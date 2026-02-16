// src/lib/db/schedule.ts
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { createSupabaseServer } from "@/lib/supabase/server";

export type ScheduleRoom = {
  id: number;
  name: string;
  building: string;
  floor: string | null;
  capacity: number;
};

export type ScheduleBooking = {
  id: number;
  room_id: number;
  start_time: string; // ISO
  end_time: string;   // ISO
  status: string;
};

/**
 * Rooms list for dropdown + quick-book section.
 * Uses the regular server client (RLS allows selecting rooms for authenticated users).
 */
export async function getRoomsForSchedule(): Promise<ScheduleRoom[]> {
  const supabase = await createSupabaseServer();

  const { data, error } = await supabase
    .from("rooms")
    .select("id, name, building, floor, capacity")
    .eq("is_active", true)
    .order("building")
    .order("name");

  if (error) return [];
  return (data ?? []) as ScheduleRoom[];
}

/**
 * Active bookings for the month window.
 * Uses service role to avoid any RLS recursion and to support "All Rooms" aggregation.
 *
 * If roomId is null => all rooms
 */
export async function getActiveBookingsBetweenForSchedule(
  startISO: string,
  endISO: string,
  roomId: number | null,
): Promise<ScheduleBooking[]> {
  const admin = createSupabaseAdmin();

  let q = admin
    .from("bookings")
    .select("id, room_id, start_time, end_time, status")
    .eq("status", "active")
    .lt("start_time", endISO)
    .gt("end_time", startISO);

  if (roomId) q = q.eq("room_id", roomId);

  const { data, error } = await q.order("start_time", { ascending: true });

  if (error) return [];
  return (data ?? []) as ScheduleBooking[];
}
