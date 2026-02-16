// src/components/schedule/ScheduleGrid.tsx
"use client";

import { useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";

type RoomRow = {
  id: number;
  name: string;
  building: string;
  floor: string | null;
  capacity: number;
  amenities: string[] | null;
  department?: any;
};

type BusyInterval = {
  room_id: number;
  start_time: string;
  end_time: string;
};

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

/**
 * Build a slot list as ISO start/end pairs for a single day.
 * - Uses UTC-safe construction so server/client don’t drift
 * - Schedule page passes date="YYYY-MM-DD"
 */
function buildSlotsForDay(date: string, slotMinutes: number, openHour: number, closeHour: number) {
  const [y, m, d] = date.split("-").map(Number);
  const slots: { startISO: string; endISO: string; label: string }[] = [];

  // Build at local time (UI expectation) but still in ISO strings.
  // If you prefer strict UTC, adjust here consistently across app.
  const start = new Date(y, (m ?? 1) - 1, d ?? 1, openHour, 0, 0, 0);
  const end = new Date(y, (m ?? 1) - 1, d ?? 1, closeHour, 0, 0, 0);

  for (let t = start.getTime(); t < end.getTime(); t += slotMinutes * 60 * 1000) {
    const s = new Date(t);
    const e = new Date(t + slotMinutes * 60 * 1000);

    slots.push({
      startISO: s.toISOString(),
      endISO: e.toISOString(),
      label: `${pad2(s.getHours())}:${pad2(s.getMinutes())}`,
    });
  }

  return slots;
}

/**
 * Overlap check: interval [aStart, aEnd) overlaps [bStart, bEnd)
 */
function overlaps(aStartISO: string, aEndISO: string, bStartISO: string, bEndISO: string) {
  return Date.parse(aStartISO) < Date.parse(bEndISO) && Date.parse(aEndISO) > Date.parse(bStartISO);
}

export default function ScheduleGrid(props: {
  rooms: RoomRow[];
  date: string; // YYYY-MM-DD
  slotMinutes: number;
  openHour: number;
  closeHour: number;
  busy: BusyInterval[];
}) {
  const router = useRouter();
  const sp = useSearchParams();

  const slots = useMemo(
    () => buildSlotsForDay(props.date, props.slotMinutes, props.openHour, props.closeHour),
    [props.date, props.slotMinutes, props.openHour, props.closeHour],
  );

  // Group busy intervals by room_id for faster lookup
  const busyByRoom = useMemo(() => {
    const m = new Map<number, BusyInterval[]>();
    for (const b of props.busy) {
      if (!m.has(b.room_id)) m.set(b.room_id, []);
      m.get(b.room_id)!.push(b);
    }
    return m;
  }, [props.busy]);

  function setDate(nextDate: string) {
    const params = new URLSearchParams(sp.toString());
    params.set("date", nextDate);
    // When changing date, close any modal
    params.delete("bookRoomId");
    router.push(`/schedule?${params.toString()}`);
  }

  function openBooking(roomId: number) {
    const params = new URLSearchParams(sp.toString());
    params.set("date", props.date);
    params.set("bookRoomId", String(roomId));
    router.push(`/schedule?${params.toString()}`);
  }

  return (
    <div className="mt-6 rounded-2xl border bg-white p-4 shadow-sm">
      {/* Date controls (basic; UI team can redesign) */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-gray-900">Schedule</h2>
          <p className="mt-1 text-xs text-gray-600">
            Click an available slot to book (modal opens). Slot size comes from settings.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <input
            type="date"
            className="rounded border px-3 py-2 text-sm"
            value={props.date}
            onChange={(e) => setDate(e.target.value)}
          />
        </div>
      </div>

      {/* Grid header: times */}
      <div className="mt-4 overflow-x-auto">
        <div className="min-w-[900px]">
          <div
            className="grid gap-2"
            style={{
              gridTemplateColumns: `240px repeat(${slots.length}, minmax(60px, 1fr))`,
            }}
          >
            {/* Corner */}
            <div className="px-2 py-2 text-xs font-medium text-gray-500">Room</div>

            {/* Time headers */}
            {slots.map((s) => (
              <div key={s.startISO} className="px-1 py-2 text-center text-xs font-medium text-gray-500">
                {s.label}
              </div>
            ))}

            {/* Rows */}
            {props.rooms.map((r) => {
              const roomBusy = busyByRoom.get(r.id) ?? [];

              return (
                <div
                  key={r.id}
                  className="contents"
                >
                  {/* Room label cell */}
                  <div className="rounded-xl border bg-white px-3 py-3">
                    <div className="text-sm font-semibold text-gray-900">{r.name}</div>
                    <div className="mt-1 text-xs text-gray-600">
                      {r.building}
                      {r.floor ? ` • Floor ${r.floor}` : ""} • Cap {r.capacity}
                    </div>
                    <div className="mt-2 text-xs text-gray-500">
                      {(r.amenities ?? []).slice(0, 3).join(", ") || "—"}
                    </div>
                  </div>

                  {/* Slot cells */}
                  {slots.map((s) => {
                    const isBooked = roomBusy.some((b) =>
                      overlaps(s.startISO, s.endISO, b.start_time, b.end_time),
                    );

                    return (
                      <button
                        key={`${r.id}-${s.startISO}`}
                        type="button"
                        disabled={isBooked}
                        onClick={() => openBooking(r.id)}
                        className={[
                          "h-[66px] rounded-xl border transition",
                          isBooked
                            ? "cursor-not-allowed bg-gray-100 text-gray-400"
                            : "bg-white hover:bg-blue-50 hover:border-blue-200",
                        ].join(" ")}
                        aria-label={isBooked ? "Booked" : "Available"}
                        title={isBooked ? "Booked" : "Available (click to book)"}
                      >
                        {/* Keep content minimal; UI team can style */}
                        <span className="text-[11px] font-medium">
                          {isBooked ? "Booked" : "Free"}
                        </span>
                      </button>
                    );
                  })}
                </div>
              );
            })}
          </div>

          {props.rooms.length === 0 ? (
            <div className="mt-4 rounded-xl border p-4 text-sm text-gray-600">
              No rooms match the current filters.
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
