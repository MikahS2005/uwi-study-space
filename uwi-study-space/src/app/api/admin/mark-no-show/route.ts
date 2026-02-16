import { NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabase/server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { writeAuditLog } from "@/lib/audit/write";

/**
 * Admin/Super Admin marks a booking as no_show.
 * Server enforces:
 * - authenticated
 * - role in (admin, super_admin)
 * - scope check (unless super_admin)
 * - booking exists and is currently active
 * - update via service role
 * - audit log (best effort)
 */
export async function POST(req: Request) {
  const supabase = await createSupabaseServer();

  // 1) Auth
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // 2) Role via RPC (avoid RLS recursion)
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

  // 3) Parse body
  const body = await req.json().catch(() => null);
  const bookingId = String(body?.bookingId ?? "");

  if (!bookingId) {
    return NextResponse.json({ error: "Missing bookingId" }, { status: 400 });
  }

  // 4) Read booking (service role for reliable read)
  const admin = createSupabaseAdmin();

  const { data: booking, error: bookingErr } = await admin
    .from("bookings")
    .select("id, status, room_id, booked_for_user_id, start_time, end_time")
    .eq("id", bookingId)
    .maybeSingle();

  if (bookingErr || !booking) {
    return NextResponse.json({ error: "Booking not found" }, { status: 404 });
  }

  // only allow marking active bookings as no_show
  if (booking.status !== "active") {
    return NextResponse.json({ error: "Only active bookings can be marked no-show" }, { status: 400 });
  }

  // 5) Scope check for admins (super_admin bypass)
  if (role !== "super_admin") {
    const { data: scopes, error: scopeErr } = await supabase
      .from("admin_scopes")
      .select("room_id, department_id")
      .eq("admin_user_id", user.id);

    if (scopeErr) {
      return NextResponse.json(
        { error: "Scope lookup failed", detail: scopeErr.message },
        { status: 500 },
      );
    }

    const { data: roomRow, error: roomErr } = await supabase
      .from("rooms")
      .select("id, department_id")
      .eq("id", booking.room_id)
      .maybeSingle();

    if (roomErr || !roomRow) {
      return NextResponse.json({ error: "Room not found" }, { status: 404 });
    }

    const hasAccess = (scopes ?? []).some(
      (s) =>
        s.room_id === booking.room_id ||
        (s.department_id && s.department_id === roomRow.department_id),
    );

    if (!hasAccess) {
      return NextResponse.json({ error: "Forbidden (no scope)" }, { status: 403 });
    }
  }

  // 6) Update (guard: active -> no_show)
  const { error: updErr } = await admin
    .from("bookings")
    .update({ status: "no_show" })
    .eq("id", bookingId)
    .eq("status", "active");

  if (updErr) {
    return NextResponse.json({ error: "Update failed", detail: updErr.message }, { status: 400 });
  }

  // 7) Audit (best effort)
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
