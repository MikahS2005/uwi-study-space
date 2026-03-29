// src/app/(auth)/reset-password/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowser } from "@/lib/supabase/client";

export default function ResetPasswordPage() {
  const router = useRouter();
  const supabase = useMemo(() => createSupabaseBrowser(), []);

  const [ready, setReady] = useState(false);
  const [canReset, setCanReset] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    async function boot() {
      const { data } = await supabase.auth.getSession();
      if (!mounted) return;

      setCanReset(Boolean(data.session));
      setReady(true);
    }

    boot();

    return () => {
      mounted = false;
    };
  }, [supabase]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setMsg(null);

    if (!canReset) {
      setError("This reset link is invalid, expired, or has not established a session.");
      return;
    }

    if (!password || password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);

    const { error } = await supabase.auth.updateUser({
      password,
    });

    setLoading(false);

    if (error) {
      setError(error.message);
      return;
    }

    setMsg("Password updated successfully. Redirecting to login...");
    setTimeout(() => {
      router.replace("/login");
      router.refresh();
    }, 1200);
  }

  if (!ready) {
    return (
      <div className="rounded-lg border p-6">
        <h1 className="text-xl font-semibold">Reset password</h1>
        <p className="mt-2 text-sm text-gray-600">Preparing reset session…</p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border p-6">
      <h1 className="text-xl font-semibold">Reset password</h1>
      <p className="mt-1 text-sm text-gray-600">
        Enter your new password below.
      </p>

      <form className="mt-5 space-y-3" onSubmit={onSubmit}>
        <input
          className="w-full rounded border px-3 py-2"
          placeholder="New password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="new-password"
          required
        />

        <input
          className="w-full rounded border px-3 py-2"
          placeholder="Confirm new password"
          type="password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          autoComplete="new-password"
          required
        />

        {error ? <p className="text-sm text-red-600">{error}</p> : null}
        {msg ? <p className="text-sm text-green-700">{msg}</p> : null}

        <button
          className="w-full rounded bg-black px-3 py-2 text-white disabled:opacity-60"
          disabled={loading}
        >
          {loading ? "Updating..." : "Update password"}
        </button>
      </form>

      <p className="mt-4 text-sm text-gray-700">
        <a className="underline" href="/login">
          Back to login
        </a>
      </p>
    </div>
  );
}