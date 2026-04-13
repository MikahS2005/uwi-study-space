// src/app/(auth)/reset-password/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight, KeyRound } from "lucide-react";
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
    return () => { mounted = false; };
  }, [supabase]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null); setMsg(null);

    if (!canReset) { setError("This reset link is invalid, expired, or has not established a session."); return; }
    if (!password || password.length < 6) { setError("Password must be at least 6 characters."); return; }
    if (password !== confirmPassword) { setError("Passwords do not match."); return; }

    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);

    if (error) { setError(error.message); return; }

    setMsg("Password updated successfully. Redirecting to login…");
    setTimeout(() => { router.replace("/login"); router.refresh(); }, 1200);
  }

  const sharedStyles = `
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

    .strength-bar {
      height: 3px; border-radius: 2px; background: #e2e8f2;
      transition: background .3s, width .3s;
    }
  `;

  /* ── Loading state ── */
  if (!ready) {
    return (
      <>
        <style>{sharedStyles}</style>
        <div className="auth-font-sans flex min-h-screen items-center justify-center bg-[#f4f6fb] px-6">
          <div className="w-full max-w-sm rounded-2xl border border-[#e2e8f2] bg-white p-8 text-center shadow-sm">
            <div className="flex justify-center mb-4">
              <div className="w-10 h-10 rounded-full border-2 border-[#003595]/20 border-t-[#003595] animate-spin" />
            </div>
            <h1 className="auth-font-display text-[22px] font-black text-[#0d1b2a]">Reset Password</h1>
            <p className="mt-2 text-sm text-[#6b7b99] font-light">Preparing your reset session…</p>
          </div>
        </div>
      </>
    );
  }

  /* ── Strength indicator helper ── */
  function getStrength(p: string): { level: number; label: string; color: string } {
    if (!p) return { level: 0, label: "", color: "#e2e8f2" };
    if (p.length < 6) return { level: 1, label: "Too short", color: "#ef4444" };
    if (p.length < 8) return { level: 2, label: "Weak", color: "#f97316" };
    if (p.match(/[A-Z]/) && p.match(/[0-9]/)) return { level: 4, label: "Strong", color: "#16a34a" };
    return { level: 3, label: "Fair", color: "#f59e0b" };
  }
  const strength = getStrength(password);

  return (
    <>
      <style>{sharedStyles}</style>

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
              Choose a
              <br />
              <em className="text-[#F5C04F] not-italic">New Password.</em>
            </h1>
            <div className="auth-divider" />
            <p className="text-white/70 text-[15.5px] leading-relaxed font-light">
              Set a strong password to secure your UWI Study Space account.
            </p>
            <div className="mt-10 space-y-3">
              {[
                "At least 8 characters long",
                "Mix of uppercase & lowercase",
                "Include numbers or symbols",
              ].map((tip) => (
                <div key={tip} className="flex items-start gap-3">
                  <div className="w-5 h-5 rounded-full bg-[#F5C04F]/15 border border-[#F5C04F]/40 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <div className="w-2 h-2 rounded-full bg-[#F5C04F]" />
                  </div>
                  <span className="text-white/65 text-sm font-light">{tip}</span>
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

            <div className="afu afu-2 mt-8 text-center">
              <h2 className="auth-font-display text-[36px] font-black leading-tight text-[#0d1b2a]">Reset Password</h2>
              <p className="mt-2 text-[14px] text-[#6b7b99] font-light">Enter your new password below.</p>
            </div>

            <form className="mt-8 space-y-4" onSubmit={onSubmit}>

              <div className="afu afu-3">
                <label className="block text-[12px] font-semibold text-[#1a2d4e] mb-1.5 tracking-widest uppercase">
                  New Password
                </label>
                <div className="auth-input-wrap">
                  <KeyRound size={16} color="#9aaabb" />
                  <input
                    placeholder="Enter new password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="new-password"
                    required
                  />
                </div>
                {/* Strength indicator */}
                {password.length > 0 && (
                  <div className="mt-2">
                    <div className="flex gap-1 mb-1">
                      {[1,2,3,4].map((n) => (
                        <div
                          key={n}
                          className="strength-bar flex-1"
                          style={{ background: n <= strength.level ? strength.color : "#e2e8f2" }}
                        />
                      ))}
                    </div>
                    {strength.label && (
                      <p className="text-[12px] font-medium" style={{ color: strength.color }}>{strength.label}</p>
                    )}
                  </div>
                )}
              </div>

              <div className="afu afu-4">
                <label className="block text-[12px] font-semibold text-[#1a2d4e] mb-1.5 tracking-widest uppercase">
                  Confirm Password
                </label>
                <div className="auth-input-wrap" style={{
                  borderColor: confirmPassword && password !== confirmPassword ? "#fca5a5" : undefined,
                }}>
                  <KeyRound size={16} color="#9aaabb" />
                  <input
                    placeholder="Confirm new password"
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    autoComplete="new-password"
                    required
                  />
                  {confirmPassword && (
                    <div style={{ flexShrink: 0 }}>
                      {password === confirmPassword ? (
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="20 6 9 17 4 12"/>
                        </svg>
                      ) : (
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                        </svg>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {error ? (
                <div className="afu rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-600 font-medium">
                  {error}
                </div>
              ) : null}
              {msg ? (
                <div className="afu rounded-xl border border-green-100 bg-green-50 px-4 py-3 text-sm text-green-700 font-medium">
                  {msg}
                </div>
              ) : null}

              <div className="afu afu-5 pt-1">
                <button className="auth-btn-primary" disabled={loading}>
                  {loading ? (
                    <>
                      <svg className="animate-spin" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <circle cx="12" cy="12" r="10" strokeOpacity=".25"/>
                        <path d="M12 2a10 10 0 0 1 10 10" strokeLinecap="round"/>
                      </svg>
                      Updating…
                    </>
                  ) : (
                    <>
                      <ArrowRight size={16} />
                      Update Password
                    </>
                  )}
                </button>
              </div>
            </form>

            <p className="afu afu-5 mt-6 text-center text-[13.5px] text-[#6b7b99]">
              <Link href="/login" className="font-semibold text-[#003595] hover:opacity-75 transition-opacity">
                ← Back to Login
              </Link>
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
