// src/app/api/rooms/[id]/status/route.ts
import { NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabase/server";

// Trinidad has no DST → fixed offset is safe.
const CAMPUS_TZ_OFFSET = "-04:00";

function isValidYMD(s: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(s);
}

/**
 * Campus-local day bounds converted to UTC ISO strings for DB queries.
 * Also returns local DOW for opening-hours selection.
 */
function campusDayBoundsUtcISO(ymd: string) {
  const startLocal = new Date(`${ymd}T00:00:00${CAMPUS_TZ_OFFSET}`);
  const endLocal = new Date(`${ymd}T23:59:59.999${CAMPUS_TZ_OFFSET}`);

  return {
    dayStartUtcISO: startLocal.toISOString(),
    dayEndUtcISO: endLocal.toISOString(),
    dowLocal: startLocal.getDay(), // 0=Sun..6=Sat in campus local time
    startLocal,
    endLocal,
  };
}

function minutesToHHMM(mins: number) {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export async function GET(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const supabase = await createSupabaseServer();

  // Require auth (matches your availability route behavior)
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await ctx.params;
  const roomId = Number(id);
  if (!Number.isFinite(roomId)) {
    return NextResponse.json({ error: "Invalid room id" }, { status: 400 });
  }

  const url = new URL(req.url);
  const date = url.searchParams.get("date") ?? "";
  if (!isValidYMD(date)) {
    return NextResponse.json({ error: "Invalid date" }, { status: 400 });
  }

  const { dayStartUtcISO, dayEndUtcISO, dowLocal } = campusDayBoundsUtcISO(date);

  // 1) Weekly opening-hours “closed”
  const { data: hoursRow, error: hrsErr } = await supabase
    .from("room_opening_hours")
    .select("open_minute, close_minute, is_closed")
    .eq("room_id", roomId)
    .eq("day_of_week", dowLocal)
    .maybeSingle();

  if (hrsErr) {
    return NextResponse.json({ error: hrsErr.message }, { status: 500 });
  }

  const isClosedDay = Boolean(hoursRow?.is_closed ?? false);
  const openMinute = Number(hoursRow?.open_minute ?? 480);
  const closeMinute = Number(hoursRow?.close_minute ?? 1200);

  // 2) Blackouts overlapping this campus-local day window
  const { data: blks, error: blkErr } = await supabase
    .from("room_blackouts")
    .select("id, start_time, end_time, reason")
    .eq("room_id", roomId)
    .lt("start_time", dayEndUtcISO)
    .gt("end_time", dayStartUtcISO)
    .order("start_time", { ascending: true });

  if (blkErr) {
    return NextResponse.json({ error: blkErr.message }, { status: 500 });
  }

  // If any blackout touches the selected date, treat as “Temporarily closed” for that day.
  // (If you later want “only if the blackout covers the whole day”, we can tighten this logic.)
  const hasBlackout = (blks?.length ?? 0) > 0;
  const blackoutReason =
    hasBlackout
      ? (blks?.find((b) => (b.reason ?? "").trim().length > 0)?.reason ?? "Temporarily unavailable")
      : null;

  // 3) Optional “open now/closed now” only if date is today (campus local)
  const now = new Date();
  const todayLocal = new Date(`${new Date().toISOString().slice(0, 10)}T00:00:00${CAMPUS_TZ_OFFSET}`);
  const isToday = todayLocal.toISOString().slice(0, 10) === date;

  let openNow: boolean | null = null;
  if (isToday) {
    // Determine “now” in campus-local minutes
    const nowLocal = new Date(
      new Date().toLocaleString("en-US", { timeZone: "America/Port_of_Spain" }),
    );
    const nowMins = nowLocal.getHours() * 60 + nowLocal.getMinutes();

    openNow = !isClosedDay && !hasBlackout && nowMins >= openMinute && nowMins < closeMinute;
  }

  return NextResponse.json({
    roomId,
    date,
    isClosedDay,
    hasBlackout,
    blackoutReason,
    openMinute,
    closeMinute,
    openLabel: `${minutesToHHMM(openMinute)}–${minutesToHHMM(closeMinute)}`,
    openNow, // null if not today
  });
}