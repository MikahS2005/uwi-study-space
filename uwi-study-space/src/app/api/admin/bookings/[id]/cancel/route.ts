// src/app/api/admin/bookings/[id]/cancel/route.ts
import { NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabase/server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { writeAuditLog } from "@/lib/audit/write";
import { getPositiveRouteId, invalidIdResponse } from "@/lib/api/routeParams";
import { sendBookingCancellation } from "@/lib/email/sendBookingCancellation";
import { formatTtDateTimeLabel } from "@/lib/email/bookingEmailHelpers";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const bookingId = await getPositiveRouteId(params);
  if (bookingId === null) {
    return invalidIdResponse("booking id");
  }

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

  const body = await req.json().catch(() => ({}));
  const reason = typeof body?.reason === "string" ? body.reason.trim() : "";

  const { data: booking, error: bookingErr } = await admin
    .from("bookings")
    .select("id, status, room_id, booked_for_user_id, start_time, end_time, created_by")
    .eq("id", bookingId)
    .maybeSingle();

  if (bookingErr || !booking) {
    return NextResponse.json({ error: "Booking not found" }, { status: 404 });
  }

  if (booking.status !== "active") {
    return NextResponse.json(
      { error: "Only active bookings can be cancelled" },
      { status: 400 }
    );
  }

  if (role !== "super_admin") {
    const { data: canAccess, error: accessErr } = await supabase.rpc("admin_has_room_access", {
      target_room_id: booking.room_id,
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

  const { error: updErr } = await admin
    .from("bookings")
    .update({ status: "cancelled" })
    .eq("id", bookingId)
    .eq("status", "active");

  if (updErr) {
    return NextResponse.json({ error: "Cancel failed", detail: updErr.message }, { status: 400 });
  }

  writeAuditLog({
    actorUserId: user.id,
    action: "admin.booking.cancel",
    targetType: "booking",
    targetId: bookingId,
    meta: {
      via: role,
      roomId: booking.room_id,
      bookedForUserId: booking.booked_for_user_id,
      start: booking.start_time,
      end: booking.end_time,
      reason: reason || undefined,
    },
  }).catch(() => {});

  try {
    const [profileRes, roomRes] = await Promise.all([
      admin
        .from("profiles")
        .select("email, full_name")
        .eq("id", booking.booked_for_user_id)
        .maybeSingle(),
      admin
        .from("rooms")
        .select("name, building")
        .eq("id", booking.room_id)
        .maybeSingle(),
    ]);

    const profile = profileRes.data;
    const room = roomRes.data;

    console.log("[admin.booking.cancel] profile:", profile);
    console.log("[admin.booking.cancel] room:", room);

    if (!profile?.email) {
      console.warn("[admin.booking.cancel] No recipient email found");
    } else if (!room?.name) {
      console.warn("[admin.booking.cancel] No room name found");
    } else {
      const emailResult = await sendBookingCancellation({
        to: profile.email,
        recipientName: profile.full_name,
        roomName: room.name,
        building: room.building,
        startLabel: formatTtDateTimeLabel(booking.start_time),
        endLabel: formatTtDateTimeLabel(booking.end_time),
        reason: reason || null,
      });

      console.log("[admin.booking.cancel] emailResult:", emailResult);
    }
  } catch (err) {
    console.error("[admin.booking.cancel] cancellation email failed:", err);
  }

  return NextResponse.json({ ok: true });
}