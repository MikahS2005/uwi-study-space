//src/app/api/admin/rooms/opening-hours/update/route.ts
//
// Update a room's opening hours.
import { NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabase/server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { writeAuditLog } from "@/lib/audit/write";

type DayHours = {
  day_of_week: number;
  open_minute: number;
  close_minute: number;
  is_closed: boolean;
};

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
  const hours = Array.isArray(body?.hours) ? (body.hours as DayHours[]) : null;

  if (!Number.isFinite(roomId) || !hours) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
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

  // Normalize & validate
  const byDow = new Map<number, DayHours>();
  for (const h of hours) {
    if (typeof h?.day_of_week !== "number") continue;
    byDow.set(h.day_of_week, h);
  }

  const rows: Array<{
    room_id: number;
    day_of_week: number;
    open_minute: number;
    close_minute: number;
    is_closed: boolean;
    updated_at: string;
  }> = [];

  for (let dow = 0; dow <= 6; dow++) {
    const h = byDow.get(dow) ?? { day_of_week: dow, open_minute: 480, close_minute: 1200, is_closed: false };

    if (dow < 0 || dow > 6) return NextResponse.json({ error: "Invalid day_of_week." }, { status: 400 });

    if (!h.is_closed) {
      if (h.open_minute < 0 || h.open_minute > 1439) {
        return NextResponse.json({ error: "Invalid open_minute." }, { status: 400 });
      }
      if (h.close_minute < 1 || h.close_minute > 1440) {
        return NextResponse.json({ error: "Invalid close_minute." }, { status: 400 });
      }
      if (h.close_minute <= h.open_minute) {
        return NextResponse.json({ error: "close_minute must be after open_minute." }, { status: 400 });
      }
    }

    rows.push({
      room_id: roomId,
      day_of_week: dow,
      open_minute: h.open_minute,
      close_minute: h.close_minute,
      is_closed: Boolean(h.is_closed),
      updated_at: new Date().toISOString(),
    });
  }

  // Upsert by UNIQUE(room_id, day_of_week)
  const { error: upErr } = await admin
    .from("room_opening_hours")
    .upsert(rows, { onConflict: "room_id,day_of_week" });

  if (upErr) {
    return NextResponse.json({ error: "Update failed", detail: upErr.message }, { status: 400 });
  }

  writeAuditLog({
    actorUserId: user.id,
    action: "room.opening_hours.update",
    targetType: "room",
    targetId: String(roomId),
    meta: { via: role },
  }).catch(() => {});

  return NextResponse.json({ ok: true });
}