import { NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabase/server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { writeAuditLog } from "@/lib/audit/write";

/**
 * Admin/Super Admin marks a booking as no_show.
 *
 * Server enforces:
 * - authenticated
 * - role in (admin, super_admin)
 * - scope check (unless super_admin) via SQL function admin_has_room_access
 * - booking exists and is currently active
 * - prevents marking a future booking as no_show
 * - update via service role (RLS bypass)
 * - audit log (best effort)
 */
export async function POST(req: Request) {
  const supabase = await createSupabaseServer();
  const admin = createSupabaseAdmin();

  // ---------------------------------------------------------------------------
  // 1) Auth
  // ---------------------------------------------------------------------------
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // ---------------------------------------------------------------------------
  // 2) Role via RPC (avoid RLS recursion)
  // ---------------------------------------------------------------------------
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

  // ---------------------------------------------------------------------------
  // 3) Parse + validate body
  // ---------------------------------------------------------------------------
  const body = await req.json().catch(() => null);
  const bookingId = Number(body?.bookingId);

  if (!Number.isFinite(bookingId) || bookingId <= 0) {
    return NextResponse.json({ error: "Invalid bookingId" }, { status: 400 });
  }

  // ---------------------------------------------------------------------------
  // 4) Read booking using service role (reliable read)
  // ---------------------------------------------------------------------------
  const { data: booking, error: bookingErr } = await admin
    .from("bookings")
    .select("id, status, room_id, booked_for_user_id, start_time, end_time")
    .eq("id", bookingId)
    .maybeSingle();

  if (bookingErr || !booking) {
    return NextResponse.json({ error: "Booking not found" }, { status: 404 });
  }

  // Only allow marking ACTIVE bookings as no_show
  if (booking.status !== "active") {
    return NextResponse.json(
      { error: "Only active bookings can be marked no-show" },
      { status: 400 },
    );
  }

  // Prevent marking FUTURE bookings as no-show
  const now = new Date();
  const start = new Date(booking.start_time);
  if (start > now) {
    return NextResponse.json(
      { error: "Cannot mark a booking as no-show before it starts" },
      { status: 400 },
    );
  }

  // ---------------------------------------------------------------------------
  // 5) Scope check for admins (super_admin bypass)
  // ---------------------------------------------------------------------------
  if (role !== "super_admin") {
    // Uses auth.uid() under the hood, so must be called with user client.
    const { data: canAccess, error: accessErr } = await supabase.rpc(
      "admin_has_room_access",
      { target_room_id: booking.room_id },
    );

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

  // ---------------------------------------------------------------------------
  // 6) Update (guard: active -> no_show)
  // ---------------------------------------------------------------------------
  const { error: updErr } = await admin
    .from("bookings")
    .update({ status: "no_show" })
    .eq("id", bookingId)
    .eq("status", "active");

  if (updErr) {
    return NextResponse.json({ error: "Update failed", detail: updErr.message }, { status: 400 });
  }

  // ---------------------------------------------------------------------------
  // 7) Audit (best effort)
  // ---------------------------------------------------------------------------
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
