// src/app/api/admin/bookings/create/route.ts
import { NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabase/server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { validateBookingOrThrow } from "@/lib/booking/rules";

type Role = "student" | "admin" | "super_admin";

async function getAllowedRoomIdsForAdmin(opts: {
  supabase: Awaited<ReturnType<typeof createSupabaseServer>>;
  admin: ReturnType<typeof createSupabaseAdmin>;
  userId: string;
}): Promise<number[]> {
  const { supabase, admin, userId } = opts;

  // Read scopes for the current admin (this is normal client supabase with user session)
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

  // If they have department scopes, include all rooms in those departments
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
  const supabase = await createSupabaseServer(); // user-session client
  const admin = createSupabaseAdmin(); // service role

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
  // 2) Role via RPC (avoid profiles RLS recursion)
  // ---------------------------------------------------------------------------
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

  // ---------------------------------------------------------------------------
  // 3) Body
  // ---------------------------------------------------------------------------
  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });

  const roomId = Number(body.roomId);
  const startISO = String(body.startISO ?? "");
  const endISO = String(body.endISO ?? "");
  const purpose = typeof body.purpose === "string" ? body.purpose : null;
  const bookedForUserId = String(body.bookedForUserId ?? "");

  if (!Number.isFinite(roomId) || !startISO || !endISO || !bookedForUserId) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  // ---------------------------------------------------------------------------
  // 4) Scope enforcement (CRITICAL because service role bypasses RLS)
  // ---------------------------------------------------------------------------
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

  // ---------------------------------------------------------------------------
  // 5) Central validation rules (limits, overlap, hours, etc.)
  // ---------------------------------------------------------------------------
  const v = await validateBookingOrThrow({
    roomId,
    startISO,
    endISO,
    bookedForUserId,
    isStudentSelfBooking: false,
  });

  if (!v.ok) return NextResponse.json({ error: v.message }, { status: 400 });

  // ---------------------------------------------------------------------------
  // 6) Insert booking
  // created_by is the profile UUID (same as auth.users.id in your schema)
  // ---------------------------------------------------------------------------
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

  if (error) {
    return NextResponse.json(
      { error: "Create failed", detail: error.message },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true, id: data.id });
}