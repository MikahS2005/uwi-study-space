// src/lib/db/availability.ts
import "server-only";
import { createSupabaseServer } from "@/lib/supabase/server";
import { getSettings } from "@/lib/db/bookings";

export type Slot = { start: string; end: string; isBooked: boolean };

export type RoomAvailabilityDTO = {
  roomId: number;
  date: string; // YYYY-MM-DD (campus local day)
  slotMinutes: number;
  bufferMinutes: number; 
  maxConsecutiveHours: number;
  maxBookingDurationHours: number;
  slots: Slot[];
};

// Trinidad has no DST → fixed offset is safe.
const CAMPUS_TZ_OFFSET = "-04:00";

// ---------- time helpers (local campus day) ----------
function minutesToHHMM(mins: number) {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/**
 * Build an ISO string interpreted as campus local time.
 * Example: 2026-02-20 + 480 => "2026-02-20T08:00:00-04:00"
 */
function campusISOFromDayAndMinute(ymd: string, minute: number) {
  // minute can be 0..1440 (we mostly stay <= 1439 for slot starts)
  const hhmm = minutesToHHMM(Math.min(minute, 1439));
  return `${ymd}T${hhmm}:00${CAMPUS_TZ_OFFSET}`;
}

/**
 * Campus-local day boundaries converted to UTC ISO strings for DB queries.
 * This is KEY: we query DB in UTC, but define the window using campus-local day.
 */
function campusDayBoundsUtcISO(ymd: string) {
  const startLocal = new Date(`${ymd}T00:00:00${CAMPUS_TZ_OFFSET}`);
  const endLocal = new Date(`${ymd}T23:59:59.999${CAMPUS_TZ_OFFSET}`);
  return {
    dayStartUtcISO: startLocal.toISOString(),
    dayEndUtcISO: endLocal.toISOString(),
    // For day-of-week row selection (0=Sun..6=Sat) in campus local time:
    dowLocal: startLocal.getDay(),
  };
}

function overlapsMs(aStart: number, aEnd: number, bStart: number, bEnd: number) {
  // [aStart,aEnd) overlaps [bStart,bEnd)
  return aStart < bEnd && aEnd > bStart;
}

/**
 * Generate slot start/end ISO strings (campus local) inside open/close minutes.
 */
function generateSlotsByMinutes(params: {
  ymd: string;
  slotMinutes: number;
  openMinute: number; // 0..1439
  closeMinute: number; // 1..1440
}) {
  const { ymd, slotMinutes, openMinute, closeMinute } = params;

  const slots: Array<{ startISO: string; endISO: string; startMs: number; endMs: number }> = [];

  let cursorMin = openMinute;

  while (cursorMin + slotMinutes <= closeMinute) {
    const startISO = campusISOFromDayAndMinute(ymd, cursorMin);

    // End minute could theoretically equal 1440 (00:00 next day). We keep it simple:
    // if it hits 1440, represent it as 23:59 for display, but MS comparison still works
    // because your slotMinutes is 60 and your closeMinute usually <= 1439 anyway.
    const endISO = campusISOFromDayAndMinute(ymd, cursorMin + slotMinutes);

    const startMs = Date.parse(startISO);
    const endMs = Date.parse(endISO);

    slots.push({ startISO, endISO, startMs, endMs });
    cursorMin += slotMinutes;
  }

  return slots;
}

export async function getRoomAvailabilityForDate(
  roomId: number,
  ymd: string,
): Promise<RoomAvailabilityDTO> {
  const supabase = await createSupabaseServer();
  const settings = await getSettings();

  // 1) Room status + buffer
  const { data: room, error: roomErr } = await supabase
    .from("rooms")
    .select("id, is_active, buffer_minutes")
    .eq("id", roomId)
    .maybeSingle();

  if (roomErr) throw roomErr;

  // If room missing / inactive, still return a valid DTO shape
  if (!room || room.is_active === false) {
    return {
      roomId,
      date: ymd,
      slotMinutes: settings.slot_minutes,
      bufferMinutes: 0, // ✅ required
      maxConsecutiveHours: settings.max_consecutive_hours,
      maxBookingDurationHours: settings.max_booking_duration_hours,
      slots: [],
    };
  }

  const buffer = Number(room.buffer_minutes ?? 0);

  // 2) Campus-local day bounds (converted to UTC for DB filters) + local DOW
  const { dayStartUtcISO, dayEndUtcISO, dowLocal } = campusDayBoundsUtcISO(ymd);

  // 3) Opening hours row for that LOCAL day
  const { data: hoursRow, error: hrsErr } = await supabase
    .from("room_opening_hours")
    .select("open_minute, close_minute, is_closed")
    .eq("room_id", roomId)
    .eq("day_of_week", dowLocal)
    .maybeSingle();

  if (hrsErr) throw hrsErr;

  const openMinute = Number(hoursRow?.open_minute ?? 480);
  const closeMinute = Number(hoursRow?.close_minute ?? 1200);
  const isClosed = Boolean(hoursRow?.is_closed ?? false);

  if (isClosed) {
    return {
      roomId,
      date: ymd,
      slotMinutes: settings.slot_minutes,
      bufferMinutes: buffer, // ✅ required
      maxConsecutiveHours: settings.max_consecutive_hours,
      maxBookingDurationHours: settings.max_booking_duration_hours,
      slots: [],
    };
  }

  // 4) Pull active bookings overlapping the campus-local day window (using UTC timestamps)
  const { data: booked, error: bookedErr } = await supabase
    .from("bookings")
    .select("start_time, end_time")
    .eq("room_id", roomId)
    .eq("status", "active")
    .lt("start_time", dayEndUtcISO)
    .gt("end_time", dayStartUtcISO);

  if (bookedErr) throw bookedErr;

  // 5) Pull blackouts overlapping campus-local day window
  const { data: blackouts, error: blkErr } = await supabase
    .from("room_blackouts")
    .select("start_time, end_time")
    .eq("room_id", roomId)
    .lt("start_time", dayEndUtcISO)
    .gt("end_time", dayStartUtcISO);

  if (blkErr) throw blkErr;

  // 6) Generate slots (campus-local ISO strings) inside opening window
  const generated = generateSlotsByMinutes({
    ymd,
    slotMinutes: settings.slot_minutes,
    openMinute,
    closeMinute,
  });

  // 7) Block slots if overlap booking or blackout (with buffer)
  function slotIsBlocked(slotStartMs: number, slotEndMs: number) {
    const slotStartBuf = slotStartMs - buffer * 60_000;
    const slotEndBuf = slotEndMs + buffer * 60_000;

    for (const b of booked ?? []) {
      const b0 = Date.parse(b.start_time);
      const b1 = Date.parse(b.end_time);
      const b0Buf = b0 - buffer * 60_000;
      const b1Buf = b1 + buffer * 60_000;

      if (overlapsMs(slotStartBuf, slotEndBuf, b0Buf, b1Buf)) return true;
    }

    for (const blk of blackouts ?? []) {
      const x0 = Date.parse(blk.start_time);
      const x1 = Date.parse(blk.end_time);
      if (overlapsMs(slotStartMs, slotEndMs, x0, x1)) return true;
    }

    return false;
  }

  const slots: Slot[] = generated.map((s) => ({
    start: s.startISO,
    end: s.endISO,
    isBooked: slotIsBlocked(s.startMs, s.endMs),
  }));

  return {
    roomId,
    date: ymd,
    slotMinutes: settings.slot_minutes,
    bufferMinutes: buffer, // ✅ FIXED (was `number;`)
    maxConsecutiveHours: settings.max_consecutive_hours,
    maxBookingDurationHours: settings.max_booking_duration_hours,
    slots,
  };
}