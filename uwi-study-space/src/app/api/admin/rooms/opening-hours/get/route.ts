//src/app/api/admin/rooms/opening-hours/get/route.ts
import { NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabase/server";

export async function GET(req: Request) {
  const supabase = await createSupabaseServer();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(req.url);
  const roomId = Number(url.searchParams.get("roomId"));
  if (!Number.isFinite(roomId)) return NextResponse.json({ error: "Invalid roomId" }, { status: 400 });

  const { data: meRows } = await supabase.rpc("get_my_profile");
  const me = Array.isArray(meRows) ? meRows[0] : null;
  const role = me?.role ?? null;

  if (role !== "admin" && role !== "super_admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // RLS SELECT policy already allows reading hours for active rooms.
  const { data, error } = await supabase
    .from("room_opening_hours")
    .select("day_of_week, open_minute, close_minute, is_closed")
    .eq("room_id", roomId)
    .order("day_of_week", { ascending: true });

  if (error) {
    return NextResponse.json({ error: "Failed to load opening hours", detail: error.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true, hours: data ?? [] });
}