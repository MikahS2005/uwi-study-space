"use client";

/**
 * Complete Profile Page
 * ---------------------------------------------------------------------------
 * Purpose:
 * - Force users to complete any missing required profile fields
 * - Works for both student and staff users
 * - Leaves role/account_status managed by server-side flows
 */

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowser } from "@/lib/supabase/client";
import {
  FACULTY_OPTIONS,
  ACADEMIC_STATUS_OPTIONS,
  type AcademicStatusOption,
} from "@/lib/profile/options";

type ProfileRow = {
  id: string;
  email: string;
  full_name: string | null;
  uwi_id: string | null;
  phone: string | null;
  faculty: string | null;
  academic_status: AcademicStatusOption | null;
  role: "student" | "staff" | "admin" | "super_admin" | null;
  account_status: "pending_verification" | "active" | "suspended" | null;
};

function clean(str: string) {
  return str.trim().replace(/\s+/g, " ");
}

export default function CompleteProfilePage() {
  const router = useRouter();
  const supabase = useMemo(() => createSupabaseBrowser(), []);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [email, setEmail] = useState("");
  const [role, setRole] = useState<string>("");
  const [accountStatus, setAccountStatus] = useState<string>("");

  const [fullName, setFullName] = useState("");
  const [uwiId, setUwiId] = useState("");
  const [phone, setPhone] = useState("");
  const [faculty, setFaculty] = useState("");
  const [academicStatus, setAcademicStatus] = useState("");

  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    async function boot() {
      setLoading(true);
      setError(null);

      const {
        data: { user },
        error: authErr,
      } = await supabase.auth.getUser();

      if (!mounted) return;

      if (authErr || !user) {
        router.replace("/login?next=/complete-profile");
        return;
      }

      setEmail(user.email ?? "");

      const { data: profile, error: profErr } = await supabase
        .from("profiles")
        .select(
          "id, email, full_name, uwi_id, phone, faculty, academic_status, role, account_status"
        )
        .eq("id", user.id)
        .maybeSingle();

      if (!mounted) return;

      if (profErr) {
        setError(profErr.message);
        setLoading(false);
        return;
      }

      if (profile) {
        const p = profile as ProfileRow;
        setFullName(p.full_name ?? "");
        setUwiId(p.uwi_id ?? "");
        setPhone(p.phone ?? "");
        setFaculty(p.faculty ?? "");
        setAcademicStatus(p.academic_status ?? "");
        setRole(p.role ?? "");
        setAccountStatus(p.account_status ?? "");
      }

      setLoading(false);
    }

    boot();

    return () => {
      mounted = false;
    };
  }, [router, supabase]);

  async function onSave(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const full_name = clean(fullName);
    const uwi_id = clean(uwiId);
    const phone_clean = clean(phone);
    const faculty_clean = clean(faculty);

    if (!full_name) {
      setError("Full name is required.");
      return;
    }

    if (!uwi_id) {
      setError("UWI ID / Staff ID is required.");
      return;
    }

    if (!phone_clean) {
      setError("Phone number is required.");
      return;
    }

    if (!faculty_clean) {
      setError("Faculty is required.");
      return;
    }

    if (!academicStatus) {
      setError("Academic status is required.");
      return;
    }

    setSaving(true);

    const {
      data: { user },
      error: authErr,
    } = await supabase.auth.getUser();

    if (authErr || !user) {
      setSaving(false);
      router.replace("/login?next=/complete-profile");
      return;
    }

    const { error: upsertErr } = await supabase.from("profiles").upsert(
      {
        id: user.id,
        email: (user.email ?? "").toLowerCase(),
        full_name,
        uwi_id,
        phone: phone_clean || null,
        faculty: faculty_clean || null,
        academic_status: academicStatus || null,
      },
      { onConflict: "id" }
    );

    setSaving(false);

    if (upsertErr) {
      setError(upsertErr.message);
      return;
    }

    // Let the server-side continue route decide where they belong
    router.replace("/auth/continue");
    router.refresh();
  }

  if (loading) {
    return (
      <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
        <div className="h-6 w-48 rounded bg-slate-200" />
        <div className="mt-3 h-4 w-72 rounded bg-slate-200" />
        <div className="mt-6 space-y-3">
          <div className="h-10 w-full rounded bg-slate-200" />
          <div className="h-10 w-full rounded bg-slate-200" />
          <div className="h-10 w-full rounded bg-slate-200" />
          <div className="h-10 w-full rounded bg-slate-200" />
          <div className="h-10 w-full rounded bg-slate-200" />
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
      <h1 className="text-lg font-semibold text-slate-900">Complete Profile</h1>
      <p className="mt-1 text-sm text-slate-600">
        This is required before booking rooms. Please confirm your details.
      </p>

      <form className="mt-6 space-y-4" onSubmit={onSave}>
        <div>
          <label className="block text-sm font-medium text-slate-700">Email</label>
          <input
            className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700"
            value={email}
            disabled
          />
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="block text-sm font-medium text-slate-700">Role</label>
            <input
              className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700"
              value={role || "Not set"}
              disabled
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700">Account status</label>
            <input
              className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700"
              value={accountStatus || "Not set"}
              disabled
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700">Full name *</label>
          <input
            className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
            placeholder="e.g., Mikah Stroude"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            autoComplete="name"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700">UWI ID / Staff ID *</label>
          <input
            className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
            placeholder="e.g., 8160XXXX"
            value={uwiId}
            onChange={(e) => setUwiId(e.target.value)}
            required
          />
          <p className="mt-1 text-xs text-slate-500">
            This is used for admin search and booking verification.
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700">Phone *</label>
          <input
            className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
            placeholder="e.g., 868-555-1234"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            autoComplete="tel"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700">Faculty *</label>
          <select
            className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
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
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700">Academic status *</label>
          <select
            className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
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
        </div>

        {error ? (
          <div className="rounded-xl bg-red-50 p-3 text-sm text-red-700 ring-1 ring-red-100">
            {error}
          </div>
        ) : null}

        <button
          className="w-full rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
          disabled={saving}
        >
          {saving ? "Saving..." : "Save and Continue"}
        </button>
      </form>
    </div>
  );
}