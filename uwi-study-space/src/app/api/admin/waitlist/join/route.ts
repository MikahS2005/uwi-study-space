import { NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabase/server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { writeAuditLog } from "@/lib/audit/write";

type Role = "student" | "admin" | "super_admin";

export async function POST(req: Request) {
  const supabase = await createSupabaseServer();
  const admin = createSupabaseAdmin();

  // Auth
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Role
  const { data: meRows, error: meError } = await supabase.rpc("get_my_profile");
  if (meError) return NextResponse.json({ error: "Profile lookup failed" }, { status: 500 });

  const me = Array.isArray(meRows) ? meRows[0] : null;
  const role = (me?.role ?? null) as Role | null;
  if (role !== "student") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  // Payload
  const body = await req.json().catch(() => null);
  const roomId = Number(body?.roomId);
  const start = String(body?.start ?? "");
  const end = String(body?.end ?? "");

  if (!Number.isFinite(roomId) || !start || !end) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  // Prevent duplicates for same user/time/room in a "live" state
  const { data: existing } = await admin
    .from("waitlist")
    .select("id")
    .eq("room_id", roomId)
    .eq("user_id", user.id)
    .eq("start_time", start)
    .eq("end_time", end)
    .in("status", ["waiting", "offered"]); // don't duplicate active entries

  if ((existing ?? []).length > 0) {
    return NextResponse.json({ ok: true, already: true });
  }

  // Insert waitlist entry
  const { data: inserted, error: insErr } = await admin
    .from("waitlist")
    .insert({
      room_id: roomId,
      start_time: start,
      end_time: end,
      user_id: user.id,
      status: "waiting",
      offer_expires_at: null,
    })
    .select("id")
    .single();

  if (insErr || !inserted) {
    return NextResponse.json({ error: "Join waitlist failed", detail: insErr?.message }, { status: 500 });
  }

  // Audit (best effort)
  writeAuditLog({
    actorUserId: user.id,
    action: "waitlist.join",
    targetType: "waitlist",
    targetId: inserted.id,
    meta: { roomId, start, end },
  }).catch(() => {});

  return NextResponse.json({ ok: true, waitlistId: inserted.id });
}