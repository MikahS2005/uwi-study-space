"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type Tab = {
  href: string;
  label: string;
};

export function SuperAdminTabs({ tabs }: { tabs: Tab[] }) {
  const pathname = usePathname();

  return (
    <>
      {tabs.map((tab) => {
        const active = pathname === tab.href || pathname.startsWith(`${tab.href}/`);

        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={[
              "inline-flex items-center rounded-xl px-4 py-2.5 text-sm font-medium transition-all",
              active
                ? "border border-[var(--color-primary)]/12 bg-white text-[var(--color-primary)] shadow-sm"
                : "border border-transparent bg-transparent text-[var(--color-text-light)]/70 hover:border-[var(--color-border-light)] hover:bg-white hover:text-[var(--color-primary)]",
            ].join(" ")}
          >
            {tab.label}
          </Link>
        );
      })}
    </>
  );
}