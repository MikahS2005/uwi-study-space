"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowser } from "@/lib/supabase/client";

type MeResponse =
  | { user: null }
  | {
      user: { id: string; email: string; role?: string | null; departmentId?: number | null };
      settings: Record<string, unknown> | null;
    };

export default function UserBar() {
  const router = useRouter();
  const supabase = createSupabaseBrowser();

  const [me, setMe] = useState<MeResponse | null>(null);

  useEffect(() => {
    fetch("/api/me")
      .then((r) => r.json())
      .then((data) => setMe(data))
      .catch(() => setMe({ user: null }));
  }, []);

  async function logout() {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  const email = me && "user" in me && me.user ? me.user.email : "Loading...";
  const role = me && "user" in me && me.user ? me.user.role ?? "student" : "—";

  return (
    <div className="flex items-center gap-4 rounded-xl border border-[#E5E7EB] bg-white p-2 pr-4 shadow-sm">
      {/* Small Avatar Circle */}
      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#EAF6FF] text-[#003595] font-bold">
        {email[0]?.toUpperCase()}
      </div>

      <div className="min-w-0">
        {/* Email set to Dark Text (#1F2937) */}
        <p className="truncate text-sm font-bold text-[#1F2937] leading-none mb-1">
          {email}
        </p>
        <p className="text-[10px] font-bold uppercase tracking-wider text-[#003595]/60 leading-none">
          {String(role)}
        </p>
      </div>

      <div className="h-8 w-px bg-[#E5E7EB] mx-1" />

      {/* Logout button using Primary Blue (#003595) */}
      <button 
        className="rounded-lg bg-[#003595] px-4 py-2 text-xs font-bold text-white transition-all hover:bg-[#002366] active:scale-95" 
        onClick={logout}
      >
        Logout
      </button>
    </div>
  );
}