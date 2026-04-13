"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Eye, EyeOff } from "lucide-react";
import { createSupabaseBrowser } from "@/lib/supabase/client";
import { getPublicAppOrigin } from "@/lib/utils/publicOrigin";

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createSupabaseBrowser();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
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

  const statusMessage = localError || (queryError ? decodeURIComponent(queryError) : "");

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
        .afu-1 { animation-delay: 0.08s; }
        .afu-2 { animation-delay: 0.16s; }
        .afu-3 { animation-delay: 0.24s; }
        .afu-4 { animation-delay: 0.32s; }
        .afu-5 { animation-delay: 0.40s; }
        .afu-6 { animation-delay: 0.48s; }

        .auth-input-wrap {
          display: flex;
          align-items: center;
          gap: 12px;
          background: #fff;
          border: 1.5px solid #e2e8f2;
          border-radius: 12px;
          padding: 0 16px;
          transition: border-color .2s, box-shadow .2s;
        }
        .auth-input-wrap:focus-within {
          border-color: #003595;
          box-shadow: 0 0 0 3px rgba(0,53,149,.10);
        }
        .auth-input-wrap input {
          height: 52px;
          width: 100%;
          background: transparent;
          border: none;
          outline: none;
          font-size: 15px;
          color: #0d1b2a;
          font-family: 'DM Sans', system-ui, sans-serif;
        }
        .auth-input-wrap input::placeholder { color: #9aaabb; }

        .auth-btn-primary {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          width: 100%;
          height: 52px;
          background: linear-gradient(135deg, #003595 0%, #002160 100%);
          color: #fff;
          font-family: 'DM Sans', system-ui, sans-serif;
          font-size: 15px;
          font-weight: 600;
          letter-spacing: .02em;
          border: none;
          border-radius: 12px;
          cursor: pointer;
          transition: transform .18s, box-shadow .18s, opacity .18s;
          box-shadow: 0 4px 16px rgba(0,53,149,.28);
        }
        .auth-btn-primary:hover:not(:disabled) {
          transform: translateY(-1px);
          box-shadow: 0 8px 24px rgba(0,53,149,.34);
        }
        .auth-btn-primary:active:not(:disabled) {
          transform: translateY(0);
          box-shadow: 0 2px 8px rgba(0,53,149,.20);
        }
        .auth-btn-primary:disabled { opacity: .6; cursor: not-allowed; }

        .auth-badge {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 5px 12px;
          background: rgba(255,255,255,.12);
          border: 1px solid rgba(255,255,255,.2);
          border-radius: 100px;
          font-family: 'DM Sans', system-ui, sans-serif;
          font-size: 11px;
          font-weight: 500;
          letter-spacing: .08em;
          text-transform: uppercase;
          color: rgba(255,255,255,.75);
        }
        .auth-badge-dot {
          width: 6px; height: 6px;
          background: #F5C04F;
          border-radius: 50%;
        }

        .auth-divider {
          width: 40px;
          height: 2px;
          background: #F5C04F;
          border-radius: 2px;
          margin: 20px 0;
        }
      `}</style>

      <div className="auth-font-sans flex min-h-screen bg-[#f4f6fb]">

        {/* ── LEFT PANEL ── */}
        <div className="relative hidden lg:flex lg:w-1/2 lg:flex-col lg:items-center lg:justify-center overflow-hidden">
          <Image
            src="/assets/almjhero2.png"
            alt="Alma Jordan Library"
            fill
            className="object-cover"
            priority
          />
          <div className="absolute inset-0 bg-gradient-to-br from-[#001635]/92 via-[#002160]/85 to-[#003595]/75" />

          <div className="relative z-10 max-w-lg px-12 text-white">
            <div className="auth-badge mb-8">
              <span className="auth-badge-dot" />
              UWI St. Augustine Campus
            </div>

            <h1 className="auth-font-display text-[56px] leading-[1.05] font-black">
              Master Your
              <br />
              <em className="text-[#F5C04F] not-italic">Study Sessions.</em>
            </h1>

            <div className="auth-divider" />

            <p className="text-white/75 text-[17px] leading-relaxed font-light max-w-sm">
              The official Alma Jordan Library Study Room Booking System for UWI St.&nbsp;Augustine students and staff.
            </p>

            <div className="mt-12 flex items-center gap-4">
              <div className="flex -space-x-2">
                {["#8FB3FF","#A5D6A7","#FFE082"].map((c, i) => (
                  <div key={i} className="w-8 h-8 rounded-full border-2 border-white/30" style={{ background: c }} />
                ))}
              </div>
              <p className="text-white/60 text-sm">2,400+ students booking weekly</p>
            </div>
          </div>
        </div>

        {/* ── RIGHT PANEL ── */}
        <div className="flex w-full lg:w-1/2 items-center justify-center px-6 py-12 bg-white">
          <div className="w-full max-w-[420px]">

            {/* Logo */}
            <div className="afu afu-1 flex justify-center mb-2">
              <Image
                src="/assets/almajordanHeader.jpg"
                alt="UWI Alma Jordan Library"
                width={520}
                height={100}
                className="h-auto w-[340px]"
                priority
              />
            </div>

            {/* Heading */}
            <div className="afu afu-2 mt-8 text-center">
              <h2 className="auth-font-display text-[40px] font-black leading-tight text-[#0d1b2a]">
                Welcome Back
              </h2>
              <p className="mt-2 text-[15px] text-[#6b7b99] font-light">
                Sign in to your account to continue
              </p>
            </div>

            <form className="mt-8 space-y-4" onSubmit={onSubmit}>
              {/* Email */}
              <div className="afu afu-3">
                <label className="block text-[13px] font-semibold text-[#1a2d4e] mb-1.5 tracking-wide uppercase">
                  Student Email
                </label>
                <div className="auth-input-wrap">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#9aaabb" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>
                  </svg>
                  <input
                    placeholder="yourname@my.uwi.edu"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    autoComplete="email"
                    required
                  />
                </div>
              </div>

              {/* Password */}
              <div className="afu afu-4">
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-[13px] font-semibold text-[#1a2d4e] tracking-wide uppercase">
                    Password
                  </label>
                  <Link href="/forgot-password" className="text-[13px] font-medium text-[#003595] hover:opacity-75 transition-opacity">
                    Forgot password?
                  </Link>
                </div>
                <div className="auth-input-wrap">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#9aaabb" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                  </svg>
                  <input
                    placeholder="Enter your password"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="current-password"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((prev) => !prev)}
                    style={{ color: "#9aaabb", background: "none", border: "none", cursor: "pointer", padding: 0, display: "flex" }}
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              {statusMessage ? (
                <div className="afu afu-5 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-600 font-medium">
                  {statusMessage}
                </div>
              ) : null}

              <div className="afu afu-5 pt-1">
                <button className="auth-btn-primary" disabled={loading}>
                  {loading ? (
                    <>
                      <svg className="animate-spin" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" strokeOpacity=".25"/><path d="M12 2a10 10 0 0 1 10 10" strokeLinecap="round"/></svg>
                      Please wait…
                    </>
                  ) : (
                    <>
                      <ArrowRight size={16} />
                      Sign In
                    </>
                  )}
                </button>
              </div>
            </form>

            <p className="afu afu-6 mt-7 text-center text-[14px] text-[#6b7b99]">
              Don&apos;t have an account?{" "}
              <Link href="/signup" className="font-semibold text-[#003595] hover:opacity-75 transition-opacity">
                Create one
              </Link>
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
