import { NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabase/server";

function isValidYMD(s: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(s);
}

export async function GET(req: Request) {
  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(req.url);
  const date = url.searchParams.get("date") ?? "";
  const roomIdsRaw = url.searchParams.get("roomIds") ?? "";

  if (!isValidYMD(date)) {
    return NextResponse.json({ error: "Invalid date" }, { status: 400 });
  }

  const roomIds = roomIdsRaw
    .split(",")
    .map((x) => Number(x.trim()))
    .filter((n) => Number.isFinite(n) && n > 0);

  if (roomIds.length === 0) {
    return NextResponse.json({ rooms: {} });
  }

  // Use server "now" (UTC-based)
  const now = new Date();
  const nowISO = now.toISOString();

  const dayStart = new Date(`${date}T00:00:00.000Z`);
  const dow = dayStart.getUTCDay(); // 0..6

  // Fetch opening hours for these rooms for today’s DOW
  const { data: hoursRows, error: hrsErr } = await supabase
    .from("room_opening_hours")
    .select("room_id, open_minute, close_minute, is_closed")
    .in("room_id", roomIds)
    .eq("day_of_week", dow);

  if (hrsErr) return NextResponse.json({ error: hrsErr.message }, { status: 500 });

  // Active blackout right now (overlapping now)
  const { data: blkRows, error: blkErr } = await supabase
    .from("room_blackouts")
    .select("room_id, reason, start_time, end_time")
    .in("room_id", roomIds)
    .lt("start_time", nowISO)
    .gt("end_time", nowISO);

  if (blkErr) return NextResponse.json({ error: blkErr.message }, { status: 500 });

  const byRoomHours = new Map<number, any>();
  for (const r of hoursRows ?? []) byRoomHours.set(r.room_id, r);

  const byRoomBlk = new Map<number, any>();
  for (const b of blkRows ?? []) {
    // if multiple, keep the first (or choose earliest end)
    if (!byRoomBlk.has(b.room_id)) byRoomBlk.set(b.room_id, b);
  }

  const nowMin = now.getUTCHours() * 60 + now.getUTCMinutes();

  const result: Record<
    string,
    { isOpenNow: boolean; isClosedToday: boolean; activeBlackoutReason: string | null }
  > = {};

  for (const id of roomIds) {
    const hrs = byRoomHours.get(id);
    const isClosedToday = Boolean(hrs?.is_closed ?? false);

    const openMin = Number(hrs?.open_minute ?? 480);
    const closeMin = Number(hrs?.close_minute ?? 1200);

    const within = nowMin >= openMin && nowMin < closeMin;
    const isOpenNow = !isClosedToday && within;

    const blk = byRoomBlk.get(id);
    const activeBlackoutReason = blk?.reason ?? null;

    result[String(id)] = { isOpenNow, isClosedToday, activeBlackoutReason };
  }

  return NextResponse.json({ rooms: result });
}