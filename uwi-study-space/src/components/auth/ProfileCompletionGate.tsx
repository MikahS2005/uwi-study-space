"use client";

/**
 * ProfileCompletionGate
 * ---------------------------------------------------------------------------
 * Wrap this in your app shell/layout so any logged-in user is forced to
 * complete their profile before using the app.
 *
 * Rules:
 * - If not logged in -> do nothing here (your existing auth flow handles it)
 * - If logged in and profile missing fields -> redirect to /complete-profile
 * - Skip redirect if already on /complete-profile (avoid infinite loop)
 * - Skip redirect on /login, /signup, /verify etc. (auth routes)
 */

"use client";

import { useEffect, useMemo } from "react";
import { usePathname, useRouter } from "next/navigation";
import { createSupabaseBrowser } from "@/lib/supabase/client";

export function ProfileCompletionGate() {
  const router = useRouter();
  const pathname = usePathname();
  const supabase = useMemo(() => createSupabaseBrowser(), []);

  useEffect(() => {
    let mounted = true;

    async function run() {
      const skip =
        pathname.startsWith("/login") ||
        pathname.startsWith("/signup") ||
        pathname.startsWith("/verify") ||
        pathname.startsWith("/auth/callback") ||
        pathname.startsWith("/auth/continue") ||
        pathname.startsWith("/complete-profile");

      if (skip) return;

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user || !mounted) return;

      const { data: profile, error } = await supabase
        .from("profiles")
        .select("full_name, uwi_id, phone, faculty, academic_status")
        .eq("id", user.id)
        .maybeSingle();

      if (!mounted) return;

      const missing =
        !profile?.full_name ||
        !profile?.uwi_id ||
        !profile?.phone ||
        !profile?.faculty ||
        !profile?.academic_status;

      if (error || missing) {
        router.replace("/complete-profile");
      }
    }

    run();

    return () => {
      mounted = false;
    };
  }, [pathname, router, supabase]);

  return null;
}