import { NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createSupabaseServer();

  const {
    data: { user },
    error: authErr,
  } = await supabase.auth.getUser();

  if (authErr || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // RLS should allow students to read their own waitlist rows.
  const { data, error } = await supabase
    .from("waitlist")
    .select(
      `
      id,
      room_id,
      start_time,
      end_time,
      status,
      offer_expires_at,
      created_at,
      room:rooms ( id, name, building, floor, department_id )
    `,
    )
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(200);

  if (error) return NextResponse.json({ error: "Load failed", detail: error.message }, { status: 500 });

  return NextResponse.json({ rows: data ?? [] });
}