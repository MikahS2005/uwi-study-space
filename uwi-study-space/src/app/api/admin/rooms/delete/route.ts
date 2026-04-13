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

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

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

  const body = await req.json().catch(() => null);
  const roomId = Number(body?.roomId);

  if (!Number.isFinite(roomId) || roomId <= 0) {
    return NextResponse.json({ error: "Invalid roomId" }, { status: 400 });
  }

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

  const { data: room, error: roomErr } = await admin
    .from("rooms")
    .select("id, name")
    .eq("id", roomId)
    .maybeSingle();

  if (roomErr || !room) {
    return NextResponse.json({ error: roomErr?.message ?? "Room not found" }, { status: 404 });
  }

  const [{ count: bookingsCount }, { count: waitlistCount }] = await Promise.all([
    admin
      .from("bookings")
      .select("id", { head: true, count: "exact" })
      .eq("room_id", roomId),
    admin
      .from("waitlist")
      .select("id", { head: true, count: "exact" })
      .eq("room_id", roomId),
  ]);

  if ((bookingsCount ?? 0) > 0 || (waitlistCount ?? 0) > 0) {
    return NextResponse.json(
      {
        error:
          "This room has booking or waitlist history and cannot be deleted. Deactivate it instead.",
      },
      { status: 409 },
    );
  }

  await admin.from("room_blackouts").delete().eq("room_id", roomId);
  await admin.from("room_opening_hours").delete().eq("room_id", roomId);

  const { error: delErr } = await admin.from("rooms").delete().eq("id", roomId);

  if (delErr) {
    return NextResponse.json({ error: delErr.message }, { status: 400 });
  }

  writeAuditLog({
    actorUserId: user.id,
    action: "admin.room.delete",
    targetType: "room",
    targetId: roomId,
    meta: { via: role, roomName: room.name },
  }).catch(() => {});

  return NextResponse.json({ ok: true, roomId });
}