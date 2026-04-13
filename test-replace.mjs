import { read_file } from "fs/promises";

const filePath = "/workspaces/uwi-study-space/uwi-study-space/src/components/bookings/SlotPicker.tsx";
const content = await read_file(filePath, "utf-8");

const oldCode = `  try {
    const res = await fetch("/api/waitlist/join", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        roomId,
        startISO: bookingRange.start,
        endISO: bookingRange.end,
      }),
    });`;

const newCode = `  try {
    const res = await fetch("/api/waitlist/join", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        roomId,
        startISO: bookingRange.start,
        endISO: bookingRange.end,
        attendeeCount,
      }),
    });`;

const updated = content.replace(oldCode, newCode);
if (updated === content) {
  console.log("NO MATCH FOUND");
  console.log("Looking for:\n", oldCode);
} else {
  console.log("MATCH FOUND AND REPLACED");
}
