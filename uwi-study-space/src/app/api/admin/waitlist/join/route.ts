// src/app/api/admin/waitlist/join/route.ts
import { NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabase/server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { writeAuditLog } from "@/lib/audit/write";
import { adminHasRoomAccess } from "@/lib/db/adminScopes";

type Role = "student" | "admin" | "super_admin";

export async function POST(req: Request) {
  const supabase = await createSupabaseServer();
  const admin = createSupabaseAdmin();

  // 1) Auth
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // 2) Role
  const { data: meRows, error: meError } = await supabase.rpc("get_my_profile");
  if (meError) {
    return NextResponse.json(
      { error: "Profile lookup failed", detail: meError.message },
      { status: 500 }
    );
  }

  const me = Array.isArray(meRows) ? meRows[0] : null;
  const role = (me?.role ?? null) as Role | null;

  if (role !== "admin" && role !== "super_admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // 3) Payload
  const body = await req.json().catch(() => null);

  const roomId = Number(body?.roomId);
  const start = String(body?.start ?? "");
  const end = String(body?.end ?? "");
  const bookedForUserId = String(body?.bookedForUserId ?? "").trim();

  if (!Number.isFinite(roomId) || !start || !end || !bookedForUserId) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  // 4) Scope check for department admins
  if (role === "admin") {
    const ok = await adminHasRoomAccess(roomId);
    if (!ok) {
      return NextResponse.json({ error: "Forbidden (scope)" }, { status: 403 });
    }
  }

  // 5) Optional sanity check: confirm target user exists
  // Adjust table/column names if your schema differs.
  const { data: targetUser, error: targetErr } = await admin
    .from("profiles")
    .select("id")
    .eq("id", bookedForUserId)
    .maybeSingle();

  if (targetErr) {
    return NextResponse.json(
      { error: "Failed to verify selected student", detail: targetErr.message },
      { status: 500 }
    );
  }

  if (!targetUser) {
    return NextResponse.json({ error: "Selected student not found" }, { status: 404 });
  }

  // 6) Prevent duplicate live entries for the SAME student / room / time
  const { data: existing, error: dupErr } = await admin
    .from("waitlist")
    .select("id")
    .eq("room_id", roomId)
    .eq("user_id", bookedForUserId)
    .eq("start_time", start)
    .eq("end_time", end)
    .in("status", ["waiting", "offered"]);

  if (dupErr) {
    return NextResponse.json(
      { error: "Failed to check existing waitlist entries", detail: dupErr.message },
      { status: 500 }
    );
  }

  if ((existing ?? []).length > 0) {
    return NextResponse.json({ ok: true, already: true });
  }

  // 7) Insert waitlist entry for the SELECTED student, not the admin
  const { data: inserted, error: insErr } = await admin
    .from("waitlist")
    .insert({
      room_id: roomId,
      start_time: start,
      end_time: end,
      user_id: bookedForUserId,
      status: "waiting",
      offer_expires_at: null,
    })
    .select("id")
    .single();

  if (insErr || !inserted) {
    return NextResponse.json(
      { error: "Join waitlist failed", detail: insErr?.message },
      { status: 500 }
    );
  }

  // 8) Audit
  writeAuditLog({
    actorUserId: user.id,
    action: "admin.waitlist.join",
    targetType: "waitlist",
    targetId: inserted.id,
    meta: {
      via: role,
      roomId,
      start,
      end,
      bookedForUserId,
    },
  }).catch(() => {});

  return NextResponse.json({ ok: true, waitlistId: inserted.id });
}