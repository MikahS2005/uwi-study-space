// src/app/(app)/super-admin/layout.tsx
// Super Admin-only layout wrapper.
// - Uses /api/me to determine role
// - Redirects non-super-admin users away
// - Renders the same "admin panel" shell look (top bar + tabs area)
// NOTE: This is a CLIENT layout because it needs to fetch /api/me.

import Link from "next/link";
import { redirect } from "next/navigation";
import { createSupabaseServer } from "@/lib/supabase/server";
import { SuperAdminTabs } from "@/components/admin/SuperAdminTabs";

type AppRole = "student" | "staff" | "admin" | "super_admin" | null;

export default async function SuperAdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?next=/super-admin");
  }

  const { data: rows, error } = await supabase.rpc("get_my_profile");
  if (error) {
    redirect("/dashboard");
  }

  const me = Array.isArray(rows) ? rows[0] : null;
  const role = (me?.role ?? null) as AppRole;

  if (role !== "super_admin") {
    redirect(role === "admin" ? "/admin" : "/dashboard");
  }

  const tabs = [
    { href: "/super-admin/rooms", label: "Rooms" },
    { href: "/super-admin/bookings", label: "Bookings" },
    { href: "/super-admin/departments", label: "Departments" },
    { href: "/super-admin/users", label: "Users" },
    { href: "/super-admin/waitlist", label: "Waitlist" },
    { href: "/super-admin/reports", label: "Reports" },
    { href: "/super-admin/settings", label: "Settings" },
  ];

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Top bar (matches your screenshots vibe) */}
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="grid h-9 w-9 place-items-center rounded-xl bg-blue-50 text-blue-600 ring-1 ring-blue-100">
              {/* simple book icon */}
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                <path
                  d="M7 4h11a2 2 0 0 1 2 2v13a1 1 0 0 1-1 1H8a3 3 0 0 0-3 3V6a2 2 0 0 1 2-2Z"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinejoin="round"
                />
                <path
                  d="M5 20a3 3 0 0 1 3-3h12"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
              </svg>
            </div>

            <div>
              <div className="text-sm font-semibold text-slate-900">Admin Panel</div>
              <div className="text-xs text-slate-500">Alma Jordan Library</div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <span className="rounded-full bg-purple-50 px-3 py-1 text-xs font-medium text-purple-700 ring-1 ring-purple-100">
              Super Admin
            </span>

            <Link
              href="/dashboard"
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
            >
              ← Back to Dashboard
            </Link>

            <div className="hidden sm:block text-sm text-slate-600">{user.email ?? ""}</div>
          </div>
        </div>
      </header>

      {/* Tabs row */}
      <div className="mx-auto max-w-6xl px-6 py-6">
        <div className="rounded-2xl bg-slate-100 p-2 ring-1 ring-slate-200">
          <div className="flex flex-wrap items-center gap-2">
            <SuperAdminTabs tabs={tabs} />
          </div>
        </div>

        {/* Page content */}
        <main className="mt-6">{children}</main>
      </div>
    </div>
  );
}
