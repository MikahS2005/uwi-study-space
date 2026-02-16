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

  const email = me && "user" in me && me.user ? me.user.email : "—";
  const role = me && "user" in me && me.user ? me.user.role ?? "student" : "—";

  return (
    <div className="flex items-center justify-between gap-3 rounded border p-3">
      <div className="min-w-0">
        <p className="truncate text-sm font-medium">{email}</p>
        <p className="text-xs text-gray-600">{String(role)}</p>
      </div>

      <button className="rounded bg-black px-3 py-2 text-sm text-white" onClick={logout}>
        Logout
      </button>
    </div>
  );
}
