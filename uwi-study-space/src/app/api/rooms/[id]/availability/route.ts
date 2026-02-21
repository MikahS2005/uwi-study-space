// src/app/api/rooms/[id]/availability/route.ts
// GET availability for a room on a specific date.
// Example:
//   /api/rooms/12/availability?date=2026-02-16
//
// Returns slots[] shaped for SlotPicker.
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabase/server";
import { getRoomAvailabilityForDate } from "@/lib/db/availability";

function isValidYMD(s: string) {
  // Simple YYYY-MM-DD format check (no heavy parsing).
  return /^\d{4}-\d{2}-\d{2}$/.test(s);
}

export async function GET(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  // Ensure user is authenticated (availability is for signed-in users).
  const supabase = await createSupabaseServer();
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
    return NextResponse.json(
      { error: "Invalid date. Expected YYYY-MM-DD" },
      { status: 400 },
    );
  }

  try {
    const dto = await getRoomAvailabilityForDate(roomId, date);
    return NextResponse.json(dto);
  } catch (e: any) {
    return NextResponse.json(
      { error: "Availability failed", detail: e?.message ?? String(e) },
      { status: 500 },
    );
  }
}
