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

export async function countUserNoShowsInWindow(userId: string, windowDays: number) {
  const admin = createSupabaseAdmin();
  const { data, error } = await admin.rpc("count_user_no_shows", {
    p_user_id: userId,
    p_window_days: windowDays,
  });

  if (error) throw new Error(error.message);
  return Number(data ?? 0);
}

export async function getRoomCapacity(roomId: number) {
  const admin = createSupabaseAdmin();

  const { data, error } = await admin
    .from("rooms")
    .select("capacity")
    .eq("id", roomId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) throw new Error("Room not found");

  return Number(data.capacity ?? 0);
}

export async function roomHasOverlap(roomId: number, startISO: string, endISO: string) {
  const admin = createSupabaseAdmin();

  const { data: room, error: roomErr } = await admin
    .from("rooms")
    .select("buffer_minutes, is_active")
    .eq("id", roomId)
    .maybeSingle();

  if (roomErr) throw new Error(roomErr.message);
  if (!room || room.is_active === false) return true;

  const buffer = Number(room.buffer_minutes ?? 0);

  const start = new Date(startISO);
  const end = new Date(endISO);

  const { data: blk, error: blkErr } = await admin
    .from("room_blackouts")
    .select("id")
    .eq("room_id", roomId)
    .lt("start_time", end.toISOString())
    .gt("end_time", start.toISOString())
    .limit(1);

  if (blkErr) throw new Error(blkErr.message);
  if ((blk ?? []).length > 0) return true;

  const { data: bookings, error: bookingsErr } = await admin
    .from("bookings")
    .select("id, start_time, end_time")
    .eq("room_id", roomId)
    .eq("status", "active")
    .lt("start_time", end.toISOString())
    .gt("end_time", start.toISOString());

  if (bookingsErr) throw new Error(bookingsErr.message);

  for (const b of bookings ?? []) {
    const bStart = new Date(b.start_time);
    const bEnd = new Date(b.end_time);

    const bStartBuffered = new Date(bStart.getTime() - buffer * 60_000);
    const bEndBuffered = new Date(bEnd.getTime() + buffer * 60_000);

    if (bStartBuffered < end && bEndBuffered > start) return true;
  }

  return false;
}

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