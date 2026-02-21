"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import UserBar from "@/components/auth/UserBar";

// NOTE: We keep this local type so SidebarLayout is fully self-contained.
type MeResponse = {
  user: null | {
    id: string;
    email: string | null;
    role: "student" | "admin" | "super_admin" | null;
    departmentId: number | null;
  };
  settings: any | null; // not needed here, but /api/me returns it
};

type NavItem = {
  href: string;
  label: string;
  icon: React.ReactNode;
  roles?: Array<"student" | "admin" | "super_admin">; // optional role gating
};

/* -------------------------------------------------------------------------- */
/* Icons                    */
/* -------------------------------------------------------------------------- */

function IconDashboard() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M4 13h7V4H4v9Zm9 7h7V11h-7v9ZM4 20h7v-5H4v5Zm9-16v5h7V4h-7Z"
        fill="currentColor"
      />
    </svg>
  );
}

function IconRooms() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M4 10h16v10H4V10Zm2-6h12v4H6V4Z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconBookings() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M7 3v3M17 3v3M4 8h16M6 12h4m-4 4h6"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path
        d="M6 5h12a2 2 0 0 1 2 2v13a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Z"
        stroke="currentColor"
        strokeWidth="2"
      />
    </svg>
  );
}

function IconSchedule() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M7 3v2M17 3v2M4 7h16M6 11h4m-4 4h6"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path
        d="M6 5h12a2 2 0 0 1 2 2v13a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Z"
        stroke="currentColor"
        strokeWidth="2"
      />
    </svg>
  );
}

function IconShield() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M12 2l8 4v6c0 5-3.4 9.4-8 10-4.6-.6-8-5-8-10V6l8-4Z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconBars() {
  return (
    <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M5 7h14M5 12h14M5 17h10"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

function IconClose() {
  return (
    <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M6 6l12 12M18 6 6 18"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

/* -------------------------------------------------------------------------- */
/* SidebarLayout                                                              */
/* -------------------------------------------------------------------------- */

function NavLink({
  href,
  label,
  icon,
  onNavigate,
}: {
  href: string;
  label: string;
  icon: React.ReactNode;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();

  // "active" should also highlight nested routes (e.g., /rooms/123)
  const isActive = pathname === href || (href !== "/dashboard" && pathname.startsWith(href));

  return (
    <Link
      href={href}
      onClick={onNavigate}
      className={[
        "group flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition",
        isActive
          ? "bg-white/15 text-white"
          : "text-white/90 hover:bg-white/10 hover:text-white",
      ].join(" ")}
    >
      <span className={["transition", isActive ? "text-white" : "text-white/90 group-hover:text-white"].join(" ")}>
        {icon}
      </span>
      <span>{label}</span>
    </Link>
  );
}

export default function SidebarLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [me, setMe] = useState<MeResponse | null>(null);

  // Mobile drawer open/close state
  const [open, setOpen] = useState(false);

  useEffect(() => {
    fetch("/api/me")
      .then((r) => r.json())
      .then((data) => setMe(data))
      .catch(() => setMe({ user: null, settings: null }));
  }, []);

  const role = me?.user?.role ?? "student";

  const navItems = useMemo<NavItem[]>(() => {
    const items: NavItem[] = [
      { href: "/dashboard", label: "Dashboard", icon: <IconDashboard /> },
      { href: "/rooms", label: "Browse Rooms", icon: <IconRooms /> },
      { href: "/schedule", label: "Schedule", icon: <IconSchedule /> },
      { href: "/bookings", label: "My Bookings", icon: <IconBookings /> },
      { href: "/waitlist", label: "My Waitlist", icon: <IconBookings /> }
    ];

    // Admin panel link for admin + super_admin
// Admin panel link (role-aware routing)
if (role === "admin") {
  items.push({
    href: "/admin",
    label: "Admin Panel",
    icon: <IconShield />,
  });
}

if (role === "super_admin") {
  items.push({
    href: "/super-admin",
    label: "Admin Panel",
    icon: <IconShield />,
  });
}

    // NOTE:
    // Settings should be under /super-admin per your decision.
    // If you want a separate sidebar item for it later, add:
    // items.push({ href: "/super-admin/settings", label: "Settings", icon: <IconShield /> });
    return items;
  }, [role]);

  async function signOut() {
    // If you already have a sign-out route/button elsewhere, feel free to replace.
    // This is the simplest pattern: call Supabase signout via an API route or client.
    // If you have a /api/auth/signout route, change this call.
    try {
      await fetch("/api/auth/signout", { method: "POST" });
    } catch {
      // ignore
    }
    router.push("/login");
  }

  // Close drawer after navigation on mobile
  function handleNavigate() {
    setOpen(false);
  }

  // User card details
  const email = me?.user?.email ?? "";
  const displayName = (email || "Student").split("@")[0] || "Student";
  const initials = displayName.slice(0, 1).toUpperCase();

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Mobile top bar */}
      <div className="sticky top-0 z-30 flex items-center gap-3 border-b bg-white px-4 py-3 sm:hidden">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="inline-flex items-center justify-center rounded-md p-2 text-slate-700 hover:bg-slate-100"
          aria-label="Open sidebar"
        >
          <IconBars />
        </button>
        <div className="leading-tight">
          <div className="text-sm font-semibold text-slate-900">AJ Library Booking</div>
          <div className="text-xs text-slate-500">Alma Jordan Library</div>
        </div>
      </div>

      {/* Mobile overlay */}
      {open && (
        <button
          className="fixed inset-0 z-40 bg-black/40 sm:hidden"
          onClick={() => setOpen(false)}
          aria-label="Close sidebar overlay"
        />
      )}

      {/* Sidebar */}
      <aside
        className={[
          "fixed left-0 top-0 z-50 h-screen w-72 transform transition-transform sm:translate-x-0",
          open ? "translate-x-0" : "-translate-x-full",
        ].join(" ")}
        aria-label="Sidebar"
      >
        {/* Sidebar background */}
        <div className="flex h-full flex-col bg-sky-900">
          {/* Brand header */}
          <div className="flex items-start justify-between px-5 py-5">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-white/15 text-white">
                {/* book icon */}
                <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path
                    d="M6 4h10a2 2 0 0 1 2 2v14H8a2 2 0 0 0-2 2V4Z"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinejoin="round"
                  />
                  <path
                    d="M6 20h12"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                  />
                </svg>
              </div>

              <div className="leading-tight">
                <div className="text-sm font-semibold text-white">AJ Library Booking</div>
                <div className="text-xs text-white/80">Alma Jordan Library</div>
              </div>
            </div>

            {/* Close button on mobile */}
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-md p-2 text-white/90 hover:bg-white/10 sm:hidden"
              aria-label="Close sidebar"
            >
              <IconClose />
            </button>
          </div>

          {/* Nav */}
          <nav className="flex-1 px-4">
            <div className="space-y-1">
              {navItems.map((item) => (
                <NavLink
                  key={item.href}
                  href={item.href}
                  label={item.label}
                  icon={item.icon}
                  onNavigate={handleNavigate}
                />
              ))}
            </div>
          </nav>

          {/* Bottom user card + sign out */}
          <div className="px-4 pb-5">
            <div className="rounded-xl bg-white/10 p-4 text-white">
              <div className="mb-3 flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/20 text-sm font-semibold">
                  {initials}
                </div>
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold">{displayName}</div>
                  <div className="truncate text-xs text-white/80">{role}</div>
                </div>
              </div>

              <div className="mt-6">
                    <UserBar />
                  </div>
            </div>
          </div>
        </div>
      </aside>

      {/* Main content (pad-left on desktop so it doesn’t sit under sidebar) */}
      <main className="min-h-screen sm:ml-72">
        <div className="p-6">{children}</div>
      </main>
    </div>
  );
}
