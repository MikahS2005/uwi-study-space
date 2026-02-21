// src/lib/utils/datetime.ts

export const CAMPUS_TZ = "America/Port_of_Spain";

/**
 * Formats ISO string into Trinidad local date/time.
 */
export function formatTtDateTime(iso: string | null | undefined) {
  if (!iso) return "—";

  return new Intl.DateTimeFormat("en-GB", {
    timeZone: CAMPUS_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

/**
 * Returns today's YYYY-MM-DD in TT.
 */
export function todayYmdTt() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: CAMPUS_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());

  const yyyy = parts.find((p) => p.type === "year")?.value ?? "1970";
  const mm = parts.find((p) => p.type === "month")?.value ?? "01";
  const dd = parts.find((p) => p.type === "day")?.value ?? "01";

  return `${yyyy}-${mm}-${dd}`;
}