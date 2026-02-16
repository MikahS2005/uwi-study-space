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
    <div className="mt-6 rounded border bg-white p-4">
      <h2 className="text-sm font-semibold">Next 30 days</h2>
      <p className="mt-1 text-xs text-gray-600">Grouped by day (calendar-style view).</p>

      <div className="mt-4 grid gap-3">
        {grouped.length === 0 ? (
          <div className="rounded border p-4 text-sm text-gray-600">No upcoming bookings.</div>
        ) : null}

        {grouped.map(([date, items]) => (
          <div key={date} className="rounded border p-4">
            <div className="text-sm font-semibold">{date}</div>

            <div className="mt-3 grid gap-2">
              {items.map((b) => {
                const room = b.rooms?.name ?? "Room";
                const t =
                  mounted ? `${fmtLocalTime(b.start_time)}–${fmtLocalTime(b.end_time)}` : "—";

                return (
                  <div key={b.id} className="flex items-start justify-between gap-3 rounded bg-gray-50 px-3 py-2">
                    <div>
                      <div className="text-sm font-medium">{room}</div>
                      <div className="text-xs text-gray-600">{t}</div>
                      <div className="text-xs text-gray-500">
                        {b.purpose?.trim() ? b.purpose : "—"}
                      </div>
                    </div>
                    <span className="rounded-full bg-white px-3 py-1 text-xs text-gray-700">
                      {b.status}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
