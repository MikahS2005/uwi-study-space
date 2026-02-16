// src/lib/db/adminPanel.ts
// Server-side helper queries for the Admin Panel.
//
// IMPORTANT:
// - Uses createSupabaseServer() (anon + cookies) so RLS is enforced.
// - We still scope in queries so admins only see data they’re allowed to manage.
// - Super admins can see everything.
//
// This file provides:
// 1) getBookingsForAdminPanel()
// 2) getWaitlistForAdminPanel()

import { createSupabaseServer } from "@/lib/supabase/server";

type Role = "student" | "admin" | "super_admin";

type MeRow = {
  role: Role | null;
  department_id: number | null;
};

/**
 * Reads current user's role using SECURITY DEFINER RPC.
 * This avoids profiles RLS recursion issues.
 */
async function getMyRole(): Promise<Role | null> {
  const supabase = await createSupabaseServer();
  const { data: meRows, error } = await supabase.rpc("get_my_profile");
  if (error) return null;

  const me = Array.isArray(meRows) ? (meRows[0] as MeRow | undefined) : undefined;
  return me?.role ?? null;
}

/**
 * For a department admin:
 * - Fetch their scopes from admin_scopes
 * - Return room IDs + department IDs
 *
 * If admin has BOTH room scopes and department scopes, we OR them.
 */
async function getAdminScopeIds(userId: string) {
  const supabase = await createSupabaseServer();

  const { data: scopes, error } = await supabase
    .from("admin_scopes")
    .select("room_id, department_id")
    .eq("admin_user_id", userId);

  if (error) return { roomIds: [] as number[], deptIds: [] as number[] };

  const roomIds = (scopes ?? [])
    .map((s) => s.room_id)
    .filter((v): v is number => typeof v === "number");

  const deptIds = (scopes ?? [])
    .map((s) => s.department_id)
    .filter((v): v is number => typeof v === "number");

  return { roomIds, deptIds };
}

/**
 * Build a Supabase `.or()` filter string for:
 *   (room_id IN roomIds) OR (room.department_id IN deptIds)
 *
 * IMPORTANT:
 * - The foreign path MUST match the relationship alias used in `.select(...)`.
 * - Because we alias `room:rooms(...)`, the foreign path becomes `room.department_id`.
 */
function buildScopedOrFilter(params: {
  roomField: string; // e.g. "room_id"
  roomIds: number[];
  deptIds: number[];
  deptForeignPath: string; // e.g. "room.department_id"
}) {
  const { roomField, roomIds, deptIds, deptForeignPath } = params;

  const orParts: string[] = [];
  if (roomIds.length) orParts.push(`${roomField}.in.(${roomIds.join(",")})`);
  if (deptIds.length) orParts.push(`${deptForeignPath}.in.(${deptIds.join(",")})`);

  return orParts.join(",");
}

/**
 * Supabase may type 1-to-1 joins as arrays depending on query shape.
 * Normalize to a single object or null.
 */
type DeptJoin = { name: string } | { name: string }[] | null;

function normalizeDept(d: DeptJoin): { name: string } | null {
  if (!d) return null;
  return Array.isArray(d) ? (d[0] ?? null) : d;
}

/* =============================================================================
   BOOKINGS (Admin Panel)
   ========================================================================== */

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
    department: { name: string } | null; // ✅ normalized for UI
  } | null;
};

/**
 * Admin bookings list:
 * - super_admin: ALL bookings
 * - admin: ONLY bookings for rooms in scope (room_id OR room.department_id)
 * - student/anon: []
 */
export async function getBookingsForAdminPanel(): Promise<AdminBookingRow[]> {
  const supabase = await createSupabaseServer();

  // 1) Must be logged in
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  // 2) Role
  const role = await getMyRole();
  if (!role) return [];

  // 3) Base query (include room + department for display AND scope filtering)
  const base = supabase
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

  // Helper to normalize department shape in returned rows
  const normalizeRows = (rows: any[]) =>
    rows.map((r) => ({
      ...r,
      room: r.room
        ? {
            ...r.room,
            department: normalizeDept(r.room.department),
          }
        : null,
    })) as AdminBookingRow[];

  // 4) Super admin sees all
  if (role === "super_admin") {
    const { data, error } = await base;
    if (error) return [];
    return normalizeRows(data ?? []);
  }

  // 5) Admin scoped
  if (role !== "admin") return [];

  const { roomIds, deptIds } = await getAdminScopeIds(user.id);
  if (roomIds.length === 0 && deptIds.length === 0) return [];

  // Apply scope filter (alias-aware)
  const orFilter = buildScopedOrFilter({
    roomField: "room_id",
    roomIds,
    deptIds,
    deptForeignPath: "room.department_id",
  });

  const { data, error } = await base.or(orFilter);
  if (error) return [];
  return normalizeRows(data ?? []);
}

/* =============================================================================
   WAITLIST (Admin Panel)
   ========================================================================== */

export type AdminWaitlistRow = {
  id: number;
  room_id: number;
  start_time: string;
  end_time: string;
  status: string;
  offer_expires_at: string | null;
  created_at: string;
  user_id: string;

  room: {
    id: number;
    name: string;
    building: string;
    floor: string | null;
    department_id: number;
    department: { name: string } | null; // ✅ normalized for UI
  } | null;
};

/**
 * Admin waitlist list:
 * - super_admin: ALL waitlist entries
 * - admin: ONLY waitlist entries for rooms in scope
 * - student/anon: []
 */
export async function getWaitlistForAdminPanel(): Promise<AdminWaitlistRow[]> {
  const supabase = await createSupabaseServer();

  // 1) Must be logged in
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  // 2) Role
  const role = await getMyRole();
  if (!role) return [];

  // 3) Base query (include room + department)
  const base = supabase
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

  const normalizeRows = (rows: any[]) =>
    rows.map((r) => ({
      ...r,
      room: r.room
        ? {
            ...r.room,
            department: normalizeDept(r.room.department),
          }
        : null,
    })) as AdminWaitlistRow[];

  // 4) Super admin sees all
  if (role === "super_admin") {
    const { data, error } = await base;
    if (error) return [];
    return normalizeRows(data ?? []);
  }

  // 5) Admin scoped
  if (role !== "admin") return [];

  const { roomIds, deptIds } = await getAdminScopeIds(user.id);
  if (roomIds.length === 0 && deptIds.length === 0) return [];

  // Apply scope filter (alias-aware)
  const orFilter = buildScopedOrFilter({
    roomField: "room_id",
    roomIds,
    deptIds,
    deptForeignPath: "room.department_id",
  });

  const { data, error } = await base.or(orFilter);
  if (error) return [];
  return normalizeRows(data ?? []);
}
