// src/components/bookings/SlotPicker.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

const CAMPUS_TZ = "America/Port_of_Spain";

function fmtLocalTime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", timeZone: CAMPUS_TZ });
}

type Slot = {
  start: string;
  end: string;
  isBooked: boolean;
};

export default function SlotPicker({
  roomId,
  slots,
  slotMinutes,
  bufferMinutes,
  maxConsecutiveHours,
  maxBookingDurationHours,
  onBooked,
}: {
  roomId: number;
  slots: Slot[];
  slotMinutes: number;
  bufferMinutes: number;
  maxConsecutiveHours: number;
  maxBookingDurationHours: number;
  onBooked?: () => void;
}) {
  const router = useRouter();

  // ---------
  // Normalize numeric props (prevents NaN anywhere)
  // ---------
  const safeSlotMinutes = Number.isFinite(slotMinutes) && slotMinutes > 0 ? slotMinutes : 60;
  const safeBufferMinutes = Number.isFinite(bufferMinutes) && bufferMinutes >= 0 ? bufferMinutes : 0;

  const safeMaxConsecutiveHours =
    Number.isFinite(maxConsecutiveHours) && maxConsecutiveHours > 0 ? maxConsecutiveHours : 1;

  const safeMaxBookingDurationHours =
    Number.isFinite(maxBookingDurationHours) && maxBookingDurationHours > 0
      ? maxBookingDurationHours
      : 1;

  // Sort once
  const sortedSlots = useMemo(() => {
    return [...slots].sort((a, b) => Date.parse(a.start) - Date.parse(b.start));
  }, [slots]);

  const [rangeStart, setRangeStart] = useState<string | null>(null);
  const [rangeEnd, setRangeEnd] = useState<string | null>(null);
  const [purpose, setPurpose] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

const [showWaitlistCta, setShowWaitlistCta] = useState(false);
const [waitlistJoined, setWaitlistJoined] = useState(false);

  // ✅ Key change: index by *milliseconds*, not ISO strings
  const slotByStartMs = useMemo(() => {
    const m = new Map<number, Slot>();
    for (const s of sortedSlots) {
      const ms = Date.parse(s.start);
      if (!Number.isNaN(ms)) m.set(ms, s);
    }
    return m;
  }, [sortedSlots]);

  // Convert hours -> slots
  const maxConsecutiveSlots = useMemo(() => {
    return Math.max(1, Math.floor((safeMaxConsecutiveHours * 60) / safeSlotMinutes));
  }, [safeMaxConsecutiveHours, safeSlotMinutes]);

  const maxDurationSlots = useMemo(() => {
    return Math.max(1, Math.floor((safeMaxBookingDurationHours * 60) / safeSlotMinutes));
  }, [safeMaxBookingDurationHours, safeSlotMinutes]);

  const maxSelectableSlots = useMemo(() => {
    return Math.min(maxConsecutiveSlots, maxDurationSlots);
  }, [maxConsecutiveSlots, maxDurationSlots]);

  // Build selected slice (still slice by array indices, but validate adjacency by ms)
  const selectedSlots = useMemo(() => {
    if (!rangeStart) return [];

    const start = rangeStart;
    const end = rangeEnd ?? rangeStart;

    const startMs = Date.parse(start);
    const endMs = Date.parse(end);
    if (Number.isNaN(startMs) || Number.isNaN(endMs)) return [];

    const from = Math.min(startMs, endMs);
    const to = Math.max(startMs, endMs);

    // locate indices by ms
    const startIdx = sortedSlots.findIndex((s) => Date.parse(s.start) === from);
    const endIdx = sortedSlots.findIndex((s) => Date.parse(s.start) === to);
    if (startIdx < 0 || endIdx < 0) return [];

    const slice = sortedSlots.slice(Math.min(startIdx, endIdx), Math.max(startIdx, endIdx) + 1);

    if (slice.length < 1 || slice.length > maxSelectableSlots) return [];

    // validate: no booked, and strictly consecutive in steps of slotMinutes
    const step = safeSlotMinutes * 60 * 1000;

    for (let i = 0; i < slice.length; i++) {
      if (slice[i].isBooked) return [];
      if (i > 0) {
        const prevMs = Date.parse(slice[i - 1].start);
        const curMs = Date.parse(slice[i].start);
        if (curMs - prevMs !== step) return [];
      }
    }

    return slice;
  }, [rangeStart, rangeEnd, sortedSlots, safeSlotMinutes, maxSelectableSlots]);

  const bookingRange = useMemo(() => {
    if (selectedSlots.length === 0) return null;
    const first = selectedSlots[0];
    const last = selectedSlots[selectedSlots.length - 1];
    return { start: first.start, end: last.end, slots: selectedSlots.length };
  }, [selectedSlots]);

  // ✅ Key change: candidate end check uses ms steps, looks up slots by ms
  function canSelectAsEnd(candidateStartISO: string) {
    if (!rangeStart) return true;

    const a = Date.parse(rangeStart);
    const b = Date.parse(candidateStartISO);
    if (Number.isNaN(a) || Number.isNaN(b)) return false;

    const from = Math.min(a, b);
    const to = Math.max(a, b);

    const step = safeSlotMinutes * 60 * 1000;

    // how many slots would be included?
    const count = Math.floor((to - from) / step) + 1;
    if (count > maxSelectableSlots) return false;

    // verify every slot exists and is available
    for (let t = from; t <= to; t += step) {
      const s = slotByStartMs.get(t);
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

    if (!rangeStart) {
      setRangeStart(s.start);
      setRangeEnd(null);
      return;
    }

    if (rangeStart === s.start) {
      setRangeStart(null);
      setRangeEnd(null);
      return;
    }

    if (!canSelectAsEnd(s.start)) {
      setErrorMsg(`Select up to ${maxSelectableSlots} consecutive slot(s) with no gaps.`);
      return;
    }

    setRangeEnd(s.start);
  }

  const canConfirm = Boolean(bookingRange) && purpose.trim().length >= 3 && !submitting;

  async function confirmBooking() {
  if (!bookingRange) return;

  setSubmitting(true);
  setErrorMsg(null);
  setSuccessMsg(null);
  setShowWaitlistCta(false);
  setWaitlistJoined(false);

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

    // ✅ Special: booked conflict => show waitlist CTA
    if (res.status === 409 && data?.code === "ROOM_BOOKED" && data?.canWaitlist) {
      setErrorMsg(data?.message ?? "That room is already booked for this time.");
      setShowWaitlistCta(true);
      setSubmitting(false);
      return;
    }

    if (!res.ok) {
      setErrorMsg(data?.error ?? "Booking failed");
      setSubmitting(false);
      return;
    }

    setSuccessMsg("Booking confirmed.");
    setSubmitting(false);
    onBooked?.();

    try {
      const qs = typeof window !== "undefined" ? window.location.search : "";
      router.replace(window.location.pathname + qs);
    } catch {}

    router.refresh();

    setRangeStart(null);
    setRangeEnd(null);
    setPurpose("");
  } catch {
    setErrorMsg("Network error. Please try again.");
    setSubmitting(false);
  }
}

async function joinWaitlist() {
  if (!bookingRange) return;

  setSubmitting(true);
  setErrorMsg(null);

  try {
    const res = await fetch("/api/waitlist/join", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        roomId,
        start: bookingRange.start,
        end: bookingRange.end,
      }),
    });

    const data = (await res.json().catch(() => null)) as any;

    if (!res.ok) {
      setErrorMsg(data?.error ?? "Failed to join waitlist");
      setSubmitting(false);
      return;
    }

    setWaitlistJoined(true);
    setShowWaitlistCta(false);
    setSubmitting(false);
    setSuccessMsg("Joined waitlist. Watch your offers for an expiry timer.");
    router.refresh();
  } catch {
    setErrorMsg("Network error. Please try again.");
    setSubmitting(false);
  }
}

  function isInSelectedRange(s: Slot) {
    return selectedSlots.some((x) => x.start === s.start);
  }

  return (
    <div className="mt-4 rounded border bg-white p-4">
      <h2 className="text-sm font-bold text-black">Select a time slot</h2>

      <p className="mt-1 text-xs font-medium text-gray-700">
        Select up to <b className="text-black">{String(maxSelectableSlots)}</b> consecutive{" "}
        {safeSlotMinutes}-minute slot(s).
      </p>

      {safeBufferMinutes > 0 ? (
        <p className="mt-1 text-xs font-medium text-gray-600">
          Buffer between bookings: <b className="text-black">{safeBufferMinutes} min</b>
        </p>
      ) : null}

      {/* Messages */}
      {errorMsg && (
        <div className="mt-3 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 font-medium">
          {errorMsg}
        </div>
      )}
      {successMsg && (
        <div className="mt-3 rounded border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700 font-medium">
          {successMsg}
        </div>
      )}

      {/* Slots */}
      <div className="mt-4 grid gap-2 md:grid-cols-3">
        {sortedSlots.map((s) => {
          const disabled = s.isBooked || submitting;
          const inRange = isInSelectedRange(s);
          const isStart = rangeStart === s.start;
          const endSelectable = rangeStart ? canSelectAsEnd(s.start) : true;
          const trulyDisabled = disabled || (rangeStart ? !endSelectable && !isStart : false);

          const label = mounted ? `${fmtLocalTime(s.start)} – ${fmtLocalTime(s.end)}` : "—";

          return (
            <button
              key={s.start}
              type="button"
              disabled={trulyDisabled}
              onClick={() => handleSlotClick(s)}
              className={[
                "rounded border px-3 py-2 text-left text-sm transition-colors",
                "font-medium",
                trulyDisabled
                  ? "cursor-not-allowed bg-gray-50 text-gray-400 border-gray-100"
                  : "text-gray-900 border-gray-200 hover:border-gray-400 hover:bg-gray-50",
                inRange ? "!border-black bg-gray-50 ring-1 ring-black" : "",
              ].join(" ")}
            >
              {label}
              <span
                className={[
                  "ml-2 text-xs font-normal block",
                  trulyDisabled ? "text-gray-400" : "text-gray-600",
                ].join(" ")}
              >
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

      {/* Purpose */}
      <div className="mt-6">
        <label className="text-sm font-bold text-black">Purpose</label>
        <input
          className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm font-medium text-gray-900 placeholder:text-gray-400 focus:border-black focus:ring-1 focus:ring-black"
          placeholder="e.g. Group study, exam prep, project meeting"
          value={purpose}
          onChange={(e) => setPurpose(e.target.value)}
          disabled={submitting}
        />
        <p className="mt-1 text-xs text-gray-500 font-medium">Minimum 3 characters.</p>
      </div>

      {/* Footer */}
      <div className="mt-6 flex items-center justify-between gap-3 border-t pt-4">
        <div className="text-sm">
          <span className="font-medium text-gray-700">Selected: </span>
          {bookingRange && mounted ? (
            <span className="font-bold text-black">
              {fmtLocalTime(bookingRange.start)} – {fmtLocalTime(bookingRange.end)}{" "}
              <span className="font-normal text-gray-500">
                ({bookingRange.slots} slot{bookingRange.slots > 1 ? "s" : ""})
              </span>
            </span>
          ) : (
            <span className="text-gray-400 italic">None</span>
          )}
        </div>

        <button
          type="button"
          disabled={!canConfirm}
          className="rounded bg-black px-4 py-2 text-sm font-bold text-white transition hover:bg-gray-800 disabled:bg-gray-200 disabled:text-gray-400"
          onClick={confirmBooking}
        >
          {submitting ? "Booking..." : "Confirm Booking"}
        </button>

        {showWaitlistCta && bookingRange ? (
        <button
          type="button"
          disabled={submitting}
          onClick={joinWaitlist}
          className="rounded border border-black bg-white px-4 py-2 text-sm font-bold text-black transition hover:bg-gray-50 disabled:bg-gray-100 disabled:text-gray-400"
        >
          {submitting ? "Joining..." : "Join Waitlist"}
        </button>
      ) : null}

      {waitlistJoined ? (
        <div className="mt-3 rounded border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-700 font-medium">
          You’re on the waitlist for that slot.
        </div>
      ) : null}
      </div>
    </div>
  );
}