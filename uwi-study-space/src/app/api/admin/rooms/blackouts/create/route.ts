//src/app/api/admin/rooms/blackouts/create/route.ts
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

  const { data: meRows } = await supabase.rpc("get_my_profile");
  const me = Array.isArray(meRows) ? meRows[0] : null;
  const role = me?.role ?? null;

  if (role !== "admin" && role !== "super_admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const roomId = Number(body?.roomId);
  const start = String(body?.start ?? "");
  const end = String(body?.end ?? "");
  const reason = body?.reason ? String(body.reason) : null;

  if (!Number.isFinite(roomId) || !start || !end) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  if (Date.parse(end) <= Date.parse(start)) {
    return NextResponse.json({ error: "Blackout end time must be after start time." }, { status: 400 });
  }

  // Scope check for admins (super_admin bypass)
  if (role !== "super_admin") {
    const { data: scopes, error: scopeErr } = await supabase
      .from("admin_scopes")
      .select("room_id, department_id")
      .eq("admin_user_id", user.id);

    if (scopeErr) return NextResponse.json({ error: "Scope lookup failed" }, { status: 500 });

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

  const { data: inserted, error: insErr } = await admin
    .from("room_blackouts")
    .insert({
      room_id: roomId,
      start_time: start,
      end_time: end,
      reason,
      created_by: user.id,
    })
    .select("id")
    .single();

  if (insErr || !inserted) {
    return NextResponse.json({ error: "Insert failed", detail: insErr?.message }, { status: 400 });
  }

  writeAuditLog({
    actorUserId: user.id,
    action: "room.blackout.create",
    targetType: "room_blackout",
    targetId: String(inserted.id),
    meta: { roomId, start, end, reason, via: role },
  }).catch(() => {});

  return NextResponse.json({ ok: true, blackoutId: inserted.id });
}