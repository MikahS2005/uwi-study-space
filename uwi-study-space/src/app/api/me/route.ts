// src/app/api/me/route.ts
import { NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createSupabaseServer();

  // 1) Auth user
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json(
      { user: null, settings: null, profileError: authError?.message ?? "Not authenticated" },
      { status: 401 },
    );
  }

  // 2) Fetch profile via SECURITY DEFINER RPC (avoids RLS recursion)
  //    Function returns an array of rows; we grab the first.
  const [{ data: profileRows, error: profileError }, { data: settings, error: settingsError }] =
    await Promise.all([
      supabase.rpc("get_my_profile"),
      supabase.from("settings").select("*").maybeSingle(),
    ]);

  const profile = Array.isArray(profileRows) ? profileRows[0] : null;

  return NextResponse.json({
    user: {
      id: user.id,
      email: user.email,
      role: profile?.role ?? null,
      departmentId: profile?.department_id ?? null,
    },
    settings: settings ?? null,
    profileError: profileError?.message ?? null,
    settingsError: settingsError?.message ?? null,
  });
}
