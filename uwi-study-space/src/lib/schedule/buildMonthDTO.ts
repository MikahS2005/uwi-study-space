// src/lib/schedule/buildMonthDTO.ts
import type { ScheduleRoom, ScheduleBooking } from "@/lib/db/schedule";

/**
 * This DTO is the ONLY thing the client needs.
 * It prevents hydration mismatch by ensuring the server decides all labels + counts.
 */

export type DayCell = {
  ymd: string;          // YYYY-MM-DD
  inMonth: boolean;
  dayNumber: number;    // 1..31
  bookedSlots: number;  // number of slot starts that are booked
  totalSlots: number;   // total slot starts possible for that day
  status: "available" | "limited" | "full";
};

export type DayBookingRow = {
  id: number;
  room_id: number;
  room_name: string;
  start: string; // ISO
  end: string;   // ISO
};

export type ScheduleMonthDTO = {
  month: string;                 // YYYY-MM
  selected: string;              // YYYY-MM-DD or ""
  roomId: number | "all";
  slotMinutes: number;
  openHour: number;
  closeHour: number;
  rooms: ScheduleRoom[];
  grid: DayCell[];               // 6x7 = 42 cells
  byDay: Record<string, DayBookingRow[]>; // ymd -> bookings
};

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function ymdFromUTCDate(d: Date) {
  return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}`;
}

function startOfDayUTC(ymd: string) {
  return new Date(`${ymd}T00:00:00.000Z`);
}

function addMinutes(d: Date, minutes: number) {
  return new Date(d.getTime() + minutes * 60 * 1000);
}

function clampToDay(iso: string, dayStart: Date, dayEnd: Date) {
  const t = new Date(iso);
  if (t < dayStart) return dayStart;
  if (t > dayEnd) return dayEnd;
  return t;
}

/**
 * Convert bookings into "slot starts" that are booked for a given day.
 * We mark a slot as booked if any active booking overlaps that slot interval.
 */
function computeBookedSlotStartsForDay(opts: {
  dayYMD: string;
  bookings: ScheduleBooking[];
  slotMinutes: number;
  openHour: number;
  closeHour: number;
}) {
  const dayStart = startOfDayUTC(opts.dayYMD);
  const dayOpen = new Date(Date.UTC(dayStart.getUTCFullYear(), dayStart.getUTCMonth(), dayStart.getUTCDate(), opts.openHour, 0, 0));
  const dayClose = new Date(Date.UTC(dayStart.getUTCFullYear(), dayStart.getUTCMonth(), dayStart.getUTCDate(), opts.closeHour, 0, 0));

  const totalSlots = Math.max(
    0,
    Math.floor((dayClose.getTime() - dayOpen.getTime()) / (opts.slotMinutes * 60 * 1000)),
  );

  // Prebuild all slot start times
  const slotStarts: Date[] = [];
  for (let i = 0; i < totalSlots; i++) {
    slotStarts.push(addMinutes(dayOpen, i * opts.slotMinutes));
  }

  const booked = new Set<string>();

  for (const b of opts.bookings) {
    // clamp booking overlap to [open, close]
    const bStart = clampToDay(b.start_time, dayOpen, dayClose);
    const bEnd = clampToDay(b.end_time, dayOpen, dayClose);

    if (bEnd <= bStart) continue;

    // mark any slot that overlaps [bStart, bEnd)
    for (const s of slotStarts) {
      const e = addMinutes(s, opts.slotMinutes);
      const overlaps = s < bEnd && e > bStart;
      if (overlaps) booked.add(s.toISOString());
    }
  }

  return { bookedSlots: booked.size, totalSlots };
}

/**
 * 0 booked -> available
 * 1..(total-1) -> limited
 * total booked -> full
 */
function dayStatus(booked: number, total: number): DayCell["status"] {
  if (total <= 0) return "available";
  if (booked <= 0) return "available";
  if (booked >= total) return "full";
  return "limited";
}

export function buildScheduleMonthDTO(opts: {
  month: string; // YYYY-MM
  selected: string; // YYYY-MM-DD or ""
  roomId: number | "all";
  rooms: ScheduleRoom[];
  bookings: ScheduleBooking[];
  slotMinutes: number;
  openHour: number;
  closeHour: number;
}): ScheduleMonthDTO {
  const [yy, mm] = opts.month.split("-").map((x) => Number(x));
  const monthStart = new Date(Date.UTC(yy, mm - 1, 1, 0, 0, 0));
  const monthEnd = new Date(Date.UTC(yy, mm, 1, 0, 0, 0)); // next month

  // Sunday-start grid: back up to Sunday
  const startDow = monthStart.getUTCDay(); // 0=Sun
  const gridStart = new Date(monthStart);
  gridStart.setUTCDate(gridStart.getUTCDate() - startDow);

  const grid: DayCell[] = [];
  const byDay: Record<string, DayBookingRow[]> = {};

  // Pre-index room names
  const roomNameById = new Map<number, string>();
  for (const r of opts.rooms) roomNameById.set(r.id, r.name);

  // Bucket bookings by day (by start_time day in UTC)
  for (const b of opts.bookings) {
    const d = new Date(b.start_time);
    const ymd = ymdFromUTCDate(d);
    if (!byDay[ymd]) byDay[ymd] = [];
    byDay[ymd].push({
      id: b.id,
      room_id: b.room_id,
      room_name: roomNameById.get(b.room_id) ?? `Room ${b.room_id}`,
      start: b.start_time,
      end: b.end_time,
    });
  }

  // Build 42 cells
  for (let i = 0; i < 42; i++) {
    const d = new Date(gridStart);
    d.setUTCDate(gridStart.getUTCDate() + i);

    const ymd = ymdFromUTCDate(d);
    const inMonth = d >= monthStart && d < monthEnd;

    // bookings that overlap this day (cheap approach: filter month bookings by overlap with day open/close)
    // For correctness, we can just feed all month bookings; computeBookedSlotStarts clamps per day anyway.
    const { bookedSlots, totalSlots } = computeBookedSlotStartsForDay({
      dayYMD: ymd,
      bookings: opts.bookings,
      slotMinutes: opts.slotMinutes,
      openHour: opts.openHour,
      closeHour: opts.closeHour,
    });

    grid.push({
      ymd,
      inMonth,
      dayNumber: d.getUTCDate(),
      bookedSlots,
      totalSlots,
      status: dayStatus(bookedSlots, totalSlots),
    });
  }

  return {
    month: opts.month,
    selected: opts.selected,
    roomId: opts.roomId,
    slotMinutes: opts.slotMinutes,
    openHour: opts.openHour,
    closeHour: opts.closeHour,
    rooms: opts.rooms,
    grid,
    byDay,
  };
}
