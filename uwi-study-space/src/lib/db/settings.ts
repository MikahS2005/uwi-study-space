// src/lib/db/settings.ts
import { createSupabaseAdmin } from "@/lib/supabase/admin";

/**
 * Reads the single settings row (id=1).
 * Uses service role to avoid RLS issues.
 */
export async function getSettings() {
  const admin = createSupabaseAdmin();
  const { data, error } = await admin.from("settings").select("*").eq("id", 1).single();
  if (error || !data) throw new Error(error?.message ?? "Settings not found");
  return data;
}

/**
 * Updates the single settings row (id=1).
 * Uses service role. Route must enforce super_admin access.
 */
export async function updateSettings(patch: Record<string, unknown>) {
  const admin = createSupabaseAdmin();

  // Only update known keys (prevents accidental garbage writes).
  // NOTE: keep this list aligned with your settings table columns.
  const allowed = new Set([
    "student_booking_enabled",
    "max_bookings_per_day",
    "max_booking_window_days",
    "max_booking_duration_hours",
    "max_consecutive_hours",
    "no_show_threshold",
    "no_show_window_days",
    "slot_minutes",
    "waitlist_offer_minutes", 
    "reverify_after_logout_count",
  ]);

  const safePatch: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(patch ?? {})) {
    if (allowed.has(k)) safePatch[k] = v;
  }

  // Always touch updated_at if your table has it
  safePatch.updated_at = new Date().toISOString();

  const { data, error } = await admin
    .from("settings")
    .update(safePatch)
    .eq("id", 1)
    .select("*")
    .single();

  if (error || !data) throw new Error(error?.message ?? "Settings update failed");
  return data;
}
