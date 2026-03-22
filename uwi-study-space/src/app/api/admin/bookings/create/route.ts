import { NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabase/server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { validateBookingOrThrow } from "@/lib/booking/rules";
import { sendBookingConfirmation } from "@/lib/email/sendBookingConfirmation";
import { formatTtDateTimeLabel } from "@/lib/email/bookingEmailHelpers";

type Role = "student" | "staff" | "admin" | "super_admin";

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
  const bookedForUserId = String(body.bookedForUserId ?? "");

  if (!Number.isFinite(roomId) || !startISO || !endISO || !bookedForUserId) {
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

  const v = await validateBookingOrThrow({
    roomId,
    startISO,
    endISO,
    bookedForUserId,
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
          canWaitlist: true,
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
      booked_for_user_id: bookedForUserId,
    })
    .select("id")
    .single();

  if (error || !data) {
    return NextResponse.json(
      { error: "Create failed", detail: error?.message },
      { status: 500 },
    );
  }

  // confirmation email to booked-for user
  try {
    const [profileRes, roomRes] = await Promise.all([
      admin
        .from("profiles")
        .select("email, full_name")
        .eq("id", bookedForUserId)
        .maybeSingle(),
      admin
        .from("rooms")
        .select("name, building")
        .eq("id", roomId)
        .maybeSingle(),
    ]);

    const profile = profileRes.data;
    const room = roomRes.data;

    console.log("[admin.booking.create] profile:", profile);
    console.log("[admin.booking.create] room:", room);

    if (!profile?.email) {
      console.warn("[admin.booking.create] No recipient email found");
    } else if (!room?.name) {
      console.warn("[admin.booking.create] No room name found");
    } else {
      const emailResult = await sendBookingConfirmation({
        to: profile.email,
        recipientName: profile.full_name,
        roomName: room.name,
        building: room.building,
        startLabel: formatTtDateTimeLabel(startISO),
        endLabel: formatTtDateTimeLabel(endISO),
        bookingId: data.id,
        purpose: purpose || null,
      });

      console.log("[admin.booking.create] emailResult:", emailResult);
    }
  } catch (err) {
    console.error("[admin.booking.create] confirmation email failed:", err);
  }

  return NextResponse.json({ ok: true, id: data.id });
}