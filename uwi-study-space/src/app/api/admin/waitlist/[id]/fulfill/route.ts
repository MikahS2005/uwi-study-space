// src/app/api/admin/waitlist/[id]/fulfill/route.ts
import { NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabase/server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { adminHasRoomAccess } from "@/lib/db/adminScopes";
import { validateBookingOrThrow } from "@/lib/booking/rules";

type Role = "student" | "admin" | "super_admin";

export async function POST(_: Request, ctx: { params: { id: string } }) {
  const supabase = await createSupabaseServer();
  const admin = createSupabaseAdmin();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: meRows } = await supabase.rpc("get_my_profile");
  const me = Array.isArray(meRows) ? meRows[0] : null;
  const role: Role | null = me?.role ?? null;

  if (role !== "admin" && role !== "super_admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const id = Number(ctx.params.id);
  if (!Number.isFinite(id)) return NextResponse.json({ error: "Invalid id" }, { status: 400 });

  // Load waitlist row (we need room_id, user_id, times)
  const { data: w, error } = await admin
    .from("waitlist")
    .select("id, room_id, user_id, start_time, end_time, status, offer_expires_at")
    .eq("id", id)
    .single();

  if (error || !w) return NextResponse.json({ error: "Waitlist not found" }, { status: 404 });

  if (role === "admin") {
    const ok = await adminHasRoomAccess(Number(w.room_id));
    if (!ok) return NextResponse.json({ error: "Forbidden (scope)" }, { status: 403 });
  }

  const s = String(w.status).toLowerCase();
  if (s !== "offered" && s !== "waiting") {
    return NextResponse.json({ error: "This waitlist entry cannot be fulfilled in its current status." }, { status: 400 });
  }

  // If offered, ensure not expired
  if (s === "offered" && w.offer_expires_at) {
    const exp = new Date(w.offer_expires_at).getTime();
    if (!Number.isNaN(exp) && Date.now() > exp) {
      // Auto-expire as a safety
      await admin.from("waitlist").update({ status: "expired", offer_expires_at: null }).eq("id", id);
      return NextResponse.json({ error: "Offer has expired." }, { status: 400 });
    }
  }

  // Validate booking rules against this student
  const v = await validateBookingOrThrow({
    roomId: Number(w.room_id),
    startISO: String(w.start_time),
    endISO: String(w.end_time),
    bookedForUserId: String(w.user_id),
    isStudentSelfBooking: false, // admin action
  });

  if (!v.ok) return NextResponse.json({ error: v.message }, { status: 400 });

  // Create booking
  const { data: booking, error: insErr } = await admin
    .from("bookings")
    .insert({
      room_id: Number(w.room_id),
      start_time: String(w.start_time),
      end_time: String(w.end_time),
      purpose: "Waitlist fulfillment", // optional; you can store null if you prefer
      created_by: user.id,
      booked_for_user_id: String(w.user_id),
    })
    .select("id")
    .single();

  if (insErr || !booking) {
    return NextResponse.json({ error: "Booking create failed", detail: insErr?.message }, { status: 500 });
  }

  // Update waitlist row
  const { error: upErr } = await admin
    .from("waitlist")
    .update({ status: "fulfilled", offer_expires_at: null })
    .eq("id", id);

  if (upErr) {
    // Best-effort rollback? In practice you may log and keep booking.
    return NextResponse.json({ error: "Waitlist update failed", detail: upErr.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, bookingId: booking.id });
}