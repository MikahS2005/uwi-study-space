// src/app/(app)/admin/layout.tsx
// Admin-only layout wrapper (department admins).
// - Uses /api/me to determine role
// - Redirects non-admin users away
// - Redirects super_admin away to /super-admin (they should use the super admin panel)
// - Renders the same "admin panel" shell look (top bar + tabs area)
// NOTE: This is a CLIENT layout because it needs to fetch /api/me.

"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";

type MeResponse = {
  user: null | {
    id: string;
    email: string | null;
    role: "student" | "admin" | "super_admin" | null;
    departmentId: number | null;
  };
};

function TabLink({ href, label }: { href: string; label: string }) {
  const pathname = usePathname();

  // Active if exact match OR nested route (e.g., /admin/bookings/123)
  const active = pathname === href || pathname.startsWith(href + "/");

  return (
    <Link
      href={href}
      className={[
        "inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm transition",
        active
          ? "bg-white shadow-sm ring-1 ring-slate-200 text-slate-900"
          : "text-slate-600 hover:bg-white/60 hover:text-slate-900",
      ].join(" ")}
    >
      {label}
    </Link>
  );
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();

  // `me` stores the result from /api/me (user + role)
  const [me, setMe] = useState<MeResponse | null>(null);

  // `loading` prevents flashing unauthorized content before redirects run
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Pull current user + role from your existing endpoint.
    fetch("/api/me")
      .then((r) => r.json())
      .then((data: MeResponse) => setMe(data))
      .catch(() => setMe({ user: null }))
      .finally(() => setLoading(false));
  }, []);

  const role = me?.user?.role ?? null;

  /**
   * Hard-gate this entire route group:
   * - Not logged in => /login
   * - student => /dashboard
   * - super_admin => /super-admin (they should not use /admin shell)
   * - admin => allowed
   */
  useEffect(() => {
    if (loading) return;

    // Not logged in -> login
    if (!me?.user) {
      router.replace("/login?next=/admin");
      return;
    }

    // Super admin should go to the super-admin panel
    if (role === "super_admin") {
      router.replace("/super-admin");
      return;
    }

    // Students are not allowed in /admin
    if (role !== "admin") {
      router.replace("/dashboard");
      return;
    }
  }, [loading, me, role, router]);

  /**
   * Tabs for department admins:
   * - matches your feature list: Rooms, Bookings, Waitlist, Reports
   *
   * NOTE: These paths must exist as pages. If you haven't created them yet,
   * keep the tabs list minimal until those pages are added.
   */
  const tabs = useMemo(() => {
    return [
      { href: "/admin/rooms", label: "Rooms" },
      { href: "/admin/bookings", label: "Bookings" },
      { href: "/admin/waitlist", label: "Waitlist" },
      { href: "/admin/reports", label: "Reports" },
    ];
  }, []);

  if (loading) {
    // Quick skeleton so you don't see a flash of unauthorized content.
    return (
      <div className="min-h-screen bg-slate-50">
        <div className="mx-auto max-w-6xl px-6 py-8">
          <div className="h-8 w-48 rounded bg-slate-200" />
          <div className="mt-4 h-10 w-full rounded bg-slate-200" />
          <div className="mt-6 h-64 w-full rounded bg-slate-200" />
        </div>
      </div>
    );
  }

  // If not admin, the redirect effect will run. Keep render minimal.
  if (!me?.user || role !== "admin") return null;

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Top bar (same vibe as super-admin layout) */}
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="grid h-9 w-9 place-items-center rounded-xl bg-blue-50 text-blue-600 ring-1 ring-blue-100">
              {/* simple book icon */}
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
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
            {/* Badge for clarity */}
            <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700 ring-1 ring-blue-100">
              Admin
            </span>

            {/* Exit back to the student dashboard */}
            <Link
              href="/dashboard"
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
            >
              ← Back to Dashboard
            </Link>

            {/* Email display (desktop only) */}
            <div className="hidden sm:block text-sm text-slate-600">{me.user.email ?? ""}</div>
          </div>
        </div>
      </header>

      {/* Tabs row */}
      <div className="mx-auto max-w-6xl px-6 py-6">
        <div className="rounded-2xl bg-slate-100 p-2 ring-1 ring-slate-200">
          <div className="flex flex-wrap items-center gap-2">
            {tabs.map((t) => (
              <TabLink key={t.href} href={t.href} label={t.label} />
            ))}
          </div>
        </div>

        {/* Page content */}
        <main className="mt-6">{children}</main>
      </div>
    </div>
  );
}
