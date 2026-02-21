// src/app/api/super-admin/users/list/route.ts
import { NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabase/server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";

/**
 * Super Admin: list users from `public.profiles`, including:
 * - department name (join)
 * - department scopes (from admin_scopes where department_id is not null)
 *
 * Why service role?
 * - Listing could be done with RLS (super_admin has select-all),
 *   but using service role avoids any surprise policy regressions later.
 * - We still enforce authorization by checking the caller is super_admin
 *   using the cookie-based server client + get_my_profile() RPC.
 */
export async function GET() {
  const supabase = await createSupabaseServer();

  // 1) Must be signed in (cookie session)
  const {
    data: { user },
    error: authErr,
  } = await supabase.auth.getUser();

  if (authErr || !user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  // 2) Must be super_admin (fail closed)
  const { data: rows, error: roleErr } = await supabase.rpc("get_my_profile");
  const me = Array.isArray(rows) ? rows[0] : null;

  if (roleErr || me?.role !== "super_admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // 3) Service role query (bypasses RLS safely)
  const admin = createSupabaseAdmin();

  // Pull profiles + department name
  const { data: profiles, error: profErr } = await admin
    .from("profiles")
    .select(
      `
      id,
      email,
      full_name,
      uwi_id,
      role,
      department_id,
      departments:department_id ( id, name ),
      created_at
    `,
    )
    .order("created_at", { ascending: false });

  if (profErr) {
    return NextResponse.json({ error: profErr.message }, { status: 500 });
  }

  // Pull department scopes for ALL admins in one go
  const { data: scopes, error: scopeErr } = await admin
    .from("admin_scopes")
    .select("admin_user_id, department_id, room_id")
    .not("department_id", "is", null);

  if (scopeErr) {
    return NextResponse.json({ error: scopeErr.message }, { status: 500 });
  }

  // Map: admin_user_id -> deptId[]
  const scopesByUser = new Map<string, number[]>();
  for (const s of scopes ?? []) {
    const uid = String(s.admin_user_id);
    const deptId = s.department_id as number | null;
    if (!deptId) continue;

    const prev = scopesByUser.get(uid) ?? [];
    if (!prev.includes(deptId)) prev.push(deptId);
    scopesByUser.set(uid, prev);
  }

  const result =
    (profiles ?? []).map((p: any) => {
      const role = p.role as "student" | "admin" | "super_admin";

      return {
        id: p.id as string,
        email: p.email as string,
        fullName: (p.full_name ?? "") as string,
        uwiId: (p.uwi_id ?? "") as string,
        role,
        departmentId: (p.department_id ?? null) as number | null,
        departmentName: (p.departments?.name ?? null) as string | null,
        // Only admins should have scopes; keeps UI + API meaning consistent
        scopedDepartmentIds: role === "admin" ? scopesByUser.get(String(p.id)) ?? [] : [],
        createdAt: p.created_at as string,
      };
    }) ?? [];

  return NextResponse.json({ users: result });
}
