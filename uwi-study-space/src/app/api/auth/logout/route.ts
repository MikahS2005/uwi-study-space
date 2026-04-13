import { NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabase/server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";

export async function POST() {
  const supabase = await createSupabaseServer();
  const admin = createSupabaseAdmin();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    await admin
      .from("profiles")
      .update({ account_status: "pending_verification" })
      .eq("id", user.id);
  }

  await supabase.auth.signOut();

  return NextResponse.json({ ok: true });
}
