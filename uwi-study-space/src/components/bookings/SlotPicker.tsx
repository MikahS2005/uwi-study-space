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
  const [members, setMembers] = useState([{ firstName: "", lastName: "", studentId: "" }]);

  const addMember = () => setMembers([...members, { firstName: "", lastName: "", studentId: "" }]);
  const updateMember = (index: number, field: "firstName" | "lastName" | "studentId", value: string) => {
    const newMembers = [...members];
    newMembers[index][field] = value;
    setMembers(newMembers);
  };
  const removeMember = (index: number) => setMembers(members.filter((_, i) => i !== index));

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
      if (i > 0 && minutesBetween(slice[i - 1].start, slice[i].start) !== slotMinutes) return [];
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
      if (!s || s.isBooked) return false;
    }
    return true;
  }

  function handleSlotClick(s: Slot) {
    if (submitting || s.isBooked) return;
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
    try {
      const res = await fetch("/api/bookings/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roomId, start: bookingRange.start, end: bookingRange.end, purpose: purpose.trim() }),
      });
      if (!res.ok) throw new Error();
      setSuccessMsg("Booking confirmed.");
      onBooked?.();
      router.refresh();
      setRangeStart(null); setRangeEnd(null); setPurpose("");
    } catch {
      setErrorMsg("Network error. Please try again.");
    } finally {
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
            Select up to <b>{maxSelectableSlots}</b> consecutive {slotMinutes}-minute slot(s).
          </p>
        </div>

        {errorMsg && <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{errorMsg}</div>}
        {successMsg && <div className="rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700">{successMsg}</div>}

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 max-h-[250px] overflow-y-auto p-1 custom-scrollbar">
          {sortedSlots.map((s) => {
            const isBooked = s.isBooked || submitting;
            const inRange = isInSelectedRange(s);
            const canBeSelected = !isBooked && (rangeStart ? canSelectAsEnd(s.start) : true);
            const isButtonDisabled = Boolean(isBooked || (rangeStart && !canBeSelected && !inRange));
            
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
                  // GREYED OUT / DISABLED
                  isButtonDisabled && !inRange 
                    ? "bg-gray-50 text-gray-300 border-gray-100 cursor-not-allowed opacity-60" 
                    : "",
                  // AVAILABLE
                  !isButtonDisabled && !inRange 
                    ? "bg-[#EAF6FF] text-[#003595] border-[#EAF6FF] hover:border-[#003595] hover:bg-white shadow-sm" 
                    : "",
                  // SELECTED
                  inRange 
                    ? "bg-[#003595] text-white border-[#003595] shadow-md scale-[0.98] font-bold" 
                    : ""
                ].join(" ")}
              >
                <div className={`text-[13px] leading-tight ${inRange ? "text-white" : isButtonDisabled ? "text-gray-300" : "text-[#1F2937]"}`}>
                  {startLabel}
                  <span className="block text-[10px] opacity-60">to {endLabel}</span>
                </div>
                <div className={`mt-1 text-[9px] uppercase font-bold tracking-wider ${inRange ? "text-white/80" : isButtonDisabled ? "text-gray-300" : "text-[#003595]/60"}`}>
                  {inRange ? "Selected" : isBooked ? "Booked" : "Available"}
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
                />
                <input
                  className="flex-1 min-w-0 rounded-lg border border-[#E5E7EB] px-3 py-2 text-sm text-[#1F2937] outline-none focus:ring-2 focus:ring-[#003595]/10"
                  placeholder="Last Name"
                  value={member.lastName}
                  onChange={(e) => updateMember(index, "lastName", e.target.value)}
                />
                <input
                  className="w-20 md:w-32 rounded-lg border border-[#E5E7EB] px-3 py-2 text-sm text-[#1F2937] outline-none focus:ring-2 focus:ring-[#003595]/10"
                  placeholder="ID"
                  value={member.studentId}
                  onChange={(e) => updateMember(index, "studentId", e.target.value)}
                />
                <button type="button" onClick={() => removeMember(index)} className="text-gray-400 hover:text-red-500 p-1">✕</button>
              </div>
            ))}
          </div>
          <button type="button" onClick={addMember} className="mt-3 text-sm font-bold text-[#003595] hover:underline">+ Add person</button>
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
      <div className="border-t border-[#E5E7EB] pt-6 flex items-center justify-between bg-white">
        <div className="text-sm">
          <span className="text-[#1F2937] opacity-60 font-medium">Selected: </span>
          {mounted && bookingRange ? (
            <span className="font-bold text-[#003595]">{fmtLocalTime(bookingRange.start)} – {fmtLocalTime(bookingRange.end)}</span>
          ) : (
            <span className="text-gray-400 italic text-xs">Pick a slot</span>
          )}
        </div>
        <button
          type="button"
          disabled={!canConfirm}
          className="rounded-xl bg-[#003595] px-8 py-3 text-sm font-bold text-white shadow-lg shadow-[#003595]/20 disabled:opacity-30 disabled:shadow-none hover:bg-[#002366] transition-all"
          onClick={confirmBooking}
        >
          {submitting ? "Booking..." : "Confirm"}
        </button>
      </div>
    </div>
  );
}