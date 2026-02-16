// src/components/bookings/SlotPicker.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

function fmtLocalTime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

type Slot = {
  start: string;
  end: string;
  isBooked: boolean;
};

function minutesBetween(aISO: string, bISO: string) {
  return (Date.parse(bISO) - Date.parse(aISO)) / (1000 * 60);
}

function isSameISO(a: string, b: string) {
  return a === b;
}

export default function SlotPicker({
  roomId,
  slots,
  slotMinutes,
  maxConsecutive,
  maxDurationHours,
  onBooked,
}: {
  roomId: number;
  slots: Slot[];
  slotMinutes: number; // ✅ from settings.slot_minutes
  maxConsecutive: number; // ✅ from settings.max_consecutive_hours
  maxDurationHours: number; // ✅ from settings.max_booking_duration_hours (UI hint)
  onBooked?: () => void; // ✅ optional callback used by modal
}) {
    const router = useRouter();

  /**
   * Sort slots by time once (important for consecutive-range logic).
   */
  const sortedSlots = useMemo(() => {
    return [...slots].sort((a, b) => Date.parse(a.start) - Date.parse(b.start));
  }, [slots]);

  /**
   * Range selection:
   * - first click chooses a start slot
   * - second click chooses an end slot (must be consecutive, within limits)
   */
  const [rangeStart, setRangeStart] = useState<string | null>(null);
  const [rangeEnd, setRangeEnd] = useState<string | null>(null);

  // Purpose field (server stores it; your API already validates rules)
  const [purpose, setPurpose] = useState("");

  // UX state
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  /**
   * Hydration safety:
   * Server-rendered times can mismatch client timezone formatting.
   * We render "—" until mounted, then format times locally.
   */
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  /**
   * Map slot.start -> slot, so we can quickly verify consecutive ranges.
   * Includes booked slots too (so we can reject ranges that cross booked gaps).
   */
  const slotByStart = useMemo(() => {
    const m = new Map<string, Slot>();
    for (const s of sortedSlots) m.set(s.start, s);
    return m;
  }, [sortedSlots]);

  /**
   * Settings-derived limits used by the UI.
   * - max selectable slots is limited by BOTH:
   *   1) maxConsecutive (settings.max_consecutive_hours)
   *   2) maxDurationHours (settings.max_booking_duration_hours)
   *
   * Why both?
   * - maxConsecutive prevents long back-to-back bookings.
   * - maxDurationHours caps a single booking request length.
   * Server enforces everything anyway; this is just a matching UI guard.
   */
  const maxSlotsByDuration = Math.floor((maxDurationHours * 60) / slotMinutes);
  const maxSelectableSlots = Math.max(1, Math.min(maxConsecutive, maxSlotsByDuration));

  /**
   * Build the selected range as a list of slots (inclusive endpoints).
   * Must be:
   * - 1..maxSelectableSlots slots
   * - all available
   * - strictly consecutive by slotMinutes
   */
  const selectedSlots = useMemo(() => {
    if (!rangeStart) return [];

    const start = rangeStart;
    const end = rangeEnd ?? rangeStart;

    // Ensure chronological order (support selecting end before start)
    const startISO = Date.parse(start) <= Date.parse(end) ? start : end;
    const endISO = Date.parse(start) <= Date.parse(end) ? end : start;

    const startIdx = sortedSlots.findIndex((s) => s.start === startISO);
    const endIdx = sortedSlots.findIndex((s) => s.start === endISO);
    if (startIdx < 0 || endIdx < 0) return [];

    const slice = sortedSlots.slice(startIdx, endIdx + 1);

    // Must be within configured max selection length
    if (slice.length < 1 || slice.length > maxSelectableSlots) return [];

    // Must be available + consecutive
    for (let i = 0; i < slice.length; i++) {
      if (slice[i].isBooked) return [];
      if (i > 0) {
        const diff = minutesBetween(slice[i - 1].start, slice[i].start);
        if (diff !== slotMinutes) return [];
      }
    }

    return slice;
  }, [rangeStart, rangeEnd, sortedSlots, slotMinutes, maxSelectableSlots]);

  /**
   * Convert selectedSlots to booking start/end for the API.
   * End time should be the end of the last slot.
   */
  const bookingRange = useMemo(() => {
    if (selectedSlots.length === 0) return null;
    const first = selectedSlots[0];
    const last = selectedSlots[selectedSlots.length - 1];
    return { start: first.start, end: last.end, slots: selectedSlots.length };
  }, [selectedSlots]);

  /**
   * During selection: determine whether a candidate slot can be chosen
   * as the range end such that the range:
   * - stays <= maxSelectableSlots
   * - stays consecutive in slotMinutes steps
   * - does not include booked gaps
   */
  function canSelectAsEnd(candidateStart: string) {
    if (!rangeStart) return true;

    const a = Date.parse(rangeStart);
    const b = Date.parse(candidateStart);

    const from = Math.min(a, b);
    const to = Math.max(a, b);

    // Generate the slot starts that would be included in the range.
    const neededStarts: string[] = [];
    for (let t = from; t <= to; t += slotMinutes * 60 * 1000) {
      neededStarts.push(new Date(t).toISOString());
    }

    // Range too long
    if (neededStarts.length > maxSelectableSlots) return false;

    // Every start must exist and be available
    for (const sISO of neededStarts) {
      const s = slotByStart.get(sISO);
      if (!s) return false;
      if (s.isBooked) return false;
    }

    return true;
  }

  function handleSlotClick(s: Slot) {
    if (submitting) return;
    if (s.isBooked) return;

    setErrorMsg(null);
    setSuccessMsg(null);

    // First click chooses start
    if (!rangeStart) {
      setRangeStart(s.start);
      setRangeEnd(null);
      return;
    }

    // Clicking start again resets
    if (isSameISO(rangeStart, s.start)) {
      setRangeStart(null);
      setRangeEnd(null);
      return;
    }

    // Second click chooses end if valid
    if (!canSelectAsEnd(s.start)) {
      setErrorMsg(
        `Select up to ${maxSelectableSlots} consecutive slot(s) with no gaps.`,
      );
      return;
    }

    setRangeEnd(s.start);
  }

  // Confirm only when bookingRange exists + purpose is minimally valid
  const canConfirm =
    Boolean(bookingRange) && purpose.trim().length >= 3 && !submitting;

  async function confirmBooking() {
    if (!bookingRange) return;

    setSubmitting(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const res = await fetch("/api/bookings/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          roomId,
          start: bookingRange.start,
          end: bookingRange.end,
          purpose: purpose.trim(),
        }),
      });

      const data = (await res.json().catch(() => null)) as any;

      if (!res.ok) {
        setErrorMsg(data?.error ?? "Booking failed");
        setSubmitting(false);
        return;
      }

      setSuccessMsg("Booking confirmed.");
      setSubmitting(false);
      // If we're inside a modal, let the parent close it + clean up URL.
      onBooked?.();

      // Refresh server data so the chosen slots become unavailable immediately
      try {
        const qs = typeof window !== "undefined" ? window.location.search : "";
        router.replace(window.location.pathname + qs);
      } catch {
        // ignore
      }
      router.refresh();

      // Reset UI
      setRangeStart(null);
      setRangeEnd(null);
      setPurpose("");
    } catch {
      setErrorMsg("Network error. Please try again.");
      setSubmitting(false);
    }
  }

  function isInSelectedRange(s: Slot) {
    return selectedSlots.some((x) => x.start === s.start);
  }

  return (
    <div className="mt-6 rounded border bg-white p-4">
      <h2 className="text-sm font-semibold">Select a time slot</h2>

      <p className="mt-1 text-xs text-gray-600">
        Select up to <b>{maxSelectableSlots}</b> consecutive{" "}
        {slotMinutes}-minute slot(s).
      </p>

      {errorMsg ? (
        <div className="mt-3 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {errorMsg}
        </div>
      ) : null}

      {successMsg ? (
        <div className="mt-3 rounded border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700">
          {successMsg}
        </div>
      ) : null}

      <div className="mt-4 grid gap-2 md:grid-cols-3">
        {sortedSlots.map((s) => {
          const disabled = s.isBooked || submitting;

          const inRange = isInSelectedRange(s);
          const isStart = rangeStart === s.start;
          const isEnd = rangeEnd === s.start;

          const endSelectable = rangeStart ? canSelectAsEnd(s.start) : true;
          const trulyDisabled =
            disabled || (rangeStart ? !endSelectable && !isStart : false);

          const label = mounted
            ? `${fmtLocalTime(s.start)} – ${fmtLocalTime(s.end)}`
            : "—";

          return (
            <button
              key={s.start}
              type="button"
              disabled={trulyDisabled}
              onClick={() => handleSlotClick(s)}
              className={[
                "rounded border px-3 py-2 text-left text-sm",
                trulyDisabled
                  ? "cursor-not-allowed bg-gray-100 text-gray-500"
                  : "hover:bg-gray-50",
                inRange ? "border-black" : "",
                isStart ? "ring-1 ring-black" : "",
                isEnd ? "ring-1 ring-black" : "",
              ].join(" ")}
            >
              {label}
              <span className="ml-2 text-xs">
                {s.isBooked
                  ? "(unavailable)"
                  : inRange
                    ? "(selected)"
                    : rangeStart && !endSelectable
                      ? "(not consecutive)"
                      : "(available)"}
              </span>
            </button>
          );
        })}
      </div>

      <div className="mt-5">
        <label className="text-xs text-gray-600">Purpose</label>
        <input
          className="mt-1 w-full rounded border px-3 py-2 text-sm"
          placeholder="e.g. Group study, exam prep, project meeting"
          value={purpose}
          onChange={(e) => setPurpose(e.target.value)}
          disabled={submitting}
        />
        <p className="mt-1 text-xs text-gray-500">Minimum 3 characters.</p>
      </div>

      <div className="mt-5 flex items-center justify-between gap-3">
        <div className="text-sm">
          <span className="text-gray-600">Selected: </span>
          {bookingRange && mounted ? (
            <span className="font-medium">
              {fmtLocalTime(bookingRange.start)} – {fmtLocalTime(bookingRange.end)}{" "}
              <span className="text-gray-500">
                ({bookingRange.slots} slot{bookingRange.slots > 1 ? "s" : ""})
              </span>
            </span>
          ) : (
            <span className="text-gray-500">None</span>
          )}
        </div>

        <button
          type="button"
          disabled={!canConfirm}
          className="rounded bg-black px-3 py-2 text-sm text-white disabled:opacity-50"
          onClick={confirmBooking}
        >
          {submitting ? "Booking..." : "Confirm"}
        </button>
      </div>
    </div>
  );
}

