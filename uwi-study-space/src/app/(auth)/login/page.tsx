"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createSupabaseBrowser } from "@/lib/supabase/client";

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

    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password,
    });

    setLoading(false);

    if (error) {
      setLocalError(error.message);
      return;
    }

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