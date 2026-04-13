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
  image_url: string[] | null;
  is_active?: boolean;
  department_id?: number;

  // IMPORTANT: Supabase returns an array for embedded relationships in many setups.
  department: { name: string }[] | null;
};

// What your app wants to work with everywhere else
export type RoomRow = Omit<RawRoomRow, "department"> & {
  department: { name: string } | null;
};

export type RoomDepartmentOption = {
  id: number;
  name: string;
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
 * Shared Rooms management list for:
 * - /admin/rooms        (mode="admin")       -> scope-limited
 * - /super-admin/rooms  (mode="super_admin") -> global list
 *
 * Defense-in-depth:
 * - We still check role server-side even though middleware likely blocks bad access.
 *
 * IMPORTANT:
 * - For admin mode: we enforce department_id OR room_id scopes from admin_scopes.
 * - For super_admin mode: we only return data if role is super_admin.
 */
export async function getRoomsForRoomsManagement(opts: {
  mode: "admin" | "super_admin";
  departmentId?: number;
}): Promise<RoomRow[]> {
  const supabase = await createSupabaseServer();

  // 1) Must be logged in
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  // 2) Get role via SECURITY DEFINER RPC (avoids profiles/RLS recursion issues)
  const { data: meRows } = await supabase.rpc("get_my_profile");
  const me = Array.isArray(meRows) ? meRows[0] : null;
  const role = me?.role ?? null;

  // 3) Base rooms query (include department_id for filtering)
  // NOTE: admin/super_admin need to see inactive rooms in the management UI,
  // so we do NOT force is_active=true.
  const base = supabase
    .from("rooms")
    .select(
      "id, name, building, floor, capacity, amenities, image_url, is_active, department_id, department:departments(name)",
    );

  // ---------------------------------------------------------------------------
  // SUPER ADMIN MODE
  // ---------------------------------------------------------------------------
  if (opts.mode === "super_admin") {
    // Only allow true super admins to see global rooms here.
    if (role !== "super_admin") return [];

    const query = Number.isFinite(opts.departmentId)
      ? base.eq("department_id", Number(opts.departmentId))
      : base;

    const { data, error } = await query.order("building").order("name");
    if (error) return [];
    return (data ?? []).map(normalizeRoom);
  }

  // ---------------------------------------------------------------------------
  // ADMIN MODE
  // ---------------------------------------------------------------------------
  // Only admins can use the scoped list.
  if (role !== "admin") return [];

  // Fetch admin scopes for this user
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

  let query = base.or(orParts.join(","));

  if (Number.isFinite(opts.departmentId)) {
    query = query.eq("department_id", Number(opts.departmentId));
  }

  const { data, error } = await query.order("building").order("name");
  if (error) return [];

  return (data ?? []).map(normalizeRoom);
}

export async function getDepartmentOptionsForRoomsManagement(opts: {
  mode: "admin" | "super_admin";
}): Promise<RoomDepartmentOption[]> {
  const supabase = await createSupabaseServer();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data: meRows } = await supabase.rpc("get_my_profile");
  const me = Array.isArray(meRows) ? meRows[0] : null;
  const role = me?.role ?? null;

  if (opts.mode === "super_admin") {
    if (role !== "super_admin") return [];

    const { data, error } = await supabase
      .from("departments")
      .select("id, name")
      .order("name");

    if (error) return [];
    return (data ?? []) as RoomDepartmentOption[];
  }

  if (role !== "admin") return [];

  const { data: scopes, error: scopeErr } = await supabase
    .from("admin_scopes")
    .select("department_id, room_id")
    .eq("admin_user_id", user.id);

  if (scopeErr) return [];

  const directDeptIds = (scopes ?? [])
    .map((s) => s.department_id)
    .filter((v): v is number => typeof v === "number");

  const scopedRoomIds = (scopes ?? [])
    .map((s) => s.room_id)
    .filter((v): v is number => typeof v === "number");

  let roomDeptIds: number[] = [];
  if (scopedRoomIds.length) {
    const { data: roomRows, error: roomErr } = await supabase
      .from("rooms")
      .select("department_id")
      .in("id", scopedRoomIds);

    if (roomErr) return [];

    roomDeptIds = (roomRows ?? [])
      .map((r) => r.department_id)
      .filter((v): v is number => typeof v === "number");
  }

  const allowedDeptIds = Array.from(new Set([...directDeptIds, ...roomDeptIds]));
  if (allowedDeptIds.length === 0) return [];

  const { data: departments, error: deptErr } = await supabase
    .from("departments")
    .select("id, name")
    .in("id", allowedDeptIds)
    .order("name");

  if (deptErr) return [];
  return (departments ?? []) as RoomDepartmentOption[];
}

/**
 * Backwards-compatible wrapper.
 * Your existing Admin Rooms page used getRoomsForAdminPanel().
 * We keep it to avoid breaking other imports while we transition.
 */
export async function getRoomsForAdminPanel(): Promise<RoomRow[]> {
  return getRoomsForRoomsManagement({ mode: "admin" });
}

// ---- your existing functions stay below ----

export async function getRoomById(roomId: number): Promise<RoomRow | null> {
  const supabase = await createSupabaseServer();

  const { data, error } = await supabase
    .from("rooms")
    .select(
      "id, name, building, floor, capacity, amenities, image_url, department:departments(name)",
    )
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