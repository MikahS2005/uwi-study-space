import { NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabase/server";
import { getWaitlistForAdminPanel } from "@/lib/db/adminPanel";

type Role = "student" | "admin" | "super_admin";

export async function GET() {
  const supabase = await createSupabaseServer();

  // Auth
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Role (SECURITY DEFINER RPC)
  const { data: meRows, error: meError } = await supabase.rpc("get_my_profile");
  if (meError) {
    return NextResponse.json(
      { error: "Profile lookup failed", detail: meError.message },
      { status: 500 },
    );
  }

  const me = Array.isArray(meRows) ? meRows[0] : null;
  const role = (me?.role ?? null) as Role | null;

  if (role !== "admin" && role !== "super_admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const rows = await getWaitlistForAdminPanel();
  return NextResponse.json({ rows });
}