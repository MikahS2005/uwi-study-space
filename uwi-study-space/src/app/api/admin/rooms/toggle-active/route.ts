// src/app/api/admin/rooms/toggle-active/route.ts
//
// Toggle a room's is_active state.
//
// Rules:
// - Must be authenticated
// - Role must be admin or super_admin
// - Admin must have scope access to the room (admin_has_room_access)
// - Update is performed with service role (bypasses RLS)
// - Audit log is best-effort
//
// IMPORTANT:
// Service role bypasses RLS, so authorization MUST be enforced here.

import { NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabase/server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { writeAuditLog } from "@/lib/audit/write";

export async function POST(req: Request) {
  const supabase = await createSupabaseServer();
  const admin = createSupabaseAdmin();

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
  // 2) Role via SECURITY DEFINER RPC
  // ---------------------------------------------------------------------------
  const { data: meRows, error: meError } = await supabase.rpc("get_my_profile");
  if (meError) {
    return NextResponse.json(
      { error: "Profile lookup failed", detail: meError.message },
      { status: 500 },
    );
  }

  const me = Array.isArray(meRows) ? meRows[0] : null;
  const role = me?.role ?? null;

  if (role !== "admin" && role !== "super_admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // ---------------------------------------------------------------------------
  // 3) Parse body
  // ---------------------------------------------------------------------------
  const body = await req.json().catch(() => null);
  const roomId = Number(body?.roomId);

  if (!Number.isFinite(roomId) || roomId <= 0) {
    return NextResponse.json({ error: "Invalid roomId" }, { status: 400 });
  }

  // ---------------------------------------------------------------------------
  // 4) Scope check (admins only)
  // ---------------------------------------------------------------------------
  if (role !== "super_admin") {
    const { data: canAccess, error: accessErr } = await supabase.rpc("admin_has_room_access", {
      target_room_id: roomId,
    });

    if (accessErr) {
      return NextResponse.json(
        { error: "Scope check failed", detail: accessErr.message },
        { status: 500 },
      );
    }

    if (canAccess !== true) {
      return NextResponse.json({ error: "Forbidden (no scope)" }, { status: 403 });
    }
  }

  // ---------------------------------------------------------------------------
  // 5) Read current is_active, then toggle (service role)
  // ---------------------------------------------------------------------------
  const { data: room, error: readErr } = await admin
    .from("rooms")
    .select("id, is_active")
    .eq("id", roomId)
    .maybeSingle();

  if (readErr || !room) {
    return NextResponse.json({ error: readErr?.message ?? "Room not found" }, { status: 404 });
  }

  const nextActive = !Boolean(room.is_active);

  const { error: updErr } = await admin.from("rooms").update({ is_active: nextActive }).eq("id", roomId);

  if (updErr) {
    return NextResponse.json({ error: updErr.message }, { status: 400 });
  }

  // ---------------------------------------------------------------------------
  // 6) Audit (best effort)
  // ---------------------------------------------------------------------------
  writeAuditLog({
    actorUserId: user.id,
    action: "admin.room.toggle_active",
    targetType: "room",
    targetId: roomId,
    meta: { via: role, nextActive },
  }).catch(() => {});

  return NextResponse.json({ ok: true, roomId, is_active: nextActive });
}
