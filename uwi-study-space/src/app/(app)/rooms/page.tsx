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
    <div>
      <h1 className="text-2xl font-semibold">Browse Rooms</h1>
      <p className="mt-1 text-sm text-gray-600">
        Filter rooms and click <b>Book</b> to reserve time.
      </p>
      
      <RoomsDatePicker maxDaysAhead={settingsForPicker.max_booking_window_days} />


      {/* Filters (client component) */}
      <RoomFilters />

      {/* Booking modal auto-opens when bookRoomId exists */}
      {bookingDTO ? <SlotPickerModalAutoOpen dto={bookingDTO} /> : null}


      {/* Rooms grid */}
      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
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