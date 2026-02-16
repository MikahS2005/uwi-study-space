// src/lib/db/availability.ts
// Room availability query + slot generation.
// This is used by:
// - Room booking modal
// - Schedule (later, we can reuse the same logic)
// - Room cards "x/y slots left" (later)

import "server-only";
import { createSupabaseServer } from "@/lib/supabase/server";
import { getSettings } from "@/lib/db/bookings";

/**
 * Basic Slot shape expected by SlotPicker.
 */
export type Slot = {
  start: string; // ISO
  end: string; // ISO
  isBooked: boolean;
};

export type RoomAvailabilityDTO = {
  roomId: number;
  date: string; // YYYY-MM-DD (UTC day)
  slotMinutes: number;
  maxConsecutiveHours: number;
  maxBookingDurationHours: number;
  slots: Slot[];
};

/**
 * Build UTC day bounds for a YYYY-MM-DD date string.
 * NOTE: This treats "day" as UTC. If you later want Port of Spain local time,
 * we can refactor to timezone-based bounds.
 */
function utcBoundsFromYMD(ymd: string) {
  // ymd like "2026-02-16"
  const [Y, M, D] = ymd.split("-").map((x) => Number(x));
  const start = new Date(Date.UTC(Y, M - 1, D, 0, 0, 0));
  const end = new Date(Date.UTC(Y, M - 1, D + 1, 0, 0, 0));
  return { start, end };
}

/**
 * Generate slot start/end ISO strings for the day using slotMinutes.
 * Example (slotMinutes=60): 08:00-09:00 etc.
 *
 * IMPORTANT:
 * Your screenshots show 12 slots/day (8AM–8PM). That's a UI decision.
 * Here we implement a DEFAULT 8:00–20:00 UTC schedule.
 * If AJL uses a different schedule (e.g. 8–10, weekends shorter),
 * we will switch this to read from a "hours" table later.
 */
function generateDailySlots(params: {
  dayStart: Date;
  slotMinutes: number;
  openHourUtc: number; // default 8
  closeHourUtc: number; // default 20
}): Array<{ start: Date; end: Date }> {
  const { dayStart, slotMinutes, openHourUtc, closeHourUtc } = params;

  const open = new Date(dayStart);
  open.setUTCHours(openHourUtc, 0, 0, 0);

  const close = new Date(dayStart);
  close.setUTCHours(closeHourUtc, 0, 0, 0);

  const slots: Array<{ start: Date; end: Date }> = [];

  let cursor = new Date(open);
  while (cursor < close) {
    const next = new Date(cursor.getTime() + slotMinutes * 60 * 1000);
    if (next > close) break;

    slots.push({ start: new Date(cursor), end: next });
    cursor = next;
  }

  return slots;
}

/**
 * Fetch bookings for a room on a day and mark which generated slots are booked.
 * We only treat status='active' as blocking a slot.
 */
export async function getRoomAvailabilityForDate(
  roomId: number,
  ymd: string,
): Promise<RoomAvailabilityDTO> {
  const supabase = await createSupabaseServer();

  // Settings drive slot size + max consecutive etc.
  const settings = await getSettings();

  const { start: dayStart, end: dayEnd } = utcBoundsFromYMD(ymd);

  // Get bookings for this room that overlap the day (active only).
  // We include any booking that might block a slot during the day.
  const { data: booked, error } = await supabase
    .from("bookings")
    .select("start_time, end_time")
    .eq("room_id", roomId)
    .eq("status", "active")
    // overlap day window: start < dayEnd AND end > dayStart
    .lt("start_time", dayEnd.toISOString())
    .gt("end_time", dayStart.toISOString());

  if (error) throw error;

  // Build generated slots for the day.
  // Default hours: 08:00–20:00 UTC => 12 x 60-min slots.
  const generated = generateDailySlots({
    dayStart,
    slotMinutes: settings.slot_minutes,
    openHourUtc: 8,
    closeHourUtc: 20,
  });

  // Determine if a generated slot is blocked by any booking overlap.
  // slot is booked if booking.start < slot.end AND booking.end > slot.start
  function slotIsBooked(slotStart: Date, slotEnd: Date) {
    for (const b of booked ?? []) {
      const bStart = Date.parse(b.start_time);
      const bEnd = Date.parse(b.end_time);
      if (bStart < slotEnd.getTime() && bEnd > slotStart.getTime()) return true;
    }
    return false;
  }

  const slots: Slot[] = generated.map(({ start, end }) => ({
    start: start.toISOString(),
    end: end.toISOString(),
    isBooked: slotIsBooked(start, end),
  }));

  return {
    roomId,
    date: ymd,
    slotMinutes: settings.slot_minutes,
    maxConsecutiveHours: settings.max_consecutive_hours,
    maxBookingDurationHours: settings.max_booking_duration_hours,
    slots,
  };
}
