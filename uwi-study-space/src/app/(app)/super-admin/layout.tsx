// src/app/(app)/super-admin/layout.tsx
// Super Admin-only layout wrapper.
// - Uses /api/me to determine role
// - Redirects non-super-admin users away
// - Renders the same "admin panel" shell look (top bar + tabs area)
// NOTE: This is a CLIENT layout because it needs to fetch /api/me.

// src/app/(app)/super-admin/layout.tsx
//
// Super Admin-only layout wrapper.
// - Uses server-side auth/profile checks
// - Redirects non-super-admin users away
// - Renders the super admin shell with themed header + tabs

"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { SuperAdminTabs } from "@/components/admin/SuperAdminTabs";

type MeResponse = {
  user: null | {
    id: string;
    email: string | null;
    role: "student" | "staff" | "admin" | "super_admin" | null;
    departmentId: number | null;
  };
};

export default function SuperAdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();

  const [me, setMe] = useState<MeResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/me")
      .then((r) => r.json())
      .then((data: MeResponse) => setMe(data))
      .catch(() => setMe({ user: null }))
      .finally(() => setLoading(false));
  }, []);

  const role = me?.user?.role ?? null;

  useEffect(() => {
    if (loading) return;

    if (!me?.user) {
      router.replace("/login?next=/super-admin");
      return;
    }

    if (role === "admin") {
      router.replace("/admin");
      return;
    }

    if (role !== "super_admin") {
      router.replace("/dashboard");
      return;
    }
  }, [loading, me, role, router]);

  const tabs = useMemo(() => {
    return [
      { href: "/super-admin/rooms", label: "Rooms" },
      { href: "/super-admin/bookings", label: "Bookings" },
      { href: "/super-admin/departments", label: "Departments" },
      { href: "/super-admin/users", label: "Users" },
      { href: "/super-admin/waitlist", label: "Waitlist" },
      { href: "/super-admin/reports", label: "Reports" },
      { href: "/super-admin/settings", label: "Settings" },
    ];
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-[var(--color-background-light)]">
        <div className="mx-auto max-w-6xl space-y-4 px-6 py-8">
          <div className="h-8 w-56 rounded bg-[var(--color-surface-light)]" />
          <div className="h-12 rounded bg-[var(--color-surface-light)]" />
          <div className="h-64 rounded bg-[var(--color-surface-light)]" />
        </div>
      </div>
    );
  }

  if (!me?.user || role !== "super_admin") return null;

  return (
    <div className="min-h-screen bg-[var(--color-surface-light)]">
      <header className="border-b border-[var(--color-border-light)] bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
          <div className="flex items-center gap-4">
            <div className="grid h-11 w-11 place-items-center rounded-2xl border border-[var(--color-primary)]/10 bg-[var(--color-primary-soft)] text-[var(--color-primary)]">
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
              <div className="text-base font-semibold text-[var(--color-text-light)]">
                Super Admin Panel
              </div>
              <div className="text-sm text-[var(--color-text-light)]/60">
                Alma Jordan Library
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <span className="rounded-full border border-[var(--color-primary)]/10 bg-[var(--color-primary-soft)] px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.08em] text-[var(--color-primary)]">
              Super Admin
            </span>

            <Link
              href="/dashboard"
              className="inline-flex items-center rounded-xl border border-[var(--color-border-light)] bg-white px-3 py-2 text-sm text-[var(--color-text-light)] transition-colors hover:bg-[var(--color-secondary)]"
            >
              ← Dashboard
            </Link>

            <div className="hidden text-sm text-[var(--color-text-light)]/70 sm:block">
              {me.user.email ?? ""}
            </div>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-6 py-6">
        <div className="rounded-2xl border border-[var(--color-border-light)] bg-[var(--color-surface-light)] p-2">
          <div className="flex flex-wrap items-center gap-2">
            <SuperAdminTabs tabs={tabs} />
          </div>
        </div>

        <main className="mt-6">{children}</main>
      </div>
    </div>
  );
}