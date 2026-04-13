"use client";

import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { createSupabaseBrowser } from "@/lib/supabase/client";
import { getPublicAppOrigin } from "@/lib/utils/publicOrigin";

export default function VerifyPage() {
  const searchParams = useSearchParams();
  const supabase = createSupabaseBrowser();

  const email = searchParams.get("email") ?? "";
  const mode = searchParams.get("mode") ?? "signup";
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  async function resendVerification() {
    if (!email) {
      setError("No email address was provided.");
      return;
    }

    setSending(true);
    setError(null);
    setMessage(null);

    const result =
      mode === "login"
        ? await supabase.auth.signInWithOtp({
            email,
            options: {
              emailRedirectTo: `${getPublicAppOrigin()}/auth/callback?next=/auth/continue`,
              shouldCreateUser: false,
            },
          })
        : await supabase.auth.resend({
            type: "signup",
            email,
            options: {
              emailRedirectTo: `${getPublicAppOrigin()}/auth/callback?next=/auth/continue`,
            },
          });

    setSending(false);

    if (result.error) {
      setError(result.error.message);
      return;
    }

    setMessage(mode === "login" ? "Login verification email sent again." : "Verification email sent again.");
  }

  return (
    <div className="rounded-lg border p-6">
      <h1 className="text-xl font-semibold">Check your email</h1>

      <p className="mt-2 text-sm text-gray-700">
        A verification link was sent to your UWI email.
      </p>

      {email ? (
        <p className="mt-2 text-sm text-gray-700">
          Email: <span className="font-medium">{email}</span>
        </p>
      ) : null}

      <p className="mt-2 text-sm text-gray-700">
        After verification, you will be redirected back into the app.
      </p>

      {message ? <p className="mt-3 text-sm text-green-600">{message}</p> : null}
      {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}

      <div className="mt-4 flex gap-3">
        <button
          type="button"
          onClick={resendVerification}
          disabled={sending || !email}
          className="rounded bg-black px-3 py-2 text-white disabled:opacity-60"
        >
          {sending ? "Sending..." : "Resend verification email"}
        </button>

        <a className="rounded border px-3 py-2" href="/login">
          Back to login
        </a>
      </div>
    </div>
  );
}