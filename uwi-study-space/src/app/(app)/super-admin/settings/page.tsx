// src/app/(app)/admin/settings/page.tsx
import { redirect } from "next/navigation";
import { createSupabaseServer } from "@/lib/supabase/server";

export default async function AdminSettingsPage() {
  const supabase = await createSupabaseServer();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Not logged in
  if (!user) redirect("/login");

  // Role gate (server-side)
  const { data: meRows, error } = await supabase.rpc("get_my_profile");
  if (error) redirect("/dashboard");

  const me = Array.isArray(meRows) ? meRows[0] : null;

  // Super admin only
  if (me?.role !== "super_admin") redirect("/dashboard");

  return (
    <div className="rounded border bg-white p-6">
    <div className="rounded-2xl bg-white p-6 ring-1 ring-slate-200">
      <h1 className="text-lg font-semibold text-slate-900">Settings</h1>
      <p className="mt-1 text-sm text-slate-600">
        System-wide booking rules + no-show thresholds. (Wiring next.)
      </p>
    </div>
    </div>
  );
}
