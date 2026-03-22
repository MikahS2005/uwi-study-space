// src/app/api/bookings/create/route.ts
import { NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabase/server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { validateBookingOrThrow } from "@/lib/booking/rules";
import { writeAuditLog } from "@/lib/audit/write";
import { sendBookingConfirmation } from "@/lib/email/sendBookingConfirmation";
import {
  formatTtDateTimeLabel,
  formatTtTimeLabel,
} from "@/lib/email/bookingEmailHelpers";

type Role = "student" | "staff" | "admin" | "super_admin";

export async function POST(req: Request) {
  const supabase = await createSupabaseServer();

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
  const role = (me?.role ?? null) as Role | null;

  // normal self-booking users
  if (role !== "student" && role !== "staff") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const roomId = Number(body?.roomId);
  const start = String(body?.start ?? "");
  const end = String(body?.end ?? "");
  const purpose = String(body?.purpose ?? "").trim();

  if (!Number.isFinite(roomId) || !start || !end) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const validation = await validateBookingOrThrow({
    roomId,
    startISO: start,
    endISO: end,
    bookedForUserId: user.id,
    isStudentSelfBooking: true,
  });

  if (!validation.ok) {
    const msg = validation.message ?? "Booking not allowed.";
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

    return NextResponse.json({ ok: false, error: msg }, { status: 400 });
  }

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

  writeAuditLog({
    actorUserId: user.id,
    action: "booking.create",
    targetType: "booking",
    targetId: inserted.id,
    meta: { roomId, start, end, via: role },
  }).catch(() => {});

  // best-effort confirmation email
  // TEMP DEBUG VERSION
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
      .eq("id", roomId)
      .maybeSingle(),
  ]);

  const profile = profileRes.data;
  const room = roomRes.data;

  console.log("[booking.create] profile:", profile);
  console.log("[booking.create] room:", room);

  if (!profile?.email) {
    console.warn("[booking.create] No recipient email found");
  } else if (!room?.name) {
    console.warn("[booking.create] No room name found");
  } else {
    const emailResult = await sendBookingConfirmation({
      to: "profile.email",
      recipientName: profile.full_name,
      roomName: room.name,
      building: room.building,
      startLabel: formatTtDateTimeLabel(start),
      endLabel: formatTtDateTimeLabel(end),
      bookingId: inserted.id,
      purpose: purpose || null,
    });

    console.log("[booking.create] emailResult:", emailResult);
  }
} catch (err) {
  console.error("[booking.create] confirmation email failed:", err);
}

  return NextResponse.json({ ok: true, bookingId: inserted.id });
}