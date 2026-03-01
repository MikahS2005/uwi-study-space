import { NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabase/server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";

type Body = { id: number };

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

  const id = Number(body?.id);
  if (!Number.isFinite(id)) return NextResponse.json({ error: "Invalid id" }, { status: 400 });

  const admin = createSupabaseAdmin();

  // 4) Safety guard: block delete if rooms exist
  const { count, error: countErr } = await admin
    .from("rooms")
    .select("id", { count: "exact", head: true })
    .eq("department_id", id);

  if (countErr) return NextResponse.json({ error: countErr.message }, { status: 500 });

  if ((count ?? 0) > 0) {
    return NextResponse.json(
      { error: "Cannot delete: this department has rooms. Move/delete rooms first." },
      { status: 400 },
    );
  }

  // 5) Delete
  const { error: delErr } = await admin.from("departments").delete().eq("id", id);
  if (delErr) return NextResponse.json({ error: delErr.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}