// src/app/api/admin/waitlist/offer/route.ts
import { NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabase/server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { getSettings } from "@/lib/db/settings";
import { adminHasRoomAccess } from "@/lib/db/adminScopes";

type Role = "student" | "admin" | "super_admin";

export async function POST(req: Request) {
  const supabase = await createSupabaseServer();
  const admin = createSupabaseAdmin();

  // 1) Auth
  const {
    data: { user },
    error: authErr,
  } = await supabase.auth.getUser();

  if (authErr || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // 2) Role via RPC (avoid RLS recursion)
  const { data: meRows, error: meErr } = await supabase.rpc("get_my_profile");
  if (meErr) {
    return NextResponse.json({ error: "Profile lookup failed", detail: meErr.message }, { status: 500 });
  }

  const me = Array.isArray(meRows) ? meRows[0] : null;
  const role = (me?.role ?? null) as Role | null;

  if (role !== "admin" && role !== "super_admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // 3) Body
  const body = await req.json().catch(() => null);
  const waitlistId = Number(body?.waitlistId);

  if (!Number.isFinite(waitlistId)) {
    return NextResponse.json({ error: "Missing waitlistId" }, { status: 400 });
  }

  // 4) Load waitlist entry (service role, but we will enforce access below)
  const { data: w, error: wErr } = await admin
    .from("waitlist")
    .select("id, room_id, status, offer_expires_at")
    .eq("id", waitlistId)
    .single();

  if (wErr || !w) {
    return NextResponse.json({ error: "Waitlist entry not found" }, { status: 404 });
  }

  const status = String(w.status ?? "").toLowerCase();

  // Only allow offering from waiting/expired (simple rule)
  if (status !== "waiting" && status !== "expired") {
    return NextResponse.json(
      { error: `Cannot offer when status is '${w.status}'.` },
      { status: 400 },
    );
  }

  // 5) Scope check (admins must have access to this room)
  if (role === "admin") {
    const ok = await adminHasRoomAccess(Number(w.room_id));
    if (!ok) return NextResponse.json({ error: "Forbidden (out of scope)" }, { status: 403 });
  }

  // 6) Compute expiry based on settings
  const settings = await getSettings();
  const offerMinutes = Number(settings.waitlist_offer_minutes ?? 30);

  const expiresAt = new Date(Date.now() + offerMinutes * 60 * 1000).toISOString();

  // 7) Update waitlist
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

  return NextResponse.json({ ok: true, offer_expires_at: expiresAt });
}