// src/lib/booking/rules.ts
import {
  countUserBookingsForDay,
  countUserNoShowsInWindow,
  getSettings,
  getUserBookingsForDay,
  roomHasOverlap,
  userHasOverlap,
} from "@/lib/db/bookings";

import { createSupabaseServer } from "@/lib/supabase/server";

/* =============================================================================
  Timezone helpers (Trinidad / campus local)
  - Use these everywhere in this file so "day", "DOW", "minutes" are consistent
============================================================================= */

const CAMPUS_TZ = "America/Port_of_Spain"; // Trinidad & Tobago (no DST)

/**
 * Extract Trinidad-local YYYY-MM-DD and minutes-since-midnight and DOW (0=Sun..6=Sat)
 * from an ISO timestamp string (can be Z or -04:00; Date() normalizes).
 */
function getTtPartsFromISO(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;

  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: CAMPUS_TZ,
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(d);

  const hh = Number(parts.find((p) => p.type === "hour")?.value ?? "0");
  const mm = Number(parts.find((p) => p.type === "minute")?.value ?? "0");
  const minutes = hh * 60 + mm;

  const yyyy = parts.find((p) => p.type === "year")?.value ?? "1970";
  const mo = parts.find((p) => p.type === "month")?.value ?? "01";
  const dd = parts.find((p) => p.type === "day")?.value ?? "01";
  const ymd = `${yyyy}-${mo}-${dd}`;

  const wd = parts.find((p) => p.type === "weekday")?.value ?? "Sun";
  const map: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  };
  const dow = map[wd] ?? 0;

  return { ymd, dow, minutes };
}

/**
 * Trinidad-local "today" (YYYY-MM-DD) based on current time in campus tz.
 */
function getTtYMDNow() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: CAMPUS_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());

  const yyyy = parts.find((p) => p.type === "year")?.value ?? "1970";
  const mo = parts.find((p) => p.type === "month")?.value ?? "01";
  const dd = parts.find((p) => p.type === "day")?.value ?? "01";
  return `${yyyy}-${mo}-${dd}`;
}

/* =============================================================================
  Core validation helpers
============================================================================= */

/**
 * Validate:
 * - ISO timestamps parse correctly
 * - end > start
 * - duration is in slotMinutes blocks
 * - duration does not exceed maxDurationHours
 */
function validateSlotMinutes(
  startISO: string,
  endISO: string,
  slotMinutes: number,
  maxDurationHours: number,
) {
  const start = new Date(startISO);
  const end = new Date(endISO);

  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return "Invalid start/end time.";
  }
  if (end <= start) return "End time must be after start time.";

  const diffMin = (end.getTime() - start.getTime()) / (1000 * 60);

  // must be a whole number of slots (e.g., 60/120/180)
  if (diffMin % slotMinutes !== 0) {
    return `Duration must be in ${slotMinutes}-minute blocks.`;
  }

  // enforce configured maximum duration
  if (diffMin > maxDurationHours * 60) {
    return `Maximum duration is ${maxDurationHours} hour(s).`;
  }

  // enforce at least one slot
  if (diffMin < slotMinutes) {
    return `Minimum duration is ${slotMinutes} minutes.`;
  }

  return null;
}

/**
 * Enforce booking window (Trinidad-local day basis):
 * - cannot book in the past (compared to TT today)
 * - cannot book more than maxDaysAhead TT-days into the future
 */
function validateMaxDaysAhead_TT(startISO: string, maxDaysAhead: number) {
  const startParts = getTtPartsFromISO(startISO);
  if (!startParts) return "Invalid start time.";

  const todayYMD = getTtYMDNow();

  // Compare by day using noon anchors to avoid edge cases
  const startNoon = new Date(`${startParts.ymd}T12:00:00-04:00`).getTime();
  const todayNoon = new Date(`${todayYMD}T12:00:00-04:00`).getTime();

  const diffDays = Math.floor((startNoon - todayNoon) / (1000 * 60 * 60 * 24));

  if (diffDays < 0) return "Cannot book in the past.";
  if (diffDays > maxDaysAhead) return `Can only book up to ${maxDaysAhead} day(s) ahead.`;

  return null;
}

/**
 * Expand a booking [start, end) into discrete slot start *milliseconds*.
 * This avoids fragile string equality across offsets/Z.
 */
function expandSlotStartMs(startISO: string, endISO: string, slotMinutes: number) {
  const starts: number[] = [];
  const start = new Date(startISO);
  const end = new Date(endISO);

  let cursor = start.getTime();
  const endMs = end.getTime();
  const step = slotMinutes * 60 * 1000;

  while (cursor < endMs) {
    starts.push(cursor);
    cursor += step;
  }

  return starts;
}

/**
 * Determine if adding the requested slot starts would exceed max consecutive slots.
 * We compute the longest run where adjacent starts differ by exactly slotMinutes.
 */
function exceedsMaxConsecutiveMs(
  existing: { start_time: string }[],
  requestedStartMs: number[],
  slotMinutes: number,
  maxConsecutiveSlots: number,
) {
  const all = new Set<number>();

  // Normalize existing bookings into slot start milliseconds.
  // IMPORTANT: We assume each stored booking start_time already aligns to slot boundaries.
  for (const b of existing) {
    const ms = Date.parse(b.start_time);
    if (!Number.isNaN(ms)) all.add(ms);
  }

  for (const ms of requestedStartMs) all.add(ms);

  const sorted = Array.from(all).sort((a, b) => a - b);

  if (sorted.length === 0) return false;

  const step = slotMinutes * 60 * 1000;

  let best = 1;
  let run = 1;

  for (let i = 1; i < sorted.length; i++) {
    const diff = sorted[i] - sorted[i - 1];
    if (diff === step) {
      run += 1;
      best = Math.max(best, run);
    } else {
      run = 1;
    }
  }

  return best > maxConsecutiveSlots;
}

/* =============================================================================
  Opening-hours validation (Trinidad-local DOW + minutes)
============================================================================= */

async function validateWithinRoomHours_TT(roomId: number, startISO: string, endISO: string) {
  const supabase = await createSupabaseServer();

  const s = getTtPartsFromISO(startISO);
  const e = getTtPartsFromISO(endISO);

  if (!s || !e) return "Invalid start/end time.";

  // Enforce same TT-local day
  if (s.ymd !== e.ymd) return "Booking must start and end on the same day.";

  const { data: hours, error } = await supabase
    .from("room_opening_hours")
    .select("open_minute, close_minute, is_closed")
    .eq("room_id", roomId)
    .eq("day_of_week", s.dow)
    .maybeSingle();

  if (error) return "Unable to check opening hours.";
  if (!hours || hours.is_closed) return "This room is closed on that day.";

  // start must be >= open, end must be <= close
  if (s.minutes < hours.open_minute || e.minutes > hours.close_minute) {
    return "Selected time is outside this room’s opening hours.";
  }

  return null;
}

/* =============================================================================
  Main validator (used by BOTH student + admin routes)
============================================================================= */

export async function validateBookingOrThrow(opts: {
  roomId: number;
  startISO: string;
  endISO: string;
  bookedForUserId: string;
  isStudentSelfBooking: boolean;
}) {
  const settings = await getSettings();

  // Gate #1: student booking toggle
  if (opts.isStudentSelfBooking && settings.student_booking_enabled === false) {
    return { ok: false as const, message: "Student self-booking is currently disabled." };
  }

  // Gate #2: no-show restriction (student self-booking only)
  if (opts.isStudentSelfBooking) {
    const noShows = await countUserNoShowsInWindow(
      opts.bookedForUserId,
      settings.no_show_window_days,
    );

    if (noShows >= settings.no_show_threshold) {
      return {
        ok: false as const,
        message: `Booking restricted due to excessive no-shows (${noShows} in the last ${settings.no_show_window_days} day(s)).`,
      };
    }
  }

  // Validate slot structure + max duration
  const slotErr = validateSlotMinutes(
    opts.startISO,
    opts.endISO,
    settings.slot_minutes,
    settings.max_booking_duration_hours,
  );
  if (slotErr) return { ok: false as const, message: slotErr };

  // Enforce booking horizon (TT-local)
  const daysErr = validateMaxDaysAhead_TT(opts.startISO, settings.max_booking_window_days);
  if (daysErr) return { ok: false as const, message: daysErr };

  // Enforce opening hours (TT-local)
  const hoursErr = await validateWithinRoomHours_TT(opts.roomId, opts.startISO, opts.endISO);
  if (hoursErr) return { ok: false as const, message: hoursErr };

  // Room overlap
  if (await roomHasOverlap(opts.roomId, opts.startISO, opts.endISO)) {
    return { ok: false as const, message: "That room is already booked for this time." };
  }

  // User overlap
  if (await userHasOverlap(opts.bookedForUserId, opts.startISO, opts.endISO)) {
    return {
      ok: false as const,
      message: "This user already has a booking that overlaps this time.",
    };
  }

  // TT-local day (for daily limits + consecutive checks)
  const startParts = getTtPartsFromISO(opts.startISO);
  if (!startParts) return { ok: false as const, message: "Invalid start time." };
  const ymdTT = startParts.ymd;

  // Daily limit (active bookings only)
  const count = await countUserBookingsForDay(opts.bookedForUserId, ymdTT);
  if (count >= settings.max_bookings_per_day) {
    return {
      ok: false as const,
      message: `Daily limit reached (${settings.max_bookings_per_day} booking(s) per day).`,
    };
  }

  // Max consecutive slots per TT-day (active bookings only)
  const existing = await getUserBookingsForDay(opts.bookedForUserId, ymdTT);

  // Expand requested booking into slot starts (ms) to prevent bypass
  const requestedStartsMs = expandSlotStartMs(
    opts.startISO,
    opts.endISO,
    settings.slot_minutes,
  );

  // ✅ FIX #1: convert hours -> slots
  const maxConsecutiveSlots = Math.max(
    1,
    Math.floor((settings.max_consecutive_hours * 60) / settings.slot_minutes),
  );

  if (
    exceedsMaxConsecutiveMs(
      existing,
      requestedStartsMs,
      settings.slot_minutes,
      maxConsecutiveSlots,
    )
  ) {
    return {
      ok: false as const,
      message: `Max consecutive booking limit is ${settings.max_consecutive_hours} hour(s).`,
    };
  }

  return { ok: true as const, settings };
}