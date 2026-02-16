// src/lib/db/rooms.ts
import { createSupabaseServer } from "@/lib/supabase/server";

/**
 * The UI wants "department" as a single object (or null).
 * BUT Supabase embed often returns it as an ARRAY (department: [{ name }]).
 *
 * So:
 * - RawRoomRow matches what Supabase actually returns
 * - RoomRow is what the rest of the app uses after normalization
 */

// What Supabase returns from: department:departments(name)
type RawRoomRow = {
  id: number;
  name: string;
  building: string;
  floor: string | null;
  capacity: number;
  amenities: string[];
  is_active?: boolean;
  department_id?: number;

  // IMPORTANT: Supabase returns an array for embedded relationships in many setups.
  department: { name: string }[] | null;
};

// What your app wants to work with everywhere else
export type RoomRow = Omit<RawRoomRow, "department"> & {
  department: { name: string } | null;
};

/**
 * Convert Supabase's embedded array into a single object.
 * - If department is null/empty -> null
 * - Else -> first element
 */
function normalizeRoom(row: RawRoomRow): RoomRow {
  const dept = Array.isArray(row.department) ? row.department[0] ?? null : null;
  return {
    ...row,
    department: dept,
  };
}

/**
 * Admin Panel room list:
 * - admin: ONLY rooms in their scope (department_id or room_id scope)
 * - super_admin: ALL rooms (including inactive)
 *
 * We fetch role via `get_my_profile()` to avoid profiles/RLS recursion.
 */
export async function getRoomsForAdminPanel(): Promise<RoomRow[]> {
  const supabase = await createSupabaseServer();

  // 1) Must be logged in
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  // 2) Get role via SECURITY DEFINER RPC
  const { data: meRows } = await supabase.rpc("get_my_profile");
  const me = Array.isArray(meRows) ? meRows[0] : null;
  const role = me?.role ?? null;

  // 3) Base rooms query (include department_id for filtering)
  // NOTE: admins/super admins may need to see inactive rooms to manage them,
  // so we do NOT force is_active=true here.
  const base = supabase
    .from("rooms")
    .select(
      "id, name, building, floor, capacity, amenities, is_active, department_id, department:departments(name)",
    );

  // 4) Super admin sees everything
  if (role === "super_admin") {
    const { data, error } = await base.order("building").order("name");
    if (error) return [];
    return (data ?? []).map(normalizeRoom);
  }

  // 5) Admin must be scoped (department_id OR room_id)
  if (role !== "admin") return [];

  const { data: scopes, error: scopeErr } = await supabase
    .from("admin_scopes")
    .select("room_id, department_id")
    .eq("admin_user_id", user.id);

  if (scopeErr) return [];

  const roomIds = (scopes ?? [])
    .map((s) => s.room_id)
    .filter((v): v is number => typeof v === "number");

  const deptIds = (scopes ?? [])
    .map((s) => s.department_id)
    .filter((v): v is number => typeof v === "number");

  // No scopes => no rooms
  if (roomIds.length === 0 && deptIds.length === 0) return [];

  // Build OR filter:
  // (id in roomIds) OR (department_id in deptIds)
  const orParts: string[] = [];
  if (roomIds.length) orParts.push(`id.in.(${roomIds.join(",")})`);
  if (deptIds.length) orParts.push(`department_id.in.(${deptIds.join(",")})`);

  const { data, error } = await base.or(orParts.join(",")).order("building").order("name");
  if (error) return [];

  return (data ?? []).map(normalizeRoom);
}

// ---- your existing functions stay below ----

export async function getRoomById(roomId: number): Promise<RoomRow | null> {
  const supabase = await createSupabaseServer();

  const { data, error } = await supabase
    .from("rooms")
    .select("id, name, building, floor, capacity, amenities, department:departments(name)")
    .eq("id", roomId)
    .maybeSingle();

  if (error || !data) return null;

  // Normalize so callers always see department as {name} | null
  return normalizeRoom(data as RawRoomRow);
}

export async function getActiveBookingsForRoomBetween(roomId: number, start: string, end: string) {
  const supabase = await createSupabaseServer();

  const { data, error } = await supabase
    .from("bookings")
    .select("id, start_time, end_time")
    .eq("room_id", roomId)
    .eq("status", "active")
    .lt("start_time", end)
    .gt("end_time", start);

  if (error) return [];
  return data ?? [];
}
