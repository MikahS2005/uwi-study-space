import { NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabase/server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { validateBookingOrThrow } from "@/lib/booking/rules";
import { writeAuditLog } from "@/lib/audit/write";

type Role = "student" | "admin" | "super_admin";

export async function POST(req: Request) {
  const supabase = await createSupabaseServer();
  const admin = createSupabaseAdmin();

  // Auth
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Role
  const { data: meRows, error: meError } = await supabase.rpc("get_my_profile");
  if (meError) return NextResponse.json({ error: "Profile lookup failed" }, { status: 500 });

  const me = Array.isArray(meRows) ? meRows[0] : null;
  const role = (me?.role ?? null) as Role | null;
  if (role !== "student") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json().catch(() => null);
  const waitlistId = Number(body?.waitlistId);

  if (!Number.isFinite(waitlistId)) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  // Load waitlist row
  const { data: wl, error: wlErr } = await admin
    .from("waitlist")
    .select("id, room_id, start_time, end_time, status, offer_expires_at, user_id")
    .eq("id", waitlistId)
    .single();

  if (wlErr || !wl) return NextResponse.json({ error: "Waitlist entry not found" }, { status: 404 });
  if (wl.user_id !== user.id) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  if (wl.status !== "offered") {
    return NextResponse.json({ error: "This offer is not active." }, { status: 400 });
  }

  if (!wl.offer_expires_at || Date.parse(wl.offer_expires_at) <= Date.now()) {
    // Mark expired (best effort)
    await admin.from("waitlist").update({ status: "expired" }).eq("id", waitlistId);
    return NextResponse.json({ error: "Offer expired." }, { status: 400 });
  }

  // Re-validate booking rules before creating booking
  const v = await validateBookingOrThrow({
    roomId: Number(wl.room_id),
    startISO: String(wl.start_time),
    endISO: String(wl.end_time),
    bookedForUserId: user.id,
    isStudentSelfBooking: true,
  });

  if (!v.ok) {
    return NextResponse.json({ error: v.message ?? "Booking not allowed." }, { status: 400 });
  }

  // Create booking
  const { data: inserted, error: insErr } = await admin
    .from("bookings")
    .insert({
      room_id: Number(wl.room_id),
      start_time: String(wl.start_time),
      end_time: String(wl.end_time),
      status: "active",
      purpose: "Waitlist accepted",
      created_by: user.id,
      booked_for_user_id: user.id,
    })
    .select("id")
    .single();

  if (insErr || !inserted) {
    return NextResponse.json({ error: "Booking creation failed", detail: insErr?.message }, { status: 500 });
  }

  // Mark waitlist accepted
  await admin.from("waitlist").update({ status: "accepted" }).eq("id", waitlistId);

  // Audit (best effort)
  writeAuditLog({
    actorUserId: user.id,
    action: "waitlist.accept",
    targetType: "waitlist",
    targetId: waitlistId,
    meta: { bookingId: inserted.id },
  }).catch(() => {});

  return NextResponse.json({ ok: true, bookingId: inserted.id });
}