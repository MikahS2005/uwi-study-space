// src/components/bookings/MyBookingsMonthCalendar.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

type BookingRow = {
  id: number;
  start_time: string;
  end_time: string;
  status: string;
  purpose: string | null;
  rooms: { id: number; name: string; building: string; floor: string | null } | null;
};

function ymd(iso: string) {
  return iso.slice(0, 10);
}

function fmtLocalTime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

/**
 * Build a YYYY-MM string from a Date in UTC-safe way.
 */
function toMonthKey(d: Date) {
  return d.toISOString().slice(0, 7);
}

/**
 * Parse "YYYY-MM" into a Date at UTC midnight of first day.
 * Avoids timezone drift issues when building the grid.
 */
function monthKeyToUTCDate(monthKey: string) {
  // monthKey: "2026-02"
  const [y, m] = monthKey.split("-").map(Number);
  return new Date(Date.UTC(y, (m ?? 1) - 1, 1, 0, 0, 0));
}

function addMonths(monthKey: string, delta: number) {
  const d = monthKeyToUTCDate(monthKey);
  d.setUTCMonth(d.getUTCMonth() + delta);
  return toMonthKey(d);
}

/**
 * Calendar grid builder:
 * - returns an array of day objects covering the whole month grid
 * - includes leading/trailing days to fill weeks
 */
function buildMonthGrid(monthKey: string) {
  const first = monthKeyToUTCDate(monthKey);

  const year = first.getUTCFullYear();
  const month = first.getUTCMonth(); // 0-11

  const monthStart = new Date(Date.UTC(year, month, 1));
  const monthEnd = new Date(Date.UTC(year, month + 1, 0)); // last day of month

  // Weekday: 0=Sun .. 6=Sat
  const startWeekday = monthStart.getUTCDay();

  // grid starts on Sunday before/at monthStart
  const gridStart = new Date(monthStart);
  gridStart.setUTCDate(monthStart.getUTCDate() - startWeekday);

  // grid ends on Saturday after/at monthEnd
  const endWeekday = monthEnd.getUTCDay();
  const daysToAdd = 6 - endWeekday;
  const gridEnd = new Date(monthEnd);
  gridEnd.setUTCDate(monthEnd.getUTCDate() + daysToAdd);

  const days: { dateKey: string; inMonth: boolean; utcDate: Date }[] = [];
  const cursor = new Date(gridStart);

  while (cursor <= gridEnd) {
    const dateKey = cursor.toISOString().slice(0, 10);
    const inMonth = cursor.getUTCMonth() === month;
    days.push({ dateKey, inMonth, utcDate: new Date(cursor) });
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  // Weeks = days.length / 7
  return days;
}

export default function MyBookingsMonthCalendar(props: {
  initialMonth: string; // "YYYY-MM" from server (prevents hydration mismatch)
  bookings: BookingRow[];
}) {
  // Month displayed (do NOT use new Date() here to avoid SSR/client mismatch)
  const [monthKey, setMonthKey] = useState(props.initialMonth);

  // Selected day within the month grid for the lower details panel
  const [selectedDay, setSelectedDay] = useState<string | null>(null);

  // Hydration-safe time formatting
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  // Group bookings by YYYY-MM-DD
  const byDay = useMemo(() => {
    const m = new Map<string, BookingRow[]>();
    for (const b of props.bookings) {
      const k = ymd(b.start_time);
      if (!m.has(k)) m.set(k, []);
      m.get(k)!.push(b);
    }
    // Ensure consistent ordering
    for (const [k, arr] of m.entries()) {
      arr.sort((a, b) => Date.parse(a.start_time) - Date.parse(b.start_time));
      m.set(k, arr);
    }
    return m;
  }, [props.bookings]);

  const gridDays = useMemo(() => buildMonthGrid(monthKey), [monthKey]);

  const monthLabel = useMemo(() => {
    const d = monthKeyToUTCDate(monthKey);
    return d.toLocaleString([], { month: "long", year: "numeric" });
  }, [monthKey]);

  // Default select: first day in the month that has bookings, else null
  useEffect(() => {
    const daysInThisMonth = gridDays.filter((d) => d.inMonth).map((d) => d.dateKey);
    const firstWithBooking = daysInThisMonth.find((k) => (byDay.get(k)?.length ?? 0) > 0) ?? null;
    setSelectedDay(firstWithBooking);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [monthKey]);

  const selectedBookings = selectedDay ? byDay.get(selectedDay) ?? [] : [];

  return (
    <div className="mt-6 space-y-4">
      {/* Calendar Card */}
      <div className="rounded-2xl border bg-white p-5 shadow-sm">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-gray-900">{monthLabel}</h2>
            <p className="mt-1 text-xs text-gray-600">
              Click a day to view bookings. (Showing upcoming window you fetched.)
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setMonthKey((m) => addMonths(m, -1))}
              className="rounded-lg border bg-white px-3 py-2 text-sm hover:bg-gray-50"
            >
              Prev
            </button>
            <button
              type="button"
              onClick={() => setMonthKey((m) => addMonths(m, 1))}
              className="rounded-lg border bg-white px-3 py-2 text-sm hover:bg-gray-50"
            >
              Next
            </button>
          </div>
        </div>

        {/* Weekday labels */}
        <div className="mt-4 grid grid-cols-7 gap-2 text-xs font-medium text-gray-500">
          {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((w) => (
            <div key={w} className="px-1">
              {w}
            </div>
          ))}
        </div>

        {/* Grid */}
        <div className="mt-2 grid grid-cols-7 gap-2">
          {gridDays.map((d) => {
            const dayNum = d.utcDate.getUTCDate();
            const count = byDay.get(d.dateKey)?.length ?? 0;
            const isSelected = selectedDay === d.dateKey;

            return (
              <button
                key={d.dateKey}
                type="button"
                onClick={() => setSelectedDay(d.dateKey)}
                className={[
                  "min-h-[84px] rounded-xl border p-2 text-left transition",
                  d.inMonth ? "bg-white" : "bg-gray-50 text-gray-400",
                  isSelected ? "ring-2 ring-blue-600" : "hover:bg-gray-50",
                ].join(" ")}
              >
                <div className="flex items-start justify-between">
                  <div className="text-sm font-semibold">{dayNum}</div>

                  {count > 0 ? (
                    <span className="rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700 ring-1 ring-blue-200">
                      {count}
                    </span>
                  ) : null}
                </div>

                {/* Tiny status dots (optional structure; UI team can redesign) */}
                {count > 0 ? (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {(byDay.get(d.dateKey) ?? []).slice(0, 6).map((b) => (
                      <span
                        key={b.id}
                        className={[
                          "h-2 w-2 rounded-full",
                          b.status === "active"
                            ? "bg-green-500"
                            : b.status === "cancelled"
                              ? "bg-gray-400"
                              : b.status === "completed"
                                ? "bg-blue-500"
                                : b.status === "no_show"
                                  ? "bg-red-500"
                                  : "bg-neutral-400",
                        ].join(" ")}
                        aria-label={b.status}
                        title={b.status}
                      />
                    ))}
                  </div>
                ) : null}
              </button>
            );
          })}
        </div>
      </div>

      {/* Selected Day Details Card */}
      <div className="rounded-2xl border bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-base font-semibold text-gray-900">
              {selectedDay ? `Bookings for ${selectedDay}` : "Select a day"}
            </h3>
            <p className="mt-1 text-xs text-gray-600">
              Click a booking day above to see details here.
            </p>
          </div>

          {/* Convenience: jump to rooms page with date prefilled */}
          {selectedDay ? (
            <Link
              href={`/rooms?date=${encodeURIComponent(selectedDay)}`}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
            >
              Book a room on this day
            </Link>
          ) : null}
        </div>

        <div className="mt-4 grid gap-3">
          {selectedDay && selectedBookings.length === 0 ? (
            <div className="rounded-xl border bg-white p-4 text-sm text-gray-600">
              No bookings for this day.
            </div>
          ) : null}

          {selectedBookings.map((b) => {
            const room = b.rooms
              ? `${b.rooms.name} • ${b.rooms.building}${b.rooms.floor ? ` • Floor ${b.rooms.floor}` : ""}`
              : "Room";

            const timeLabel = mounted
              ? `${fmtLocalTime(b.start_time)}–${fmtLocalTime(b.end_time)}`
              : "—";

            return (
              <div key={b.id} className="rounded-2xl border bg-white p-4 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <div className="text-sm font-semibold text-gray-900">{room}</div>
                    <div className="mt-1 text-sm text-gray-700">{timeLabel}</div>
                    <div className="mt-1 text-xs text-gray-500">
                      Purpose: {b.purpose?.trim() ? b.purpose : "—"}
                    </div>
                  </div>

                  <span className="rounded-full bg-gray-50 px-3 py-1 text-xs font-medium text-gray-700 ring-1 ring-gray-200">
                    {b.status}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
