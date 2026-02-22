// src/app/(app)/rooms/page.tsx
import RoomFilters from "@/components/rooms/Filters";
import RoomCard from "@/components/rooms/RoomCard";
import RoomsDatePicker from "@/components/rooms/RoomsDatePicker";
import SlotPickerModalAutoOpen from "@/components/bookings/SlotPickerModalAutoOpen";

import { getRoomsFiltered } from "@/lib/db/queries";
import { getSettings } from "@/lib/db/bookings";
import { getRoomById } from "@/lib/db/rooms";
import { getRoomAvailabilityForDate } from "@/lib/db/availability";
import { createSupabaseServer } from "@/lib/supabase/server";

// -----------------------------
// Trinidad time helpers (UTC-4)
// -----------------------------
const TT_OFFSET = "-04:00";

function getTtYMDNow() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Port_of_Spain",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());

  const yyyy = parts.find((p) => p.type === "year")?.value ?? "1970";
  const mm = parts.find((p) => p.type === "month")?.value ?? "01";
  const dd = parts.find((p) => p.type === "day")?.value ?? "01";
  return `${yyyy}-${mm}-${dd}`;
}

function addDaysYmd(ymd: string, days: number) {
  const [y, m, d] = ymd.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + days);
  return dt.toISOString().slice(0, 10);
}

function isWeekendYmd(ymd: string) {
  const [y, m, d] = ymd.split("-").map(Number);
  const day = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return day === 0 || day === 6;
}

function normalizeBookableDate(ymd: string, maxDaysAhead: number) {
  const today = getTtYMDNow();
  const max = addDaysYmd(today, maxDaysAhead);

  let iso = ymd < today ? today : ymd > max ? max : ymd;

  if (!isWeekendYmd(iso)) return iso;

  let forward = iso;
  while (forward <= max) {
    if (!isWeekendYmd(forward)) return forward;
    forward = addDaysYmd(forward, 1);
  }

  let backward = iso;
  while (backward >= today) {
    if (!isWeekendYmd(backward)) return backward;
    backward = addDaysYmd(backward, -1);
  }

  return today;
}

function getTtMinutesNow() {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "America/Port_of_Spain",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(new Date());

  const hh = Number(parts.find((p) => p.type === "hour")?.value ?? "0");
  const mm = Number(parts.find((p) => p.type === "minute")?.value ?? "0");
  return hh * 60 + mm;
}

function minutesToLabel(mins: number) {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function dowForTtDate(ymd: string) {
  const d = new Date(`${ymd}T12:00:00${TT_OFFSET}`);
  return d.getUTCDay();
}

function ttDayBoundsUtcISO(ymd: string) {
  const startLocal = new Date(`${ymd}T00:00:00${TT_OFFSET}`);
  const endLocal = new Date(`${ymd}T23:59:59.999${TT_OFFSET}`);
  return {
    dayStartUtcISO: startLocal.toISOString(),
    dayEndUtcISO: endLocal.toISOString(),
  };
}

function todayISODate() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

type RoomCardStatus = {
  isClosed: boolean;
  blackoutReason: string | null;
  openLabel: string;
  openNow: boolean | null;
};

// -----------------------------
// Main Component
// -----------------------------
export default async function RoomsPage(props: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const searchParams = await props.searchParams;
  const settingsForPicker = await getSettings();

  // 1) Filters
  const building = typeof searchParams.building === "string" ? searchParams.building : undefined;
  const amenity = typeof searchParams.amenity === "string" ? searchParams.amenity : undefined;
  const minCapacityRaw = typeof searchParams.minCapacity === "string" ? searchParams.minCapacity : undefined;
  const minCapacityNum = minCapacityRaw ? Number(minCapacityRaw) : undefined;

  const rooms = await getRoomsFiltered({
    building: building?.trim() || undefined,
    amenity: amenity?.trim() || undefined,
    minCapacity: Number.isFinite(minCapacityNum) ? minCapacityNum : undefined,
  });

  // 2) Fetch Favorites & Sort
  const supabase = await createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  
  const favoriteRoomIds = new Set<number>();
  
  if (user) {
    const { data: favorites } = await supabase
      .from("user_favorites")
      .select("room_id")
      .eq("user_id", user.id);
      
    favorites?.forEach((f) => favoriteRoomIds.add(Number(f.room_id)));
  }

  rooms.sort((a, b) => {
    const aFav = favoriteRoomIds.has(Number(a.id)) ? 1 : 0;
    const bFav = favoriteRoomIds.has(Number(b.id)) ? 1 : 0;
    if (aFav !== bFav) return bFav - aFav;
    return 0; 
  });

  // 3) Modal query params & DTO
  const bookRoomIdRaw = typeof searchParams.bookRoomId === "string" ? searchParams.bookRoomId : undefined;
  const bookRoomId = bookRoomIdRaw && /^\d+$/.test(bookRoomIdRaw) ? Number(bookRoomIdRaw) : null;
  const selectedDate = typeof searchParams.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(searchParams.date) ? searchParams.date : todayISODate();

  let bookingDTO:
    | null
    | {
        roomId: number;
        roomName: string;
        date: string;
        slots: { start: string; end: string; isBooked: boolean }[];
        slotMinutes: number;
        bufferMinutes: number;
        maxConsecutive: number;
        maxDurationHours: number;
      } = null;

  if (bookRoomId) {
    const room = await getRoomById(bookRoomId);
    if (room) {
      const avail = await getRoomAvailabilityForDate(bookRoomId, selectedDate);
      bookingDTO = {
        roomId: bookRoomId,
        roomName: room.name,
        date: selectedDate,
        slots: avail.slots,
        slotMinutes: avail.slotMinutes,
        bufferMinutes: avail.bufferMinutes,
        maxConsecutive: avail.maxConsecutiveHours,
        maxDurationHours: avail.maxBookingDurationHours,
      };
    }
  }

  // 4) Compute card status
  const roomIds = rooms.map((r: any) => Number(r.id)).filter((x) => Number.isFinite(x));
  const todayTT = getTtYMDNow();
  const nowMinTT = getTtMinutesNow();

  const dow = dowForTtDate(selectedDate);
  const { dayStartUtcISO, dayEndUtcISO } = ttDayBoundsUtcISO(selectedDate);

  const hoursRows = roomIds.length === 0 ? [] : (
      await supabase
        .from("room_opening_hours")
        .select("room_id, open_minute, close_minute, is_closed")
        .in("room_id", roomIds)
        .eq("day_of_week", dow)
    ).data ?? [];

  const blackouts = roomIds.length === 0 ? [] : (
      await supabase
        .from("room_blackouts")
        .select("room_id, reason, start_time, end_time")
        .in("room_id", roomIds)
        .lt("start_time", dayEndUtcISO)
        .gt("end_time", dayStartUtcISO)
    ).data ?? [];

  const hoursMap = new Map<number, { open_minute: number; close_minute: number; is_closed: boolean }>();
  for (const h of hoursRows as any[]) {
    hoursMap.set(Number(h.room_id), {
      open_minute: Number(h.open_minute ?? 480),
      close_minute: Number(h.close_minute ?? 1200),
      is_closed: Boolean(h.is_closed ?? false),
    });
  }

  const blackoutMap = new Map<number, string>();
  for (const b of blackouts as any[]) {
    const rid = Number(b.room_id);
    if (!blackoutMap.has(rid)) {
      blackoutMap.set(rid, String(b.reason ?? "Temporarily unavailable"));
    }
  }

  function computeStatus(roomId: number): RoomCardStatus {
    const hrs = hoursMap.get(roomId);
    const isClosedDay = hrs ? Boolean(hrs.is_closed) : true;
    const openMin = hrs ? Number(hrs.open_minute) : 0;
    const closeMin = hrs ? Number(hrs.close_minute) : 0;
    const blackoutReason = blackoutMap.get(roomId) ?? null;
    const openLabel = hrs && closeMin > openMin ? `${minutesToLabel(openMin)}–${minutesToLabel(closeMin)}` : "—";
    const isToday = selectedDate === todayTT;
    const isClosed = isClosedDay;
    const outsideHoursNow = isToday && hrs ? nowMinTT < openMin || nowMinTT >= closeMin : false;
    const openNow = isToday && hrs ? !isClosedDay && !outsideHoursNow && blackoutReason == null : null;

    return { isClosed, blackoutReason, openLabel, openNow };
  }

  return (
    <div className="space-y-8 pb-6">
      <section className="overflow-hidden rounded-[32px] border border-[var(--color-border-light)] p-6 shadow-[0_18px_50px_rgba(0,53,149,0.08)] md:p-8">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-[var(--color-text-light)] md:text-4xl">
              Browse Rooms
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--color-text-light)]/72 md:text-base">
              Discover available study rooms, compare amenities, and reserve the best space for your session.
            </p>
          </div>

          <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
            <div className="mt-3 text-xs font-medium text-gray-500">
              <RoomsDatePicker maxDaysAhead={settingsForPicker.max_booking_window_days} />
            </div>
          </div>
        </div>
      </section>

      <RoomFilters />

      {bookingDTO ? <SlotPickerModalAutoOpen dto={bookingDTO} /> : null}

      {rooms.length === 0 ? (
        <div className="rounded-[28px] border border-dashed border-[var(--color-border-light)] bg-[var(--color-background-light)] px-6 py-12 text-center shadow-sm">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-[var(--color-primary-soft)]">
            <svg
              aria-hidden="true"
              viewBox="0 0 24 24"
              className="h-6 w-6 text-[var(--color-primary)]"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <circle cx="11" cy="11" r="7" />
              <path d="m20 20-3.5-3.5" />
            </svg>
          </div>

          <h3 className="text-lg font-bold text-[var(--color-text-light)]">No rooms matched your filters</h3>
          <p className="mt-2 text-sm text-[var(--color-text-light)]/65">
            Try a different building, a smaller minimum capacity, or clear the amenity field.
          </p>
        </div>
      ) : (
        <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {rooms.map((r: any) => {
            const rid = Number(r.id);
            const isFav = favoriteRoomIds.has(rid);

            return (
              <RoomCard
                key={String(r.id)}
                room={r}
                preserve={{
                  building: building?.trim() || undefined,
                  amenity: amenity?.trim() || undefined,
                  minCapacityRaw,
                  date: selectedDate,
                }}
                status={Number.isFinite(rid) ? computeStatus(rid) : undefined}
                isFavorited={isFav}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}