"use client";

import Image from "next/image";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { ArrowRight, Mail } from "lucide-react";
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
    if (!email) { setError("No email address was provided."); return; }
    setSending(true); setError(null); setMessage(null);

    const result =
      mode === "login"
        ? await supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: `${getPublicAppOrigin()}/auth/callback?next=/auth/continue`, shouldCreateUser: false } })
        : await supabase.auth.resend({ type: "signup", email, options: { emailRedirectTo: `${getPublicAppOrigin()}/auth/callback?next=/auth/continue` } });

    setSending(false);
    if (result.error) { setError(result.error.message); return; }
    setMessage(mode === "login" ? "Login verification email sent again." : "Verification email sent again.");
  }

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,700;0,900;1,700&family=DM+Sans:opsz,wght@9..40,300;9..40,400;9..40,500;9..40,600&display=swap');
        .auth-font-display { font-family: 'Playfair Display', Georgia, serif; }
        .auth-font-sans { font-family: 'DM Sans', system-ui, sans-serif; }

        @keyframes authFadeUp {
          from { opacity: 0; transform: translateY(18px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .afu { animation: authFadeUp 0.55s cubic-bezier(.22,.68,0,1.2) both; }
        .afu-1 { animation-delay: .08s; }
        .afu-2 { animation-delay: .16s; }
        .afu-3 { animation-delay: .24s; }
        .afu-4 { animation-delay: .32s; }
        .afu-5 { animation-delay: .40s; }

        @keyframes mailFloat {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-8px); }
        }
        .mail-icon-wrap { animation: mailFloat 3s ease-in-out infinite; }

        @keyframes pulse-ring {
          0% { transform: scale(1); opacity: .6; }
          100% { transform: scale(1.55); opacity: 0; }
        }
        .pulse-ring::before, .pulse-ring::after {
          content: '';
          position: absolute; inset: -10px;
          border-radius: 50%;
          border: 1.5px solid #003595;
          animation: pulse-ring 2s ease-out infinite;
        }
        .pulse-ring::after { animation-delay: .8s; }

        .auth-btn-primary {
          display: inline-flex; align-items: center; justify-content: center; gap: 10px;
          width: 100%; height: 52px;
          background: linear-gradient(135deg, #003595 0%, #002160 100%);
          color: #fff; font-family: 'DM Sans', system-ui, sans-serif;
          font-size: 15px; font-weight: 600; letter-spacing: .02em;
          border: none; border-radius: 12px; cursor: pointer;
          transition: transform .18s, box-shadow .18s, opacity .18s;
          box-shadow: 0 4px 16px rgba(0,53,149,.28);
        }
        .auth-btn-primary:hover:not(:disabled) { transform: translateY(-1px); box-shadow: 0 8px 24px rgba(0,53,149,.34); }
        .auth-btn-primary:disabled { opacity: .5; cursor: not-allowed; }

        .auth-badge {
          display: inline-flex; align-items: center; gap: 6px; padding: 5px 12px;
          background: rgba(255,255,255,.12); border: 1px solid rgba(255,255,255,.2);
          border-radius: 100px; font-family: 'DM Sans', system-ui, sans-serif;
          font-size: 11px; font-weight: 500; letter-spacing: .08em;
          text-transform: uppercase; color: rgba(255,255,255,.75);
        }
        .auth-badge-dot { width: 6px; height: 6px; background: #F5C04F; border-radius: 50%; }
        .auth-divider { width: 36px; height: 2px; background: #F5C04F; border-radius: 2px; margin: 18px 0; }
      `}</style>

      <div className="auth-font-sans flex min-h-screen bg-[#f4f6fb]">

        {/* ── LEFT PANEL ── */}
        <div className="relative hidden lg:flex lg:w-1/2 lg:flex-col lg:items-center lg:justify-center overflow-hidden">
          <Image src="/assets/almjhero2.png" alt="Alma Jordan Library" fill className="object-cover" priority />
          <div className="absolute inset-0 bg-gradient-to-br from-[#001635]/92 via-[#002160]/85 to-[#003595]/75" />

          <div className="relative z-10 max-w-sm px-10 text-white">
            <div className="auth-badge mb-8">
              <span className="auth-badge-dot" />
              UWI St. Augustine Campus
            </div>
            <h1 className="auth-font-display text-[48px] leading-[1.08] font-black">
              Check Your
              <br />
              <em className="text-[#F5C04F] not-italic">Inbox.</em>
            </h1>
            <div className="auth-divider" />
            <p className="text-white/70 text-[15.5px] leading-relaxed font-light">
              Use the verification email to complete access and continue into the app.
            </p>

            {/* Steps */}
            <div className="mt-10 space-y-4">
              {[
                { n: "1", label: "Open your UWI email inbox" },
                { n: "2", label: "Find the verification email" },
                { n: "3", label: "Click the link to verify" },
              ].map(({ n, label }) => (
                <div key={n} className="flex items-center gap-4">
                  <div className="w-7 h-7 rounded-full border border-[#F5C04F]/50 bg-[#F5C04F]/10 flex items-center justify-center flex-shrink-0">
                    <span className="text-[#F5C04F] text-xs font-bold">{n}</span>
                  </div>
                  <span className="text-white/65 text-sm font-light">{label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── RIGHT PANEL ── */}
        <div className="flex w-full lg:w-1/2 items-center justify-center px-6 py-12 bg-white">
          <div className="w-full max-w-[400px]">

            <div className="afu afu-1 flex justify-center">
              <Image src="/assets/almajordanHeader.jpg" alt="UWI Alma Jordan Library" width={520} height={100} className="h-auto w-[340px]" priority />
            </div>

            {/* Animated mail icon */}
            <div className="afu afu-2 flex justify-center mt-8 mb-6">
              <div className="relative">
                <div className="pulse-ring relative w-20 h-20 rounded-full bg-[#EAF6FF] border border-[#003595]/15 flex items-center justify-center mail-icon-wrap">
                  <Mail size={32} color="#003595" strokeWidth={1.5} />
                </div>
              </div>
            </div>

            <div className="afu afu-3 text-center">
              <h2 className="auth-font-display text-[36px] font-black leading-tight text-[#0d1b2a]">Verify Email</h2>
              <p className="mt-2 text-[14px] text-[#6b7b99] font-light leading-relaxed">
                We sent a verification link to your UWI email.
                <br />Check your inbox and click the link.
              </p>
            </div>

            {email ? (
              <div className="afu afu-3 mt-5 rounded-xl border border-[#003595]/15 bg-[#EAF6FF] px-4 py-3">
                <div className="flex items-center gap-2.5">
                  <Mail size={15} color="#003595" />
                  <span className="text-[14px] font-semibold text-[#003595]">{email}</span>
                </div>
              </div>
            ) : null}

            {message ? (
              <div className="afu mt-4 rounded-xl border border-green-100 bg-green-50 px-4 py-3 text-sm text-green-700 font-medium">
                {message}
              </div>
            ) : null}
            {error ? (
              <div className="afu mt-4 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-600 font-medium">
                {error}
              </div>
            ) : null}

            <div className="afu afu-4 mt-6 space-y-3">
              <button
                type="button"
                onClick={resendVerification}
                disabled={sending || !email}
                className="auth-btn-primary"
              >
                <ArrowRight size={16} />
                {sending ? "Sending…" : "Resend Verification Email"}
              </button>

              <Link
                href="/login"
                className="inline-flex h-[52px] w-full items-center justify-center rounded-xl border-[1.5px] border-[#e2e8f2] bg-white text-[14.5px] font-semibold text-[#1a2d4e] hover:bg-[#f4f6fb] transition-colors"
              >
                Back to Login
              </Link>
            </div>

            <p className="afu afu-5 mt-6 text-center text-[13px] text-[#9aaabb]">
              Check your spam folder if you don&apos;t see it within 2 minutes.
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
