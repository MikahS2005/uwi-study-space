// src/app/api/admin/create-booking/route.ts
import { NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabase/server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { validateBookingOrThrow } from "@/lib/booking/rules";
import { writeAuditLog } from "@/lib/audit/write";

/**
 * Admin/Super Admin creates a booking (optionally for another user).
 * Server enforces:
 * - authenticated
 * - role in (admin, super_admin)
 * - admin scope check (unless super_admin)
 * - booking rules (overlaps, max/day, max days ahead, etc.)
 * - insert via service role
 * - audit log (best effort) AFTER successful insert
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

  // 2) Role via RPC (avoids profiles/RLS recursion)
  const { data: meRows, error: meError } = await supabase.rpc("get_my_profile");
  if (meError) {
    return NextResponse.json(
      { error: "Profile lookup failed", detail: meError.message },
      { status: 500 },
    );
  }

  const me = Array.isArray(meRows) ? meRows[0] : null;
  const role = me?.role ?? null;

  // 3) Enforce admin/super admin access
  if (role !== "admin" && role !== "super_admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // 4) Parse body
  const body = await req.json().catch(() => null);

  const roomId = Number(body?.roomId);
  const start = String(body?.start ?? "");
  const end = String(body?.end ?? "");
  const purpose = String(body?.purpose ?? "");
  const bookedForUserIdRaw = body?.bookedForUserId ? String(body.bookedForUserId) : null;

  if (!Number.isFinite(roomId) || !start || !end) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  // ✅ If admin didn't provide a target user, default to themselves
  const bookedForUserId = bookedForUserIdRaw ?? user.id;

  // 5) Scope check:
  //    - super_admin can book any room
  //    - admin must have matching row in admin_scopes (room scope OR department scope)
  if (role !== "super_admin") {
    const adminId = user.id;

    // Read scopes assigned to this admin
    const { data: scopes, error: scopeErr } = await supabase
      .from("admin_scopes")
      .select("room_id, department_id")
      .eq("admin_user_id", adminId);

    if (scopeErr) {
      return NextResponse.json(
        { error: "Scope lookup failed", detail: scopeErr.message },
        { status: 500 },
      );
    }

    // Get room department for department-level scope checks
    const { data: roomRow, error: roomErr } = await supabase
      .from("rooms")
      .select("id, department_id")
      .eq("id", roomId)
      .maybeSingle();

    if (roomErr || !roomRow) {
      return NextResponse.json({ error: "Room not found" }, { status: 404 });
    }

    const hasAccess = (scopes ?? []).some(
      (s) => s.room_id === roomId || (s.department_id && s.department_id === roomRow.department_id),
    );

    if (!hasAccess) {
      return NextResponse.json({ error: "Forbidden (no scope)" }, { status: 403 });
    }
  }

  // 6) Booking rule enforcement (admins can book even if student_booking_enabled is false)
  const validation = await validateBookingOrThrow({
    roomId,
    startISO: start,
    endISO: end,
    bookedForUserId,
    isStudentSelfBooking: false,
  });

  if (!validation.ok) {
    return NextResponse.json({ error: validation.message }, { status: 400 });
  }

  // 7) Insert using service role (server is the enforcement point)
  const admin = createSupabaseAdmin();

  const { data: inserted, error: insertErr } = await admin
    .from("bookings")
    .insert({
      room_id: roomId,
      start_time: start,
      end_time: end,
      status: "active",
      purpose,
      created_by: user.id,
      booked_for_user_id: bookedForUserId, // ✅ guaranteed non-null here
    })
    .select("id")
    .single();

  if (insertErr || !inserted) {
    return NextResponse.json(
      { error: "Insert failed", detail: insertErr?.message },
      { status: 400 },
    );
  }

  // 8) Audit log (best effort)
  writeAuditLog({
    actorUserId: user.id,
    action: "admin.booking.create",
    targetType: "booking",
    targetId: inserted.id,
    meta: {
      via: role,
      roomId,
      start,
      end,
      bookedForUserId,
    },
  }).catch(() => {});

  return NextResponse.json({ ok: true, bookingId: inserted.id });
}
