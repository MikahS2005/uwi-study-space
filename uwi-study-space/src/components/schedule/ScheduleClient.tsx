// src/components/schedule/ScheduleClient.tsx
"use client";

import { useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { ScheduleMonthDTO, DayCell } from "@/lib/schedule/buildMonthDTO";

function monthLabel(ym: string) {
  // ym = YYYY-MM
  const [y, m] = ym.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1, 1));
  const months = [
    "January","February","March","April","May","June",
    "July","August","September","October","November","December",
  ];
  return `${months[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

function addMonths(ym: string, delta: number) {
  const [y, m] = ym.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  const yy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  return `${yy}-${mm}`;
}

function fmtLocalTimeRange(startISO: string, endISO: string) {
  // Client-only display: keep it consistent (no SSR mismatch because this component is client)
  const s = new Date(startISO).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  const e = new Date(endISO).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  return `${s} - ${e}`;
}

function statusStyles(status: DayCell["status"]) {
  // visually like your legend: green=available, amber=limited, red=full
  if (status === "full") return "bg-red-50 border-red-200 text-red-700";
  if (status === "limited") return "bg-amber-50 border-amber-200 text-amber-700";
  return "bg-emerald-50 border-emerald-200 text-emerald-700";
}

export default function ScheduleClient({ dto }: { dto: ScheduleMonthDTO }) {
  const router = useRouter();
  const sp = useSearchParams();

  const selected = dto.selected || "";
  const selectedCell = useMemo(() => dto.grid.find((c) => c.ymd === selected) ?? null, [dto.grid, selected]);

  const selectedBookings = selected ? (dto.byDay[selected] ?? []) : [];

function pushParams(next: { month?: string; selected?: string; roomId?: string; bookRoomId?: string }) {
  const params = new URLSearchParams(sp.toString());

  if (next.month !== undefined) params.set("month", next.month);

  if (next.selected !== undefined) {
    if (next.selected) params.set("selected", next.selected);
    else params.delete("selected");
  }

  if (next.roomId !== undefined) {
    if (next.roomId === "all") params.set("roomId", "all");
    else params.set("roomId", next.roomId);
  }

  // ✅ NEW
  if (next.bookRoomId !== undefined) {
    if (next.bookRoomId) params.set("bookRoomId", next.bookRoomId);
    else params.delete("bookRoomId");
  }

  router.replace(`/schedule?${params.toString()}`);
}


  return (
    <div>
      <h1 className="text-2xl font-semibold">Schedule</h1>
      <p className="mt-1 text-sm text-gray-600">View room availability calendar</p>

      {/* Top controls row */}
      <div className="mt-5 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => pushParams({ month: addMonths(dto.month, -1), selected: "", bookRoomId: "" })}
            className="rounded-lg border px-3 py-2 text-sm hover:bg-neutral-50"
            aria-label="Previous month"
          >
            ‹
          </button>

          <div className="text-xl font-semibold">{monthLabel(dto.month)}</div>

          <button
            type="button"
            onClick={() => pushParams({ month: addMonths(dto.month, -1), selected: "", bookRoomId: "" })}
            className="rounded-lg border px-3 py-2 text-sm hover:bg-neutral-50"
            aria-label="Next month"
          >
            ›
          </button>
        </div>

        <div className="flex items-center gap-3">
          {/* Room dropdown */}
          <select
            className="rounded-lg border bg-white px-3 py-2 text-sm"
            value={dto.roomId === "all" ? "all" : String(dto.roomId)}
            onChange={(e) => pushParams({ roomId: e.target.value })}
          >
            <option value="all">All Rooms</option>
            {dto.rooms.map((r) => (
              <option key={r.id} value={String(r.id)}>
                {r.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Legend */}
      <div className="mt-4 flex items-center gap-6 text-sm text-gray-600">
        <div className="flex items-center gap-2">
          <span className="h-3 w-3 rounded border border-emerald-200 bg-emerald-50" />
          Available
        </div>
        <div className="flex items-center gap-2">
          <span className="h-3 w-3 rounded border border-amber-200 bg-amber-50" />
          Limited
        </div>
        <div className="flex items-center gap-2">
          <span className="h-3 w-3 rounded border border-red-200 bg-red-50" />
          Full
        </div>
      </div>

      {/* Main layout: calendar + right panel */}
      <div className="mt-5 grid gap-5 lg:grid-cols-[1fr,380px]">
        {/* Calendar card */}
        <div className="rounded-2xl border bg-white p-4">
          <div className="grid grid-cols-7 text-center text-xs font-medium text-gray-500">
            {["Sun","Mon","Tue","Wed","Thu","Fri","Sat"].map((d) => (
              <div key={d} className="py-2">{d}</div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-2">
            {dto.grid.map((c) => {
              const isSelected = c.ymd === selected;
              const disabled = !c.inMonth;

              const left = Math.max(0, c.totalSlots - c.bookedSlots);

              return (
                <button
                  key={c.ymd}
                  type="button"
                  disabled={disabled}
                  onClick={() => pushParams({ selected: c.ymd })}
                  className={[
                    "h-20 rounded-2xl border p-3 text-left transition",
                    disabled ? "opacity-40 cursor-not-allowed bg-neutral-50" : "hover:bg-neutral-50",
                    statusStyles(c.status),
                    isSelected ? "ring-2 ring-blue-500 border-blue-200" : "",
                  ].join(" ")}
                >
                  <div className="text-sm font-semibold">{c.dayNumber}</div>
                  <div className="mt-2 text-[11px]">
                    <span className="font-medium">{left}</span> left
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Right panel */}
        <div className="rounded-2xl border bg-white p-5">
          {!selectedCell ? (
            <div className="flex h-full flex-col items-center justify-center text-center">
              <div className="text-lg font-semibold">Select a date</div>
              <div className="mt-1 text-sm text-gray-600">Click on a date to see availability details</div>
            </div>
          ) : (
            <div>
              <div className="text-lg font-semibold">{selectedCell.ymd}</div>
              <div className="mt-1 text-sm text-gray-600">
                {Math.max(0, selectedCell.totalSlots - selectedCell.bookedSlots)} of {selectedCell.totalSlots} slots available
              </div>

              {/* Summary box */}
              <div className="mt-4 rounded-xl border bg-neutral-50 p-4">
                {selectedCell.bookedSlots === 0 ? (
                  <>
                    <div className="font-semibold text-emerald-700">All slots available!</div>
                    <div className="mt-1 text-sm text-gray-600">No bookings for this date yet.</div>
                  </>
                ) : (
                  <>
                    <div className="font-semibold">Booked Slots ({selectedBookings.length})</div>
                    <div className="mt-3 grid gap-2">
                      {selectedBookings.slice(0, 6).map((b) => (
                        <div key={b.id} className="rounded-lg border bg-white p-3">
                          <div className="text-sm font-medium">{b.room_name}</div>
                          <div className="mt-1 text-xs text-gray-600">{fmtLocalTimeRange(b.start, b.end)}</div>
                        </div>
                      ))}
                      {selectedBookings.length > 6 ? (
                        <div className="text-xs text-gray-500">+ {selectedBookings.length - 6} more…</div>
                      ) : null}
                    </div>
                  </>
                )}
              </div>

{/* Quick book section */}
<div className="mt-5 border-t pt-4">
  <div className="text-sm font-medium text-gray-700">Quick book a room for this date:</div>

  <div className="mt-3 grid gap-2">
    {dto.rooms.slice(0, 3).map((r) => (
      <button
        key={r.id}
        type="button"
        onClick={() => {
          // ✅ opens modal by setting bookRoomId on /schedule
          pushParams({ bookRoomId: String(r.id) });
        }}
        className="rounded-lg border bg-neutral-50 px-4 py-2 text-left text-sm font-medium hover:bg-neutral-100"
      >
        {r.name}
      </button>
    ))}
  </div>
</div>

            </div>
          )}
        </div>
      </div>
    </div>
  );
}
