// src/lib/db/adminPanel.ts
// Server-side helper queries for the Admin Panel.
//
// IMPORTANT:
// - Uses createSupabaseServer() (anon + cookies) so RLS is enforced.
// - We scope queries so admins only see data they’re allowed to manage.
// - Super admins can see everything.
//
// Exports:
// 1) getBookingsForAdminPanel()
// 2) getWaitlistForAdminPanel()

import { createSupabaseServer } from "@/lib/supabase/server";
import { getAllowedRoomIdsForCurrentAdmin } from "@/lib/db/adminAllowedRooms";

type DeptJoin = { name: string } | { name: string }[] | null;

function normalizeDept(d: DeptJoin): { name: string } | null {
  if (!d) return null;
  return Array.isArray(d) ? (d[0] ?? null) : d;
}

export type AdminBookingRow = {
  id: number;
  room_id: number;
  start_time: string;
  end_time: string;
  status: string;
  purpose: string | null;

  booked_for_user_id: string | null;

  external_student_email: string | null;
  external_student_phone: string | null;
  external_student_id: string | null;

  room: {
    id: number;
    name: string;
    building: string;
    floor: string | null;
    department_id: number;
    department: { name: string } | null;
  } | null;
};

export async function getBookingsForAdminPanel(): Promise<AdminBookingRow[]> {
  const supabase = await createSupabaseServer();

  // Must be logged in
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const allowedRoomIds = await getAllowedRoomIdsForCurrentAdmin();
  if (Array.isArray(allowedRoomIds) && allowedRoomIds.length === 0) return [];

  let q = supabase
    .from("bookings")
    .select(
      `
      id,
      room_id,
      start_time,
      end_time,
      status,
      purpose,
      booked_for_user_id,
      external_student_email,
      external_student_phone,
      external_student_id,
      room:rooms (
        id,
        name,
        building,
        floor,
        department_id,
        department:departments!rooms_department_id_fkey ( name )
      )
    `,
    )
    .order("start_time", { ascending: false })
    .limit(200);

  // super_admin => allowedRoomIds === null => don't filter
  if (Array.isArray(allowedRoomIds)) {
    q = q.in("room_id", allowedRoomIds);
  }

  const { data, error } = await q;
  if (error) return [];

  return (data ?? []).map((r: any) => ({
    ...r,
    room: r.room
      ? {
          ...r.room,
          department: normalizeDept(r.room.department),
        }
      : null,
  })) as AdminBookingRow[];
}

/* =============================================================================
   WAITLIST
   ========================================================================== */

export type AdminWaitlistRow = {
  id: number;
  room_id: number;
  start_time: string;
  end_time: string;
  status: "waiting" | "offered" | "accepted" | "expired";
  offer_expires_at: string | null;
  created_at: string;
  user_id: string;

  room: {
    id: number;
    name: string;
    building: string;
    floor: string | null;
    department_id: number;
    department: { name: string } | null;
  } | null;
};

export async function getWaitlistForAdminPanel(): Promise<AdminWaitlistRow[]> {
  const supabase = await createSupabaseServer();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const allowedRoomIds = await getAllowedRoomIdsForCurrentAdmin();
  if (Array.isArray(allowedRoomIds) && allowedRoomIds.length === 0) return [];

  let q = supabase
    .from("waitlist")
    .select(
      `
      id,
      room_id,
      start_time,
      end_time,
      status,
      offer_expires_at,
      created_at,
      user_id,
      room:rooms (
        id,
        name,
        building,
        floor,
        department_id,
        department:departments!rooms_department_id_fkey ( name )
      )
    `,
    )
    .order("created_at", { ascending: false })
    .limit(200);

  if (Array.isArray(allowedRoomIds)) {
    q = q.in("room_id", allowedRoomIds);
  }

  const { data, error } = await q;
  if (error) return [];

  return (data ?? []).map((r: any) => ({
    ...r,
    room: r.room
      ? {
          ...r.room,
          department: normalizeDept(r.room.department),
        }
      : null,
  })) as AdminWaitlistRow[];
}