// src/app/api/admin/students/route.ts
import { NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabase/server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";

export async function GET(req: Request) {
  const supabase = await createSupabaseServer();
  const admin = createSupabaseAdmin();

  // 1) Auth
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // 2) Role via RPC (avoid RLS recursion)
  const { data: meRows, error: meError } = await supabase.rpc("get_my_profile");
  if (meError) {
    return NextResponse.json({ error: "Profile lookup failed", detail: meError.message }, { status: 500 });
  }
  const me = Array.isArray(meRows) ? meRows[0] : null;
  const role = me?.role ?? null;

  if (role !== "admin" && role !== "super_admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // 3) Query
  const url = new URL(req.url);
  const q = (url.searchParams.get("q") ?? "").trim();

  if (!q) return NextResponse.json({ rows: [] });

  // 4) Search profiles (admins can search ALL students)
  // NOTE: If you also want staff accounts to be bookable, remove the role filter below.
  const { data, error } = await admin
    .from("profiles")
    .select("id, email, full_name, uwi_id, role")
    .eq("role", "student")
    .or(
      [
        `full_name.ilike.%${q}%`,
        `email.ilike.%${q}%`,
        `uwi_id.ilike.%${q}%`,
      ].join(","),
    )
    .order("full_name", { ascending: true })
    .limit(10);

  if (error) {
    return NextResponse.json({ error: "Search failed", detail: error.message }, { status: 500 });
  }

  return NextResponse.json({ rows: data ?? [] });
}