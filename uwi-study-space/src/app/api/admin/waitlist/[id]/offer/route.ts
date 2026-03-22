// src/app/api/admin/waitlist/[id]/offer/route.ts
import { NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabase/server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { getSettings } from "@/lib/db/settings";
import { adminHasRoomAccess } from "@/lib/db/adminScopes";

type Role = "student" | "admin" | "super_admin";

export async function POST(
  _: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: rawId } = await params;
  const supabase = await createSupabaseServer();
  const admin = createSupabaseAdmin();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: meRows } = await supabase.rpc("get_my_profile");
  const me = Array.isArray(meRows) ? meRows[0] : null;
  const role: Role | null = me?.role ?? null;

  if (role !== "admin" && role !== "super_admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const id = Number(rawId);
  if (!Number.isFinite(id) || id <= 0) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  const { data: w, error } = await admin
    .from("waitlist")
    .select("id, room_id, status")
    .eq("id", id)
    .single();

  if (error || !w) {
    return NextResponse.json({ error: "Waitlist not found" }, { status: 404 });
  }

  if (role === "admin") {
    const ok = await adminHasRoomAccess(Number(w.room_id));
    if (!ok) return NextResponse.json({ error: "Forbidden (scope)" }, { status: 403 });
  }

  const s = String(w.status).toLowerCase();
  if (s !== "waiting") {
    return NextResponse.json({ error: "Only waiting entries can be offered." }, { status: 400 });
  }

  const settings = await getSettings();
  const minutes = Number(settings.waitlist_offer_minutes ?? 15);
  const expiresAt = new Date(Date.now() + minutes * 60 * 1000).toISOString();

  const { error: upErr } = await admin
    .from("waitlist")
    .update({ status: "offered", offer_expires_at: expiresAt })
    .eq("id", id);

  if (upErr) {
    return NextResponse.json({ error: "Update failed", detail: upErr.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, offer_expires_at: expiresAt });
}