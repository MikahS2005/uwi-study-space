//src/app/api/waitlist/join/route.ts
import { NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabase/server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { getSettings } from "@/lib/db/settings";

// Trinidad TZ helpers (copy of what you used elsewhere)
const CAMPUS_TZ = "America/Port_of_Spain";
function getTtPartsFromISO(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;

  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: CAMPUS_TZ,
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(d);

  const hh = Number(parts.find((p) => p.type === "hour")?.value ?? "0");
  const mm = Number(parts.find((p) => p.type === "minute")?.value ?? "0");
  const minutes = hh * 60 + mm;

  const yyyy = parts.find((p) => p.type === "year")?.value ?? "1970";
  const mo = parts.find((p) => p.type === "month")?.value ?? "01";
  const dd = parts.find((p) => p.type === "day")?.value ?? "01";
  const ymd = `${yyyy}-${mo}-${dd}`;

  const wd = parts.find((p) => p.type === "weekday")?.value ?? "Sun";
  const map: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  const dow = map[wd] ?? 0;

  return { ymd, dow, minutes };
}

export async function POST(req: Request) {
  const supabase = await createSupabaseServer();
  const admin = createSupabaseAdmin();

  const {
    data: { user },
    error: authErr,
  } = await supabase.auth.getUser();

  if (authErr || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });

  const roomId = Number(body.roomId);
  const startISO = String(body.startISO ?? "");
  const endISO = String(body.endISO ?? "");
  const attendeeCount = Number(body.attendeeCount ?? 1);

  if (!Number.isFinite(roomId) || !startISO || !endISO) {
    return NextResponse.json({ error: "Missing roomId/startISO/endISO" }, { status: 400 });
  }

  if (!Number.isInteger(attendeeCount) || attendeeCount < 1) {
    return NextResponse.json({ error: "Attendee count must be at least 1." }, { status: 400 });
  }

  const settings = await getSettings();

  // Basic slot validation (same idea as bookings)
  const start = new Date(startISO);
  const end = new Date(endISO);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return NextResponse.json({ error: "Invalid start/end time." }, { status: 400 });
  }
  if (end <= start) return NextResponse.json({ error: "End time must be after start time." }, { status: 400 });

  const diffMin = (end.getTime() - start.getTime()) / (1000 * 60);
  if (diffMin % Number(settings.slot_minutes) !== 0) {
    return NextResponse.json(
      { error: `Duration must be in ${settings.slot_minutes}-minute blocks.` },
      { status: 400 },
    );
  }

  // Opening-hours check (per room)
  const s = getTtPartsFromISO(startISO);
  const e = getTtPartsFromISO(endISO);
  if (!s || !e) return NextResponse.json({ error: "Invalid time." }, { status: 400 });
  if (s.ymd !== e.ymd) return NextResponse.json({ error: "Must start and end on the same day." }, { status: 400 });

  const { data: hours, error: hErr } = await supabase
    .from("room_opening_hours")
    .select("open_minute, close_minute, is_closed")
    .eq("room_id", roomId)
    .eq("day_of_week", s.dow)
    .maybeSingle();

  if (hErr) return NextResponse.json({ error: "Unable to check opening hours." }, { status: 500 });
  if (!hours || hours.is_closed) return NextResponse.json({ error: "This room is closed on that day." }, { status: 400 });

  if (s.minutes < hours.open_minute || e.minutes > hours.close_minute) {
    return NextResponse.json({ error: "Selected time is outside opening hours." }, { status: 400 });
  }

  // Prevent duplicates (same user, same room, same window, still relevant)
  const { data: existing } = await admin
    .from("waitlist")
    .select("id, status")
    .eq("user_id", user.id)
    .eq("room_id", roomId)
    .eq("start_time", startISO)
    .eq("end_time", endISO)
    .in("status", ["waiting", "offered"]);

  if ((existing ?? []).length > 0) {
    return NextResponse.json({ ok: true, already: true });
  }

  const { data: wl, error: insErr } = await admin
    .from("waitlist")
    .insert({
      room_id: roomId,
      start_time: startISO,
      end_time: endISO,
      attendee_count: attendeeCount,
      user_id: user.id,
      status: "waiting",
      offer_expires_at: null,
    })
    .select("id")
    .single();

  if (insErr || !wl) return NextResponse.json({ error: "Join waitlist failed", detail: insErr?.message }, { status: 500 });

  return NextResponse.json({ ok: true, id: wl.id });
}