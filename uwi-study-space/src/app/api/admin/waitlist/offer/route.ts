import { NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabase/server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { adminHasRoomAccess } from "@/lib/db/adminScopes";
import { getSettings } from "@/lib/db/settings";
import { writeAuditLog } from "@/lib/audit/write";

type Role = "student" | "admin" | "super_admin";

export async function POST(req: Request) {
  const supabase = await createSupabaseServer();
  const admin = createSupabaseAdmin();

  // Auth
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Role
  const { data: meRows, error: meError } = await supabase.rpc("get_my_profile");
  if (meError) return NextResponse.json({ error: "Profile lookup failed" }, { status: 500 });

  const me = Array.isArray(meRows) ? meRows[0] : null;
  const role = (me?.role ?? null) as Role | null;

  if (role !== "admin" && role !== "super_admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const waitlistId = Number(body?.waitlistId);

  if (!Number.isFinite(waitlistId)) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  // Load waitlist row (service role so we can read regardless of RLS)
  const { data: wl, error: wlErr } = await admin
    .from("waitlist")
    .select("id, room_id, user_id, status, start_time, end_time")
    .eq("id", waitlistId)
    .single();

  if (wlErr || !wl) {
    return NextResponse.json({ error: "Waitlist entry not found" }, { status: 404 });
  }

  // Scope check (department admin must have access)
  if (role === "admin") {
    const ok = await adminHasRoomAccess(Number(wl.room_id));
    if (!ok) return NextResponse.json({ error: "Out of scope" }, { status: 403 });
  }

  const settings = await getSettings();
  const offerMinutes = Number(settings.waitlist_offer_minutes ?? 30);
  const expiresAt = new Date(Date.now() + offerMinutes * 60 * 1000).toISOString();

  // Mark as offered + set expiry
  const { error: upErr } = await admin
    .from("waitlist")
    .update({
      status: "offered",
      offer_expires_at: expiresAt,
    })
    .eq("id", waitlistId);

  if (upErr) {
    return NextResponse.json({ error: "Offer failed", detail: upErr.message }, { status: 500 });
  }

  // Audit (best effort)
  writeAuditLog({
    actorUserId: user.id,
    action: "waitlist.offer",
    targetType: "waitlist",
    targetId: waitlistId,
    meta: { roomId: wl.room_id, start: wl.start_time, end: wl.end_time, expiresAt },
  }).catch(() => {});

  return NextResponse.json({ ok: true, offer_expires_at: expiresAt });
}