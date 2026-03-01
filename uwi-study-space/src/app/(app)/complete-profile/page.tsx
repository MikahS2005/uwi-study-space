"use client";

/**
 * Complete Profile Page
 * ---------------------------------------------------------------------------
 * Purpose:
 * - Fix legacy users created before signup collected full_name + uwi_id.
 * - Force users to enter missing profile fields.
 *
 * Security:
 * - Uses Supabase client (RLS enforced).
 * - UPSERT is allowed ONLY for the authenticated user due to policies.
 */

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowser } from "@/lib/supabase/client";

type ProfileRow = {
  id: string;
  email: string;
  full_name: string | null;
  uwi_id: string | null;
  phone: string | null;
};

function clean(str: string) {
  return str.trim().replace(/\s+/g, " ");
}

export default function CompleteProfilePage() {
  const router = useRouter();
  const supabase = useMemo(() => createSupabaseBrowser(), []);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [email, setEmail] = useState<string>("");
  const [fullName, setFullName] = useState("");
  const [uwiId, setUwiId] = useState("");
  const [phone, setPhone] = useState("");

  const [error, setError] = useState<string | null>(null);

  // Load current user + existing profile (if any)
  useEffect(() => {
    let mounted = true;

    async function boot() {
      setLoading(true);
      setError(null);

      // 1) Must be logged in
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

      // 2) Fetch profile row (may not exist for some legacy flows)
      const { data: profile, error: profErr } = await supabase
        .from("profiles")
        .select("id, email, full_name, uwi_id, phone")
        .eq("id", user.id)
        .maybeSingle();

      if (!mounted) return;

      if (profErr) {
        setError(profErr.message);
        setLoading(false);
        return;
      }

      // Pre-fill if exists
      if (profile) {
        setFullName(profile.full_name ?? "");
        setUwiId(profile.uwi_id ?? "");
        setPhone(profile.phone ?? "");
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

    if (!full_name) {
      setError("Full name is required.");
      return;
    }
    if (!uwi_id) {
      setError("UWI ID / Staff ID is required.");
      return;
    }

    setSaving(true);

    // Must have user id to upsert correctly
    const {
      data: { user },
      error: authErr,
    } = await supabase.auth.getUser();

    if (authErr || !user) {
      setSaving(false);
      router.replace("/login?next=/complete-profile");
      return;
    }

    /**
     * UPSERT strategy:
     * - If profile exists: update missing fields
     * - If profile does not exist: insert a new row with id=auth.uid()
     *
     * NOTE:
     * - RLS policies must allow insert/update for own row.
     */
    const { error: upsertErr } = await supabase.from("profiles").upsert(
      {
        id: user.id,
        email: (user.email ?? "").toLowerCase(),
        full_name,
        uwi_id,
        phone: phone_clean || null,
      },
      { onConflict: "id" },
    );

    setSaving(false);

    if (upsertErr) {
      setError(upsertErr.message);
      return;
    }

    // Success -> send them back to the correct app entry point
    router.replace("/dashboard");
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
          <label className="block text-sm font-medium text-slate-700">Phone (optional)</label>
          <input
            className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
            placeholder="e.g., 868-555-1234"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            autoComplete="tel"
          />
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