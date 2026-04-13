"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Mail } from "lucide-react";
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
    if (error) { setError(error.message); return; }
    setSent(true);
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

        .auth-input-wrap {
          display: flex; align-items: center; gap: 10px;
          background: #fff; border: 1.5px solid #e2e8f2;
          border-radius: 12px; padding: 0 14px;
          transition: border-color .2s, box-shadow .2s;
        }
        .auth-input-wrap:focus-within {
          border-color: #003595;
          box-shadow: 0 0 0 3px rgba(0,53,149,.10);
        }
        .auth-input-wrap input {
          height: 52px; width: 100%;
          background: transparent; border: none; outline: none;
          font-size: 15px; color: #0d1b2a;
          font-family: 'DM Sans', system-ui, sans-serif;
        }
        .auth-input-wrap input::placeholder { color: #9aaabb; }

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
        .auth-btn-primary:disabled { opacity: .6; cursor: not-allowed; }

        .auth-badge {
          display: inline-flex; align-items: center; gap: 6px; padding: 5px 12px;
          background: rgba(255,255,255,.12); border: 1px solid rgba(255,255,255,.2);
          border-radius: 100px; font-family: 'DM Sans', system-ui, sans-serif;
          font-size: 11px; font-weight: 500; letter-spacing: .08em;
          text-transform: uppercase; color: rgba(255,255,255,.75);
        }
        .auth-badge-dot { width: 6px; height: 6px; background: #F5C04F; border-radius: 50%; }
        .auth-divider { width: 36px; height: 2px; background: #F5C04F; border-radius: 2px; margin: 18px 0; }

        @keyframes checkDraw {
          from { stroke-dashoffset: 50; }
          to   { stroke-dashoffset: 0; }
        }
        .check-circle { animation: authFadeUp 0.5s cubic-bezier(.22,.68,0,1.2) both; }
        .check-path {
          stroke-dasharray: 50;
          stroke-dashoffset: 50;
          animation: checkDraw 0.5s ease .2s both;
        }
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
              Reset Your
              <br />
              <em className="text-[#F5C04F] not-italic">Access.</em>
            </h1>
            <div className="auth-divider" />
            <p className="text-white/70 text-[15.5px] leading-relaxed font-light">
              Enter your UWI email to receive a secure password reset link.
            </p>
            <div className="mt-10 p-5 rounded-2xl border border-white/15 bg-white/5">
              <p className="text-white/50 text-xs uppercase tracking-widest font-medium mb-3">Security reminder</p>
              <p className="text-white/65 text-sm font-light leading-relaxed">
                Reset links expire after 1 hour. Never share your reset link with anyone.
              </p>
            </div>
          </div>
        </div>

        {/* ── RIGHT PANEL ── */}
        <div className="flex w-full lg:w-1/2 items-center justify-center px-6 py-12 bg-white">
          <div className="w-full max-w-[400px]">

            <div className="afu afu-1 flex justify-center">
              <Image src="/assets/almajordanHeader.jpg" alt="UWI Alma Jordan Library" width={520} height={100} className="h-auto w-[340px]" priority />
            </div>

            {sent ? (
              /* ── Success state ── */
              <div className="mt-8 text-center">
                <div className="check-circle flex justify-center mb-6">
                  <div className="w-20 h-20 rounded-full bg-green-50 border border-green-100 flex items-center justify-center">
                    <svg width="36" height="36" viewBox="0 0 36 36" fill="none">
                      <path className="check-path" d="M9 18.5L15 24.5L27 12" stroke="#16a34a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </div>
                </div>
                <h2 className="auth-font-display text-[36px] font-black leading-tight text-[#0d1b2a]">Email Sent!</h2>
                <p className="mt-2 text-[14.5px] text-[#6b7b99] font-light leading-relaxed max-w-xs mx-auto">
                  Check your inbox for a password reset link. It may take a minute or two to arrive.
                </p>
                <div className="mt-5 rounded-xl border border-[#003595]/15 bg-[#EAF6FF] px-4 py-3">
                  <div className="flex items-center justify-center gap-2.5">
                    <Mail size={15} color="#003595" />
                    <span className="text-[14px] font-semibold text-[#003595]">{email}</span>
                  </div>
                </div>
                <Link href="/login" className="inline-flex mt-5 h-[52px] w-full items-center justify-center rounded-xl bg-[#003595] text-[15px] font-semibold text-white hover:bg-[#002160] transition-colors" style={{ boxShadow: "0 4px 16px rgba(0,53,149,.28)" }}>
                  Back to Login
                </Link>
              </div>
            ) : (
              /* ── Form state ── */
              <>
                <div className="afu afu-2 mt-8 text-center">
                  <h2 className="auth-font-display text-[36px] font-black leading-tight text-[#0d1b2a]">Forgot Password</h2>
                  <p className="mt-2 text-[14px] text-[#6b7b99] font-light">
                    We&apos;ll send a reset link to your UWI email.
                  </p>
                </div>

                <form className="mt-8 space-y-4" onSubmit={onSubmit}>
                  <div className="afu afu-3">
                    <label className="block text-[12px] font-semibold text-[#1a2d4e] mb-1.5 tracking-widest uppercase">
                      UWI Email
                    </label>
                    <div className="auth-input-wrap">
                      <Mail size={16} color="#9aaabb" />
                      <input
                        placeholder="name@my.uwi.edu"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        autoComplete="email"
                        required
                      />
                    </div>
                  </div>

                  {error ? (
                    <div className="afu rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-600 font-medium">
                      {error}
                    </div>
                  ) : null}

                  <div className="afu afu-4 pt-1">
                    <button className="auth-btn-primary" disabled={loading}>
                      <ArrowRight size={16} />
                      {loading ? "Sending…" : "Send Reset Link"}
                    </button>
                  </div>
                </form>

                <p className="afu afu-5 mt-6 text-center text-[13.5px] text-[#6b7b99]">
                  <Link href="/login" className="font-semibold text-[#003595] hover:opacity-75 transition-opacity">
                    ← Back to Login
                  </Link>
                </p>
              </>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
