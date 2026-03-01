// src/app/api/super-admin/scopes/set-departments/route.ts
//
// Super Admin: set the FULL department scope set for an admin user.
//
// Key rules:
// - Caller must be super_admin
// - Target user must currently be role='admin' (prevents assigning scopes to students)
// - We treat departmentIds as "the full desired set":
//   - remove existing dept scopes not in desired
//   - insert missing dept scopes
//
// Uses service role (bypasses RLS) so authZ must be enforced here.

import { NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabase/server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { writeAuditLog } from "@/lib/audit/write";

type Body = {
  adminUserId: string; // uuid
  departmentIds: number[]; // the full desired set
};

export async function POST(req: Request) {
  const supabase = await createSupabaseServer();

  // 1) Auth
  const {
    data: { user },
    error: authErr,
  } = await supabase.auth.getUser();

  if (authErr || !user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  // 2) Authorize: must be super_admin
  const { data: rows, error: roleErr } = await supabase.rpc("get_my_profile");
  const me = Array.isArray(rows) ? rows[0] : null;

  if (roleErr || me?.role !== "super_admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // 3) Parse body
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const adminUserId = String(body?.adminUserId ?? "").trim();
  const deptIdsRaw = Array.isArray(body?.departmentIds) ? body.departmentIds : [];

  if (!adminUserId) {
    return NextResponse.json({ error: "Missing adminUserId" }, { status: 400 });
  }

  // Normalize + de-dupe department IDs
  const desired = Array.from(
    new Set(
      deptIdsRaw
        .map((n) => Number(n))
        .filter((n) => Number.isFinite(n) && n > 0),
    ),
  );

  const admin = createSupabaseAdmin();

  // 4) Safety: target must be an admin (only admins need scopes)
  const { data: target, error: targetErr } = await admin
    .from("profiles")
    .select("id, role")
    .eq("id", adminUserId)
    .maybeSingle();

  if (targetErr || !target) {
    return NextResponse.json({ error: targetErr?.message ?? "Target user not found" }, { status: 404 });
  }

  if (target.role !== "admin") {
    return NextResponse.json(
      { error: "Scopes can only be assigned to users with role=admin." },
      { status: 400 },
    );
  }

  // 5) Fetch current dept scopes for that user
  const { data: existing, error: exErr } = await admin
    .from("admin_scopes")
    .select("id, department_id")
    .eq("admin_user_id", adminUserId)
    .not("department_id", "is", null);

  if (exErr) {
    return NextResponse.json({ error: exErr.message }, { status: 500 });
  }

  const existingRows = existing ?? [];
  const existingDeptIds = existingRows
    .map((r: any) => Number(r.department_id))
    .filter((n) => Number.isFinite(n));

  // Diff
  const toAdd = desired.filter((id) => !existingDeptIds.includes(id));
  const toRemoveIds = existingRows
    .filter((r: any) => !desired.includes(Number(r.department_id)))
    .map((r: any) => r.id);

  // 6) Remove scopes not in desired set
  if (toRemoveIds.length > 0) {
    const { error: delErr } = await admin.from("admin_scopes").delete().in("id", toRemoveIds);
    if (delErr) return NextResponse.json({ error: delErr.message }, { status: 500 });
  }

  // 7) Insert missing scopes
  if (toAdd.length > 0) {
    const payload = toAdd.map((deptId) => ({
      admin_user_id: adminUserId,
      department_id: deptId,
      room_id: null,
    }));

    const { error: insErr } = await admin.from("admin_scopes").insert(payload);
    if (insErr) return NextResponse.json({ error: insErr.message }, { status: 500 });
  }

  // 8) Audit (best-effort)
  writeAuditLog({
    actorUserId: user.id,
    action: "super_admin.scopes.set_departments",
    targetType: "user",
    targetId: adminUserId,
    meta: { desiredDepartmentIds: desired },
  }).catch(() => {});

  return NextResponse.json({ ok: true });
}

