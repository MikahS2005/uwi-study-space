import { NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabase/server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { validateBookingOrThrow } from "@/lib/booking/rules";
import { writeAuditLog } from "@/lib/audit/write";
import { sendBookingConfirmation } from "@/lib/email/sendBookingConfirmation";
import { formatTtDateTimeLabel } from "@/lib/email/bookingEmailHelpers";

type Role = "student" | "staff" | "admin" | "super_admin";
type AcademicStatus = "UG" | "PG" | "Other";

type IncomingAttendee = {
  profileUserId?: string | null;
  fullName?: string;
  email?: string;
  phone?: string;
  uwiId?: string;
  faculty?: string;
  academicStatus?: AcademicStatus | null;
};

async function getAllowedRoomIdsForAdmin(opts: {
  supabase: Awaited<ReturnType<typeof createSupabaseServer>>;
  admin: ReturnType<typeof createSupabaseAdmin>;
  userId: string;
}): Promise<number[]> {
  const { supabase, admin, userId } = opts;

  const { data: scopes, error: scopeErr } = await supabase
    .from("admin_scopes")
    .select("room_id, department_id")
    .eq("admin_user_id", userId);

  if (scopeErr) return [];

  const roomIds = (scopes ?? [])
    .map((s) => s.room_id)
    .filter((v): v is number => Number.isFinite(Number(v)))
    .map(Number);

  const deptIds = (scopes ?? [])
    .map((s) => s.department_id)
    .filter((v): v is number => Number.isFinite(Number(v)))
    .map(Number);

  let deptRoomIds: number[] = [];
  if (deptIds.length > 0) {
    const { data: deptRooms, error: deptRoomsErr } = await admin
      .from("rooms")
      .select("id")
      .in("department_id", deptIds);

    if (!deptRoomsErr) {
      deptRoomIds = (deptRooms ?? []).map((r) => Number(r.id)).filter(Number.isFinite);
    }
  }

  return Array.from(new Set([...roomIds, ...deptRoomIds]));
}

export async function POST(req: Request) {
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
  const role = (me?.role ?? null) as Role | null;

  if (role !== "admin" && role !== "super_admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });

  const roomId = Number(body.roomId);
  const startISO = String(body.startISO ?? "");
  const endISO = String(body.endISO ?? "");
  const purpose = typeof body.purpose === "string" ? body.purpose.trim() : null;

  const bookedForUserId =
    typeof body.bookedForUserId === "string" && body.bookedForUserId.trim()
      ? body.bookedForUserId.trim()
      : null;

  const externalStudentName =
    typeof body.externalStudentName === "string" ? body.externalStudentName.trim() : "";
  const externalStudentEmail =
    typeof body.externalStudentEmail === "string" ? body.externalStudentEmail.trim() : "";
  const externalStudentPhone =
    typeof body.externalStudentPhone === "string" ? body.externalStudentPhone.trim() : "";
  const externalStudentId =
    typeof body.externalStudentId === "string" ? body.externalStudentId.trim() : "";
  const externalStudentFaculty =
    typeof body.externalStudentFaculty === "string" ? body.externalStudentFaculty.trim() : "";
  const externalStudentAcademicStatus =
    typeof body.externalStudentAcademicStatus === "string"
      ? (body.externalStudentAcademicStatus.trim() as AcademicStatus)
      : null;

  const rawAttendees = Array.isArray(body.attendees) ? (body.attendees as IncomingAttendee[]) : [];

  const normalizedAdditionalAttendees = rawAttendees
    .map((a) => ({
      profile_user_id:
        typeof a.profileUserId === "string" && a.profileUserId.trim() ? a.profileUserId.trim() : null,
      full_name: String(a.fullName ?? "").trim(),
      email: String(a.email ?? "").trim() || null,
      phone: String(a.phone ?? "").trim() || null,
      uwi_id: String(a.uwiId ?? "").trim() || null,
      faculty: String(a.faculty ?? "").trim() || null,
      academic_status: a.academicStatus ?? null,
    }))
    .filter((a) => a.full_name || a.uwi_id || a.email || a.profile_user_id);

  if (!Number.isFinite(roomId) || !startISO || !endISO) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  if (role === "admin") {
    const allowedRoomIds = await getAllowedRoomIdsForAdmin({
      supabase,
      admin,
      userId: user.id,
    });

    if (allowedRoomIds.length === 0) {
      return NextResponse.json({ error: "No room scope assigned" }, { status: 403 });
    }

    if (!allowedRoomIds.includes(roomId)) {
      return NextResponse.json(
        { error: "Forbidden (room not in admin scope)" },
        { status: 403 },
      );
    }
  }

  let primarySnapshot: {
    booked_for_user_id: string | null;
    booked_for_name: string | null;
    booked_for_email: string | null;
    booked_for_phone: string | null;
    booked_for_uwi_id: string | null;
    booked_for_faculty: string | null;
    booked_for_academic_status: AcademicStatus | null;
    external_student_email: string | null;
    external_student_phone: string | null;
    external_student_id: string | null;
  };

  let primaryAttendeeRow: {
    profile_user_id: string | null;
    attendee_type: "primary";
    full_name: string;
    email: string | null;
    phone: string | null;
    uwi_id: string | null;
    faculty: string | null;
    academic_status: AcademicStatus | null;
  };

  if (bookedForUserId) {
    const { data: profile, error: profileErr } = await admin
      .from("profiles")
      .select("id, email, full_name, uwi_id, phone, faculty, academic_status")
      .eq("id", bookedForUserId)
      .maybeSingle();

    if (profileErr || !profile) {
      return NextResponse.json(
        { error: "Booked-for user not found", detail: profileErr?.message },
        { status: 404 },
      );
    }

    primarySnapshot = {
      booked_for_user_id: profile.id,
      booked_for_name: profile.full_name,
      booked_for_email: profile.email,
      booked_for_phone: profile.phone,
      booked_for_uwi_id: profile.uwi_id,
      booked_for_faculty: profile.faculty,
      booked_for_academic_status: profile.academic_status as AcademicStatus | null,
      external_student_email: null,
      external_student_phone: null,
      external_student_id: null,
    };

    primaryAttendeeRow = {
      profile_user_id: profile.id,
      attendee_type: "primary",
      full_name: profile.full_name ?? "Primary attendee",
      email: profile.email,
      phone: profile.phone,
      uwi_id: profile.uwi_id,
      faculty: profile.faculty,
      academic_status: profile.academic_status as AcademicStatus | null,
    };
  } else {
    if (
      !externalStudentName ||
      !externalStudentEmail ||
      !externalStudentPhone ||
      !externalStudentId ||
      !externalStudentFaculty ||
      !externalStudentAcademicStatus
    ) {
      return NextResponse.json(
        {
          error:
            "External bookings require name, email, phone, UWI ID, faculty, and academic status.",
        },
        { status: 400 },
      );
    }

    primarySnapshot = {
      booked_for_user_id: null,
      booked_for_name: externalStudentName,
      booked_for_email: externalStudentEmail,
      booked_for_phone: externalStudentPhone,
      booked_for_uwi_id: externalStudentId,
      booked_for_faculty: externalStudentFaculty,
      booked_for_academic_status: externalStudentAcademicStatus,
      external_student_email: externalStudentEmail,
      external_student_phone: externalStudentPhone,
      external_student_id: externalStudentId,
    };

    primaryAttendeeRow = {
      profile_user_id: null,
      attendee_type: "primary",
      full_name: externalStudentName,
      email: externalStudentEmail,
      phone: externalStudentPhone,
      uwi_id: externalStudentId,
      faculty: externalStudentFaculty,
      academic_status: externalStudentAcademicStatus,
    };
  }

  // Auto-derived count: primary attendee + additional attendees
  const attendeeCount = 1 + normalizedAdditionalAttendees.length;

  const v = await validateBookingOrThrow({
    roomId,
    startISO,
    endISO,
    attendeeCount,
    bookedForUserId: primarySnapshot.booked_for_user_id,
    isStudentSelfBooking: false,
  });

  if (!v.ok) {
    const msg = v.message ?? "Booking not allowed.";
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
          canWaitlist: Boolean(primarySnapshot.booked_for_user_id),
        },
        { status: 409 },
      );
    }

    return NextResponse.json({ ok: false, error: msg }, { status: 400 });
  }

  const { data, error } = await admin
    .from("bookings")
    .insert({
      room_id: roomId,
      start_time: startISO,
      end_time: endISO,
      purpose,
      created_by: user.id,
      attendee_count: attendeeCount,

      booked_for_user_id: primarySnapshot.booked_for_user_id,
      booked_for_name: primarySnapshot.booked_for_name,
      booked_for_email: primarySnapshot.booked_for_email,
      booked_for_phone: primarySnapshot.booked_for_phone,
      booked_for_uwi_id: primarySnapshot.booked_for_uwi_id,
      booked_for_faculty: primarySnapshot.booked_for_faculty,
      booked_for_academic_status: primarySnapshot.booked_for_academic_status,

      external_student_email: primarySnapshot.external_student_email,
      external_student_phone: primarySnapshot.external_student_phone,
      external_student_id: primarySnapshot.external_student_id,
    })
    .select("id")
    .single();

  if (error || !data) {
    return NextResponse.json(
      { error: "Create failed", detail: error?.message },
      { status: 500 },
    );
  }

  const attendeeRows = [
    {
      booking_id: data.id,
      ...primaryAttendeeRow,
    },
    ...normalizedAdditionalAttendees.map((a) => ({
      booking_id: data.id,
      profile_user_id: a.profile_user_id,
      attendee_type: "additional" as const,
      full_name: a.full_name || "Additional attendee",
      email: a.email,
      phone: a.phone,
      uwi_id: a.uwi_id,
      faculty: a.faculty,
      academic_status: a.academic_status,
    })),
  ];

  const { error: attendeeErr } = await admin.from("booking_attendees").insert(attendeeRows);

  if (attendeeErr) {
    await admin.from("bookings").delete().eq("id", data.id);
    return NextResponse.json(
      { error: "Failed to save attendees", detail: attendeeErr.message },
      { status: 500 },
    );
  }

  try {
    const { data: room } = await admin
      .from("rooms")
      .select("name, building")
      .eq("id", roomId)
      .maybeSingle();

    if (primarySnapshot.booked_for_email && room?.name) {
      await sendBookingConfirmation({
        to: primarySnapshot.booked_for_email,
        recipientName: primarySnapshot.booked_for_name,
        roomName: room.name,
        building: room.building,
        startLabel: formatTtDateTimeLabel(startISO),
        endLabel: formatTtDateTimeLabel(endISO),
        bookingId: data.id,
        purpose: purpose || null,
      });
    }
  } catch (err) {
    console.error("[admin.booking.create] confirmation email failed:", err);
  }

  writeAuditLog({
    actorUserId: user.id,
    action: "admin.booking.create",
    targetType: "booking",
    targetId: data.id,
    meta: {
      via: role,
      roomId,
      startISO,
      endISO,
      attendeeCount,
      bookingMode: bookedForUserId ? "internal" : "external",
      bookedForUserId: primarySnapshot.booked_for_user_id,
      bookedForEmail: primarySnapshot.booked_for_email,
    },
  }).catch(() => {});

  return NextResponse.json({ ok: true, id: data.id });
}