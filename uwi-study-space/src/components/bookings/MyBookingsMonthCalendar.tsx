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

// ── helpers ──────────────────────────────────────────────────────────────────
function ymd(iso: string) { return iso.slice(0, 10); }

function fmtLocalTime(iso: string) {
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function toMonthKey(d: Date) { return d.toISOString().slice(0, 7); }

function monthKeyToUTCDate(monthKey: string) {
  const [y, m] = monthKey.split("-").map(Number);
  return new Date(Date.UTC(y, (m ?? 1) - 1, 1));
}

function addMonths(monthKey: string, delta: number) {
  const d = monthKeyToUTCDate(monthKey);
  d.setUTCMonth(d.getUTCMonth() + delta);
  return toMonthKey(d);
}

function buildMonthGrid(monthKey: string) {
  const first      = monthKeyToUTCDate(monthKey);
  const year       = first.getUTCFullYear();
  const month      = first.getUTCMonth();
  const monthStart = new Date(Date.UTC(year, month, 1));
  const monthEnd   = new Date(Date.UTC(year, month + 1, 0));

  const gridStart = new Date(monthStart);
  gridStart.setUTCDate(monthStart.getUTCDate() - monthStart.getUTCDay());

  const gridEnd = new Date(monthEnd);
  gridEnd.setUTCDate(monthEnd.getUTCDate() + (6 - monthEnd.getUTCDay()));

  const days: { dateKey: string; inMonth: boolean; utcDate: Date }[] = [];
  const cursor = new Date(gridStart);
  while (cursor <= gridEnd) {
    days.push({ dateKey: cursor.toISOString().slice(0, 10), inMonth: cursor.getUTCMonth() === month, utcDate: new Date(cursor) });
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return days;
}

// ── status config — all aligned to brand palette ─────────────────────────────
const STATUS = {
  active:    { dot: "bg-emerald-500", badge: "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200",         label: "Active" },
  cancelled: { dot: "bg-slate-300",   badge: "bg-slate-100 text-slate-500 ring-1 ring-slate-200",              label: "Cancelled" },
  completed: { dot: "bg-[#003595]/60",badge: "bg-[#EAF6FF] text-[#003595] ring-1 ring-[#003595]/20",           label: "Completed" },
  no_show:   { dot: "bg-rose-400",    badge: "bg-rose-50 text-rose-700 ring-1 ring-rose-200",                  label: "No-show" },
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
    <svg className="h-10 w-10 text-[#003595]/20" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
        d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
    </svg>
  );
}

// ── main component ────────────────────────────────────────────────────────────
export default function MyBookingsMonthCalendar(props: {
  initialMonth: string;
  bookings: BookingRow[];
}) {
  const [monthKey,     setMonthKey]     = useState(props.initialMonth);
  const [selectedDay,  setSelectedDay]  = useState<string | null>(null);
  const [mounted,      setMounted]      = useState(false);
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

  const gridDays  = useMemo(() => buildMonthGrid(monthKey), [monthKey]);
  const todayKey  = useMemo(() => new Date().toISOString().slice(0, 10), []);

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

  const selectedBookings  = selectedDay ? (byDay.get(selectedDay) ?? []) : [];
  const selectedDayLabel  = selectedDay
    ? new Date(selectedDay + "T00:00:00").toLocaleDateString([], { weekday: "long", month: "long", day: "numeric" })
    : null;

  const activeCount = props.bookings.filter((b) => b.status === "active").length;

  return (
    <div className="space-y-4">

      {/* ── Calendar card ─────────────────────────────────────────────────── */}
      <div className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-200">

        {/* Header — solid navy, NO gradient */}
        <div className="flex items-center justify-between gap-3 border-b border-[#002366] bg-[#003595] px-5 py-4">
          <div>
            <h2 className="font-serif text-base font-bold text-white">{monthLabel}</h2>
            <p className="mt-0.5 text-xs text-white/60">
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
        <div className="grid grid-cols-7 border-b border-slate-100 bg-slate-50">
          {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((w) => (
            <div key={w} className="py-2.5 text-center text-[10px] font-bold uppercase tracking-widest text-slate-400">
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
                  "group relative flex min-h-[80px] flex-col p-2 text-left transition-colors duration-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#003595]/40",
                  isSelected
                    ? "bg-[#003595]"
                    : isToday
                      ? "bg-[#EAF6FF]"
                      : isWeekend && d.inMonth
                        ? "bg-slate-50 hover:bg-slate-100"
                        : d.inMonth
                          ? "bg-white hover:bg-[#EAF6FF]/50"
                          : "bg-slate-50/60",
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
                          ? "bg-[#003595] text-white"
                          : d.inMonth
                            ? "text-slate-700 group-hover:text-[#003595]"
                            : "text-slate-300",
                    ].join(" ")}
                  >
                    {dayNum}
                  </span>

                  {count > 0 && (
                    <span
                      className={[
                        "rounded-full px-1.5 py-px text-[9px] font-bold leading-tight",
                        isSelected ? "bg-white/20 text-white" : "bg-[#003595] text-white",
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
                          isSelected ? "bg-white/50" : getStatus(b.status).dot,
                        ].join(" ")}
                      />
                    ))}
                    {dots.length > 5 && (
                      <span className={["text-[9px] font-bold leading-none", isSelected ? "text-white/50" : "text-slate-400"].join(" ")}>
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
        <div className="flex flex-wrap items-center gap-4 border-t border-slate-100 bg-slate-50 px-5 py-2.5">
          {Object.entries(STATUS).map(([key, val]) => (
            <span key={key} className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
              <span className={`h-2 w-2 rounded-full ${val.dot}`} />
              {val.label}
            </span>
          ))}
        </div>
      </div>

      {/* ── Detail panel ──────────────────────────────────────────────────── */}
      <div className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-200">

        {/* Detail header */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
          <div>
            {selectedDayLabel ? (
              <>
                <h3 className="font-serif text-sm font-bold text-[#003595]">{selectedDayLabel}</h3>
                <p className="mt-0.5 text-xs text-slate-400">
                  {selectedBookings.length > 0
                    ? `${selectedBookings.length} booking${selectedBookings.length !== 1 ? "s" : ""} on this day`
                    : "No bookings on this day"}
                </p>
              </>
            ) : (
              <>
                <h3 className="text-sm font-bold text-slate-400">No day selected</h3>
                <p className="mt-0.5 text-xs text-slate-400">Click a day on the calendar above.</p>
              </>
            )}
          </div>

          {selectedDay && (
            <Link
              href={`/rooms?date=${encodeURIComponent(selectedDay)}`}
              className="flex items-center gap-1.5 rounded-xl bg-[#003595] px-3.5 py-2 text-xs font-bold text-white transition hover:bg-[#002366]"
            >
              <PlusIcon />
              Book a room
            </Link>
          )}
        </div>

        {/* Detail body */}
        <div className="p-4">
          {/* No day selected */}
          {!selectedDay && (
            <div className="flex flex-col items-center gap-3 py-12 text-center">
              <CalendarEmptyIcon />
              <div>
                <p className="text-sm font-semibold text-slate-400">Select a day</p>
                <p className="mt-0.5 text-xs text-slate-300">Click any date on the calendar above.</p>
              </div>
            </div>
          )}

          {/* Day selected but empty */}
          {selectedDay && selectedBookings.length === 0 && (
            <div className="flex flex-col items-center gap-3 rounded-2xl border-2 border-dashed border-[#003595]/15 bg-[#EAF6FF]/30 py-12 text-center">
              <CalendarEmptyIcon />
              <div>
                <p className="text-sm font-semibold text-[#003595]">No bookings on this day</p>
                <p className="mt-1 text-xs text-slate-400">Use the button above to book a room.</p>
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
                    className="flex items-stretch overflow-hidden rounded-xl ring-1 ring-slate-200 transition hover:ring-[#003595]/30 hover:shadow-sm"
                  >
                    {/* Left: index + time sidebar */}
                    <div className="flex w-20 shrink-0 flex-col items-center justify-center gap-1 bg-[#EAF6FF] px-2 py-3">
                      <span className="text-[9px] font-bold uppercase tracking-widest text-[#003595]/50">
                        #{i + 1}
                      </span>
                      <div className="flex items-center text-[#003595]">
                        <ClockIcon />
                      </div>
                      <span className="text-center font-mono text-[10px] font-bold leading-tight text-[#003595]">
                        {mounted ? fmtLocalTime(b.start_time) : "—"}
                      </span>
                      <span className="text-[9px] text-[#003595]/40">to</span>
                      <span className="text-center font-mono text-[10px] font-bold leading-tight text-[#003595]/70">
                        {mounted ? fmtLocalTime(b.end_time) : "—"}
                      </span>
                    </div>

                    {/* Right: booking info */}
                    <div className="flex flex-1 items-start justify-between gap-2 bg-white px-4 py-3">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className={`h-2 w-2 shrink-0 rounded-full ${cfg.dot}`} />
                          <span className="text-sm font-bold text-[#003595]">{roomName}</span>
                          {location && (
                            <span className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-500">
                              {location}
                            </span>
                          )}
                        </div>

                        {b.purpose?.trim() ? (
                          <p className="mt-1.5 pl-3.5 text-xs text-slate-500">{b.purpose}</p>
                        ) : (
                          <p className="mt-1.5 pl-3.5 text-xs italic text-slate-300">No purpose set</p>
                        )}
                      </div>

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
