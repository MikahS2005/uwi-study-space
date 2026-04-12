import { NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabase/server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { validateBookingOrThrow } from "@/lib/booking/rules";
import { writeAuditLog } from "@/lib/audit/write";
import { sendBookingConfirmation } from "@/lib/email/sendBookingConfirmation";
import { formatTtDateTimeLabel } from "@/lib/email/bookingEmailHelpers";

type Role = "student" | "staff" | "admin" | "super_admin";

type IncomingMember = {
  profileUserId?: string | null;
  fullName?: string;
  studentId?: string;
};

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

  const admin = createSupabaseAdmin();

  // Main booker snapshot
  const { data: profile, error: profileErr } = await admin
    .from("profiles")
    .select("email, full_name, uwi_id, phone, faculty, academic_status")
    .eq("id", user.id)
    .maybeSingle();

  if (profileErr || !profile) {
    return NextResponse.json(
      { error: "Unable to read profile snapshot", detail: profileErr?.message },
      { status: 500 },
    );
  }

  // Additional attendees from the student form
  const rawMembers = Array.isArray(body?.members) ? (body.members as IncomingMember[]) : [];

  const normalizedMembers = rawMembers
    .map((m) => {
      const profileUserId =
        typeof m?.profileUserId === "string" && m.profileUserId.trim()
          ? m.profileUserId.trim()
          : null;

      const fullName = String(m?.fullName ?? "").trim();
      const studentId = String(m?.studentId ?? "").trim();

      return {
        profileUserId,
        fullName,
        studentId: studentId || null,
      };
    })
    .filter((m) => m.profileUserId || m.fullName || m.studentId);

  // If an attendee is linked to an existing profile, enrich it from profiles
  const enrichedMembers = await Promise.all(
    normalizedMembers.map(async (m) => {
      if (!m.profileUserId) {
        return {
          profileUserId: null,
          fullName: m.fullName,
          studentId: m.studentId,
          email: null,
          phone: null,
          faculty: null,
          academicStatus: null,
        };
      }

      const { data: p } = await admin
        .from("profiles")
        .select("full_name, uwi_id, email, phone, faculty, academic_status")
        .eq("id", m.profileUserId)
        .maybeSingle();

      return {
        profileUserId: m.profileUserId,
        fullName: p?.full_name ?? m.fullName,
        studentId: p?.uwi_id ?? m.studentId,
        email: p?.email ?? null,
        phone: p?.phone ?? null,
        faculty: p?.faculty ?? null,
        academicStatus: p?.academic_status ?? null,
      };
    }),
  );

  // Primary attendee + additional attendees
  const attendeeCount = 1 + enrichedMembers.length;

  const validation = await validateBookingOrThrow({
    roomId,
    startISO: start,
    endISO: end,
    attendeeCount,
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

      booked_for_name: profile.full_name,
      booked_for_email: profile.email,
      booked_for_phone: profile.phone,
      booked_for_uwi_id: profile.uwi_id,
      booked_for_faculty: profile.faculty,
      booked_for_academic_status: profile.academic_status,
      attendee_count: attendeeCount,
    })
    .select("id")
    .single();

  if (insertErr || !inserted) {
    return NextResponse.json(
      { error: "Insert failed", detail: insertErr?.message },
      { status: 400 },
    );
  }

  const attendeeRows = [
    {
      booking_id: inserted.id,
      profile_user_id: user.id,
      attendee_type: "primary",
      full_name: profile.full_name ?? "Primary attendee",
      email: profile.email,
      phone: profile.phone,
      uwi_id: profile.uwi_id,
      faculty: profile.faculty,
      academic_status: profile.academic_status,
    },
    ...enrichedMembers.map((m) => ({
      booking_id: inserted.id,
      profile_user_id: m.profileUserId ?? null,
      attendee_type: "additional",
      full_name: m.fullName || "Additional attendee",
      email: m.email,
      phone: m.phone,
      uwi_id: m.studentId,
      faculty: m.faculty,
      academic_status: m.academicStatus,
    })),
  ];

  const { error: attendeeErr } = await admin.from("booking_attendees").insert(attendeeRows);

  if (attendeeErr) {
    await admin.from("bookings").delete().eq("id", inserted.id);

    return NextResponse.json(
      { error: "Failed to save attendees", detail: attendeeErr.message },
      { status: 500 },
    );
  }

  writeAuditLog({
    actorUserId: user.id,
    action: "booking.create",
    targetType: "booking",
    targetId: inserted.id,
    meta: { roomId, start, end, via: role, attendeeCount },
  }).catch(() => {});

  try {
    const { data: room } = await admin
      .from("rooms")
      .select("name, building")
      .eq("id", roomId)
      .maybeSingle();

    if (profile.email && room?.name) {
      await sendBookingConfirmation({
        to: profile.email,
        recipientName: profile.full_name,
        roomName: room.name,
        building: room.building,
        startLabel: formatTtDateTimeLabel(start),
        endLabel: formatTtDateTimeLabel(end),
        bookingId: inserted.id,
        purpose: purpose || null,
      });
    }
  } catch (err) {
    console.error("[booking.create] confirmation email failed:", err);
  }

  return NextResponse.json({ ok: true, bookingId: inserted.id });
}