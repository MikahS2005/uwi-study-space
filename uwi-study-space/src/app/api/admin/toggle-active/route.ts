// src/app/api/admin/rooms/toggle-active/route.ts
// Toggle a room's active state (Admin Panel).
//
// Rules:
// - Must be logged in
// - role === "admin"  -> can only toggle rooms in their scope
// - role === "super_admin" -> can toggle any room
//
// We use:
// - createSupabaseServer() to read the current session user (cookies) + role via RPC
// - createSupabaseAdmin() (service role) to perform the UPDATE reliably
//
// IMPORTANT: service role bypasses RLS, so we MUST enforce authorization checks here.

import { NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabase/server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { adminHasRoomAccess } from "@/lib/db/adminScopes";

export async function POST(req: Request) {
  const supabase = await createSupabaseServer();

  // 1) Auth user (cookie-based)
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  // 2) Parse body
  const body = (await req.json().catch(() => null)) as null | { roomId?: number };
  const roomId = body?.roomId;

  if (!roomId || typeof roomId !== "number") {
    return NextResponse.json({ error: "roomId is required" }, { status: 400 });
  }

  // 3) Role via SECURITY DEFINER RPC (avoids profiles recursion)
  const { data: meRows, error: meErr } = await supabase.rpc("get_my_profile");
  if (meErr) {
    return NextResponse.json({ error: meErr.message }, { status: 400 });
  }

  const me = Array.isArray(meRows) ? meRows[0] : null;
  const role = (me?.role ?? null) as "student" | "admin" | "super_admin" | null;

  // 4) Only admin/super_admin allowed
  if (role !== "admin" && role !== "super_admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // 5) If department admin, enforce scope
  if (role === "admin") {
    const ok = await adminHasRoomAccess(roomId);
    if (!ok) {
      return NextResponse.json({ error: "Room out of scope" }, { status: 403 });
    }
  }

  // 6) Toggle using service role (reliable update regardless of RLS)
  const admin = createSupabaseAdmin();

  // Read current is_active first
  const { data: room, error: readErr } = await admin
    .from("rooms")
    .select("id, is_active")
    .eq("id", roomId)
    .maybeSingle();

  if (readErr || !room) {
    return NextResponse.json({ error: readErr?.message ?? "Room not found" }, { status: 404 });
  }

  const nextActive = !(room.is_active ?? false);

  const { error: updErr } = await admin
    .from("rooms")
    .update({ is_active: nextActive })
    .eq("id", roomId);

  if (updErr) {
    return NextResponse.json({ error: updErr.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true, roomId, is_active: nextActive });
}
