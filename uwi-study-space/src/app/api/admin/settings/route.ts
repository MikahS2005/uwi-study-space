// src/app/api/admin/settings/route.ts
import { NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabase/server";
import { updateSettings, getSettings } from "@/lib/db/settings";

/**
 * Super admin only:
 * - GET returns current settings
 * - PATCH updates settings
 *
 * Security:
 * - auth user required
 * - role checked via get_my_profile() SECURITY DEFINER RPC
 */
export async function GET() {
  const supabase = await createSupabaseServer();

  const { data: auth, error: authErr } = await supabase.auth.getUser();
  if (authErr || !auth?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: meRows, error: meErr } = await supabase.rpc("get_my_profile");
  if (meErr) return NextResponse.json({ error: "Profile lookup failed" }, { status: 500 });

  const me = Array.isArray(meRows) ? meRows[0] : null;
  if (me?.role !== "super_admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const settings = await getSettings();
  return NextResponse.json({ settings });
}

export async function PATCH(req: Request) {
  const supabase = await createSupabaseServer();

  const { data: auth, error: authErr } = await supabase.auth.getUser();
  if (authErr || !auth?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: meRows, error: meErr } = await supabase.rpc("get_my_profile");
  if (meErr) return NextResponse.json({ error: "Profile lookup failed" }, { status: 500 });

  const me = Array.isArray(meRows) ? meRows[0] : null;
  if (me?.role !== "super_admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  // Minimal type coercion (keeps UI simple)
  const patch: Record<string, unknown> = {};

  if ("student_booking_enabled" in body) patch.student_booking_enabled = Boolean(body.student_booking_enabled);

  const intKeys = [
    "max_bookings_per_day",
    "max_booking_window_days",
    "max_booking_duration_hours",
    "max_consecutive_hours",
    "no_show_threshold",
    "no_show_window_days",
    "slot_minutes",
  ] as const;

  for (const k of intKeys) {
    if (k in body) {
      const n = Number((body as any)[k]);
      if (!Number.isFinite(n) || n < 0) {
        return NextResponse.json({ error: `Invalid ${k}` }, { status: 400 });
      }
      patch[k] = Math.trunc(n);
    }
  }

  const settings = await updateSettings(patch);
  return NextResponse.json({ ok: true, settings });
}
