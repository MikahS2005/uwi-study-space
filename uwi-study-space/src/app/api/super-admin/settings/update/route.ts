// src/app/api/super-admin/settings/update/route.ts
import { NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabase/server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { writeAuditLog } from "@/lib/audit/write";

type Body = Partial<{
  student_booking_enabled: boolean;
  max_bookings_per_day: number;
  max_days_ahead: number;
  slot_minutes: number;

  waitlist_offer_minutes: number;

  no_show_threshold: number;
  no_show_window_days: number;
  no_show_ban_days: number;

  // If you added these columns already, keep them here too:
  max_booking_window_days: number;
  max_booking_duration_hours: number;
  max_consecutive_hours: number;
  reverify_after_logout_count: number;
}>;

/**
 * Super Admin Settings (UPDATE)
 * - Auth + super_admin check via get_my_profile()
 * - Uses service role for update
 * - Writes audit log (best-effort)
 *
 * NOTE:
 * - DB constraints already protect ranges; we still sanity-check basic types.
 */
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

  // 2) Authorize
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

  // 4) Build safe patch (only allow known keys)
  const patch: Record<string, any> = {};

  const allowBool = (k: keyof Body) => {
    const v = body[k];
    if (typeof v === "boolean") patch[k as string] = v;
  };

  const allowInt = (k: keyof Body) => {
    const v = body[k];
    if (typeof v === "number" && Number.isFinite(v)) patch[k as string] = Math.trunc(v);
  };

  allowBool("student_booking_enabled");

  allowInt("max_bookings_per_day");
  allowInt("max_days_ahead");
  allowInt("slot_minutes");

  allowInt("waitlist_offer_minutes");

  allowInt("no_show_threshold");
  allowInt("no_show_window_days");
  allowInt("no_show_ban_days");

  allowInt("max_booking_window_days");
  allowInt("max_booking_duration_hours");
  allowInt("max_consecutive_hours");
  allowInt("reverify_after_logout_count");

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
  }

  // Keep timestamps consistent
  patch.updated_at = new Date().toISOString();

  // 5) Update
  const admin = createSupabaseAdmin();
  const { data: updated, error: updErr } = await admin
    .from("settings")
    .update(patch)
    .eq("id", 1)
    .select("*")
    .maybeSingle();

  if (updErr) {
    return NextResponse.json({ error: updErr.message }, { status: 500 });
  }

  // 6) Audit (best-effort)
  await writeAuditLog({
    actorUserId: user.id,
    action: "settings.update",
    targetType: "settings",
    targetId: 1,
    meta: { patch },
  });

  return NextResponse.json({ ok: true, settings: updated });
}