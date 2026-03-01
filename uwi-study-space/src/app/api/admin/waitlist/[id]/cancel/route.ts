// src/app/api/admin/waitlist/[id]/cancel/route.ts
import { NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabase/server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { adminHasRoomAccess } from "@/lib/db/adminScopes";

type Role = "student" | "admin" | "super_admin";

export async function POST(_: Request, ctx: { params: { id: string } }) {
  const supabase = await createSupabaseServer();
  const admin = createSupabaseAdmin();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: meRows } = await supabase.rpc("get_my_profile");
  const me = Array.isArray(meRows) ? meRows[0] : null;
  const role: Role | null = me?.role ?? null;

  if (role !== "admin" && role !== "super_admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const id = Number(ctx.params.id);
  if (!Number.isFinite(id)) return NextResponse.json({ error: "Invalid id" }, { status: 400 });

  const { data: w, error } = await admin.from("waitlist").select("id, room_id, status").eq("id", id).single();
  if (error || !w) return NextResponse.json({ error: "Waitlist not found" }, { status: 404 });

  if (role === "admin") {
    const ok = await adminHasRoomAccess(Number(w.room_id));
    if (!ok) return NextResponse.json({ error: "Forbidden (scope)" }, { status: 403 });
  }

  const s = String(w.status).toLowerCase();
  if (s === "fulfilled") return NextResponse.json({ error: "Cannot cancel a fulfilled entry." }, { status: 400 });

  const { error: upErr } = await admin
    .from("waitlist")
    .update({ status: "cancelled", offer_expires_at: null })
    .eq("id", id);

  if (upErr) return NextResponse.json({ error: "Update failed", detail: upErr.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}