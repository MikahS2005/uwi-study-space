"use client";

import { getPublicAppOrigin } from "@/lib/utils/publicOrigin";
import { useState } from "react";
import { useRouter } from "next/navigation";
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

    if (!fullName.trim()) {
      setError("Full name is required.");
      return;
    }

    if (!uwiId.trim()) {
      setError("Student / staff ID is required.");
      return;
    }

    if (!phone.trim()) {
      setError("Phone number is required.");
      return;
    }

    if (!faculty) {
      setError("Faculty is required.");
      return;
    }

    if (!academicStatus) {
      setError("Academic status is required.");
      return;
    }

    const role = inferRole(normalizedEmail);

    setLoading(true);

    const { error } = await supabase.auth.signUp({
      email: normalizedEmail,
      password,
      options: {
        data: {
          full_name: fullName.trim(),
          uwi_id: uwiId.trim(),
          phone: phone.trim(),
          faculty,
          academic_status: academicStatus,
          role,
        },
        emailRedirectTo: `${getPublicAppOrigin()}/auth/callback?next=/auth/continue`,
      },
    });

    setLoading(false);

    if (error) {
      setError(error.message);
      return;
    }

    router.push("/verify");
    router.refresh();
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
          required
        />

        <input
          className="w-full rounded border px-3 py-2"
          placeholder="Student / Staff ID"
          value={uwiId}
          onChange={(e) => setUwiId(e.target.value)}
          autoComplete="off"
          required
        />

        <input
          className="w-full rounded border px-3 py-2"
          placeholder="Phone number"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          autoComplete="tel"
          required
        />

        <select
          className="w-full rounded border px-3 py-2"
          value={faculty}
          onChange={(e) => setFaculty(e.target.value)}
          required
        >
          <option value="">Select faculty</option>
          {FACULTY_OPTIONS.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>

        <select
          className="w-full rounded border px-3 py-2"
          value={academicStatus}
          onChange={(e) => setAcademicStatus(e.target.value)}
          required
        >
          <option value="">Select academic status</option>
          {ACADEMIC_STATUS_OPTIONS.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>

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