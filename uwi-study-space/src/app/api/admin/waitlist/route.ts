// src/app/api/admin/waitlist/route.ts
import { NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabase/server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";

type Role = "student" | "admin" | "super_admin";

export async function GET(req: Request) {
  const supabase = await createSupabaseServer();
  const admin = createSupabaseAdmin();

  // 1) Auth
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // 2) Role via SECURITY DEFINER RPC
  const { data: meRows, error: meError } = await supabase.rpc("get_my_profile");
  if (meError) return NextResponse.json({ error: "Profile lookup failed" }, { status: 500 });

  const me = Array.isArray(meRows) ? meRows[0] : null;
  const role: Role | null = me?.role ?? null;

  if (role !== "admin" && role !== "super_admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // 3) Query params (simple + consistent with bookings page)
  const url = new URL(req.url);
  const from = (url.searchParams.get("from") ?? "").trim(); // YYYY-MM-DD
  const to = (url.searchParams.get("to") ?? "").trim(); // YYYY-MM-DD
  const roomId = (url.searchParams.get("roomId") ?? "").trim();
  const building = (url.searchParams.get("building") ?? "").trim();
  const departmentId = (url.searchParams.get("departmentId") ?? "").trim();
  const status = (url.searchParams.get("status") ?? "").trim(); // waiting/offered/expired/cancelled/fulfilled (depends on your enum)
  const q = (url.searchParams.get("q") ?? "").trim();

  // 4) Build base query (service role: we enforce scope in code)
  // NOTE: service role is fine here because admins/super-admins are privileged users.
  // We still scope department admins to rooms in their scope.
  let query = admin
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
        department:departments!rooms_department_id_fkey ( id, name )
      )
    `,
    )
    .order("created_at", { ascending: false })
    .limit(200);

  // Date filtering (inclusive ymd -> [from 00:00, to 23:59])
  if (from) query = query.gte("start_time", `${from}T00:00:00-04:00`);
  if (to) query = query.lte("start_time", `${to}T23:59:59-04:00`);

  if (roomId) query = query.eq("room_id", Number(roomId));
  if (status) query = query.eq("status", status);

  // Filter by building/department using joined room fields
  if (building) query = query.eq("room.building", building);
  if (departmentId) query = query.eq("room.department_id", Number(departmentId));

  // Search: currently only supports user_id partial match (you can expand later)
  if (q) query = query.or(`user_id.ilike.%${q}%`);

  // 5) Scope filtering for admins (super_admin sees all)
  if (role === "admin") {
    const { data: scopes, error: scopesErr } = await admin
      .from("admin_scopes")
      .select("room_id, department_id")
      .eq("admin_user_id", user.id);

    if (scopesErr) return NextResponse.json({ error: "Scope lookup failed" }, { status: 500 });

    const roomIds = (scopes ?? [])
      .map((s) => s.room_id)
      .filter((v): v is number => typeof v === "number");

    const deptIds = (scopes ?? [])
      .map((s) => s.department_id)
      .filter((v): v is number => typeof v === "number");

    if (roomIds.length === 0 && deptIds.length === 0) {
      return NextResponse.json({ rows: [], meta: { rooms: [], buildings: [], departments: [] } });
    }

    // ✅ Scope filtering for admins (avoid foreign-table paths in `.or()`)
// Expand dept scopes → room ids, then filter only on room_id.
if (role === "admin") {
  const { data: scopes, error: scopesErr } = await admin
    .from("admin_scopes")
    .select("room_id, department_id")
    .eq("admin_user_id", user.id);

  if (scopesErr) {
    return NextResponse.json({ error: "Scope lookup failed" }, { status: 500 });
  }

  const scopedRoomIds = (scopes ?? [])
    .map((s) => s.room_id)
    .filter((v): v is number => typeof v === "number");

  const scopedDeptIds = (scopes ?? [])
    .map((s) => s.department_id)
    .filter((v): v is number => typeof v === "number");

  // If dept scopes exist, pull the rooms that belong to those departments
  let deptRoomIds: number[] = [];
  if (scopedDeptIds.length) {
    const { data: deptRooms, error: deptRoomsErr } = await admin
      .from("rooms")
      .select("id")
      .in("department_id", scopedDeptIds);

    if (deptRoomsErr) {
      return NextResponse.json({ error: "Scope room lookup failed" }, { status: 500 });
    }

    deptRoomIds = (deptRooms ?? []).map((r: any) => Number(r.id)).filter(Number.isFinite);
  }

  const allowedRoomIds = Array.from(new Set([...scopedRoomIds, ...deptRoomIds]));

  // No scope => no results
  if (allowedRoomIds.length === 0) {
    return NextResponse.json({ rows: [], meta: { rooms: [], buildings: [], departments: [] } });
  }

  // ✅ Single safe scope filter
  query = query.in("room_id", allowedRoomIds);
}
  }

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: "Query failed", detail: error.message }, { status: 500 });

  // 6) Meta for filters (buildings/depts/rooms) — scoped for admins
  // We build meta from rooms table similarly to bookings meta.
  let roomsQ = admin
    .from("rooms")
    .select("id, name, building, department_id, departments:departments(id, name)")
    .eq("is_active", true);

  if (role === "admin") {
    // Reuse same scope rules for rooms meta
    const { data: scopes } = await admin
      .from("admin_scopes")
      .select("room_id, department_id")
      .eq("admin_user_id", user.id);

    const roomIds = (scopes ?? [])
      .map((s) => s.room_id)
      .filter((v): v is number => typeof v === "number");

    const deptIds = (scopes ?? [])
      .map((s) => s.department_id)
      .filter((v): v is number => typeof v === "number");

    const orParts: string[] = [];
    if (roomIds.length) orParts.push(`id.in.(${roomIds.join(",")})`);
    if (deptIds.length) orParts.push(`department_id.in.(${deptIds.join(",")})`);

    if (orParts.length) roomsQ = roomsQ.or(orParts.join(","));
  }

  const { data: roomsData } = await roomsQ;

  const metaRooms =
    (roomsData ?? []).map((r: any) => ({
      id: r.id,
      name: r.name,
      building: r.building,
      departmentId: r.department_id,
      departmentName: r.departments?.name ?? "—",
    })) ?? [];

  const buildings = Array.from(new Set(metaRooms.map((r) => r.building).filter(Boolean))).sort();
  const departmentsMap = new Map<number, string>();
  for (const r of metaRooms) {
    if (typeof r.departmentId === "number") departmentsMap.set(r.departmentId, r.departmentName);
  }
  const departments = Array.from(departmentsMap.entries())
    .map(([id, name]) => ({ id, name }))
    .sort((a, b) => a.name.localeCompare(b.name));

  return NextResponse.json({
    rows: data ?? [],
    meta: { rooms: metaRooms, buildings, departments },
  });
}