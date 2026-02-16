const SLOT_MINUTES_DEFAULT = 60;

function parseYMD(ymd: string) {
  // expects "YYYY-MM-DD"
  const [y, m, d] = ymd.split("-").map(Number);
  if (!y || !m || !d) return null;
  return { y, m, d };
}

/**
 * Start of the given day in UTC (00:00:00.000Z).
 * Using UTC avoids timezone shifting bugs.
 */
export function startOfDay(ymd: string): Date | null {
  const dt = parseYMD(ymd);
  if (!dt) return null;

  // ✅ Build a real Date in UTC
  return new Date(Date.UTC(dt.y, dt.m - 1, dt.d, 0, 0, 0, 0));
}

/**
 * End of the given day in UTC (23:59:59.999Z).
 */
export function endOfDay(ymd: string): Date | null {
  const dt = parseYMD(ymd);
  if (!dt) return null;

  // ✅ Build a real Date in UTC
  return new Date(Date.UTC(dt.y, dt.m - 1, dt.d, 23, 59, 59, 999));
}

/**
 * Build slots for a given day using UTC timestamps (prevents date shifting).
 * startHour/endHour are in 24h time (e.g. 8..21).
 */
export function buildSlotsForDay(
  ymd: string,
  slotMinutes = SLOT_MINUTES_DEFAULT,
  startHour = 8,
  endHour = 21,
) {
  const p = parseYMD(ymd);
  if (!p) return [];

  const slots: { start: string; end: string }[] = [];

  for (let h = startHour; h < endHour; h += 1) {
    const startMs = Date.UTC(p.y, p.m - 1, p.d, h, 0, 0, 0);
    const endMs = startMs + slotMinutes * 60 * 1000;

    slots.push({
      start: new Date(startMs).toISOString(),
      end: new Date(endMs).toISOString(),
    });
  }

  return slots;
}

/**
 * Format time for display.
 * NOTE: This formats in the user's local timezone (fine for UI),
 * while the underlying slot math stays UTC-stable.
 */
export function fmtTime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}
