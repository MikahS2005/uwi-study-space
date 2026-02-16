import { createSupabaseAdmin } from "@/lib/supabase/admin";

/**
 * Read global settings (single row).
 * Uses service-role so it never fails due to RLS.
 */
export async function getSettings() {
  const admin = createSupabaseAdmin();
  const { data, error } = await admin.from("settings").select("*").single();
  if (error || !data) throw new Error(error?.message ?? "Settings not found");
  return data;
}

/**
 * Count how many "no_show" bookings a user has within a rolling window (N days).
 * Backed by the SQL function:
 *   public.count_user_no_shows(p_user_id uuid, p_window_days int)
 *
 * Uses service-role to ensure consistent behavior regardless of RLS.
 */
export async function countUserNoShowsInWindow(userId: string, windowDays: number) {
  const admin = createSupabaseAdmin();
  const { data, error } = await admin.rpc("count_user_no_shows", {
    p_user_id: userId,
    p_window_days: windowDays,
  });

  if (error) throw new Error(error.message);
  return Number(data ?? 0);
}

/**
 * Check if a room has any ACTIVE booking overlapping [start, end).
 * Overlap condition:
 *   existing.start < requested.end AND existing.end > requested.start
 */
export async function roomHasOverlap(roomId: number, startISO: string, endISO: string) {
  const admin = createSupabaseAdmin();
  const { data, error } = await admin
    .from("bookings")
    .select("id")
    .eq("room_id", roomId)
    .eq("status", "active")
    .lt("start_time", endISO)
    .gt("end_time", startISO)
    .limit(1);

  if (error) throw new Error(error.message);
  return (data?.length ?? 0) > 0;
}

/**
 * Check if a user has any ACTIVE booking overlapping [start, end).
 */
export async function userHasOverlap(userId: string, startISO: string, endISO: string) {
  const admin = createSupabaseAdmin();
  const { data, error } = await admin
    .from("bookings")
    .select("id")
    .eq("booked_for_user_id", userId)
    .eq("status", "active")
    .lt("start_time", endISO)
    .gt("end_time", startISO)
    .limit(1);

  if (error) throw new Error(error.message);
  return (data?.length ?? 0) > 0;
}

/**
 * Count how many ACTIVE bookings a user has on a given yyyy-mm-dd (UTC day).
 * NOTE: We use UTC day boundaries to match the rest of the app's slot math.
 */
export async function countUserBookingsForDay(userId: string, ymd: string) {
  const admin = createSupabaseAdmin();

  const dayStart = new Date(`${ymd}T00:00:00.000Z`).toISOString();
  const dayEnd = new Date(`${ymd}T23:59:59.999Z`).toISOString();

  const { count, error } = await admin
    .from("bookings")
    .select("id", { count: "exact", head: true })
    .eq("booked_for_user_id", userId)
    .eq("status", "active")
    .gte("start_time", dayStart)
    .lte("start_time", dayEnd);

  if (error) throw new Error(error.message);
  return count ?? 0;
}

/**
 * Get all ACTIVE bookings for a user on a given day (UTC) so we can enforce
 * max consecutive booking hours.
 */
export async function getUserBookingsForDay(userId: string, ymd: string) {
  const admin = createSupabaseAdmin();

  const dayStart = new Date(`${ymd}T00:00:00.000Z`).toISOString();
  const dayEnd = new Date(`${ymd}T23:59:59.999Z`).toISOString();

  const { data, error } = await admin
    .from("bookings")
    .select("start_time, end_time")
    .eq("booked_for_user_id", userId)
    .eq("status", "active")
    .gte("start_time", dayStart)
    .lte("start_time", dayEnd);

  if (error) throw new Error(error.message);
  return data ?? [];
}
