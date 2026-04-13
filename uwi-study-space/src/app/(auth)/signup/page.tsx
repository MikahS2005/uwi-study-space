"use client";

import { getPublicAppOrigin } from "@/lib/utils/publicOrigin";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight, IdCard, KeyRound, Mail, Phone, UserRound } from "lucide-react";
import { createSupabaseBrowser } from "@/lib/supabase/client";
import { FACULTY_OPTIONS, ACADEMIC_STATUS_OPTIONS } from "@/lib/profile/options";

function isAllowedDomain(email: string) {
  const e = email.trim().toLowerCase();
  return e.endsWith("@my.uwi.edu") || e.endsWith("@uwi.edu");
}

function inferRole(email: string): "student" | "staff" {
  const e = email.trim().toLowerCase();
  return e.endsWith("@uwi.edu") && !e.endsWith("@my.uwi.edu") ? "staff" : "student";
}

export default function SignupPage() {
  const router = useRouter();
  const supabase = createSupabaseBrowser();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [uwiId, setUwiId] = useState("");
  const [phone, setPhone] = useState("");
  const [faculty, setFaculty] = useState("");
  const [academicStatus, setAcademicStatus] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const normalizedEmail = email.trim().toLowerCase();

    if (!isAllowedDomain(normalizedEmail)) {
      setError("Use @my.uwi.edu or @uwi.edu.");
      return;
    }
    if (!fullName.trim()) { setError("Full name is required."); return; }
    if (!uwiId.trim()) { setError("Student / staff ID is required."); return; }
    if (!phone.trim()) { setError("Phone number is required."); return; }
    if (!faculty) { setError("Faculty is required."); return; }
    if (!academicStatus) { setError("Academic status is required."); return; }

    const role = inferRole(normalizedEmail);
    setLoading(true);

    const { error } = await supabase.auth.signUp({
      email: normalizedEmail,
      password,
      options: {
        data: { full_name: fullName.trim(), uwi_id: uwiId.trim(), phone: phone.trim(), faculty, academic_status: academicStatus, role },
        emailRedirectTo: `${getPublicAppOrigin()}/auth/callback?next=/auth/continue`,
      },
    });

    setLoading(false);
    if (error) { setError(error.message); return; }

    router.push("/verify");
    router.refresh();
  }

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,700;0,900;1,700&family=DM+Sans:opsz,wght@9..40,300;9..40,400;9..40,500;9..40,600&display=swap');
        .auth-font-display { font-family: 'Playfair Display', Georgia, serif; }
        .auth-font-sans { font-family: 'DM Sans', system-ui, sans-serif; }

        @keyframes authFadeUp {
          from { opacity: 0; transform: translateY(16px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .afu { animation: authFadeUp 0.5s cubic-bezier(.22,.68,0,1.15) both; }
        .afu-1 { animation-delay: .05s; }
        .afu-2 { animation-delay: .10s; }
        .afu-3 { animation-delay: .15s; }
        .afu-4 { animation-delay: .20s; }
        .afu-5 { animation-delay: .25s; }
        .afu-6 { animation-delay: .30s; }
        .afu-7 { animation-delay: .35s; }
        .afu-8 { animation-delay: .40s; }
        .afu-9 { animation-delay: .45s; }
        .afu-10 { animation-delay: .50s; }

        .auth-input-wrap {
          display: flex; align-items: center; gap: 10px;
          background: #fff;
          border: 1.5px solid #e2e8f2;
          border-radius: 12px;
          padding: 0 14px;
          transition: border-color .2s, box-shadow .2s;
        }
        .auth-input-wrap:focus-within {
          border-color: #003595;
          box-shadow: 0 0 0 3px rgba(0,53,149,.10);
        }
        .auth-input-wrap input {
          height: 48px; width: 100%;
          background: transparent; border: none; outline: none;
          font-size: 14.5px; color: #0d1b2a;
          font-family: 'DM Sans', system-ui, sans-serif;
        }
        .auth-input-wrap input::placeholder { color: #9aaabb; }

        .auth-select {
          width: 100%; height: 48px;
          background: #fff;
          border: 1.5px solid #e2e8f2;
          border-radius: 12px;
          padding: 0 14px;
          font-size: 14.5px; color: #0d1b2a;
          font-family: 'DM Sans', system-ui, sans-serif;
          outline: none;
          transition: border-color .2s, box-shadow .2s;
          appearance: none;
          background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%239aaabb' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E");
          background-repeat: no-repeat;
          background-position: right 14px center;
        }
        .auth-select:focus {
          border-color: #003595;
          box-shadow: 0 0 0 3px rgba(0,53,149,.10);
        }
        .auth-select option[value=""] { color: #9aaabb; }

        .auth-btn-primary {
          display: inline-flex; align-items: center; justify-content: center; gap: 10px;
          width: 100%; height: 52px;
          background: linear-gradient(135deg, #003595 0%, #002160 100%);
          color: #fff;
          font-family: 'DM Sans', system-ui, sans-serif;
          font-size: 15px; font-weight: 600; letter-spacing: .02em;
          border: none; border-radius: 12px; cursor: pointer;
          transition: transform .18s, box-shadow .18s, opacity .18s;
          box-shadow: 0 4px 16px rgba(0,53,149,.28);
        }
        .auth-btn-primary:hover:not(:disabled) { transform: translateY(-1px); box-shadow: 0 8px 24px rgba(0,53,149,.34); }
        .auth-btn-primary:disabled { opacity: .6; cursor: not-allowed; }

        .auth-divider { width: 36px; height: 2px; background: #F5C04F; border-radius: 2px; margin: 18px 0; }
        .auth-badge {
          display: inline-flex; align-items: center; gap: 6px; padding: 5px 12px;
          background: rgba(255,255,255,.12); border: 1px solid rgba(255,255,255,.2);
          border-radius: 100px; font-family: 'DM Sans', system-ui, sans-serif;
          font-size: 11px; font-weight: 500; letter-spacing: .08em;
          text-transform: uppercase; color: rgba(255,255,255,.75);
        }
        .auth-badge-dot { width: 6px; height: 6px; background: #F5C04F; border-radius: 50%; }
      `}</style>

      <div className="auth-font-sans flex min-h-screen bg-[#f4f6fb]">

        {/* ── LEFT PANEL ── */}
        <div className="relative hidden lg:flex lg:w-[42%] lg:flex-col lg:items-center lg:justify-center overflow-hidden">
          <Image src="/assets/almjhero2.png" alt="Alma Jordan Library" fill className="object-cover" priority />
          <div className="absolute inset-0 bg-gradient-to-br from-[#001635]/92 via-[#002160]/85 to-[#003595]/75" />

          <div className="relative z-10 max-w-sm px-10 text-white">
            <div className="auth-badge mb-8">
              <span className="auth-badge-dot" />
              UWI St. Augustine Campus
            </div>
            <h1 className="auth-font-display text-[48px] leading-[1.08] font-black">
              Start Your
              <br />
              <em className="text-[#F5C04F] not-italic">Study Journey.</em>
            </h1>
            <div className="auth-divider" />
            <p className="text-white/70 text-[15.5px] leading-relaxed font-light">
              Create your account to access room booking, schedules, and waitlist offers.
            </p>
            <div className="mt-10 space-y-3">
              {["Room Booking System", "Study Group Scheduling", "Waitlist Management"].map((item) => (
                <div key={item} className="flex items-center gap-3">
                  <div className="w-5 h-5 rounded-full bg-[#F5C04F]/20 border border-[#F5C04F]/40 flex items-center justify-center flex-shrink-0">
                    <div className="w-2 h-2 rounded-full bg-[#F5C04F]" />
                  </div>
                  <span className="text-white/70 text-sm font-light">{item}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── RIGHT PANEL ── */}
        <div className="flex w-full lg:w-[58%] items-center justify-center px-6 py-10 bg-white overflow-y-auto">
          <div className="w-full max-w-[440px]">

            <div className="afu afu-1 flex justify-center">
              <Image src="/assets/almajordanHeader.jpg" alt="UWI Alma Jordan Library" width={520} height={100} className="h-auto w-[340px]" priority />
            </div>

            <div className="afu afu-2 mt-5 text-center">
              <h2 className="auth-font-display text-[36px] font-black leading-tight text-[#0d1b2a]">Create Account</h2>
              <p className="mt-1.5 text-[14px] text-[#6b7b99] font-light">Use your official UWI credentials to register</p>
            </div>

            <form className="mt-7 space-y-3" onSubmit={onSubmit}>

              <div className="afu afu-3">
                <label className="block text-[12px] font-semibold text-[#1a2d4e] mb-1.5 tracking-widest uppercase">Full Name</label>
                <div className="auth-input-wrap">
                  <UserRound size={15} color="#9aaabb" />
                  <input placeholder="Your full name" value={fullName} onChange={(e) => setFullName(e.target.value)} autoComplete="name" required />
                </div>
              </div>

              <div className="afu afu-4">
                <label className="block text-[12px] font-semibold text-[#1a2d4e] mb-1.5 tracking-widest uppercase">Student / Staff ID</label>
                <div className="auth-input-wrap">
                  <IdCard size={15} color="#9aaabb" />
                  <input placeholder="e.g. 816012345" value={uwiId} onChange={(e) => setUwiId(e.target.value)} autoComplete="off" required />
                </div>
              </div>

              <div className="afu afu-5">
                <label className="block text-[12px] font-semibold text-[#1a2d4e] mb-1.5 tracking-widest uppercase">Phone Number</label>
                <div className="auth-input-wrap">
                  <Phone size={15} color="#9aaabb" />
                  <input placeholder="+1 (868) 000-0000" value={phone} onChange={(e) => setPhone(e.target.value)} autoComplete="tel" required />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="afu afu-6">
                  <label className="block text-[12px] font-semibold text-[#1a2d4e] mb-1.5 tracking-widest uppercase">Faculty</label>
                  <select className="auth-select" value={faculty} onChange={(e) => setFaculty(e.target.value)} required>
                    <option value="">Select faculty</option>
                    {FACULTY_OPTIONS.map((option) => (
                      <option key={option} value={option}>{option}</option>
                    ))}
                  </select>
                </div>
                <div className="afu afu-7">
                  <label className="block text-[12px] font-semibold text-[#1a2d4e] mb-1.5 tracking-widest uppercase">Status</label>
                  <select className="auth-select" value={academicStatus} onChange={(e) => setAcademicStatus(e.target.value)} required>
                    <option value="">Select status</option>
                    {ACADEMIC_STATUS_OPTIONS.map((option) => (
                      <option key={option} value={option}>{option}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="afu afu-8">
                <label className="block text-[12px] font-semibold text-[#1a2d4e] mb-1.5 tracking-widest uppercase">UWI Email</label>
                <div className="auth-input-wrap">
                  <Mail size={15} color="#9aaabb" />
                  <input placeholder="name@my.uwi.edu" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required />
                </div>
              </div>

              <div className="afu afu-9">
                <label className="block text-[12px] font-semibold text-[#1a2d4e] mb-1.5 tracking-widest uppercase">Password</label>
                <div className="auth-input-wrap">
                  <KeyRound size={15} color="#9aaabb" />
                  <input placeholder="Choose a secure password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" required />
                </div>
              </div>

              {error ? (
                <div className="afu rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-600 font-medium">
                  {error}
                </div>
              ) : null}

              <div className="afu afu-10 pt-1">
                <button className="auth-btn-primary" disabled={loading}>
                  <ArrowRight size={16} />
                  {loading ? "Creating Account…" : "Create Account"}
                </button>
              </div>
            </form>

            <p className="afu afu-10 mt-5 text-center text-[13.5px] text-[#6b7b99]">
              Already have an account?{" "}
              <Link href="/login" className="font-semibold text-[#003595] hover:opacity-75 transition-opacity">Login</Link>
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
