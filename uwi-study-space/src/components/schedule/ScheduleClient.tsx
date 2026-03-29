// src/components/schedule/ScheduleClient.tsx
"use client";

import { useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { ScheduleMonthDTO, DayCell } from "@/lib/schedule/buildMonthDTO";

function monthLabel(ym: string) {
  const [y, m] = ym.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1, 1));
  const months = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
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
  const s = new Date(startISO).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  const e = new Date(endISO).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  return `${s} - ${e}`;
}

function formatDateLabel(ymd: string) {
  const [y, m, d] = ymd.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  return dt.toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function statusStyles(status: DayCell["status"]) {
  if (status === "full") {
    return "border-red-200 bg-red-50 text-red-700";
  }

  if (status === "limited") {
    return "border-amber-200 bg-amber-50 text-amber-700";
  }

  return "border-[rgba(0,53,149,0.16)] bg-[rgba(0,53,149,0.06)] text-[var(--color-primary)]";
}

function legendDot(status: DayCell["status"]) {
  if (status === "full") return "bg-red-400";
  if (status === "limited") return "bg-amber-400";
  return "bg-[var(--color-primary)]";
}

export default function ScheduleClient({ dto }: { dto: ScheduleMonthDTO }) {
  const router = useRouter();
  const sp = useSearchParams();

  const selected = dto.selected || "";
  const selectedCell = useMemo(
    () => dto.grid.find((c) => c.ymd === selected) ?? null,
    [dto.grid, selected]
  );

  const selectedBookings = selected ? (dto.byDay[selected] ?? []) : [];

  function pushParams(next: {
    month?: string;
    selected?: string;
    roomId?: string;
    bookRoomId?: string;
  }) {
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

    if (next.bookRoomId !== undefined) {
      if (next.bookRoomId) params.set("bookRoomId", next.bookRoomId);
      else params.delete("bookRoomId");
    }

    router.replace(`/schedule?${params.toString()}`);
  }

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-[var(--color-text-light)] md:text-3xl">
            Schedule
          </h1>
          <p className="mt-1 text-sm text-[var(--color-text-light)]/65">
            Review room availability by date and open a booking directly from the calendar.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => pushParams({ month: addMonths(dto.month, -1), selected: "", bookRoomId: "" })}
            className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-[var(--color-border-light)] bg-white text-[var(--color-text-light)] shadow-sm transition-colors hover:bg-[var(--color-secondary)]"
            aria-label="Previous month"
          >
            ‹
          </button>

          <div className="rounded-xl border border-[var(--color-border-light)] bg-white px-4 py-2.5 text-sm font-semibold text-[var(--color-text-light)] shadow-sm">
            {monthLabel(dto.month)}
          </div>

          <button
            type="button"
            onClick={() => pushParams({ month: addMonths(dto.month, 1), selected: "", bookRoomId: "" })}
            className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-[var(--color-border-light)] bg-white text-[var(--color-text-light)] shadow-sm transition-colors hover:bg-[var(--color-secondary)]"
            aria-label="Next month"
          >
            ›
          </button>

          <select
            className="rounded-xl border border-[var(--color-border-light)] bg-white px-3 py-2.5 text-sm text-[var(--color-text-light)] shadow-sm outline-none"
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
      <div className="flex flex-wrap items-center gap-2">
        {[
          { label: "Available", status: "available" as const },
          { label: "Limited", status: "limited" as const },
          { label: "Full", status: "full" as const },
        ].map((item) => (
          <div
            key={item.label}
            className="inline-flex items-center gap-2 rounded-full border border-[var(--color-border-light)] bg-white px-3 py-1.5 text-xs font-medium text-[var(--color-text-light)]/75"
          >
            <span className={`h-2.5 w-2.5 rounded-full ${legendDot(item.status)}`} />
            {item.label}
          </div>
        ))}
      </div>

      {/* Main layout */}
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
        {/* Calendar */}
        <section className="rounded-2xl border border-[var(--color-border-light)] bg-white p-4 shadow-sm md:p-5">
          <div className="grid grid-cols-7 text-center text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--color-text-light)]/45">
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
              <div key={d} className="py-2">
                {d}
              </div>
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
                    "h-[88px] rounded-2xl border p-3 text-left transition-all duration-200",
                    disabled
                      ? "cursor-not-allowed border-[var(--color-border-light)] bg-[var(--color-surface-light)] opacity-45"
                      : "hover:-translate-y-0.5 hover:shadow-sm",
                    statusStyles(c.status),
                    isSelected ? "ring-2 ring-[var(--color-primary)] ring-offset-1" : "",
                  ].join(" ")}
                >
                  <div className="flex items-start justify-between">
                    <span className="text-sm font-semibold">{c.dayNumber}</span>
                  </div>

                  {!disabled ? (
                    <div className="mt-5 text-[12px]">
                      <span className="font-semibold">{left}</span> available
                    </div>
                  ) : null}
                </button>
              );
            })}
          </div>
        </section>

        {/* Right panel */}
        <aside className="rounded-2xl border border-[var(--color-border-light)] bg-white p-5 shadow-sm xl:sticky xl:top-6 xl:self-start">
          {!selectedCell ? (
            <div className="flex min-h-[280px] flex-col items-center justify-center text-center">
              <div className="text-lg font-semibold text-[var(--color-text-light)]">Select a date</div>
              <div className="mt-1 text-sm text-[var(--color-text-light)]/60">
                Choose a day from the calendar to view availability and book a room.
              </div>
            </div>
          ) : (
            <div className="space-y-5">
              {/* Selected date header */}
              <div>
                <div className="inline-flex items-center rounded-full bg-[var(--color-primary-soft)] px-3 py-1 text-xs font-semibold text-[var(--color-primary)]">
                  Selected day
                </div>
                <div className="mt-3 text-lg font-semibold text-[var(--color-text-light)]">
                  {formatDateLabel(selectedCell.ymd)}
                </div>
                <div className="mt-1 text-sm text-[var(--color-text-light)]/60">
                  {Math.max(0, selectedCell.totalSlots - selectedCell.bookedSlots)} of{" "}
                  {selectedCell.totalSlots} slots available
                </div>
              </div>

              {/* Availability summary */}
              <div className="rounded-2xl border border-[var(--color-border-light)] bg-[var(--color-surface-light)] p-4">
                {selectedCell.bookedSlots === 0 ? (
                  <>
                    <div className="font-semibold text-[var(--color-primary)]">Fully available</div>
                    <div className="mt-1 text-sm text-[var(--color-text-light)]/60">
                      No bookings have been made for this date yet.
                    </div>
                  </>
                ) : (
                  <>
                    <div className="font-semibold text-[var(--color-text-light)]">
                      Existing bookings ({selectedBookings.length})
                    </div>

                    <div className="mt-3 grid gap-2">
                      {selectedBookings.slice(0, 6).map((b) => (
                        <div
                          key={b.id}
                          className="rounded-xl border border-[var(--color-border-light)] bg-white p-3"
                        >
                          <div className="text-sm font-medium text-[var(--color-text-light)]">
                            {b.room_name}
                          </div>
                          <div className="mt-1 text-xs text-[var(--color-text-light)]/60">
                            {fmtLocalTimeRange(b.start, b.end)}
                          </div>
                        </div>
                      ))}

                      {selectedBookings.length > 6 ? (
                        <div className="text-xs text-[var(--color-text-light)]/55">
                          + {selectedBookings.length - 6} more bookings
                        </div>
                      ) : null}
                    </div>
                  </>
                )}
              </div>

              {/* Quick book */}
              <div className="border-t border-[var(--color-border-light)] pt-4">
                <div className="text-sm font-semibold text-[var(--color-text-light)]">Quick book</div>
                <div className="mt-1 text-sm text-[var(--color-text-light)]/60">
                  Open a booking modal for this date.
                </div>

                <div className="mt-3 grid gap-2">
                  {dto.rooms.slice(0, 3).map((r) => (
                    <button
                      key={r.id}
                      type="button"
                      onClick={() => pushParams({ bookRoomId: String(r.id) })}
                      className="rounded-xl border border-[var(--color-border-light)] bg-white px-4 py-3 text-left text-sm font-medium text-[var(--color-text-light)] transition-colors hover:bg-[var(--color-primary-soft)]"
                    >
                      {r.name}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}