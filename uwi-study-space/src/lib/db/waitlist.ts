import { createSupabaseServer } from "@/lib/supabase/server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { getSettings } from "@/lib/db/settings";
import { validateBookingOrThrow } from "@/lib/booking/rules";

export type WaitlistStatus = "waiting" | "offered" | "accepted" | "expired";

function nowIso() {
  return new Date().toISOString();
}

function isExpired(offerExpiresAt: string | null) {
  if (!offerExpiresAt) return true;
  return Date.parse(offerExpiresAt) <= Date.now();
}

/**
 * Student joins waitlist for a specific room + time.
 * (Only creates a record; does NOT create a booking.)
 */
export async function joinWaitlist(params: {
  roomId: number;
  startISO: string;
  endISO: string;
  attendeeCount: number;
}) {
  const supabase = await createSupabaseServer();
  const admin = createSupabaseAdmin();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { ok: false as const, message: "Unauthorized" };

  const attendeeCount = Number(params.attendeeCount);
  if (!Number.isInteger(attendeeCount) || attendeeCount < 1) {
    return { ok: false as const, message: "Attendee count must be at least 1." };
  }

  const { data, error } = await admin
    .from("waitlist")
    .insert({
      room_id: params.roomId,
      start_time: params.startISO,
      end_time: params.endISO,
      attendee_count: attendeeCount,
      user_id: user.id,
      status: "waiting",
    })
    .select("id")
    .single();

  if (error) return { ok: false as const, message: error.message };
  return { ok: true as const, id: Number(data.id) };
}
/**
 * Admin offers a waitlist entry:
 * - sets status=offered
 * - sets offer_expires_at = now + waitlist_offer_minutes
 */
export async function adminOfferWaitlistEntry(params: { waitlistId: number }) {
  const supabase = await createSupabaseServer();
  const admin = createSupabaseAdmin();

  // Auth
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, message: "Unauthorized" };

  // Role
  const { data: meRows } = await supabase.rpc("get_my_profile");
  const me = Array.isArray(meRows) ? meRows[0] : null;
  const role = me?.role ?? null;
  if (role !== "admin" && role !== "super_admin") {
    return { ok: false as const, message: "Forbidden" };
  }

  // (Optional but recommended) scope check:
  // You can enforce admin room access here by looking up waitlist.room_id and calling admin_has_room_access RPC.
  // Leaving it out is okay ONLY if you already enforce scope at the admin UI + list query layer.

  // Settings -> expiry
  const settings = await getSettings();
  const mins = Number(settings.waitlist_offer_minutes ?? 30);
  const expiresAt = new Date(Date.now() + mins * 60 * 1000).toISOString();

  // Offer
  const { data, error } = await admin
    .from("waitlist")
    .update({
      status: "offered",
      offer_expires_at: expiresAt,
    })
    .eq("id", params.waitlistId)
    .in("status", ["waiting", "expired"]) // allow re-offer if expired
    .select("id, status, offer_expires_at")
    .single();

  if (error) return { ok: false as const, message: error.message };
  return { ok: true as const, row: data };
}

/**
 * Student accepts an offer:
 * - verifies waitlist entry belongs to the student
 * - if expired: marks expired and blocks
 * - checks booking rules + overlap + room overlap via validateBookingOrThrow
 * - inserts booking
 * - marks waitlist accepted
 */
export async function acceptWaitlistOffer(params: { waitlistId: number; purpose?: string | null }) {
  const supabase = await createSupabaseServer();
  const admin = createSupabaseAdmin();

  // 1) Auth
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, message: "Unauthorized" };

  // 2) Load waitlist row (service role so we can read it reliably)
  const { data: w, error: wErr } = await admin
    .from("waitlist")
    .select("id, room_id, start_time, end_time, user_id, status, offer_expires_at, attendee_count")
    .eq("id", params.waitlistId)
    .single();

  if (wErr || !w) return { ok: false as const, message: "Waitlist entry not found." };

  // 3) Must belong to student
  if (String(w.user_id) !== String(user.id)) {
    return { ok: false as const, message: "Forbidden" };
  }

  // 4) Must be offered
  if (w.status !== "offered") {
    return { ok: false as const, message: "This offer is not active." };
  }

  // 5) Expiry enforcement
  if (isExpired(w.offer_expires_at)) {
    await admin.from("waitlist").update({ status: "expired" }).eq("id", w.id);
    return { ok: false as const, message: "Offer expired." };
  }

  // 6) Validate booking rules (re-uses your central validator)
  // NOTE: this automatically checks overlaps and opening hours etc.
const v = await validateBookingOrThrow({
  roomId: Number(w.room_id),
  startISO: String(w.start_time),
  endISO: String(w.end_time),
  attendeeCount: Number(w.attendee_count ?? 1),
  bookedForUserId: user.id,
  isStudentSelfBooking: true,
});

  if (!v.ok) return { ok: false as const, message: v.message };

  // 7) Create booking + mark accepted (ideally within a transaction — but PostgREST doesn’t do multi-statement txn easily).
  // We'll do best-effort with ordering that minimizes harm:
  // - create booking first
  // - then mark waitlist accepted
  const { data: booking, error: bErr } = await admin
    .from("bookings")
    .insert({
      room_id: w.room_id,
      start_time: w.start_time,
      end_time: w.end_time,
      purpose: (params.purpose ?? null) || null,
      created_by: user.id,
      booked_for_user_id: user.id,
      status: "active",
    })
    .select("id")
    .single();

  if (bErr || !booking) {
    return { ok: false as const, message: bErr?.message ?? "Failed to create booking." };
  }

  // Mark accepted
  await admin
    .from("waitlist")
    .update({ status: "accepted" })
    .eq("id", w.id)
    .eq("status", "offered");

  return { ok: true as const, bookingId: Number(booking.id) };
}