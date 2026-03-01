import { createSupabaseAdmin } from "@/lib/supabase/admin";

// ✅ Expand as the app grows (keeps audit logging type-safe)
type AuditTargetType =
  | "booking"
  | "room"
  | "user"
  | "settings"
  | "waitlist"
  // New admin features
  | "room_blackout"
  | "room_opening_hours";

export async function writeAuditLog(opts: {
  actorUserId: string;
  action: string; // e.g. "booking.create", "booking.cancel", "admin.booking.create"
  targetType: AuditTargetType;
  targetId: string | number;
  meta?: Record<string, unknown>;
}) {
  const admin = createSupabaseAdmin();

  // ✅ Best-effort logging: do NOT break the main flow if audit insert fails
  await admin.from("audit_logs").insert({
    actor_user_id: opts.actorUserId,
    action: opts.action,
    target_type: opts.targetType,
    target_id: String(opts.targetId),
    meta: opts.meta ?? {},
  });
}