import { NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabase/server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";

type Role = "student" | "staff" | "admin" | "super_admin";

export async function GET(req: Request) {
  const supabase = await createSupabaseServer();
  const admin = createSupabaseAdmin();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: meRows, error: meError } = await supabase.rpc("get_my_profile");
  if (meError) {
    return NextResponse.json(
      { error: "Profile lookup failed", detail: meError.message },
      { status: 500 },
    );
  }

  const me = Array.isArray(meRows) ? meRows[0] : null;
  const role = (me?.role ?? null) as Role | null;

  // student booking attendees can look up existing accounts by student ID
  if (role !== "student" && role !== "staff" && role !== "admin" && role !== "super_admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const url = new URL(req.url);
  const q = (url.searchParams.get("q") ?? "").trim();

  if (!q) return NextResponse.json({ rows: [] });

  const { data, error } = await admin
    .from("profiles")
    .select("id, uwi_id")
    .eq("role", "student")
    .eq("uwi_id", q)
    .limit(10);

  if (error) {
    return NextResponse.json(
      { error: "Search failed", detail: error.message },
      { status: 500 },
    );
  }

  return NextResponse.json({ rows: data ?? [] });
}