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

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { createSupabaseBrowser } from "@/lib/supabase/client";

export function ProfileCompletionGate() {
  const router = useRouter();
  const pathname = usePathname();
  const supabase = useMemo(() => createSupabaseBrowser(), []);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    let mounted = true;

    async function run() {
      // Skip auth routes + the completion page itself
      const skip =
        pathname.startsWith("/login") ||
        pathname.startsWith("/signup") ||
        pathname.startsWith("/verify") ||
        pathname.startsWith("/complete-profile");

      if (skip) {
        if (mounted) setChecked(true);
        return;
      }

      const {
        data: { user },
      } = await supabase.auth.getUser();

      // Not logged in -> let your existing routing handle it
      if (!user) {
        if (mounted) setChecked(true);
        return;
      }

      // Load profile
      const { data: profile, error } = await supabase
        .from("profiles")
        .select("full_name, uwi_id")
        .eq("id", user.id)
        .maybeSingle();

      if (!mounted) return;

      // If profile missing OR fields missing -> force completion
      const missing = !profile?.full_name || !profile?.uwi_id;

      if (error || missing) {
        router.replace("/complete-profile");
        return;
      }

      setChecked(true);
    }

    run();

    return () => {
      mounted = false;
    };
  }, [pathname, router, supabase]);

  // We render nothing; this is a redirect gate only.
  // `checked` is here in case you want to add a top-loading bar later.
  return null;
}