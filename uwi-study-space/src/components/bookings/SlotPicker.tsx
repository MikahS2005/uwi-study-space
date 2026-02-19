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
  slotMinutes: number;
  maxConsecutive: number;
  maxDurationHours: number;
  onBooked?: () => void;
}) {
  const router = useRouter();

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

  const slotByStart = useMemo(() => {
    const m = new Map<string, Slot>();
    for (const s of sortedSlots) m.set(s.start, s);
    return m;
  }, [sortedSlots]);

  const maxSlotsByDuration = Math.floor((maxDurationHours * 60) / slotMinutes);
  const maxSelectableSlots = Math.max(1, Math.min(maxConsecutive, maxSlotsByDuration));

  const selectedSlots = useMemo(() => {
    if (!rangeStart) return [];

    const start = rangeStart;
    const end = rangeEnd ?? rangeStart;

    const startISO = Date.parse(start) <= Date.parse(end) ? start : end;
    const endISO = Date.parse(start) <= Date.parse(end) ? end : start;

    const startIdx = sortedSlots.findIndex((s) => s.start === startISO);
    const endIdx = sortedSlots.findIndex((s) => s.start === endISO);
    if (startIdx < 0 || endIdx < 0) return [];

    const slice = sortedSlots.slice(startIdx, endIdx + 1);

    if (slice.length < 1 || slice.length > maxSelectableSlots) return [];

    for (let i = 0; i < slice.length; i++) {
      if (slice[i].isBooked) return [];
      if (i > 0) {
        const diff = minutesBetween(slice[i - 1].start, slice[i].start);
        if (diff !== slotMinutes) return [];
      }
    }

    return slice;
  }, [rangeStart, rangeEnd, sortedSlots, slotMinutes, maxSelectableSlots]);

  const bookingRange = useMemo(() => {
    if (selectedSlots.length === 0) return null;
    const first = selectedSlots[0];
    const last = selectedSlots[selectedSlots.length - 1];
    return { start: first.start, end: last.end, slots: selectedSlots.length };
  }, [selectedSlots]);

  function canSelectAsEnd(candidateStart: string) {
    if (!rangeStart) return true;

    const a = Date.parse(rangeStart);
    const b = Date.parse(candidateStart);

    const from = Math.min(a, b);
    const to = Math.max(a, b);

    const neededStarts: string[] = [];
    for (let t = from; t <= to; t += slotMinutes * 60 * 1000) {
      neededStarts.push(new Date(t).toISOString());
    }

    if (neededStarts.length > maxSelectableSlots) return false;

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

    if (!rangeStart) {
      setRangeStart(s.start);
      setRangeEnd(null);
      return;
    }

    if (isSameISO(rangeStart, s.start)) {
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

  function isInSelectedRange(s: Slot) {
    return selectedSlots.some((x) => x.start === s.start);
  }

  return (
    <div className="mt-4 rounded border bg-white p-4">
      {/* 1. Header Text - Darker */}
      <h2 className="text-sm font-bold text-black">Select a time slot</h2>
      <p className="mt-1 text-xs font-medium text-gray-700">
        Select up to <b className="text-black">{maxSelectableSlots}</b> consecutive{" "}
        {slotMinutes}-minute slot(s).
      </p>

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

      {/* 2. Slot Grid */}
      <div className="mt-4 grid gap-2 md:grid-cols-3">
        {sortedSlots.map((s) => {
          const disabled = s.isBooked || submitting;
          const inRange = isInSelectedRange(s);
          const isStart = rangeStart === s.start;
          const isEnd = rangeEnd === s.start;
          const endSelectable = rangeStart ? canSelectAsEnd(s.start) : true;
          const trulyDisabled = disabled || (rangeStart ? !endSelectable && !isStart : false);

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
                "rounded border px-3 py-2 text-left text-sm transition-colors",
                // Base font weight and color for readability
                "font-medium",
                trulyDisabled
                  ? "cursor-not-allowed bg-gray-50 text-gray-400 border-gray-100" // Disabled look
                  : "text-gray-900 border-gray-200 hover:border-gray-400 hover:bg-gray-50", // Enabled look (Dark Text)
                inRange ? "!border-black bg-gray-50 ring-1 ring-black" : "", // Selected overrides
              ].join(" ")}
            >
              {label}
              <span className={`ml-2 text-xs font-normal block ${trulyDisabled ? "text-gray-400" : "text-gray-600"}`}>
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

      {/* 3. Purpose Input - Darker Labels */}
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

      {/* 4. Footer Actions */}
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
      </div>
    </div>
  );
}