import { NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabase/server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { validateBookingOrThrow } from "@/lib/booking/rules";
import { writeAuditLog } from "@/lib/audit/write";

type Role = "student" | "admin" | "super_admin";

/**
 * Student creates their own booking.
 * Server enforces:
 * - authenticated
 * - role === student
 * - booking rules (limits/overlaps/etc)
 * - insert via service role
 * - audit log (best effort) AFTER successful insert
 *
 * IMPORTANT:
 * If the room is already booked, return 409 with:
 *   { code: "ROOM_BOOKED", canWaitlist: true }
 * so the UI can show "Join Waitlist".
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

  // Only students use this route (admins use /api/admin/create-booking)
  if (role !== "student") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // 3) Parse payload (be defensive)
  const body = await req.json().catch(() => null);
  const roomId = Number(body?.roomId);
  const start = String(body?.start ?? "");
  const end = String(body?.end ?? "");
  const purpose = String(body?.purpose ?? "").trim();

  if (!Number.isFinite(roomId) || !start || !end) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  // 4) Enforce rules (overlaps, max/day, max days ahead, slot mins, etc.)
  const validation = await validateBookingOrThrow({
    roomId,
    startISO: start,
    endISO: end,
    bookedForUserId: user.id,
    isStudentSelfBooking: true,
  });

  if (!validation.ok) {
    const msg = validation.message ?? "Booking not allowed.";

    // If the failure is specifically "already booked", signal waitlist option.
    // We match a couple likely phrasings; keep the canonical message in rules.ts.
    const m = msg.toLowerCase();
    const isBookedConflict =
      m.includes("already booked") ||
      m.includes("overlap") ||
      m.includes("conflict") ||
      m.includes("booked for this time");

    if (isBookedConflict) {
      return NextResponse.json(
        {
          ok: false,
          code: "ROOM_BOOKED",
          message: msg,
          canWaitlist: true,
        },
        { status: 409 },
      );
    }

    // All other rule failures are a normal 400
    return NextResponse.json({ ok: false, error: msg }, { status: 400 });
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
    // If DB unique constraint / overlap protection exists, you can map that to 409 too,
    // but keeping it simple for now.
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