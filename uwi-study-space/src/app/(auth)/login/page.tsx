"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createSupabaseBrowser } from "@/lib/supabase/client";
import { getPublicAppOrigin } from "@/lib/utils/publicOrigin";

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createSupabaseBrowser();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const next = searchParams.get("next");
  const queryError = searchParams.get("error");

async function onSubmit(e: React.FormEvent) {
  e.preventDefault();
  setLoading(true);
  setLocalError(null);

  const normalizedEmail = email.trim().toLowerCase();

  const { data, error } = await supabase.auth.signInWithPassword({
    email: normalizedEmail,
    password,
  });

  if (error) {
    setLoading(false);
    setLocalError(error.message);
    return;
  }

  const { data: profileRow, error: profileError } = await supabase
    .from("profiles")
    .select("account_status")
    .eq("id", data.user.id)
    .maybeSingle();

  if (profileError) {
    await supabase.auth.signOut();
    setLoading(false);
    setLocalError("Could not verify account status. Please try again.");
    return;
  }

  const isVerified = !!data.user?.email_confirmed_at;
  const isPendingVerification = profileRow?.account_status === "pending_verification";

  if (!isVerified || isPendingVerification) {
    await supabase.auth.signOut();

    const target = next
      ? `/auth/continue?next=${encodeURIComponent(next)}`
      : "/auth/continue";

    const { error: otpError } = await supabase.auth.signInWithOtp({
      email: normalizedEmail,
      options: {
        emailRedirectTo: `${getPublicAppOrigin()}/auth/callback?next=${encodeURIComponent(target)}`,
        shouldCreateUser: false,
      },
    });

    if (otpError) {
      setLoading(false);
      setLocalError(otpError.message);
      return;
    }

    setLoading(false);
    router.push(`/verify?mode=login&email=${encodeURIComponent(normalizedEmail)}`);
    router.refresh();
    return;
  }

  setLoading(false);

  const target = next
    ? `/auth/continue?next=${encodeURIComponent(next)}`
    : "/auth/continue";

  router.push(target);
  router.refresh();
}
  return (
    <div className="rounded-lg border p-6">
      <h1 className="text-xl font-semibold">Login</h1>
      <p className="mt-1 text-sm text-gray-600">Use your UWI email address.</p>

      <form className="mt-5 space-y-3" onSubmit={onSubmit}>
        <input
          className="w-full rounded border px-3 py-2"
          placeholder="email@my.uwi.edu or email@uwi.edu"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
          required
        />
        <input
          className="w-full rounded border px-3 py-2"
          placeholder="Password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
          required
        />

        {localError ? <p className="text-sm text-red-600">{localError}</p> : null}
        {!localError && queryError ? (
          <p className="text-sm text-red-600">{decodeURIComponent(queryError)}</p>
        ) : null}

        <button
          className="w-full rounded bg-black px-3 py-2 text-white disabled:opacity-60"
          disabled={loading}
        >
          {loading ? "Logging in..." : "Login"}
        </button>
      </form>

      <p className="mt-4 text-sm text-gray-700">
        Don’t have an account?{" "}
        <a className="underline" href="/signup">
          Sign up
        </a>
      </p>
      <p className="text-sm text-gray-700">
      <a className="underline" href="/forgot-password">
        Forgot your password?
      </a>
    </p>
    </div>
  );
}