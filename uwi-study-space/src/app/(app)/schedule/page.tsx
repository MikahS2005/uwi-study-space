// src/app/(app)/schedule/page.tsx
import { redirect } from "next/navigation";
import { createSupabaseServer } from "@/lib/supabase/server";
import { getSettings } from "@/lib/db/bookings";
import { getRoomsForSchedule, getActiveBookingsBetweenForSchedule } from "@/lib/db/schedule";
import { buildScheduleMonthDTO } from "@/lib/schedule/buildMonthDTO";
import ScheduleClient from "@/components/schedule/ScheduleClient";


// ✅ reuse your existing logic for slot building
import { getRoomById, getActiveBookingsForRoomBetween } from "@/lib/db/rooms";
import { buildSlotsForDay, startOfDay, endOfDay } from "@/lib/booking/time";
import SlotPickerModalAutoOpen from "@/components/bookings/SlotPickerModalAutoOpen";
import { getRoomAvailabilityForDate } from "@/lib/db/availability";

export default async function SchedulePage(props: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const sp = await props.searchParams;

  // month=YYYY-MM
  const month =
    typeof sp.month === "string" && /^\d{4}-\d{2}$/.test(sp.month)
      ? sp.month
      : new Date().toISOString().slice(0, 7);

  // selected=YYYY-MM-DD
  const selected =
    typeof sp.selected === "string" && /^\d{4}-\d{2}-\d{2}$/.test(sp.selected) ? sp.selected : "";

  // roomId=number OR "all" (calendar filter)
  const roomIdRaw = typeof sp.roomId === "string" ? sp.roomId : "all";
  const roomId = roomIdRaw !== "all" && /^\d+$/.test(roomIdRaw) ? Number(roomIdRaw) : null;

  // ✅ NEW: bookRoomId=number (opens modal on schedule)
  const bookRoomIdRaw = typeof sp.bookRoomId === "string" ? sp.bookRoomId : undefined;
  const bookRoomId =
    bookRoomIdRaw && /^\d+$/.test(bookRoomIdRaw) ? Number(bookRoomIdRaw) : null;

  const settings = await getSettings();
  const rooms = await getRoomsForSchedule();

  // Month window
  const monthStartISO = `${month}-01T00:00:00.000Z`;
  const monthStart = new Date(monthStartISO);
  if (Number.isNaN(monthStart.getTime())) redirect("/schedule");

  const monthEnd = new Date(
    Date.UTC(monthStart.getUTCFullYear(), monthStart.getUTCMonth() + 1, 1, 0, 0, 0),
  );
  const monthEndISO = monthEnd.toISOString();

  // Active bookings for month window (calendar snapshots)
  const monthBookings = await getActiveBookingsBetweenForSchedule(
    monthStartISO,
    monthEndISO,
    roomId,
  );

  const dto = buildScheduleMonthDTO({
    month,
    selected,
    roomId: roomId ?? "all",
    rooms,
    bookings: monthBookings,
    slotMinutes: settings.slot_minutes,
    openHour: 8,
    closeHour: 21,
  });

  // ✅ NEW: build bookingDTO for modal if selected+bookRoomId exist
    let bookingDTO:
  | null
  | {
      roomId: number;
      roomName: string;
      date: string;
      slots: { start: string; end: string; isBooked: boolean }[];
      slotMinutes: number;
      bufferMinutes: number,
      maxConsecutive: number;
      maxDurationHours: number;
    } = null;

if (bookRoomId && selected) {
  const room = await getRoomById(bookRoomId);
  if (room) {
    const avail = await getRoomAvailabilityForDate(bookRoomId, selected);

    bookingDTO = {
      roomId: bookRoomId,
      roomName: room.name, // ✅ fixes TS error
      date: selected,
      slots: avail.slots,
      slotMinutes: avail.slotMinutes,
      bufferMinutes: avail.bufferMinutes,
      maxConsecutive: avail.maxConsecutiveHours,
      maxDurationHours: avail.maxBookingDurationHours,
    };
  }
}

  return (
    <div className="p-6">
      {/* ✅ auto-open modal when bookRoomId is present */}
      {bookingDTO ? <SlotPickerModalAutoOpen dto={bookingDTO} /> : null}

      <ScheduleClient dto={dto} />
    </div>
  );
}
