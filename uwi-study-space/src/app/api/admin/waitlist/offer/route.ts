import { NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabase/server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { getSettings } from "@/lib/db/settings";
import { adminHasRoomAccess } from "@/lib/db/adminScopes";
import { sendWaitlistOffer } from "@/lib/email/sendWaitlistOffer";
import { formatTtDateTimeLabel } from "@/lib/email/bookingEmailHelpers";
import { invalidIdResponse } from "@/lib/api/routeParams";

type Role = "student" | "staff" | "admin" | "super_admin";

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const id = Number(body?.waitlistId);

  if (!Number.isInteger(id) || id <= 0) {
    return invalidIdResponse("waitlistId");
  }

  const supabase = await createSupabaseServer();
  const admin = createSupabaseAdmin();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: meRows } = await supabase.rpc("get_my_profile");
  const me = Array.isArray(meRows) ? meRows[0] : null;
  const role: Role | null = me?.role ?? null;

  if (role !== "admin" && role !== "super_admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { data: w, error } = await admin
    .from("waitlist")
    .select("id, room_id, user_id, start_time, end_time, status")
    .eq("id", id)
    .single();

  if (error || !w) {
    return NextResponse.json({ error: "Waitlist not found" }, { status: 404 });
  }

  if (role === "admin") {
    const ok = await adminHasRoomAccess(Number(w.room_id));
    if (!ok) {
      return NextResponse.json({ error: "Forbidden (scope)" }, { status: 403 });
    }
  }

  const s = String(w.status).toLowerCase();
  if (s !== "waiting") {
    return NextResponse.json(
      { error: "Only waiting entries can be offered." },
      { status: 400 }
    );
  }

  const settings = await getSettings();
  const minutes = Number(settings.waitlist_offer_minutes ?? 15);
  const expiresAt = new Date(Date.now() + minutes * 60 * 1000).toISOString();

  const { error: upErr } = await admin
    .from("waitlist")
    .update({ status: "offered", offer_expires_at: expiresAt })
    .eq("id", id);

  if (upErr) {
    return NextResponse.json(
      { error: "Update failed", detail: upErr.message },
      { status: 500 }
    );
  }

  try {
    const [profileRes, roomRes] = await Promise.all([
      admin
        .from("profiles")
        .select("email, full_name")
        .eq("id", w.user_id)
        .maybeSingle(),
      admin
        .from("rooms")
        .select("name, building")
        .eq("id", w.room_id)
        .maybeSingle(),
    ]);

    const profile = profileRes.data;
    const room = roomRes.data;

    if (profile?.email && room?.name) {
      await sendWaitlistOffer({
        to: profile.email,
        recipientName: profile.full_name,
        roomName: room.name,
        building: room.building,
        startLabel: formatTtDateTimeLabel(w.start_time),
        endLabel: formatTtDateTimeLabel(w.end_time),
        expiresLabel: formatTtDateTimeLabel(expiresAt),
      });
    }
  } catch (err) {
    console.error("[admin.waitlist.offer] waitlist offer email failed:", err);
  }

  return NextResponse.json({ ok: true, offer_expires_at: expiresAt });
}