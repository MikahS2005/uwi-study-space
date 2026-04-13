// src/components/bookings/MyBookingsCalendar.tsx
"use client";
 
import { useEffect, useMemo, useState } from "react";
 
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
 
function fmtDateHeading(dateKey: string) {
  const d = new Date(dateKey + "T00:00:00");
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);
 
  const isToday = d.toDateString() === today.toDateString();
  const isTomorrow = d.toDateString() === tomorrow.toDateString();
 
  const label = isToday ? "Today" : isTomorrow ? "Tomorrow" : "";
  const formatted = d.toLocaleDateString([], { weekday: "long", month: "short", day: "numeric" });
 
  return { label, formatted };
}
 
const STATUS_CONFIG: Record<string, { dot: string; badge: string; label: string }> = {
  active: { dot: "bg-emerald-500", badge: "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200", label: "Active" },
  cancelled: { dot: "bg-slate-300", badge: "bg-slate-100 text-slate-500 ring-1 ring-slate-200", label: "Cancelled" },
  completed: { dot: "bg-sky-400", badge: "bg-sky-50 text-sky-700 ring-1 ring-sky-200", label: "Completed" },
  no_show: { dot: "bg-rose-400", badge: "bg-rose-50 text-rose-700 ring-1 ring-rose-200", label: "No-show" },
};
 
export default function MyBookingsCalendar({ bookings }: { bookings: BookingRow[] }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
 
  const grouped = useMemo(() => {
    const m = new Map<string, BookingRow[]>();
    for (const b of bookings) {
      const key = ymd(b.start_time);
      if (!m.has(key)) m.set(key, []);
      m.get(key)!.push(b);
    }
    return Array.from(m.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [bookings]);
 
  return (
    <div className="mt-6 space-y-1">
      {/* Header */}
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">Next 30 days</h2>
          <p className="mt-0.5 text-xs text-slate-400">Your upcoming sessions, grouped by day.</p>
        </div>
        <span className="rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">
          {bookings.length} booking{bookings.length !== 1 ? "s" : ""}
        </span>
      </div>
 
      {grouped.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50/60 py-16 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white shadow-sm ring-1 ring-slate-200">
            <svg className="h-6 w-6 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
          <div>
            <p className="text-sm font-medium text-slate-700">No upcoming bookings</p>
            <p className="mt-0.5 text-xs text-slate-400">Book a room to get started.</p>
          </div>
        </div>
      ) : (
        <div className="space-y-5">
          {grouped.map(([date, items]) => {
            const { label, formatted } = fmtDateHeading(date);
 
            return (
              <div key={date}>
                {/* Date heading */}
                <div className="mb-2 flex items-center gap-2">
                  <div className="flex items-baseline gap-2">
                    {label && (
                      <span className="rounded-md bg-slate-900 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-white">
                        {label}
                      </span>
                    )}
                    <span className="text-xs font-semibold text-slate-600">{formatted}</span>
                  </div>
                  <div className="flex-1 border-t border-slate-100" />
                  <span className="text-[10px] text-slate-400">{items.length} booking{items.length !== 1 ? "s" : ""}</span>
                </div>
 
                {/* Booking items */}
                <div className="grid gap-2 pl-2">
                  {items.map((b) => {
                    const cfg = STATUS_CONFIG[b.status] ?? {
                      dot: "bg-neutral-400",
                      badge: "bg-neutral-50 text-neutral-700 ring-1 ring-neutral-200",
                      label: b.status,
                    };
                    const timeLabel = mounted
                      ? `${fmtLocalTime(b.start_time)} – ${fmtLocalTime(b.end_time)}`
                      : "—";
                    const roomName = b.rooms?.name ?? "Room";
                    const location = b.rooms
                      ? `${b.rooms.building}${b.rooms.floor ? ` · Floor ${b.rooms.floor}` : ""}`
                      : "";
 
                    return (
                      <div
                        key={b.id}
                        className="flex items-start gap-3 rounded-xl bg-white px-4 py-3 shadow-sm ring-1 ring-slate-200 transition hover:ring-slate-300"
                      >
                        {/* Time column */}
                        <div className="flex w-20 shrink-0 flex-col items-end border-r border-slate-100 pr-3 pt-0.5">
                          <span className="font-mono text-[10px] font-medium text-slate-500">
                            {mounted ? fmtLocalTime(b.start_time) : "—"}
                          </span>
                          <span className="mt-0.5 font-mono text-[10px] text-slate-400">
                            {mounted ? fmtLocalTime(b.end_time) : ""}
                          </span>
                        </div>
 
                        {/* Content */}
                        <div className="flex flex-1 flex-wrap items-start justify-between gap-2">
                          <div>
                            <div className="flex items-center gap-1.5">
                              <span className={`h-2 w-2 rounded-full ${cfg.dot}`} />
                              <span className="text-sm font-semibold text-slate-800">{roomName}</span>
                            </div>
                            {location && (
                              <p className="mt-0.5 pl-3.5 text-xs text-slate-400">{location}</p>
                            )}
                            {b.purpose?.trim() && (
                              <p className="mt-1 pl-3.5 text-xs text-slate-500">{b.purpose}</p>
                            )}
                          </div>
                          <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-medium ${cfg.badge}`}>
                            {cfg.label}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}