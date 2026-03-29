// src/app/api/admin/bookings/route.ts
import { NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabase/server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";

export async function GET(req: Request) {
  const supabase = await createSupabaseServer();
  const admin = createSupabaseAdmin();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

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

  const url = new URL(req.url);
  const from = String(url.searchParams.get("from") ?? "");
  const to = String(url.searchParams.get("to") ?? "");
  const roomId = url.searchParams.get("roomId");
  const building = url.searchParams.get("building");
  const departmentId = url.searchParams.get("departmentId");
  const status = url.searchParams.get("status");
  const q = (url.searchParams.get("q") ?? "").trim().toLowerCase();

  if (!from || !to) {
    return NextResponse.json({ error: "Missing from/to (YYYY-MM-DD)" }, { status: 400 });
  }

  const fromIso = new Date(`${from}T00:00:00.000Z`).toISOString();
  const toIso = new Date(`${to}T23:59:59.999Z`).toISOString();

  let allowedRoomIds: number[] | null = null;

  if (role !== "super_admin") {
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

    allowedRoomIds = Array.from(new Set([...roomIds, ...deptRoomIds]));

    if (allowedRoomIds.length === 0) {
      return NextResponse.json({
        rows: [],
        meta: { rooms: [], buildings: [], departments: [] },
      });
    }
  }

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

  const departmentsMap = new Map<number, string>();
  for (const r of roomsMeta ?? []) {
    const deptId = Number(r.department_id);
    const deptName = (r as any)?.departments?.name ?? null;

    if (Number.isFinite(deptId) && deptName) {
      departmentsMap.set(deptId, String(deptName));
    }
  }

  const departments = Array.from(departmentsMap.entries())
    .map(([id, name]) => ({ id, name }))
    .sort((a, b) => a.name.localeCompare(b.name));

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

      booked_for_name,
      booked_for_email,
      booked_for_phone,
      booked_for_uwi_id,
      booked_for_faculty,
      booked_for_academic_status,
      attendee_count,

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
      ),

      booking_attendees (
        id,
        profile_user_id,
        attendee_type,
        full_name,
        email,
        phone,
        uwi_id,
        faculty,
        academic_status,
        created_at
      )
    `,
    )
    .lt("start_time", toIso)
    .gt("end_time", fromIso)
    .order("start_time", { ascending: true });

  if (allowedRoomIds && allowedRoomIds.length > 0) {
    bq = bq.in("room_id", allowedRoomIds);
  }

  if (roomId && Number.isFinite(Number(roomId))) {
    bq = bq.eq("room_id", Number(roomId));
  }

  if (status && status !== "all") {
    bq = bq.eq("status", status);
  }

  const { data: rows, error: rowsErr } = await bq;

  if (rowsErr) {
    return NextResponse.json(
      { error: "Bookings query failed", detail: rowsErr.message },
      { status: 500 },
    );
  }

  let finalRows = rows ?? [];

  if (building) {
    finalRows = finalRows.filter((r: any) => String(r?.rooms?.building ?? "") === String(building));
  }

  if (departmentId && Number.isFinite(Number(departmentId))) {
    const dep = Number(departmentId);
    finalRows = finalRows.filter((r: any) => Number(r?.rooms?.department_id) === dep);
  }

  if (q) {
    finalRows = finalRows.filter((r: any) => {
      const attendeeHay = Array.isArray(r.booking_attendees)
        ? r.booking_attendees
            .map((a: any) =>
              [
                a.full_name ?? "",
                a.email ?? "",
                a.phone ?? "",
                a.uwi_id ?? "",
                a.faculty ?? "",
                a.academic_status ?? "",
              ]
                .join(" ")
                .toLowerCase(),
            )
            .join(" ")
        : "";

      const hay = [
        r.purpose ?? "",
        r.booked_for_name ?? "",
        r.booked_for_email ?? "",
        r.booked_for_phone ?? "",
        r.booked_for_uwi_id ?? "",
        r.booked_for_faculty ?? "",
        r.booked_for_academic_status ?? "",
        r.external_student_email ?? "",
        r.external_student_phone ?? "",
        r.external_student_id ?? "",
        attendeeHay,
      ]
        .join(" ")
        .toLowerCase();

      return hay.includes(q);
    });
  }

  return NextResponse.json({
    rows: finalRows.map((r: any) => ({
      ...r,
      booking_source: r.booked_for_user_id ? "internal" : "external",
      booking_attendees: [...(r.booking_attendees ?? [])].sort((a: any, b: any) => {
        if (a.attendee_type === "primary" && b.attendee_type !== "primary") return -1;
        if (a.attendee_type !== "primary" && b.attendee_type === "primary") return 1;
        return String(a.full_name ?? "").localeCompare(String(b.full_name ?? ""));
      }),
    })),
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