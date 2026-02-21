import { createSupabaseServer } from "@/lib/supabase/server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";

type Role = "student" | "admin" | "super_admin";

/**
 * Returns:
 * - null  => user is super_admin (means "ALL rooms")
 * - []    => user is admin but has no scopes
 * - [..]  => scoped room ids for admin
 */
export async function getAllowedRoomIdsForCurrentAdmin(): Promise<number[] | null> {
  const supabase = await createSupabaseServer();
  const admin = createSupabaseAdmin();

  // 1) Auth
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  // 2) Role via SECURITY DEFINER RPC
  const { data: meRows, error: meError } = await supabase.rpc("get_my_profile");
  if (meError) return [];

  const me = Array.isArray(meRows) ? meRows[0] : null;
  const role = (me?.role ?? null) as Role | null;

  if (role === "super_admin") return null;
  if (role !== "admin") return [];

  // 3) Read scopes (RLS enforced)
  const { data: scopes, error: scopeErr } = await supabase
    .from("admin_scopes")
    .select("room_id, department_id")
    .eq("admin_user_id", user.id);

  if (scopeErr) return [];

  const roomIds = (scopes ?? [])
    .map((s) => s.room_id)
    .filter((x): x is number => Number.isFinite(Number(x)))
    .map(Number);

  const deptIds = (scopes ?? [])
    .map((s) => s.department_id)
    .filter((x): x is number => Number.isFinite(Number(x)))
    .map(Number);

  // Expand dept scope -> rooms
  let deptRoomIds: number[] = [];
  if (deptIds.length > 0) {
    const { data: deptRooms } = await admin.from("rooms").select("id").in("department_id", deptIds);
    deptRoomIds = (deptRooms ?? []).map((r) => Number(r.id)).filter(Number.isFinite);
  }

  return Array.from(new Set([...roomIds, ...deptRoomIds]));
}