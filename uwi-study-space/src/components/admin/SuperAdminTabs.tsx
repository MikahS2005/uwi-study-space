"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type Tab = { href: string; label: string };

type SuperAdminTabsProps = {
  tabs: Tab[];
};

export function SuperAdminTabs({ tabs }: SuperAdminTabsProps) {
  const pathname = usePathname();

  return (
    <>
      {tabs.map((t) => {
        const active = pathname === t.href || pathname.startsWith(t.href + "/");
        return (
          <Link
            key={t.href}
            href={t.href}
            className={[
              "inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm transition",
              active
                ? "bg-white shadow-sm ring-1 ring-slate-200 text-slate-900"
                : "text-slate-600 hover:bg-white/60 hover:text-slate-900",
            ].join(" ")}
          >
            {t.label}
          </Link>
        );
      })}
    </>
  );
}
