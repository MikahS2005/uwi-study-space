//src/app/api/admin/rooms/opening-hours/get/route.ts
import { NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabase/server";

export async function GET(req: Request) {
  const supabase = await createSupabaseServer();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(req.url);
  const roomId = Number(url.searchParams.get("roomId"));

  if (!Number.isFinite(roomId)) {
    return NextResponse.json({ error: "Invalid roomId" }, { status: 400 });
  }

  const { data: meRows, error: meError } = await supabase.rpc("get_my_profile");
  if (meError) {
    return NextResponse.json({ error: "Profile lookup failed" }, { status: 500 });
  }

  const me = Array.isArray(meRows) ? meRows[0] : null;
  const role = me?.role ?? null;

  if (role !== "admin" && role !== "super_admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // We can rely on RLS reads for rooms if you allow admins; otherwise use service role.
  const { data: room, error } = await supabase
    .from("rooms")
    .select("buffer_minutes")
    .eq("id", roomId)
    .maybeSingle();

  if (error || !room) {
    return NextResponse.json({ error: "Room not found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true, bufferMinutes: room.buffer_minutes ?? 0 });
}