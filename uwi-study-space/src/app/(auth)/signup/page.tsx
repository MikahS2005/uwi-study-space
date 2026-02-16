"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowser } from "@/lib/supabase/client";

function isAllowedDomain(email: string) {
  const e = email.trim().toLowerCase();
  return e.endsWith("@my.uwi.edu") || e.endsWith("@uwi.edu");
}

export default function SignupPage() {
  const router = useRouter();
  const supabase = createSupabaseBrowser();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const normalizedEmail = email.trim().toLowerCase();
    if (!isAllowedDomain(normalizedEmail)) {
      setError("Use @my.uwi.edu (students) or @uwi.edu (staff).");
      return;
    }

    setLoading(true);

    const { data, error } = await supabase.auth.signUp({
      email: normalizedEmail,
      password,
      options: {
        data: { full_name: fullName.trim() }, // stored in auth metadata
        emailRedirectTo: `${window.location.origin}/verify`,
      },
    });

    setLoading(false);

    if (error) {
      setError(error.message);
      return;
    }

    // Supabase may require email confirmation depending on settings
    if (data.user && data.user.identities?.length) {
      router.push("/verify");
      router.refresh();
    } else {
      router.push("/verify");
      router.refresh();
    }
  }

  return (
    <div className="rounded-lg border p-6">
      <h1 className="text-xl font-semibold">Create account</h1>
      <p className="mt-1 text-sm text-gray-600">UWI emails only.</p>

      <form className="mt-5 space-y-3" onSubmit={onSubmit}>
        <input
          className="w-full rounded border px-3 py-2"
          placeholder="Full name"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          autoComplete="name"
        />
        <input
          className="w-full rounded border px-3 py-2"
          placeholder="email@my.uwi.edu"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
          required
        />
        <input
          className="w-full rounded border px-3 py-2"
          placeholder="Password (min 6 chars)"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="new-password"
          required
        />

        {error ? <p className="text-sm text-red-600">{error}</p> : null}

        <button
          className="w-full rounded bg-black px-3 py-2 text-white disabled:opacity-60"
          disabled={loading}
        >
          {loading ? "Creating..." : "Sign up"}
        </button>
      </form>

      <p className="mt-4 text-sm text-gray-700">
        Already have an account?{" "}
        <a className="underline" href="/login">
          Login
        </a>
      </p>
    </div>
  );
}
