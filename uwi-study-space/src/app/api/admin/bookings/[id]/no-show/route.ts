// src/app/api/admin/bookings/[id]/no-show/route.ts
import { NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabase/server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { writeAuditLog } from "@/lib/audit/write";

/**
 * POST /api/admin/bookings/:id/no-show
 *
 * Mirrors your existing /api/admin/mark-no-show but REST-ful.
 */
export async function POST(_req: Request, ctx: { params: { id: string } }) {
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
      { status: 500 },
    );
  }

  const me = Array.isArray(meRows) ? meRows[0] : null;
  const role = me?.role ?? null;

  if (role !== "admin" && role !== "super_admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // 3) Parse booking id
  const bookingId = Number(ctx.params.id);
  if (!Number.isFinite(bookingId) || bookingId <= 0) {
    return NextResponse.json({ error: "Invalid booking id" }, { status: 400 });
  }

  // 4) Read booking
  const { data: booking, error: bookingErr } = await admin
    .from("bookings")
    .select("id, status, room_id, booked_for_user_id, start_time, end_time")
    .eq("id", bookingId)
    .maybeSingle();

  if (bookingErr || !booking) {
    return NextResponse.json({ error: "Booking not found" }, { status: 404 });
  }

  if (booking.status !== "active") {
    return NextResponse.json({ error: "Only active bookings can be marked no-show" }, { status: 400 });
  }

  // Prevent marking FUTURE bookings as no-show
  if (new Date(booking.start_time) > new Date()) {
    return NextResponse.json(
      { error: "Cannot mark a booking as no-show before it starts" },
      { status: 400 },
    );
  }

  // 5) Scope check for admins
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

  // 6) Update
  const { error: updErr } = await admin
    .from("bookings")
    .update({ status: "no_show" })
    .eq("id", bookingId)
    .eq("status", "active");

  if (updErr) {
    return NextResponse.json({ error: "Update failed", detail: updErr.message }, { status: 400 });
  }

  // 7) Audit
  writeAuditLog({
    actorUserId: user.id,
    action: "admin.booking.no_show",
    targetType: "booking",
    targetId: bookingId,
    meta: {
      via: role,
      roomId: booking.room_id,
      bookedForUserId: booking.booked_for_user_id,
      start: booking.start_time,
      end: booking.end_time,
    },
  }).catch(() => {});

  return NextResponse.json({ ok: true });
}