// src/app/api/super-admin/users/update-role/route.ts
import { NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabase/server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { writeAuditLog } from "@/lib/audit/write";

/**
 * Super Admin-only:
 * - Promote/demote a user's role in `public.profiles`.
 *
 * Important behavior:
 * - Prevent super admin from demoting themselves (lockout protection).
 * - If a user is demoted to "student", we remove their admin scopes
 *   to avoid leaving stale permissions in `admin_scopes`.
 *
 * Why service role for writes?
 * - The service role bypasses RLS safely on server routes.
 * - We STILL authorize the caller via cookie auth + get_my_profile() RPC.
 */

type Body = {
  targetUserId: string; // uuid
  newRole: "student" |"staff"| "admin" | "super_admin";
};

export async function POST(req: Request) {
  const supabase = await createSupabaseServer();

  // 1) Auth (cookie session)
  const {
    data: { user },
    error: authErr,
  } = await supabase.auth.getUser();

  if (authErr || !user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  // 2) Authorize: caller must be super_admin
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

  const targetUserId = body?.targetUserId;
  const newRole = body?.newRole;

  if (!targetUserId || !newRole) {
    return NextResponse.json({ error: "Missing targetUserId/newRole" }, { status: 400 });
  }

  // 4) Safety: prevent self-demotion (super admin lockout)
  if (targetUserId === user.id && newRole !== "super_admin") {
    return NextResponse.json({ error: "You cannot demote yourself." }, { status: 400 });
  }

  const admin = createSupabaseAdmin();

  // 5) Fetch current role for audit + decisions
  const { data: beforeRow, error: beforeErr } = await admin
    .from("profiles")
    .select("id, role, email")
    .eq("id", targetUserId)
    .maybeSingle();

  if (beforeErr || !beforeRow) {
    return NextResponse.json({ error: "Target user not found." }, { status: 404 });
  }

  const oldRole = beforeRow.role as Body["newRole"];

  // 6) Update role
  const { error: updErr } = await admin
    .from("profiles")
    .update({ role: newRole })
    .eq("id", targetUserId);

  if (updErr) {
    return NextResponse.json({ error: updErr.message }, { status: 500 });
  }

  /**
   * 7) If demoted to student:
   * Remove any admin_scopes rows for this user.
   *
   * Why?
   * - Scopes are ONLY meaningful for admins.
   * - Leaving them behind is confusing and can create future policy bugs
   *   if someone accidentally treats “has scopes” as “is admin”.
   */
  if (newRole === "student" || newRole === "staff") {
    const { error: delScopeErr } = await admin
      .from("admin_scopes")
      .delete()
      .eq("admin_user_id", targetUserId);

    if (delScopeErr) {
      // Role change already happened; don't fail the whole request.
      // Return ok but include a warning.
      await writeAuditLog({
        actorUserId: user.id,
        action: "super_admin.user.role_update_scope_cleanup_failed",
        targetType: "user",
        targetId: targetUserId,
        meta: { oldRole, newRole, error: delScopeErr.message },
      });

      return NextResponse.json({
        ok: true,
        warning: "Role updated, but failed to clean up admin scopes.",
      });
    }
  }

  // 8) Audit log (best effort)
  await writeAuditLog({
    actorUserId: user.id,
    action: "super_admin.user.role_update",
    targetType: "user",
    targetId: targetUserId,
    meta: { oldRole, newRole },
  });

  return NextResponse.json({ ok: true });
}