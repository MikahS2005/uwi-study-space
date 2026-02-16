// src/lib/db/adminScopes.ts
import { createSupabaseServer } from "@/lib/supabase/server";

/**
 * Server-side helper:
 * - Super admin: always true
 * - Admin: must have scope to the room (room scope OR department scope)
 *
 * IMPORTANT:
 * We delegate the scope logic to the SQL function:
 *   public.admin_has_room_access(target_room_id bigint) -> boolean
 *
 * This avoids:
 * - duplicating logic in JS
 * - RLS recursion issues
 * - subtle filtering bugs (like missing admin_user_id constraints)
 */
export async function adminHasRoomAccess(roomId: number) {
  const supabase = await createSupabaseServer();

  // Must be signed in
  const {
    data: { user },
    error: authErr,
  } = await supabase.auth.getUser();

  if (authErr || !user) return false;

  // Use RPC to check room access in the database layer.
  // The function already allows super admins to pass.
  const { data, error } = await supabase.rpc("admin_has_room_access", {
    target_room_id: roomId,
  });

  if (error) return false;

  // RPC returns boolean
  return Boolean(data);
}
