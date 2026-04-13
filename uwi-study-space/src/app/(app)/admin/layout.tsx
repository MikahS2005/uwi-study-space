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
    role: "student" | "staff" | "admin" | "super_admin" | null;
    departmentId: number | null;
  };
};

function TabLink({ href, label }: { href: string; label: string }) {
  const pathname = usePathname();
  const active = pathname === href || pathname.startsWith(href + "/");

  return (
    <Link
      href={href}
      className={[
        "inline-flex items-center rounded-xl px-4 py-2 text-sm font-medium transition-colors",
        active
          ? "bg-white text-[var(--color-primary)] shadow-sm border border-[var(--color-border-light)]"
          : "text-[var(--color-text-light)]/70 hover:bg-white hover:text-[var(--color-primary)]",
      ].join(" ")}
    >
      {label}
    </Link>
  );
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
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
      router.replace("/login?next=/admin");
      return;
    }

    if (role === "super_admin") {
      router.replace("/super-admin");
      return;
    }

    if (role !== "admin") {
      router.replace("/dashboard");
      return;
    }
  }, [loading, me, role, router]);

  const tabs = useMemo(() => {
    return [
      { href: "/admin/rooms", label: "Rooms" },
      { href: "/admin/bookings", label: "Bookings" },
      { href: "/admin/waitlist", label: "Waitlist" },
      { href: "/admin/reports", label: "Reports" },
    ];
  }, []);

  // =============================
  // LOADING SKELETON (THEMED)
  // =============================
  if (loading) {
    return (
      <div className="min-h-screen bg-[var(--color-background-light)]">
        <div className="mx-auto max-w-6xl px-6 py-8 space-y-4">
          <div className="h-8 w-48 rounded bg-[var(--color-surface-light)]" />
          <div className="h-12 rounded bg-[var(--color-surface-light)]" />
          <div className="h-64 rounded bg-[var(--color-surface-light)]" />
        </div>
      </div>
    );
  }

  if (!me?.user || role !== "admin") return null;

  return (
    <div className="min-h-screen bg-[var(--color-background-light)]">
      {/* =============================
          HEADER
      ============================= */}
      <header className="border-b border-[var(--color-border-light)] bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          {/* LEFT */}
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-[var(--color-primary-soft)] text-[var(--color-primary)] border border-[var(--color-primary)]/10">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                <path
                  d="M7 4h11a2 2 0 0 1 2 2v13a1 1 0 0 1-1 1H8a3 3 0 0 0-3 3V6a2 2 0 0 1 2-2Z"
                  stroke="currentColor"
                  strokeWidth="2"
                />
                <path
                  d="M5 20a3 3 0 0 1 3-3h12"
                  stroke="currentColor"
                  strokeWidth="2"
                />
              </svg>
            </div>

            <div>
              <div className="text-sm font-semibold text-[var(--color-text-light)]">
                Admin Panel
              </div>
              <div className="text-xs text-[var(--color-text-light)]/60">
                Alma Jordan Library
              </div>
            </div>
          </div>

          {/* RIGHT */}
          <div className="flex items-center gap-3">
            <span className="rounded-full bg-[var(--color-primary-soft)] px-3 py-1 text-xs font-semibold text-[var(--color-primary)] border border-[var(--color-primary)]/10">
              Admin
            </span>

            <Link
              href="/dashboard"
              className="inline-flex items-center rounded-xl border border-[var(--color-border-light)] bg-white px-3 py-2 text-sm text-[var(--color-text-light)] transition-colors hover:bg-[var(--color-secondary)]"
            >
              ← Dashboard
            </Link>

            <div className="hidden sm:block text-sm text-[var(--color-text-light)]/70">
              {me.user.email ?? ""}
            </div>
          </div>
        </div>
      </header>

      {/* =============================
          TABS
      ============================= */}
      <div className="mx-auto max-w-6xl px-6 py-6">
        <div className="rounded-2xl bg-[var(--color-surface-light)] p-2 border border-[var(--color-border-light)]">
          <div className="flex flex-wrap gap-2">
            {tabs.map((t) => (
              <TabLink key={t.href} href={t.href} label={t.label} />
            ))}
          </div>
        </div>

        {/* =============================
            PAGE CONTENT
        ============================= */}
        <main className="mt-6">{children}</main>
      </div>
    </div>
  );
}