import { NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabase/server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";

/**
 * Super Admin: list departments + (optional) room count.
 * Using service role prevents future RLS changes from breaking this screen.
 */
export async function GET() {
  const supabase = await createSupabaseServer();

  // 1) Auth (cookie session)
  const {
    data: { user },
    error: authErr,
  } = await supabase.auth.getUser();

  if (authErr || !user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  // 2) Authorize: must be super_admin
  const { data: rows, error: roleErr } = await supabase.rpc("get_my_profile");
  const me = Array.isArray(rows) ? rows[0] : null;

  if (roleErr || me?.role !== "super_admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const admin = createSupabaseAdmin();

  // 3) Pull departments
  const { data: departments, error: depErr } = await admin
    .from("departments")
    .select("id, name")
    .order("name");

  if (depErr) return NextResponse.json({ error: depErr.message }, { status: 500 });

  // 4) Room counts (so we can guard delete + display)
  const { data: rooms, error: roomErr } = await admin
    .from("rooms")
    .select("id, department_id");

  if (roomErr) return NextResponse.json({ error: roomErr.message }, { status: 500 });

  const countByDept = new Map<number, number>();
  for (const r of rooms ?? []) {
    const did = Number((r as any).department_id);
    if (!Number.isFinite(did)) continue;
    countByDept.set(did, (countByDept.get(did) ?? 0) + 1);
  }

  const result = (departments ?? []).map((d: any) => ({
    id: d.id as number,
    name: d.name as string,
    roomCount: countByDept.get(Number(d.id)) ?? 0,
  }));

  return NextResponse.json({ departments: result });
}