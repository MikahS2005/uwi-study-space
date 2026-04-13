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

// ── helpers ─────────────────────────────────────────────────────────────────
function ymd(iso: string) { return iso.slice(0, 10); }

function fmtLocalTime(iso: string) {
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function toMonthKey(d: Date) { return d.toISOString().slice(0, 7); }

function monthKeyToUTCDate(monthKey: string) {
  const [y, m] = monthKey.split("-").map(Number);
  return new Date(Date.UTC(y, (m ?? 1) - 1, 1, 0, 0, 0));
}

function addMonths(monthKey: string, delta: number) {
  const d = monthKeyToUTCDate(monthKey);
  d.setUTCMonth(d.getUTCMonth() + delta);
  return toMonthKey(d);
}

function buildMonthGrid(monthKey: string) {
  const first = monthKeyToUTCDate(monthKey);
  const year  = first.getUTCFullYear();
  const month = first.getUTCMonth();

  const monthStart   = new Date(Date.UTC(year, month, 1));
  const monthEnd     = new Date(Date.UTC(year, month + 1, 0));
  const startWeekday = monthStart.getUTCDay();

  const gridStart = new Date(monthStart);
  gridStart.setUTCDate(monthStart.getUTCDate() - startWeekday);

  const gridEnd = new Date(monthEnd);
  gridEnd.setUTCDate(monthEnd.getUTCDate() + (6 - monthEnd.getUTCDay()));

  const days: { dateKey: string; inMonth: boolean; utcDate: Date }[] = [];
  const cursor = new Date(gridStart);

  while (cursor <= gridEnd) {
    days.push({
      dateKey: cursor.toISOString().slice(0, 10),
      inMonth: cursor.getUTCMonth() === month,
      utcDate: new Date(cursor),
    });
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  return days;
}

// ── status config ────────────────────────────────────────────────────────────
const STATUS = {
  active:    { dot: "bg-emerald-500", badge: "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200", label: "Active" },
  cancelled: { dot: "bg-slate-300",   badge: "bg-slate-100 text-slate-500 ring-1 ring-slate-200",    label: "Cancelled" },
  completed: { dot: "bg-blue-600",    badge: "bg-blue-50 text-blue-700 ring-1 ring-blue-200",         label: "Completed" },
  no_show:   { dot: "bg-rose-400",    badge: "bg-rose-50 text-rose-700 ring-1 ring-rose-200",         label: "No-show" },
} as const;

type StatusKey = keyof typeof STATUS;

function getStatus(s: string) {
  return STATUS[s as StatusKey] ?? { dot: "bg-slate-400", badge: "bg-slate-100 text-slate-600 ring-1 ring-slate-200", label: s };
}

// ── icons ────────────────────────────────────────────────────────────────────
function ChevronLeft() {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
    </svg>
  );
}
function ChevronRight() {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
    </svg>
  );
}
function PlusIcon() {
  return (
    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
    </svg>
  );
}
function ClockIcon() {
  return (
    <svg className="h-3 w-3 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <circle cx="12" cy="12" r="9" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 7v5l3 3" />
    </svg>
  );
}
function CalendarEmptyIcon() {
  return (
    <svg className="h-10 w-10 text-blue-200" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
        d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
    </svg>
  );
}

// ── main component ───────────────────────────────────────────────────────────
export default function MyBookingsMonthCalendar(props: {
  initialMonth: string;
  bookings: BookingRow[];
}) {
  const [monthKey, setMonthKey]       = useState(props.initialMonth);
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [mounted, setMounted]         = useState(false);
  useEffect(() => setMounted(true), []);

  // Group bookings by date
  const byDay = useMemo(() => {
    const m = new Map<string, BookingRow[]>();
    for (const b of props.bookings) {
      const k = ymd(b.start_time);
      if (!m.has(k)) m.set(k, []);
      m.get(k)!.push(b);
    }
    for (const [k, arr] of m.entries()) {
      arr.sort((a, b) => Date.parse(a.start_time) - Date.parse(b.start_time));
      m.set(k, arr);
    }
    return m;
  }, [props.bookings]);

  const gridDays   = useMemo(() => buildMonthGrid(monthKey), [monthKey]);
  const todayKey   = useMemo(() => new Date().toISOString().slice(0, 10), []);

  const monthLabel = useMemo(() =>
    monthKeyToUTCDate(monthKey).toLocaleString([], { month: "long", year: "numeric" }),
    [monthKey],
  );

  // Auto-select first day with bookings when month changes
  useEffect(() => {
    const first = gridDays
      .filter((d) => d.inMonth)
      .map((d) => d.dateKey)
      .find((k) => (byDay.get(k)?.length ?? 0) > 0) ?? null;
    setSelectedDay(first);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [monthKey]);

  const selectedBookings = selectedDay ? (byDay.get(selectedDay) ?? []) : [];

  const selectedDayLabel = selectedDay
    ? new Date(selectedDay + "T00:00:00").toLocaleDateString([], {
        weekday: "long", month: "long", day: "numeric",
      })
    : null;

  // Summary counts for the legend
  const activeCount = props.bookings.filter(b => b.status === "active").length;

  return (
    <div className="space-y-4">

      {/* ── Calendar card ─────────────────────────────────────────────────── */}
      <div className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-100">

        {/* Header */}
        <div className="flex items-center justify-between gap-3 border-b border-slate-100 bg-gradient-to-r from-blue-900 to-blue-800 px-5 py-4">
          <div>
            <h2 className="text-base font-bold text-white">{monthLabel}</h2>
            <p className="mt-0.5 text-xs text-blue-200">
              {props.bookings.length} booking{props.bookings.length !== 1 ? "s" : ""} this window
              {activeCount > 0 && (
                <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] font-semibold text-emerald-300 ring-1 ring-emerald-400/30">
                  <span className="h-1 w-1 rounded-full bg-emerald-400" />
                  {activeCount} active
                </span>
              )}
            </p>
          </div>

          {/* Month nav */}
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setMonthKey((m) => addMonths(m, -1))}
              className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/10 text-white transition hover:bg-white/20"
              aria-label="Previous month"
            >
              <ChevronLeft />
            </button>
            <button
              type="button"
              onClick={() => setMonthKey((m) => addMonths(m, 1))}
              className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/10 text-white transition hover:bg-white/20"
              aria-label="Next month"
            >
              <ChevronRight />
            </button>
          </div>
        </div>

        {/* Weekday labels */}
        <div className="grid grid-cols-7 border-b border-blue-800/30 bg-blue-806+0">
          {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((w) => (
            <div
              key={w}
              className="py-2.5 text-center text-[11px] font-bold uppercase tracking-widest text-blue-200"
            >
              {w}
            </div>
          ))}
        </div>

        {/* Day grid */}
        <div className="grid grid-cols-7 gap-px bg-slate-100 p-px">
          {gridDays.map((d) => {
            const dayNum     = d.utcDate.getUTCDate();
            const count      = byDay.get(d.dateKey)?.length ?? 0;
            const isSelected = selectedDay === d.dateKey;
            const isToday    = d.dateKey === todayKey;
            const dots       = byDay.get(d.dateKey) ?? [];
            const isWeekend  = d.utcDate.getUTCDay() === 0 || d.utcDate.getUTCDay() === 6;

            return (
              <button
                key={d.dateKey}
                type="button"
                onClick={() => setSelectedDay(d.dateKey)}
                className={[
                  "group relative flex min-h-[80px] flex-col p-2 text-left transition-all duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500",
                  // Background
                  isSelected
                    ? "bg-blue-900"
                    : isToday
                      ? "bg-blue-50"
                      : isWeekend && d.inMonth
                        ? "bg-slate-50/80 hover:bg-slate-100"
                        : d.inMonth
                          ? "bg-white hover:bg-blue-50/40"
                          : "bg-slate-50/50",
                ].join(" ")}
              >
                {/* Day number */}
                <div className="flex items-start justify-between">
                  <span
                    className={[
                      "flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold",
                      isSelected
                        ? "bg-white/20 text-white"
                        : isToday
                          ? "bg-blue-900 text-white"
                          : d.inMonth
                            ? "text-slate-700 group-hover:text-blue-900"
                            : "text-slate-300",
                    ].join(" ")}
                  >
                    {dayNum}
                  </span>

                  {/* Booking count badge */}
                  {count > 0 && (
                    <span
                      className={[
                        "rounded-full px-1.5 py-px text-[9px] font-bold leading-tight",
                        isSelected
                          ? "bg-white/20 text-white"
                          : "bg-blue-900 text-white",
                      ].join(" ")}
                    >
                      {count}
                    </span>
                  )}
                </div>

                {/* Status dots */}
                {dots.length > 0 && (
                  <div className="mt-auto flex flex-wrap gap-0.5 pt-1">
                    {dots.slice(0, 5).map((b) => (
                      <span
                        key={b.id}
                        title={getStatus(b.status).label}
                        className={[
                          "h-1.5 w-1.5 rounded-full",
                          isSelected ? "bg-white/60" : getStatus(b.status).dot,
                        ].join(" ")}
                      />
                    ))}
                    {dots.length > 5 && (
                      <span className={["text-[9px] font-bold leading-none", isSelected ? "text-white/60" : "text-slate-400"].join(" ")}>
                        +{dots.length - 5}
                      </span>
                    )}
                  </div>
                )}
              </button>
            );
          })}
        </div>

        {/* Legend */}
        <div className="flex flex-wrap items-center gap-3 border-t border-slate-100 bg-slate-50/60 px-5 py-2.5">
          {Object.entries(STATUS).map(([key, val]) => (
            <span key={key} className="flex items-center gap-1.5 text-[10px] font-medium text-slate-500">
              <span className={`h-2 w-2 rounded-full ${val.dot}`} />
              {val.label}
            </span>
          ))}
        </div>
      </div>

      {/* ── Detail panel ──────────────────────────────────────────────────── */}
      <div className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-100">

        {/* Detail header */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
          <div>
            {selectedDayLabel ? (
              <>
                <h3 className="text-sm font-bold text-blue-900">{selectedDayLabel}</h3>
                <p className="mt-0.5 text-xs text-slate-400">
                  {selectedBookings.length > 0
                    ? `${selectedBookings.length} booking${selectedBookings.length !== 1 ? "s" : ""} on this day`
                    : "No bookings on this day"}
                </p>
              </>
            ) : (
              <>
                <h3 className="text-sm font-bold text-slate-500">No day selected</h3>
                <p className="mt-0.5 text-xs text-slate-400">Click a day on the calendar above.</p>
              </>
            )}
          </div>

          {selectedDay && (
            <Link
              href={`/rooms?date=${encodeURIComponent(selectedDay)}`}
              className="flex items-center gap-1.5 rounded-xl bg-blue-900 px-3.5 py-2 text-xs font-bold text-white transition hover:bg-blue-800"
            >
              <PlusIcon />
              Book a room
            </Link>
          )}
        </div>

        {/* Detail body */}
        <div className="p-4">
          {/* Empty state */}
          {!selectedDay && (
            <div className="flex flex-col items-center gap-3 py-12 text-center">
              <CalendarEmptyIcon />
              <div>
                <p className="text-sm font-semibold text-slate-400">Select a day</p>
                <p className="mt-0.5 text-xs text-slate-300">Click any date on the calendar above.</p>
              </div>
            </div>
          )}

          {selectedDay && selectedBookings.length === 0 && (
            <div className="flex flex-col items-center gap-3 rounded-2xl border-2 border-dashed border-blue-100 bg-blue-50/30 py-12 text-center">
              <CalendarEmptyIcon />
              <div>
                <p className="text-sm font-semibold text-blue-900">No bookings on this day</p>
                <p className="mt-1 text-xs text-slate-400">Book a room using the button above.</p>
              </div>
            </div>
          )}

          {/* Booking rows */}
          {selectedBookings.length > 0 && (
            <div className="grid gap-2.5">
              {selectedBookings.map((b, i) => {
                const roomName  = b.rooms?.name ?? "Room";
                const location  = b.rooms
                  ? `${b.rooms.building}${b.rooms.floor ? ` · Floor ${b.rooms.floor}` : ""}`
                  : "";
                const timeLabel = mounted
                  ? `${fmtLocalTime(b.start_time)} – ${fmtLocalTime(b.end_time)}`
                  : "—";
                const cfg = getStatus(b.status);

                return (
                  <div
                    key={b.id}
                    className="group flex items-stretch overflow-hidden rounded-xl ring-1 ring-slate-200 transition hover:ring-blue-200 hover:shadow-sm"
                  >
                    {/* Left: index + time sidebar */}
                    <div className="flex w-20 shrink-0 flex-col items-center justify-center gap-1 bg-blue-50 px-2 py-3">
                      <span className="text-[9px] font-bold uppercase tracking-widest text-blue-400">
                        #{i + 1}
                      </span>
                      <div className="flex items-center gap-0.5 text-blue-900">
                        <ClockIcon />
                      </div>
                      <span className="font-mono text-[10px] font-bold text-blue-900 leading-tight text-center">
                        {mounted ? fmtLocalTime(b.start_time) : "—"}
                      </span>
                      <span className="text-[9px] text-blue-400">to</span>
                      <span className="font-mono text-[10px] font-bold text-blue-700 leading-tight text-center">
                        {mounted ? fmtLocalTime(b.end_time) : "—"}
                      </span>
                    </div>

                    {/* Right: booking info */}
                    <div className="flex flex-1 items-start justify-between gap-2 bg-white px-4 py-3">
                      <div className="min-w-0">
                        {/* Room name + location */}
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className={`h-2 w-2 shrink-0 rounded-full ${cfg.dot}`} />
                          <span className="text-sm font-bold text-blue-900">{roomName}</span>
                          {location && (
                            <span className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-500">
                              {location}
                            </span>
                          )}
                        </div>

                        {/* Purpose */}
                        {b.purpose?.trim() ? (
                          <p className="mt-1.5 pl-3.5 text-xs text-slate-500">{b.purpose}</p>
                        ) : (
                          <p className="mt-1.5 pl-3.5 text-xs text-slate-300 italic">No purpose set</p>
                        )}
                      </div>

                      {/* Status badge */}
                      <span className={`shrink-0 self-start rounded-full px-2.5 py-1 text-[10px] font-bold ${cfg.badge}`}>
                        {cfg.label}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}