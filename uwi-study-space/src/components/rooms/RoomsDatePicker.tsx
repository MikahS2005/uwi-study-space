// src/components/rooms/RoomsDatePicker.tsx
"use client";

/**
 * RoomsDatePicker
 * - Controls the `?date=YYYY-MM-DD` query param on /rooms.
 * - Keeps other filters intact.
 * - Does NOT keep bookRoomId (so changing date doesn't auto-open a modal).
 *
 * NOTE:
 * We constrain the max date using `maxDaysAhead` from settings, passed in from server.
 */

import { useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";

function todayISODate() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function addDaysYMD(baseYMD: string, days: number) {
  const d = new Date(`${baseYMD}T00:00:00`);
  d.setDate(d.getDate() + days);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export default function RoomsDatePicker(props: { maxDaysAhead: number }) {
  const router = useRouter();
  const sp = useSearchParams();

  const today = todayISODate();

  // Current date from URL (fallback today)
  const selectedDate =
    sp.get("date") && /^\d{4}-\d{2}-\d{2}$/.test(sp.get("date") as string)
      ? (sp.get("date") as string)
      : today;

  // Clamp the max date to today + maxDaysAhead
  const maxDate = useMemo(() => addDaysYMD(today, props.maxDaysAhead), [today, props.maxDaysAhead]);

  function setDate(nextDate: string) {
    const next = new URLSearchParams(sp.toString());

    // Always set date
    next.set("date", nextDate);

    // Changing date should not keep an open modal target
    next.delete("bookRoomId");

    const qs = next.toString();
    router.push(`/rooms${qs ? `?${qs}` : ""}`);
  }

  return (
    <div className="mt-4 rounded border bg-white p-4">
      <label className="text-xs text-neutral-600">Booking date</label>
      <div className="mt-1 flex items-center gap-2">
        <input
          type="date"
          className="rounded border px-3 py-2 text-sm"
          value={selectedDate}
          min={today}
          max={maxDate}
          onChange={(e) => setDate(e.target.value)}
        />
        <p className="text-xs text-neutral-500">
          Up to <b>{props.maxDaysAhead}</b> day(s) ahead.
        </p>
      </div>
    </div>
  );
}
