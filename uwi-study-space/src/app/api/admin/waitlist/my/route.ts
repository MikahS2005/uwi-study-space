import { NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabase/server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";

type Role = "student" | "admin" | "super_admin";

export async function GET() {
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

  // Pull user waitlist rows with room + department name for display
  const { data, error } = await admin
    .from("waitlist")
    .select(`
      id,
      room_id,
      start_time,
      end_time,
      status,
      offer_expires_at,
      created_at,
      room:rooms(
        id,
        name,
        building,
        floor,
        department:departments!rooms_department_id_fkey(name)
      )
    `)
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) return NextResponse.json({ error: "Query failed", detail: error.message }, { status: 500 });

  // Normalize department join shape if Supabase returns array
  const rows = (data ?? []).map((r: any) => ({
    ...r,
    room: r.room
      ? {
          ...r.room,
          department: Array.isArray(r.room.department) ? (r.room.department[0] ?? null) : (r.room.department ?? null),
        }
      : null,
  }));

  return NextResponse.json({ rows });
}