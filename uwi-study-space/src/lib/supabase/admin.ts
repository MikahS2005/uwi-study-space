import { createClient } from "@supabase/supabase-js";

export function createSupabaseAdmin() {
  // Server-only: service role bypasses RLS
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createClient(url, serviceKey, { auth: { persistSession: false } });
}
