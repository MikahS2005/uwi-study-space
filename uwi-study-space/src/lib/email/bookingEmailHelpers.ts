// src/lib/email/bookingEmailHelpers.ts
const CAMPUS_TZ = "America/Port_of_Spain";

export function formatTtDateTimeLabel(iso: string) {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: CAMPUS_TZ,
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  }).format(new Date(iso));
}

export function formatTtTimeLabel(iso: string) {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: CAMPUS_TZ,
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  }).format(new Date(iso));
}