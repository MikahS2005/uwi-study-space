import { NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabase/server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";

export async function GET() {
  const supabase = await createSupabaseServer();

  const {
    data: { user },
    error: authErr,
  } = await supabase.auth.getUser();

  if (authErr || !user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { data: rows, error: roleErr } = await supabase.rpc("get_my_profile");
  const me = Array.isArray(rows) ? rows[0] : null;

  if (roleErr || me?.role !== "super_admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const admin = createSupabaseAdmin();

  const { data: profiles, error: profErr } = await admin
    .from("profiles")
    .select(`
      id,
      email,
      full_name,
      uwi_id,
      phone,
      faculty,
      academic_status,
      account_status,
      email_verified_at,
      created_at,
      updated_at,
      role,
      department_id,
      departments:department_id ( id, name )
    `)
    .order("created_at", { ascending: false });

  if (profErr) {
    return NextResponse.json({ error: profErr.message }, { status: 500 });
  }

  const { data: scopes, error: scopeErr } = await admin
    .from("admin_scopes")
    .select("admin_user_id, department_id")
    .not("department_id", "is", null);

  if (scopeErr) {
    return NextResponse.json({ error: scopeErr.message }, { status: 500 });
  }

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
      const role = p.role as "student" | "staff" | "admin" | "super_admin";

      return {
        id: p.id as string,
        email: (p.email ?? "") as string,
        fullName: (p.full_name ?? "") as string,
        uwiId: (p.uwi_id ?? "") as string,
        phone: (p.phone ?? "") as string,
        faculty: (p.faculty ?? "") as string,
        academicStatus: (p.academic_status ?? null) as string | null,
        accountStatus: (p.account_status ?? null) as string | null,
        emailVerifiedAt: (p.email_verified_at ?? null) as string | null,
        createdAt: (p.created_at ?? null) as string | null,
        updatedAt: (p.updated_at ?? null) as string | null,
        role,
        departmentId: (p.department_id ?? null) as number | null,
        departmentName: (p.departments?.name ?? null) as string | null,
        scopedDepartmentIds: role === "admin" ? scopesByUser.get(String(p.id)) ?? [] : [],
      };
    }) ?? [];

  return NextResponse.json({ users: result });
}