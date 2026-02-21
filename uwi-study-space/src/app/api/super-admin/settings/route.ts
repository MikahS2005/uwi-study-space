// src/app/api/super-admin/settings/route.ts
import { NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabase/server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";

/**
 * Super Admin Settings (READ)
 * - Uses cookie-based auth to verify caller
 * - Verifies caller is super_admin via get_my_profile() RPC
 * - Uses service role to fetch settings safely (bypasses RLS surprises)
 */
export async function GET() {
  const supabase = await createSupabaseServer();

  // 1) Must be authenticated
  const {
    data: { user },
    error: authErr,
  } = await supabase.auth.getUser();

  if (authErr || !user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  // 2) Must be super_admin
  const { data: rows, error: roleErr } = await supabase.rpc("get_my_profile");
  const me = Array.isArray(rows) ? rows[0] : null;

  if (roleErr || me?.role !== "super_admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // 3) Fetch settings (single row)
  const admin = createSupabaseAdmin();
  const { data, error } = await admin.from("settings").select("*").eq("id", 1).maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ settings: data });
}