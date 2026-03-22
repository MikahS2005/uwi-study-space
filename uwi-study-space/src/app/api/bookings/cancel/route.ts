import { NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabase/server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { writeAuditLog } from "@/lib/audit/write";
import { sendBookingCancellation } from "@/lib/email/sendBookingCancellation";
import { formatTtDateTimeLabel } from "@/lib/email/bookingEmailHelpers";

type Role = "student" | "staff" | "admin" | "super_admin";

/**
 * Normal user cancels their own booking.
 * Server enforces:
 * - authenticated
 * - role === student or staff
 * - booking belongs to them
 * - booking is active
 * - audit log (best effort) AFTER successful cancel
 * - cancellation email (best effort)
 */
export async function POST(req: Request) {
  const supabase = await createSupabaseServer();

  // 1) Auth user
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // 2) Role check via RPC (avoids profiles/RLS recursion)
  const { data: meRows, error: meError } = await supabase.rpc("get_my_profile");
  if (meError) {
    return NextResponse.json(
      { error: "Profile lookup failed", detail: meError.message },
      { status: 500 },
    );
  }

  const me = Array.isArray(meRows) ? meRows[0] : null;
  const role = (me?.role ?? null) as Role | null;

  if (role !== "student" && role !== "staff") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // 3) Parse payload
  const body = await req.json().catch(() => null);
  const bookingId = String(body?.bookingId ?? "").trim();

  if (!bookingId) {
    return NextResponse.json({ error: "Missing bookingId" }, { status: 400 });
  }

  // 4) Ensure booking belongs to this user + is active
  const admin = createSupabaseAdmin();
  const { data: booking, error: bookingErr } = await admin
    .from("bookings")
    .select("id, status, booked_for_user_id, room_id, start_time, end_time")
    .eq("id", bookingId)
    .maybeSingle();

  if (bookingErr || !booking) {
    return NextResponse.json({ error: "Booking not found" }, { status: 404 });
  }

  if (booking.booked_for_user_id !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (booking.status !== "active") {
    return NextResponse.json({ error: "Not cancellable" }, { status: 400 });
  }

  // 5) Cancel
  const { error: cancelErr } = await admin
    .from("bookings")
    .update({ status: "cancelled" })
    .eq("id", bookingId)
    .eq("status", "active");

  if (cancelErr) {
    return NextResponse.json(
      { error: "Cancel failed", detail: cancelErr.message },
      { status: 400 },
    );
  }

  // 6) Audit log (best effort)
  writeAuditLog({
    actorUserId: user.id,
    action: "booking.cancel",
    targetType: "booking",
    targetId: bookingId,
    meta: {
      via: role,
      roomId: booking.room_id,
      start: booking.start_time,
      end: booking.end_time,
    },
  }).catch(() => {});

  // 7) Cancellation email (best effort)
  try {
    const [profileRes, roomRes] = await Promise.all([
      admin
        .from("profiles")
        .select("email, full_name")
        .eq("id", user.id)
        .maybeSingle(),
      admin
        .from("rooms")
        .select("name, building")
        .eq("id", booking.room_id)
        .maybeSingle(),
    ]);

    const profile = profileRes.data;
    const room = roomRes.data;

    console.log("[booking.cancel] profile:", profile);
    console.log("[booking.cancel] room:", room);

    if (!profile?.email) {
      console.warn("[booking.cancel] No recipient email found");
    } else if (!room?.name) {
      console.warn("[booking.cancel] No room name found");
    } else {
      const emailResult = await sendBookingCancellation({
        to: profile.email,
        recipientName: profile.full_name,
        roomName: room.name,
        building: room.building,
        startLabel: formatTtDateTimeLabel(booking.start_time),
        endLabel: formatTtDateTimeLabel(booking.end_time),
        reason: null,
      });

      console.log("[booking.cancel] emailResult:", emailResult);
    }
  } catch (err) {
    console.error("[booking.cancel] cancellation email failed:", err);
  }

  return NextResponse.json({ ok: true });
}