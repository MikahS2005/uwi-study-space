// src/app/api/admin/departments/allowed/route.ts
//
// Returns the list of departments the current user is allowed to create rooms under.
//
// Rules:
// - Must be authenticated
// - Role must be admin or super_admin
// - super_admin => all departments
// - admin => departments derived from admin_scopes:
//     - direct department scopes (admin_scopes.department_id)
//     - plus departments of any room scopes (admin_scopes.room_id -> rooms.department_id)
//
// Why this exists:
// - Keeps the UI honest (dropdown only shows allowed departments)
// - Prevents “guessing” a department_id in client code
//
// Note:
// - This is an AUTHZ helper, not a security boundary. The create-room API must still enforce scope.

import { NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createSupabaseServer();

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
  // 2) Role via SECURITY DEFINER RPC (avoids profiles/RLS recursion)
  // ---------------------------------------------------------------------------
  const { data: meRows, error: meError } = await supabase.rpc("get_my_profile");
  if (meError) {
    return NextResponse.json(
      { error: "Profile lookup failed", detail: meError.message },
      { status: 500 },
    );
  }

  const me = Array.isArray(meRows) ? meRows[0] : null;
  const role = (me?.role ?? null) as "student" | "admin" | "super_admin" | null;

  if (role !== "admin" && role !== "super_admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // ---------------------------------------------------------------------------
  // 3) Super admin => all departments
  // ---------------------------------------------------------------------------
  if (role === "super_admin") {
    const { data, error } = await supabase
      .from("departments")
      .select("id, name")
      .order("name");

    if (error) {
      return NextResponse.json({ error: "Failed to load departments" }, { status: 500 });
    }

    return NextResponse.json({ departments: data ?? [] });
  }

  // ---------------------------------------------------------------------------
  // 4) Admin => derive allowed departments from scopes
  // ---------------------------------------------------------------------------
  const { data: scopes, error: scopeErr } = await supabase
    .from("admin_scopes")
    .select("department_id, room_id")
    .eq("admin_user_id", user.id);

  if (scopeErr) {
    return NextResponse.json(
      { error: "Failed to load admin scopes", detail: scopeErr.message },
      { status: 500 },
    );
  }

  const directDeptIds = (scopes ?? [])
    .map((s) => s.department_id)
    .filter((v): v is number => typeof v === "number");

  const scopedRoomIds = (scopes ?? [])
    .map((s) => s.room_id)
    .filter((v): v is number => typeof v === "number");

  // If admin has room scopes, convert to department scopes too.
  let roomDeptIds: number[] = [];
  if (scopedRoomIds.length) {
    const { data: roomRows, error: roomsErr } = await supabase
      .from("rooms")
      .select("department_id")
      .in("id", scopedRoomIds);

    if (roomsErr) {
      return NextResponse.json(
        { error: "Failed to load room departments", detail: roomsErr.message },
        { status: 500 },
      );
    }

    roomDeptIds = (roomRows ?? [])
      .map((r) => r.department_id)
      .filter((v): v is number => typeof v === "number");
  }

  const allowedDeptIds = Array.from(new Set([...directDeptIds, ...roomDeptIds]));

  // No allowed departments => empty list
  if (allowedDeptIds.length === 0) {
    return NextResponse.json({ departments: [] });
  }

  const { data: departments, error: deptErr } = await supabase
    .from("departments")
    .select("id, name")
    .in("id", allowedDeptIds)
    .order("name");

  if (deptErr) {
    return NextResponse.json(
      { error: "Failed to load allowed departments", detail: deptErr.message },
      { status: 500 },
    );
  }

  return NextResponse.json({ departments: departments ?? [] });
}
