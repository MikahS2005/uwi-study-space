// src/app/(app)/super-admin/settings/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";

type SettingsRow = {
  id: number;

  student_booking_enabled: boolean;
  max_bookings_per_day: number;
  max_days_ahead: number;
  slot_minutes: number;

  waitlist_offer_minutes: number;

  no_show_threshold: number;
  no_show_window_days: number;
  no_show_ban_days: number;

  // Optional extra columns (if present in your DB, they’ll populate)
  max_booking_window_days?: number;
  max_booking_duration_hours?: number;
  max_consecutive_hours?: number;

  updated_at: string;
};

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-slate-900">{label}</div>
          {hint ? <div className="mt-1 text-xs text-slate-600">{hint}</div> : null}
        </div>
        <div className="min-w-[160px]">{children}</div>
      </div>
    </div>
  );
}

export default function SuperAdminSettingsPage() {
  const [settings, setSettings] = useState<SettingsRow | null>(null);
  const [loading, setLoading] = useState(true);

  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  // Local editable state
  const [form, setForm] = useState({
    student_booking_enabled: true,
    max_bookings_per_day: 2,
    max_days_ahead: 7,
    slot_minutes: 60,

    waitlist_offer_minutes: 30,

    no_show_threshold: 3,
    no_show_window_days: 30,
    no_show_ban_days: 14,

    max_booking_window_days: 7,
    max_booking_duration_hours: 3,
    max_consecutive_hours: 3,
  });

  async function load() {
    setLoading(true);
    setMsg(null);

    const r = await fetch("/api/super-admin/settings");
    const j = await r.json().catch(() => ({}));

    if (!r.ok) {
      setSettings(null);
      setLoading(false);
      setMsg({ kind: "err", text: j.error ?? "Failed to load settings" });
      return;
    }

    const s = (j.settings ?? null) as SettingsRow | null;
    setSettings(s);

    if (s) {
      setForm({
        student_booking_enabled: Boolean(s.student_booking_enabled),
        max_bookings_per_day: Number(s.max_bookings_per_day),
        max_days_ahead: Number(s.max_days_ahead),
        slot_minutes: Number(s.slot_minutes),

        waitlist_offer_minutes: Number(s.waitlist_offer_minutes),

        no_show_threshold: Number(s.no_show_threshold),
        no_show_window_days: Number(s.no_show_window_days),
        no_show_ban_days: Number(s.no_show_ban_days),

        max_booking_window_days: Number(s.max_booking_window_days ?? s.max_days_ahead ?? 7),
        max_booking_duration_hours: Number(s.max_booking_duration_hours ?? 3),
        max_consecutive_hours: Number(s.max_consecutive_hours ?? 3),
      });
    }

    setLoading(false);
  }

  useEffect(() => {
    load().catch(() => setLoading(false));
  }, []);

  const dirty = useMemo(() => {
    if (!settings) return false;

    const baseline = {
      student_booking_enabled: Boolean(settings.student_booking_enabled),
      max_bookings_per_day: Number(settings.max_bookings_per_day),
      max_days_ahead: Number(settings.max_days_ahead),
      slot_minutes: Number(settings.slot_minutes),

      waitlist_offer_minutes: Number(settings.waitlist_offer_minutes),

      no_show_threshold: Number(settings.no_show_threshold),
      no_show_window_days: Number(settings.no_show_window_days),
      no_show_ban_days: Number(settings.no_show_ban_days),

      max_booking_window_days: Number(settings.max_booking_window_days ?? settings.max_days_ahead ?? 7),
      max_booking_duration_hours: Number(settings.max_booking_duration_hours ?? 3),
      max_consecutive_hours: Number(settings.max_consecutive_hours ?? 3),
    };

    return JSON.stringify(baseline) !== JSON.stringify(form);
  }, [settings, form]);

  async function save() {
    setSaving(true);
    setMsg(null);

    const r = await fetch("/api/super-admin/settings/update", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });

    const j = await r.json().catch(() => ({}));

    if (!r.ok) {
      setSaving(false);
      setMsg({ kind: "err", text: j.error ?? "Failed to save settings" });
      return;
    }

    setMsg({ kind: "ok", text: "Settings saved." });
    setSaving(false);
    await load();
  }

  if (loading) {
    return (
      <div className="rounded-2xl bg-white p-6 ring-1 ring-slate-200">
        <div className="h-6 w-40 rounded bg-slate-200" />
        <div className="mt-4 h-20 w-full rounded bg-slate-200" />
        <div className="mt-3 h-20 w-full rounded bg-slate-200" />
        <div className="mt-3 h-20 w-full rounded bg-slate-200" />
      </div>
    );
  }

  return (
    <div className="rounded-2xl bg-white p-6 ring-1 ring-slate-200">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-lg font-semibold text-slate-900">Settings</h1>
          <p className="mt-1 text-sm text-slate-600">
            Booking and enforcement rules used across the app.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {dirty ? (
            <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-medium text-amber-700 ring-1 ring-amber-100">
              Unsaved changes
            </span>
          ) : (
            <span className="rounded-full bg-slate-50 px-3 py-1 text-xs font-medium text-slate-700 ring-1 ring-slate-200">
              Up to date
            </span>
          )}

          <button
            onClick={save}
            disabled={!dirty || saving}
            className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
          >
            {saving ? "Saving..." : "Save Settings"}
          </button>
        </div>
      </div>

      {msg ? (
        <div
          className={[
            "mt-4 rounded-xl px-4 py-3 text-sm ring-1",
            msg.kind === "ok"
              ? "bg-emerald-50 text-emerald-800 ring-emerald-100"
              : "bg-red-50 text-red-800 ring-red-100",
          ].join(" ")}
        >
          {msg.text}
        </div>
      ) : null}

      <div className="mt-5 grid grid-cols-1 gap-3 lg:grid-cols-2">
        <Field
          label="Student self-booking enabled"
          hint="If disabled, students cannot create their own bookings (admins/super admins still can)."
        >
          <label className="flex items-center justify-end gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={form.student_booking_enabled}
              onChange={(e) => setForm((p) => ({ ...p, student_booking_enabled: e.target.checked }))}
            />
            Enabled
          </label>
        </Field>

        <Field label="Slot length (minutes)" hint="Booking slots must match this exact duration.">
          <input
            type="number"
            min={15}
            step={15}
            value={form.slot_minutes}
            onChange={(e) => setForm((p) => ({ ...p, slot_minutes: Number(e.target.value) }))}
            className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
          />
        </Field>

        <Field label="Max bookings per day" hint="Per user, per calendar day.">
          <input
            type="number"
            min={0}
            max={10}
            value={form.max_bookings_per_day}
            onChange={(e) => setForm((p) => ({ ...p, max_bookings_per_day: Number(e.target.value) }))}
            className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
          />
        </Field>

   {/*     <Field label="Max days ahead" hint="How far into the future a user can book.">
          <input
            type="number"
            min={0}
            max={30}
            value={form.max_days_ahead}
            onChange={(e) => setForm((p) => ({ ...p, max_days_ahead: Number(e.target.value) }))}
            className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
          />
        </Field> */}

        <Field label="Waitlist offer expiry (minutes)" hint="How long a user has to accept an offered slot.">
          <input
            type="number"
            min={5}
            max={240}
            value={form.waitlist_offer_minutes}
            onChange={(e) => setForm((p) => ({ ...p, waitlist_offer_minutes: Number(e.target.value) }))}
            className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
          />
        </Field>

        <Field label="No-show threshold" hint="No-shows within the rolling window before a temporary ban.">
          <input
            type="number"
            min={0}
            max={20}
            value={form.no_show_threshold}
            onChange={(e) => setForm((p) => ({ ...p, no_show_threshold: Number(e.target.value) }))}
            className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
          />
        </Field>

        <Field label="No-show rolling window (days)" hint="How far back we count no-shows.">
          <input
            type="number"
            min={1}
            max={365}
            value={form.no_show_window_days}
            onChange={(e) => setForm((p) => ({ ...p, no_show_window_days: Number(e.target.value) }))}
            className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
          />
        </Field>

        <Field label="No-show ban duration (days)" hint="Length of ban after crossing threshold.">
          <input
            type="number"
            min={0}
            max={365}
            value={form.no_show_ban_days}
            onChange={(e) => setForm((p) => ({ ...p, no_show_ban_days: Number(e.target.value) }))}
            className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
          />
        </Field>

        {/* Optional advanced limits (only if you're using them in validateBookingOrThrow) */}
        <Field label="Max booking window (days)" hint="Alternative cap used by some UIs (optional).">
          <input
            type="number"
            min={0}
            max={30}
            value={form.max_booking_window_days}
            onChange={(e) => setForm((p) => ({ ...p, max_booking_window_days: Number(e.target.value) }))}
            className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
          />
        </Field>

        <Field label="Max booking duration (hours)" hint="Hard cap for a single booking length (optional).">
          <input
            type="number"
            min={1}
            max={8}
            value={form.max_booking_duration_hours}
            onChange={(e) =>
              setForm((p) => ({ ...p, max_booking_duration_hours: Number(e.target.value) }))
            }
            className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
          />
        </Field>

        <Field label="Max consecutive hours" hint="Max back-to-back booking duration (optional).">
          <input
            type="number"
            min={1}
            max={8}
            value={form.max_consecutive_hours}
            onChange={(e) => setForm((p) => ({ ...p, max_consecutive_hours: Number(e.target.value) }))}
            className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
          />
        </Field>
      </div>

      <div className="mt-6 text-xs text-slate-500">
        Last updated: {settings?.updated_at ? new Date(settings.updated_at).toLocaleString() : "—"}
      </div>
    </div>
  );
}