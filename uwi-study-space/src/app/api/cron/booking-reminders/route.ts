import { NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { sendBookingReminder } from "@/lib/email/sendBookingReminder";
import { formatTtDateTimeLabel } from "@/lib/email/bookingEmailHelpers";

const TT_OFFSET_HOURS = 4;

function getTomorrowWindowInUtcFromTt(now = new Date()) {
  const ttParts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Port_of_Spain",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);

  const year = Number(ttParts.find((p) => p.type === "year")?.value);
  const month = Number(ttParts.find((p) => p.type === "month")?.value);
  const day = Number(ttParts.find((p) => p.type === "day")?.value);

  const tomorrowStartUtc = new Date(Date.UTC(year, month - 1, day + 1, TT_OFFSET_HOURS, 0, 0));
  const dayAfterStartUtc = new Date(Date.UTC(year, month - 1, day + 2, TT_OFFSET_HOURS, 0, 0));

  return {
    startIso: tomorrowStartUtc.toISOString(),
    endIso: dayAfterStartUtc.toISOString(),
  };
}

function isAuthorized(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true;

  const auth = req.headers.get("authorization");
  return auth === `Bearer ${secret}`;
}

export async function GET(req: Request) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createSupabaseAdmin();
  const { startIso, endIso } = getTomorrowWindowInUtcFromTt();

  const { data: bookings, error } = await admin
    .from("bookings")
    .select(`
      id,
      room_id,
      start_time,
      end_time,
      booked_for_user_id,
      status,
      reminder_sent_at
    `)
    .eq("status", "active")
    .is("reminder_sent_at", null)
    .gte("start_time", startIso)
    .lt("start_time", endIso);

  if (error) {
    return NextResponse.json({ error: "Query failed", detail: error.message }, { status: 500 });
  }

  let sent = 0;
  let skipped = 0;
  let failed = 0;

  for (const booking of bookings ?? []) {
    try {
      const [profileRes, roomRes] = await Promise.all([
        admin
          .from("profiles")
          .select("email, full_name")
          .eq("id", booking.booked_for_user_id)
          .maybeSingle(),
        admin
          .from("rooms")
          .select("name, building")
          .eq("id", booking.room_id)
          .maybeSingle(),
      ]);

      const profile = profileRes.data;
      const room = roomRes.data;

      if (!profile?.email || !room?.name) {
        skipped += 1;
        continue;
      }

      const emailResult = await sendBookingReminder({
        to: profile.email,
        recipientName: profile.full_name,
        roomName: room.name,
        building: room.building,
        startLabel: formatTtDateTimeLabel(booking.start_time),
        endLabel: formatTtDateTimeLabel(booking.end_time),
      });

      console.log("[cron.booking-reminders] emailResult:", emailResult);

      const { error: markErr } = await admin
        .from("bookings")
        .update({ reminder_sent_at: new Date().toISOString() })
        .eq("id", booking.id);

      if (markErr) {
        console.error("[cron.booking-reminders] failed to mark reminder_sent_at:", markErr);
      }

      sent += 1;
    } catch (err) {
      failed += 1;
      console.error("[cron.booking-reminders] send failed for booking", booking.id, err);
    }
  }

  return NextResponse.json({
    ok: true,
    window: { startIso, endIso },
    counts: { sent, skipped, failed, total: (bookings ?? []).length },
  });
}