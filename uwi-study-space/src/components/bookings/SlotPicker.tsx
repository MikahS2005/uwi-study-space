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

  // New props (preferred)
  bufferMinutes,
  maxConsecutiveHours,
  maxBookingDurationHours,

  // Back-compat (older props some callers may still send)
  maxConsecutive,
  maxDurationHours,

  onBooked,
}: {
  roomId: number;
  slots: Slot[];
  slotMinutes: number;

  // Preferred naming
  bufferMinutes?: number;
  maxConsecutiveHours?: number;
  maxBookingDurationHours?: number;

  // Back-compat naming
  maxConsecutive?: number; // (legacy) already in slots, not hours
  maxDurationHours?: number; // (legacy)

  onBooked?: () => void;
}) {
  const router = useRouter();

  // ---------
  // Normalize numeric props (prevents NaN anywhere)
  // ---------
  const safeSlotMinutes = Number.isFinite(slotMinutes) && slotMinutes > 0 ? slotMinutes : 60;
  const safeBufferMinutes =
    Number.isFinite(bufferMinutes) && (bufferMinutes as number) >= 0 ? (bufferMinutes as number) : 0;

  // Prefer new hours props, fall back to legacy hours prop
  const rawMaxConsecutiveHours = Number.isFinite(maxConsecutiveHours)
    ? (maxConsecutiveHours as number)
    : undefined;

  const rawMaxBookingDurationHours = Number.isFinite(maxBookingDurationHours)
    ? (maxBookingDurationHours as number)
    : Number.isFinite(maxDurationHours)
      ? (maxDurationHours as number)
      : undefined;

  const safeMaxConsecutiveHours =
    Number.isFinite(rawMaxConsecutiveHours) && (rawMaxConsecutiveHours as number) > 0
      ? (rawMaxConsecutiveHours as number)
      : 1;

  const safeMaxBookingDurationHours =
    Number.isFinite(rawMaxBookingDurationHours) && (rawMaxBookingDurationHours as number) > 0
      ? (rawMaxBookingDurationHours as number)
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

  // Party members (kept from Isabella UI)
  const [members, setMembers] = useState([{ firstName: "", lastName: "", studentId: "" }]);
  const addMember = () => setMembers([...members, { firstName: "", lastName: "", studentId: "" }]);
  const updateMember = (index: number, field: "firstName" | "lastName" | "studentId", value: string) => {
    const newMembers = [...members];
    newMembers[index][field] = value;
    setMembers(newMembers);
  };
  const removeMember = (index: number) => setMembers(members.filter((_, i) => i !== index));

  // Waitlist behavior (from main)
  const [showWaitlistCta, setShowWaitlistCta] = useState(false);
  const [waitlistJoined, setWaitlistJoined] = useState(false);

  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  // ✅ Key change: index by milliseconds, not ISO strings
  const slotByStartMs = useMemo(() => {
    const m = new Map<number, Slot>();
    for (const s of sortedSlots) {
      const ms = Date.parse(s.start);
      if (!Number.isNaN(ms)) m.set(ms, s);
    }
    return m;
  }, [sortedSlots]);

  // Convert hours -> slots (new logic)
  const maxConsecutiveSlots = useMemo(() => {
    return Math.max(1, Math.floor((safeMaxConsecutiveHours * 60) / safeSlotMinutes));
  }, [safeMaxConsecutiveHours, safeSlotMinutes]);

  const maxDurationSlots = useMemo(() => {
    return Math.max(1, Math.floor((safeMaxBookingDurationHours * 60) / safeSlotMinutes));
  }, [safeMaxBookingDurationHours, safeSlotMinutes]);

  // If legacy `maxConsecutive` exists (already slots), allow it to further constrain selection.
  const legacyMaxConsecutiveSlots = useMemo(() => {
    return Number.isFinite(maxConsecutive) && (maxConsecutive as number) > 0 ? (maxConsecutive as number) : null;
  }, [maxConsecutive]);

  const maxSelectableSlots = useMemo(() => {
    const byHours = Math.min(maxConsecutiveSlots, maxDurationSlots);
    return legacyMaxConsecutiveSlots ? Math.min(byHours, legacyMaxConsecutiveSlots) : byHours;
  }, [maxConsecutiveSlots, maxDurationSlots, legacyMaxConsecutiveSlots]);

  const selectedSlots = useMemo(() => {
    if (!rangeStart) return [];
    const start = rangeStart;
    const end = rangeEnd ?? rangeStart;

    const startMs = Date.parse(start);
    const endMs = Date.parse(end);
    if (Number.isNaN(startMs) || Number.isNaN(endMs)) return [];

    const from = Math.min(startMs, endMs);
    const to = Math.max(startMs, endMs);

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
    const count = Math.floor((to - from) / step) + 1;
    if (count > maxSelectableSlots) return false;

    for (let t = from; t <= to; t += step) {
      const s = slotByStartMs.get(t);
      if (!s) return false;
      if (s.isBooked) return false;
    }

    return true;
  }

  function handleSlotClick(s: Slot) {
    if (submitting || s.isBooked) return;

    setErrorMsg(null);
    setSuccessMsg(null);
    setShowWaitlistCta(false);
    setWaitlistJoined(false);

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

          // include members (API can ignore if not used yet)
          members: members
            .map((m) => ({
              firstName: m.firstName.trim(),
              lastName: m.lastName.trim(),
              studentId: m.studentId.trim(),
            }))
            .filter((m) => m.firstName || m.lastName || m.studentId),
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

      // reset selection
      setRangeStart(null);
      setRangeEnd(null);
      setPurpose("");

      router.refresh();
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
    <div className="flex flex-col h-full font-sans">
      <div className="flex-1 overflow-y-auto min-h-0 pr-2 space-y-6 custom-scrollbar">
        <div>
          <h2 className="text-sm font-bold text-[#1F2937]">Select a time slot</h2>
          <p className="mt-1 text-xs text-[#1F2937] opacity-70">
            Select up to <b>{maxSelectableSlots}</b> consecutive {safeSlotMinutes}-minute slot(s).
          </p>

          {safeBufferMinutes > 0 ? (
            <p className="mt-1 text-xs text-[#1F2937] opacity-70">
              Buffer between bookings: <b>{safeBufferMinutes} min</b>
            </p>
          ) : null}
        </div>

        {errorMsg && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {errorMsg}
          </div>
        )}
        {successMsg && (
          <div className="rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700">
            {successMsg}
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 max-h-[250px] overflow-y-auto p-1 custom-scrollbar">
          {sortedSlots.map((s) => {
            const disabledByBooking = s.isBooked || submitting;
            const inRange = isInSelectedRange(s);

            const canBeSelected = !disabledByBooking && (rangeStart ? canSelectAsEnd(s.start) : true);
            const isButtonDisabled = Boolean(disabledByBooking || (rangeStart && !canBeSelected && !inRange));

            const startLabel = mounted ? fmtLocalTime(s.start) : "—";
            const endLabel = mounted ? fmtLocalTime(s.end) : "—";

            return (
              <button
                key={s.start}
                type="button"
                disabled={isButtonDisabled}
                onClick={() => handleSlotClick(s)}
                className={[
                  "rounded-xl border px-2 py-3 text-center transition-all duration-200",
                  // DISABLED
                  isButtonDisabled && !inRange
                    ? "bg-gray-50 text-gray-300 border-gray-100 cursor-not-allowed opacity-60"
                    : "",
                  // AVAILABLE
                  !isButtonDisabled && !inRange
                    ? "bg-[#EAF6FF] text-[#003595] border-[#EAF6FF] hover:border-[#003595] hover:bg-white shadow-sm"
                    : "",
                  // SELECTED
                  inRange ? "bg-[#003595] text-white border-[#003595] shadow-md scale-[0.98] font-bold" : "",
                ].join(" ")}
              >
                <div
                  className={`text-[13px] leading-tight ${
                    inRange ? "text-white" : isButtonDisabled ? "text-gray-300" : "text-[#1F2937]"
                  }`}
                >
                  {startLabel}
                  <span className="block text-[10px] opacity-60">to {endLabel}</span>
                </div>

                <div
                  className={`mt-1 text-[9px] uppercase font-bold tracking-wider ${
                    inRange ? "text-white/80" : isButtonDisabled ? "text-gray-300" : "text-[#003595]/60"
                  }`}
                >
                  {inRange ? "Selected" : s.isBooked ? "Booked" : "Available"}
                </div>
              </button>
            );
          })}
        </div>

        {/* PARTY MEMBERS */}
        <div className="mt-8 border-t border-[#E5E7EB] pt-6">
          <h3 className="text-sm font-bold text-[#1F2937] mb-4">Other Party Members</h3>
          <div className="space-y-3">
            {members.map((member, index) => (
              <div key={index} className="flex items-center gap-2">
                <input
                  className="flex-1 min-w-0 rounded-lg border border-[#E5E7EB] px-3 py-2 text-sm text-[#1F2937] outline-none focus:ring-2 focus:ring-[#003595]/10"
                  placeholder="First Name"
                  value={member.firstName}
                  onChange={(e) => updateMember(index, "firstName", e.target.value)}
                  disabled={submitting}
                />
                <input
                  className="flex-1 min-w-0 rounded-lg border border-[#E5E7EB] px-3 py-2 text-sm text-[#1F2937] outline-none focus:ring-2 focus:ring-[#003595]/10"
                  placeholder="Last Name"
                  value={member.lastName}
                  onChange={(e) => updateMember(index, "lastName", e.target.value)}
                  disabled={submitting}
                />
                <input
                  className="w-20 md:w-32 rounded-lg border border-[#E5E7EB] px-3 py-2 text-sm text-[#1F2937] outline-none focus:ring-2 focus:ring-[#003595]/10"
                  placeholder="ID"
                  value={member.studentId}
                  onChange={(e) => updateMember(index, "studentId", e.target.value)}
                  disabled={submitting}
                />
                <button
                  type="button"
                  onClick={() => removeMember(index)}
                  className="text-gray-400 hover:text-red-500 p-1"
                  disabled={submitting || members.length <= 1}
                  aria-label="Remove member"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={addMember}
            className="mt-3 text-sm font-bold text-[#003595] hover:underline"
            disabled={submitting}
          >
            + Add person
          </button>
        </div>

        {/* PURPOSE */}
        <div className="mt-5 pb-4">
          <label className="text-xs font-bold text-[#1F2937] uppercase tracking-wider opacity-60">Purpose</label>
          <input
            className="mt-1 w-full rounded-xl border border-[#E5E7EB] px-4 py-3 text-sm text-[#1F2937] outline-none focus:ring-2 focus:ring-[#003595]/10"
            placeholder="e.g. Group study"
            value={purpose}
            onChange={(e) => setPurpose(e.target.value)}
            disabled={submitting}
          />
        </div>
      </div>

      {/* FOOTER */}
      <div className="border-t border-[#E5E7EB] pt-6 flex items-center justify-between bg-white gap-3 flex-wrap">
        <div className="text-sm">
          <span className="text-[#1F2937] opacity-60 font-medium">Selected: </span>
          {mounted && bookingRange ? (
            <span className="font-bold text-[#003595]">
              {fmtLocalTime(bookingRange.start)} – {fmtLocalTime(bookingRange.end)}
            </span>
          ) : (
            <span className="text-gray-400 italic text-xs">Pick a slot</span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {showWaitlistCta && bookingRange ? (
            <button
              type="button"
              disabled={submitting}
              onClick={joinWaitlist}
              className="rounded-xl border border-[#003595] bg-white px-5 py-3 text-sm font-bold text-[#003595] hover:bg-[#EAF6FF] disabled:opacity-40"
            >
              {submitting ? "Joining..." : "Join Waitlist"}
            </button>
          ) : null}

          <button
            type="button"
            disabled={!canConfirm}
            className="rounded-xl bg-[#003595] px-8 py-3 text-sm font-bold text-white shadow-lg shadow-[#003595]/20 disabled:opacity-30 disabled:shadow-none hover:bg-[#002366] transition-all"
            onClick={confirmBooking}
          >
            {submitting ? "Booking..." : "Confirm Booking"}
          </button>
        </div>
      </div>

      {waitlistJoined ? (
        <div className="mt-3 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-700 font-medium">
          You’re on the waitlist for that slot.
        </div>
      ) : null}
    </div>
  );
}