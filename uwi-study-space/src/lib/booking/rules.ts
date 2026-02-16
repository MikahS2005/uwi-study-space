import {
  countUserBookingsForDay,
  countUserNoShowsInWindow,
  getSettings,
  getUserBookingsForDay,
  roomHasOverlap,
  userHasOverlap,
} from "@/lib/db/bookings";

/* ============================================================================
  Helpers
============================================================================ */

/**
 * Extract yyyy-mm-dd from an ISO string.
 * Example: "2026-02-07T14:00:00.000Z" -> "2026-02-07"
 */
function isoToYMD(iso: string) {
  return iso.slice(0, 10);
}

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

  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()))
    return "Invalid start/end time.";

  if (end <= start) return "End time must be after start time.";

  const diffMin = (end.getTime() - start.getTime()) / (1000 * 60);

  // must be a whole number of slots (e.g., 60/120/180)
  if (diffMin % slotMinutes !== 0)
    return `Duration must be in ${slotMinutes}-minute blocks.`;

  // enforce configured maximum duration
  if (diffMin > maxDurationHours * 60)
    return `Maximum duration is ${maxDurationHours} hour(s).`;

  // enforce at least one slot
  if (diffMin < slotMinutes)
    return `Minimum duration is ${slotMinutes} minutes.`;

  return null;
}

/**
 * Enforce booking window:
 * - cannot book in the past
 * - cannot book more than maxDaysAhead days into the future
 */
function validateMaxDaysAhead(startISO: string, maxDaysAhead: number) {
  const start = new Date(startISO);
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);

  const startDay = new Date(start);
  startDay.setUTCHours(0, 0, 0, 0);

  const diffDays = Math.floor(
    (startDay.getTime() - today.getTime()) / (1000 * 60 * 60 * 24),
  );

  if (diffDays < 0) return "Cannot book in the past.";
  if (diffDays > maxDaysAhead)
    return `Can only book up to ${maxDaysAhead} day(s) ahead.`;

  return null;
}

/**
 * Expand a booking [start, end) into discrete slot start times.
 * Example (slotMinutes=60):
 *   08:00–11:00 => [08:00, 09:00, 10:00]
 *
 * This is required so "max consecutive hours" cannot be bypassed by booking
 * multiple hours in a single request.
 */
function expandSlotStarts(startISO: string, endISO: string, slotMinutes: number) {
  const starts: string[] = [];
  const start = new Date(startISO);
  const end = new Date(endISO);

  let cursor = new Date(start);

  while (cursor < end) {
    starts.push(new Date(cursor).toISOString());
    cursor = new Date(cursor.getTime() + slotMinutes * 60 * 1000);
  }

  return starts;
}

/**
 * Determine if adding the requested slot starts would exceed max consecutive slots.
 * We compute the longest "run" where adjacent starts differ by exactly slotMinutes.
 */
function exceedsMaxConsecutive(
  existing: { start_time: string }[],
  requestedStarts: string[],
  slotMinutes: number,
  maxConsecutive: number,
) {
  const allStarts = new Set<string>();

  for (const b of existing) allStarts.add(b.start_time);
  for (const s of requestedStarts) allStarts.add(s);

  const sorted = Array.from(allStarts).sort(
    (a, b) => Date.parse(a) - Date.parse(b),
  );

  let best = 1;
  let run = 1;

  for (let i = 1; i < sorted.length; i++) {
    const prev = Date.parse(sorted[i - 1]);
    const cur = Date.parse(sorted[i]);
    const diffMin = (cur - prev) / (1000 * 60);

    if (diffMin === slotMinutes) {
      run += 1;
      best = Math.max(best, run);
    } else {
      run = 1;
    }
  }

  return best > maxConsecutive;
}

/* ============================================================================
  Main validator (used by BOTH student + admin routes)
============================================================================ */

export async function validateBookingOrThrow(opts: {
  roomId: number;
  startISO: string;
  endISO: string;
  bookedForUserId: string;
  isStudentSelfBooking: boolean;
}) {
  // Load configurable limits from the single settings row
  const settings = await getSettings();

  /**
   * Gate #1: student booking toggle
   * - Only blocks student self-booking
   * - Admin/Super Admin routes pass isStudentSelfBooking=false (so they can still book)
   */
  if (opts.isStudentSelfBooking && settings.student_booking_enabled === false) {
    return { ok: false, message: "Student self-booking is currently disabled." };
  }

  /**
   * Gate #2: no-show restriction (student self-booking only)
   * If a student reaches the threshold of no-shows in the rolling window, block booking.
   * Admin/Super Admin can still book on their behalf through the admin route.
   */
  if (opts.isStudentSelfBooking) {
    const noShows = await countUserNoShowsInWindow(
      opts.bookedForUserId,
      settings.no_show_window_days,
    );

    if (noShows >= settings.no_show_threshold) {
      return {
        ok: false,
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
  if (slotErr) return { ok: false, message: slotErr };

  // Enforce booking horizon
  const daysErr = validateMaxDaysAhead(opts.startISO, settings.max_booking_window_days);
  if (daysErr) return { ok: false, message: daysErr };

  // Room overlap
  if (await roomHasOverlap(opts.roomId, opts.startISO, opts.endISO)) {
    return { ok: false, message: "That room is already booked for this time." };
  }

  // User overlap
  if (await userHasOverlap(opts.bookedForUserId, opts.startISO, opts.endISO)) {
    return {
      ok: false,
      message: "This user already has a booking that overlaps this time.",
    };
  }

  // Daily limit (active bookings only)
  const ymd = isoToYMD(opts.startISO);
  const count = await countUserBookingsForDay(opts.bookedForUserId, ymd);

  if (count >= settings.max_bookings_per_day) {
    return {
      ok: false,
      message: `Daily limit reached (${settings.max_bookings_per_day} booking(s) per day).`,
    };
  }

  // Max consecutive slots per day (active bookings only)
  const existing = await getUserBookingsForDay(opts.bookedForUserId, ymd);

  // Expand requested booking into slot start times to prevent bypass
  const requestedStarts = expandSlotStarts(
    opts.startISO,
    opts.endISO,
    settings.slot_minutes,
  );

  if (
    exceedsMaxConsecutive(
      existing,
      requestedStarts,
      settings.slot_minutes,
      settings.max_consecutive_hours,
    )
  ) {
    return {
      ok: false,
      message: `Max consecutive booking limit is ${settings.max_consecutive_hours} hour(s).`,
    };
  }

  return { ok: true as const, settings };
}
