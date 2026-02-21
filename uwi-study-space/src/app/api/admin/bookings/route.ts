// src/app/api/admin/bookings/route.ts
import { NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabase/server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";

/**
 * GET /api/admin/bookings?from=YYYY-MM-DD&to=YYYY-MM-DD&roomId=&building=&departmentId=&status=&q=
 *
 * Returns:
 * - rows: bookings filtered by scope + query
 * - meta: { rooms, buildings, departments } (also scope-filtered for admins)
 *
 * Notes:
 * - Admin scope enforcement is done server-side:
 *   - super_admin => all bookings
 *   - admin => only rooms in their admin_scopes (room OR department scopes)
 */
export async function GET(req: Request) {
  const supabase = await createSupabaseServer();
  const admin = createSupabaseAdmin();

  // ---------------------------------------------------------------------------
  // 1) Auth
  // ---------------------------------------------------------------------------
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // ---------------------------------------------------------------------------
  // 2) Role via RPC (avoid RLS recursion)
  // ---------------------------------------------------------------------------
  const { data: meRows, error: meError } = await supabase.rpc("get_my_profile");
  if (meError) {
    return NextResponse.json(
      { error: "Profile lookup failed", detail: meError.message },
      { status: 500 },
    );
  }

  const me = Array.isArray(meRows) ? meRows[0] : null;
  const role = me?.role ?? null;

  if (role !== "admin" && role !== "super_admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // ---------------------------------------------------------------------------
  // 3) Parse query params
  // ---------------------------------------------------------------------------
  const url = new URL(req.url);

  const from = String(url.searchParams.get("from") ?? "");
  const to = String(url.searchParams.get("to") ?? "");
  const roomId = url.searchParams.get("roomId");
  const building = url.searchParams.get("building");
  const departmentId = url.searchParams.get("departmentId");
  const status = url.searchParams.get("status");
  const q = (url.searchParams.get("q") ?? "").trim();

  // Basic safety: require from/to
  if (!from || !to) {
    return NextResponse.json({ error: "Missing from/to (YYYY-MM-DD)" }, { status: 400 });
  }

  // Expand date to full-day boundaries *as strings we can use in comparisons*.
  // We keep it ISO-friendly: [from 00:00:00Z, to 23:59:59Z] boundaries.
  // (Your booking rules use TT-local constraints elsewhere; list view is fine with ISO bounds.)
  const fromIso = new Date(`${from}T00:00:00.000Z`).toISOString();
  const toIso = new Date(`${to}T23:59:59.999Z`).toISOString();

  // ---------------------------------------------------------------------------
  // 4) Determine allowed rooms (admin only)
  // ---------------------------------------------------------------------------
  let allowedRoomIds: number[] | null = null;

  if (role !== "super_admin") {
    // Fetch scopes for this admin (RLS should allow owner to read their scopes)
    const { data: scopes, error: scopeErr } = await supabase
      .from("admin_scopes")
      .select("room_id, department_id")
      .eq("admin_user_id", user.id);

    if (scopeErr) {
      return NextResponse.json(
        { error: "Scope lookup failed", detail: scopeErr.message },
        { status: 500 },
      );
    }

    const roomIds = (scopes ?? [])
      .map((s) => s.room_id)
      .filter((x): x is number => Number.isFinite(Number(x)))
      .map(Number);

    const deptIds = (scopes ?? [])
      .map((s) => s.department_id)
      .filter((x): x is number => Number.isFinite(Number(x)))
      .map(Number);

    // If they have department scopes, include all rooms in those departments
    let deptRoomIds: number[] = [];
    if (deptIds.length > 0) {
      const { data: deptRooms, error: deptRoomsErr } = await admin
        .from("rooms")
        .select("id")
        .in("department_id", deptIds);

      if (deptRoomsErr) {
        return NextResponse.json(
          { error: "Rooms lookup failed", detail: deptRoomsErr.message },
          { status: 500 },
        );
      }

      deptRoomIds = (deptRooms ?? []).map((r) => Number(r.id)).filter(Number.isFinite);
    }

    const merged = Array.from(new Set([...roomIds, ...deptRoomIds]));
    allowedRoomIds = merged;

    // No scope => no bookings
    if (allowedRoomIds.length === 0) {
      return NextResponse.json({
        rows: [],
        meta: { rooms: [], buildings: [], departments: [] },
      });
    }
  }

  // ---------------------------------------------------------------------------
  // 5) Meta lists for filter dropdowns (scope-aware)
  // ---------------------------------------------------------------------------
  // We keep meta “cheap” and aligned to the visible rooms.
  const roomsMetaQuery = admin
    .from("rooms")
    .select("id, name, building, department_id, departments(name)")
    .eq("is_active", true);

  const scopedRoomsMetaQuery =
    allowedRoomIds && allowedRoomIds.length > 0
      ? roomsMetaQuery.in("id", allowedRoomIds)
      : roomsMetaQuery;

  const { data: roomsMeta, error: roomsMetaErr } = await scopedRoomsMetaQuery
    .order("building")
    .order("name");

  if (roomsMetaErr) {
    return NextResponse.json(
      { error: "Meta lookup failed", detail: roomsMetaErr.message },
      { status: 500 },
    );
  }

  const buildings = Array.from(
    new Set((roomsMeta ?? []).map((r) => String(r.building ?? "")).filter(Boolean)),
  ).sort((a, b) => a.localeCompare(b));

  // departments derived from roomsMeta (keeps it scoped)
  const departmentsMap = new Map<number, string>();
  for (const r of roomsMeta ?? []) {
    const deptId = Number(r.department_id);
    const deptName =
      // supabase returns nested object for "departments(name)"
      (r as any)?.departments?.name ?? null;

    if (Number.isFinite(deptId) && deptName) {
      departmentsMap.set(deptId, String(deptName));
    }
  }

  const departments = Array.from(departmentsMap.entries())
    .map(([id, name]) => ({ id, name }))
    .sort((a, b) => a.name.localeCompare(b.name));

  // ---------------------------------------------------------------------------
  // 6) Build bookings query (service role for reliable joins; scope enforced manually)
  // ---------------------------------------------------------------------------
// 6) Build bookings query (service role for reliable joins; scope enforced manually)
let bq = admin
  .from("bookings")
  .select(
    `
    id,
    room_id,
    start_time,
    end_time,
    status,
    purpose,
    created_at,
    created_by,
    booked_for_user_id,
    external_student_email,
    external_student_phone,
    external_student_id,

    rooms (
      id,
      name,
      building,
      floor,
      department_id,
      departments ( id, name )
    ),

    booked_for:profiles!bookings_booked_for_user_id_fkey (
      id,
      email,
      full_name,
      uwi_id
    ),

    creator:profiles!bookings_created_by_fkey (
      id,
      email,
      full_name,
      uwi_id
    )
  `,
  )
  .lt("start_time", toIso)
  .gt("end_time", fromIso)
  .order("start_time", { ascending: true });
  
  // Scope filter (admin only)
  if (allowedRoomIds && allowedRoomIds.length > 0) {
    bq = bq.in("room_id", allowedRoomIds);
  }

  // Room filter
  if (roomId && Number.isFinite(Number(roomId))) {
    bq = bq.eq("room_id", Number(roomId));
  }

  // Building filter (on joined room)
  if (building) {
    // Some Supabase setups allow filtering on foreign table columns using dot notation.
    // If it doesn't work in your project, we’ll fall back to client-side filtering.
    bq = (bq as any).eq("rooms.building", building);
  }

  // Department filter
  if (departmentId && Number.isFinite(Number(departmentId))) {
    bq = (bq as any).eq("rooms.department_id", Number(departmentId));
  }

  // Status filter (active/cancelled/completed/no_show)
  if (status && status !== "all") {
    bq = bq.eq("status", status);
  }

  // Lightweight q filter:
  // - always search purpose (safe)
  // - if q looks like UUID, also match booked_for_user_id exactly
  // - if your DB later exposes email/student_id joins, we can extend here safely
  if (q) {
    const looksUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(q);

    if (looksUuid) {
      // OR conditions aren’t always pleasant with Supabase typed APIs; we do a simple approach:
      // fetch by purpose OR match user id via an additional filter pass client-side.
      // Here, we prioritize exact ID match.
      bq = bq.or(`purpose.ilike.%${q}%,booked_for_user_id.eq.${q}`);
    } else {
      bq = bq.ilike("purpose", `%${q}%`);
    }
  }

  const { data: rows, error: rowsErr } = await bq;

  if (rowsErr) {
    // If filtering on joined columns fails (rooms.building), still return a useful error.
    return NextResponse.json(
      { error: "Bookings query failed", detail: rowsErr.message },
      { status: 500 },
    );
  }

  // If join-filters didn’t apply in your Supabase version, we can safely filter on the server:
  let finalRows = rows ?? [];

  if (building) {
    finalRows = finalRows.filter((r: any) => String(r?.rooms?.building ?? "") === String(building));
  }
  if (departmentId && Number.isFinite(Number(departmentId))) {
    const dep = Number(departmentId);
    finalRows = finalRows.filter((r: any) => Number(r?.rooms?.department_id) === dep);
  }

  // Return in a stable shape.
  return NextResponse.json({
    rows: finalRows,
    meta: {
      rooms: (roomsMeta ?? []).map((r: any) => ({
        id: Number(r.id),
        name: String(r.name ?? ""),
        building: String(r.building ?? ""),
        departmentId: Number(r.department_id),
        departmentName: String(r?.departments?.name ?? ""),
      })),
      buildings,
      departments,
    },
  });
}