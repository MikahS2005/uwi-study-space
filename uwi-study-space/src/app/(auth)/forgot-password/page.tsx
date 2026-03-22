// src/app/(auth)/forgot-password/page.tsx
"use client";

import { useState } from "react";
import { createSupabaseBrowser } from "@/lib/supabase/client";
import { getPublicAppOrigin } from "@/lib/utils/publicOrigin";

export default function ForgotPasswordPage() {
  const supabase = createSupabaseBrowser();

  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSent(false);
    setLoading(true);

    const normalizedEmail = email.trim().toLowerCase();

    const { error } = await supabase.auth.resetPasswordForEmail(normalizedEmail, {
      redirectTo: `${getPublicAppOrigin()}/auth/callback?next=/reset-password`,
    });

    setLoading(false);

    if (error) {
      setError(error.message);
      return;
    }

    setSent(true);
  }

  return (
    <div className="rounded-lg border p-6">
      <h1 className="text-xl font-semibold">Forgot password</h1>
      <p className="mt-1 text-sm text-gray-600">
        Enter your UWI email and we’ll send you a password reset link.
      </p>

      <form className="mt-5 space-y-3" onSubmit={onSubmit}>
        <input
          className="w-full rounded border px-3 py-2"
          placeholder="email@my.uwi.edu or email@uwi.edu"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
          required
        />

        {error ? <p className="text-sm text-red-600">{error}</p> : null}

        {sent ? (
          <p className="text-sm text-green-700">
            Reset email sent. Check your inbox and click the link.
          </p>
        ) : null}

        <button
          className="w-full rounded bg-black px-3 py-2 text-white disabled:opacity-60"
          disabled={loading}
        >
          {loading ? "Sending..." : "Send reset link"}
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