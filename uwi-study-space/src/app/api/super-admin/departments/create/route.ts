import { NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabase/server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";

type Body = { name: string };

export async function POST(req: Request) {
  const supabase = await createSupabaseServer();

  // 1) Auth
  const {
    data: { user },
    error: authErr,
  } = await supabase.auth.getUser();

  if (authErr || !user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  // 2) Super admin only
  const { data: rows, error: roleErr } = await supabase.rpc("get_my_profile");
  const me = Array.isArray(rows) ? rows[0] : null;
  if (roleErr || me?.role !== "super_admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  // 3) Parse body
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const name = (body?.name ?? "").trim();
  if (!name) return NextResponse.json({ error: "Name is required" }, { status: 400 });

  const admin = createSupabaseAdmin();

  const { data, error } = await admin.from("departments").insert({ name }).select("id, name").single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, department: data });
}