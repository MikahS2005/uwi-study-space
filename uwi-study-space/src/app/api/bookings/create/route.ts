import { NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabase/server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { validateBookingOrThrow } from "@/lib/booking/rules";
import { writeAuditLog } from "@/lib/audit/write";

/**
 * Student creates their own booking.
 * Server enforces:
 * - authenticated
 * - role === student
 * - booking rules (limits/overlaps/etc)
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

  // 2) Role check via RPC (avoids profiles/RLS recursion)
  const { data: meRows, error: meError } = await supabase.rpc("get_my_profile");
  if (meError) {
    return NextResponse.json(
      { error: "Profile lookup failed", detail: meError.message },
      { status: 500 },
    );
  }

  const me = Array.isArray(meRows) ? meRows[0] : null;
  const role = me?.role ?? null;

  // Only students use this route (admins use /api/admin/create-booking)
  if (role !== "student") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // 3) Parse payload
  const body = await req.json();
  const roomId = Number(body.roomId);
  const start = String(body.start);
  const end = String(body.end);
  const purpose = String(body.purpose ?? "");

  if (!Number.isFinite(roomId) || !start || !end) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  // 4) Enforce rules (overlaps, max/day, 7-days, 3-consecutive, etc.)
  const validation = await validateBookingOrThrow({
    roomId,
    startISO: start,
    endISO: end,
    bookedForUserId: user.id,
    isStudentSelfBooking: true,
  });

  if (!validation.ok) {
    return NextResponse.json({ error: validation.message }, { status: 400 });
  }

  // 5) Insert with service role
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
      booked_for_user_id: user.id,
    })
    .select("id")
    .single();

  if (insertErr || !inserted) {
    return NextResponse.json(
      { error: "Insert failed", detail: insertErr?.message },
      { status: 400 },
    );
  }

  // 6) Audit log (best effort — do not block success)
  writeAuditLog({
    actorUserId: user.id,
    action: "booking.create",
    targetType: "booking",
    targetId: inserted.id,
    meta: { roomId, start, end, via: "student" },
  }).catch(() => {});

  return NextResponse.json({ ok: true, bookingId: inserted.id });
}
