// src/app/(app)/rooms/page.tsx
import Link from "next/link";
import RoomFilters from "@/components/rooms/Filters";
import { getBookedRoomIdsBetween, getRoomsFiltered } from "@/lib/db/queries";

import { getSettings } from "@/lib/db/bookings";
import { getRoomById, getActiveBookingsForRoomBetween } from "@/lib/db/rooms";
import { buildSlotsForDay, startOfDay, endOfDay } from "@/lib/booking/time";
import SlotPickerModalAutoOpen from "@/components/bookings/SlotPickerModalAutoOpen";
import RoomCard from "@/components/rooms/RoomCard";
import RoomsDatePicker from "@/components/rooms/RoomsDatePicker";



/**
 * Build ISO for today bounds (server-side).
 * Used for "booked today" indicator only.
 */
function startOfTodayISO() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

function endOfTodayISO() {
  const d = new Date();
  d.setHours(23, 59, 59, 999);
  return d.toISOString();
}

function todayISODate() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export default async function RoomsPage(props: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const searchParams = await props.searchParams;
  // Settings used to constrain the date picker (booking window)
  const settingsForPicker = await getSettings();


  // ---------------------------
  // 1) Filters (existing)
  // ---------------------------
  const building = typeof searchParams.building === "string" ? searchParams.building : undefined;
  const amenity = typeof searchParams.amenity === "string" ? searchParams.amenity : undefined;

  const minCapacityRaw =
    typeof searchParams.minCapacity === "string" ? searchParams.minCapacity : undefined;
  const minCapacityNum = minCapacityRaw ? Number(minCapacityRaw) : undefined;

  const rooms = await getRoomsFiltered({
    building: building?.trim() || undefined,
    amenity: amenity?.trim() || undefined,
    minCapacity: Number.isFinite(minCapacityNum) ? minCapacityNum : undefined,
  });

  

  // ---------------------------
  // 2) Booking modal query params
  // ---------------------------
  // Example: /rooms?bookRoomId=12&date=2026-02-16
  const bookRoomIdRaw =
    typeof searchParams.bookRoomId === "string" ? searchParams.bookRoomId : undefined;
  const bookRoomId = bookRoomIdRaw && /^\d+$/.test(bookRoomIdRaw) ? Number(bookRoomIdRaw) : null;

  const selectedDate =
    typeof searchParams.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(searchParams.date)
      ? searchParams.date
      : todayISODate();

  // ---------------------------
  // 3) If a room is selected for booking, load slots for that room+date
  //    (Only for the selected room; do NOT do this for every room in the list.)
  // ---------------------------
  let bookingDTO:
    | null
    | {
        roomId: number;
        roomName: string;
        date: string;
        slots: { start: string; end: string; isBooked: boolean }[];
        slotMinutes: number;
        maxConsecutive: number;
        maxDurationHours: number;
      } = null;

  if (bookRoomId) {
    const settings = await getSettings();

    // Ensure room exists
    const room = await getRoomById(bookRoomId);
    if (room) {
      const dayStart = startOfDay(selectedDate);
      const dayEnd = endOfDay(selectedDate);

      if (dayStart && dayEnd) {
        const bookings = await getActiveBookingsForRoomBetween(
          bookRoomId,
          dayStart.toISOString(),
          dayEnd.toISOString(),
        );

        // For now keep hours hardcoded; later can be a settings/table value.
        const openHour = 8;
        const closeHour = 21;

        const slots = buildSlotsForDay(selectedDate, settings.slot_minutes, openHour, closeHour).map(
          (s) => {
            const isBooked = bookings.some(
              (b) =>
                new Date(b.start_time) < new Date(s.end) &&
                new Date(b.end_time) > new Date(s.start),
            );
            return { ...s, isBooked };
          },
        );

        bookingDTO = {
          roomId: bookRoomId,
          roomName: room.name,
          date: selectedDate,
          slots,
          slotMinutes: settings.slot_minutes,
          maxConsecutive: settings.max_consecutive_hours,
          maxDurationHours: settings.max_booking_duration_hours,
        };
      }
    }
  }

return (
  <div className="space-y-8">
    <div>
      {/* 1. Header: Increased size and switched to black/bold */}
      <h1 className="text-3xl font-bold text-black tracking-tight">
        Browse Rooms
      </h1>
      
      {/* 2. Instructions: Darkened to text-gray-800 for legibility */}
      <p className="mt-2 text-sm font-medium text-gray-800">
        Filter rooms and click <b className="text-black">Book Room</b> to reserve time.
      </p>
    </div>
    
    {/* 3. Booking Date Section: Added a border and darkened labels */}
    <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
      <div className="mt-3 text-xs font-medium text-gray-500">
        <RoomsDatePicker maxDaysAhead={settingsForPicker.max_booking_window_days} />
      </div>
    </div>

    {/* Filters Component */}
    <RoomFilters />

    {/* Booking modal auto-opens when bookRoomId exists */}
    {bookingDTO ? <SlotPickerModalAutoOpen dto={bookingDTO} /> : null}

    {/* Rooms grid */}
    <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {rooms.map((r) => (
        <RoomCard
          key={String(r.id)}
          room={r as any}
          preserve={{
            building: building?.trim() || undefined,
            amenity: amenity?.trim() || undefined,
            minCapacityRaw: minCapacityRaw,
            date: selectedDate,
          }}
        />
      ))}
    </div>
  </div>
);
}