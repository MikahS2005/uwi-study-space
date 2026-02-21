//src/app/api/admin/rooms/buffer/update/route.ts
import { NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabase/server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { writeAuditLog } from "@/lib/audit/write";

export async function POST(req: Request) {
  const supabase = await createSupabaseServer();
  const admin = createSupabaseAdmin();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: meRows, error: meError } = await supabase.rpc("get_my_profile");
  if (meError) return NextResponse.json({ error: "Profile lookup failed" }, { status: 500 });

  const me = Array.isArray(meRows) ? meRows[0] : null;
  const role = me?.role ?? null;

  if (role !== "admin" && role !== "super_admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const roomId = Number(body?.roomId);
  const bufferMinutes = Number(body?.bufferMinutes);

  if (!Number.isFinite(roomId) || !Number.isFinite(bufferMinutes)) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  if (bufferMinutes < 0 || bufferMinutes > 240) {
    return NextResponse.json({ error: "Buffer minutes must be between 0 and 240." }, { status: 400 });
  }

  // Scope check for admins (super_admin bypass)
  if (role !== "super_admin") {
    const { data: scopes, error: scopeErr } = await supabase
      .from("admin_scopes")
      .select("room_id, department_id")
      .eq("admin_user_id", user.id);

    if (scopeErr) {
      return NextResponse.json({ error: "Scope lookup failed" }, { status: 500 });
    }

    const { data: roomRow, error: roomErr } = await supabase
      .from("rooms")
      .select("department_id")
      .eq("id", roomId)
      .maybeSingle();

    if (roomErr || !roomRow) return NextResponse.json({ error: "Room not found" }, { status: 404 });

    const hasAccess = (scopes ?? []).some(
      (s) => s.room_id === roomId || (s.department_id && s.department_id === roomRow.department_id),
    );

    if (!hasAccess) return NextResponse.json({ error: "Forbidden (no scope)" }, { status: 403 });
  }

  const { error: updErr } = await admin.from("rooms").update({ buffer_minutes: bufferMinutes }).eq("id", roomId);
  if (updErr) {
    return NextResponse.json({ error: "Update failed", detail: updErr.message }, { status: 400 });
  }

  writeAuditLog({
    actorUserId: user.id,
    action: "room.buffer.update",
    targetType: "room",
    targetId: String(roomId),
    meta: { bufferMinutes, via: role },
  }).catch(() => {});

  return NextResponse.json({ ok: true });
}