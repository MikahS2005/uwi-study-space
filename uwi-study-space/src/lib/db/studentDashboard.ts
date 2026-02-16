// src/lib/db/studentDashboard.ts
// Student dashboard read queries.
// IMPORTANT:
// - We still explicitly filter by booked_for_user_id even though RLS enforces it.
//   This makes intent clear and prevents accidental broad reads if policies change.

import "server-only";
import { createSupabaseServer } from "@/lib/supabase/server";

export type BookingStatus = "active" | "cancelled" | "no_show" | "completed";

export type StudentDashboardDTO = {
  stats: {
    activeBookings: number;
    upcomingToday: number;
    bookingsLeftToday: number;
    maxBookingsPerDay: number;
  };
  upcoming: Array<{
    id: number;
    room: { id: number; name: string; building: string; floor: string | null };
    start_time: string;
    end_time: string;
    status: BookingStatus;
    purpose: string | null;
  }>;
};

/**
 * Compute UTC "today" bounds.
 * NOTE: If you later want Trinidad local-day accuracy, compute with timezone.
 */
function utcDayBounds(d: Date) {
  const start = new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 0, 0, 0),
  );
  const end = new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + 1, 0, 0, 0),
  );
  return { startIso: start.toISOString(), endIso: end.toISOString() };
}

export async function getStudentDashboard(): Promise<StudentDashboardDTO> {
  const supabase = await createSupabaseServer();

  // 1) Auth user
  const {
    data: { user },
    error: userErr,
  } = await supabase.auth.getUser();

  if (userErr) throw userErr;
  if (!user) throw new Error("Unauthenticated");

  const now = new Date();
  const nowIso = now.toISOString();
  const { startIso: dayStartIso, endIso: dayEndIso } = utcDayBounds(now);

  // 2) Settings (single row)
  const { data: settings, error: settingsErr } = await supabase
    .from("settings")
    .select("max_bookings_per_day")
    .eq("id", 1)
    .single();

  if (settingsErr) throw settingsErr;

  const maxBookingsPerDay = settings?.max_bookings_per_day ?? 2;

  // 3) Active bookings count (currently happening right now)
  const { count: activeCount, error: activeErr } = await supabase
    .from("bookings")
    .select("id", { count: "exact", head: true })
    .eq("booked_for_user_id", user.id)
    .eq("status", "active")
    .lte("start_time", nowIso)
    .gt("end_time", nowIso);

  if (activeErr) throw activeErr;

  // 4) Upcoming today count (future bookings starting today)
  const { count: upcomingTodayCount, error: upcomingTodayErr } = await supabase
    .from("bookings")
    .select("id", { count: "exact", head: true })
    .eq("booked_for_user_id", user.id)
    .eq("status", "active")
    .gte("start_time", nowIso)
    .gte("start_time", dayStartIso)
    .lt("start_time", dayEndIso);

  if (upcomingTodayErr) throw upcomingTodayErr;

  // 5) Total active bookings starting today (used for "bookings left today")
  const { count: todayTotalActive, error: todayTotalErr } = await supabase
    .from("bookings")
    .select("id", { count: "exact", head: true })
    .eq("booked_for_user_id", user.id)
    .eq("status", "active")
    .gte("start_time", dayStartIso)
    .lt("start_time", dayEndIso);

  if (todayTotalErr) throw todayTotalErr;

  const bookingsLeftToday = Math.max(
    0,
    maxBookingsPerDay - (todayTotalActive ?? 0),
  );

  // 6) Upcoming list (next 5)
  const { data: upcoming, error: upcomingErr } = await supabase
    .from("bookings")
    .select(
      `
      id,
      start_time,
      end_time,
      status,
      purpose,
      room:rooms (
        id,
        name,
        building,
        floor
      )
    `,
    )
    .eq("booked_for_user_id", user.id)
    .eq("status", "active")
    .gte("end_time", nowIso)
    .order("start_time", { ascending: true })
    .limit(5);

  if (upcomingErr) throw upcomingErr;

  return {
    stats: {
      activeBookings: activeCount ?? 0,
      upcomingToday: upcomingTodayCount ?? 0,
      bookingsLeftToday,
      maxBookingsPerDay,
    },
    upcoming:
      (upcoming ?? []).map((b: any) => ({
        id: b.id,
        room: {
          id: b.room?.id,
          name: b.room?.name,
          building: b.room?.building,
          floor: b.room?.floor ?? null,
        },
        start_time: b.start_time,
        end_time: b.end_time,
        status: b.status,
        purpose: b.purpose ?? null,
      })) ?? [],
  };
}
