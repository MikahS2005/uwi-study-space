import { createSupabaseServer } from "@/lib/supabase/server";

/**
 * Fetch the current user's profile record (role, etc.).
 * Used by server routes to enforce role checks.
 */
export async function getMyProfile() {
  const supabase = await createSupabaseServer();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data, error } = await supabase
    .from("profiles")
    .select("id, email, role, department")
    .eq("id", user.id)
    .maybeSingle();

  if (error) return null;
  return data ?? null;
}
