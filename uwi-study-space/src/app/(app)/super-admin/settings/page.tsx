"use client";

// src/app/(app)/super-admin/settings/page.tsx

import { useEffect, useMemo, useState } from "react";

/* ─────────────────────────────────────────────────────────────
   Types
───────────────────────────────────────────────────────────── */
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
  max_booking_window_days?: number;
  max_booking_duration_hours?: number;
  max_consecutive_hours?: number;
  updated_at: string;
};

/* ─────────────────────────────────────────────────────────────
   Shared primitives
───────────────────────────────────────────────────────────── */
function Spinner({
  light = false,
  size = 14,
}: {
  light?: boolean;
  size?: number;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      className="animate-spin shrink-0"
      aria-hidden="true"
    >
      <circle
        cx="12"
        cy="12"
        r="10"
        stroke={light ? "rgba(255,255,255,0.25)" : "rgba(0,53,149,0.15)"}
        strokeWidth="3"
      />
      <path
        d="M12 2a10 10 0 0 1 10 10"
        stroke={light ? "#fff" : "#003595"}
        strokeWidth="3"
        strokeLinecap="round"
      />
    </svg>
  );
}

/* ─────────────────────────────────────────────────────────────
   Field wrapper
───────────────────────────────────────────────────────────── */
function SettingField({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between py-4 border-b border-[#F3F4F6] last:border-0">
      <div className="flex-1 min-w-0 pr-4">
        <p className="text-sm font-semibold text-[#1F2937]">{label}</p>
        {hint && (
          <p className="mt-0.5 text-xs text-[#6B7280] leading-relaxed">
            {hint}
          </p>
        )}
      </div>
      <div className="shrink-0 sm:w-52">{children}</div>
    </div>
  );
}

function NumberInput({
  value,
  onChange,
  min,
  max,
  step = 1,
}: {
  value: number;
  onChange: (n: number) => void;
  min?: number;
  max?: number;
  step?: number;
}) {
  return (
    <input
      type="number"
      value={value}
      min={min}
      max={max}
      step={step}
      onChange={(e) => onChange(Number(e.target.value))}
      className="w-full rounded-lg border border-[#E5E7EB] bg-[#F9FAFB] px-3.5 py-2.5 text-sm text-[#1F2937] outline-none transition focus:border-[#003595] focus:ring-2 focus:ring-[#003595]/10 text-right"
    />
  );
}

function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) {
  return (
    <label className="flex cursor-pointer items-center justify-between rounded-lg border border-[#E5E7EB] bg-[#F9FAFB] px-3.5 py-2.5 hover:border-[#003595]/30 transition-colors">
      <span className="text-sm font-medium text-[#1F2937]">{label}</span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors ${
          checked ? "bg-[#003595]" : "bg-[#D1D5DB]"
        }`}
      >
        <span
          className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${
            checked ? "translate-x-4.5" : "translate-x-0.5"
          }`}
        />
      </button>
    </label>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-white rounded-xl border border-[#E5E7EB] shadow-sm overflow-hidden">
      <div className="px-5 py-3.5 border-b border-[#E5E7EB] bg-[#F9FAFB]">
        <h2 className="text-xs font-bold tracking-[0.12em] uppercase text-[#374151]">
          {title}
        </h2>
      </div>
      <div className="px-5">{children}</div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
   Main page
───────────────────────────────────────────────────────────── */
export default function SuperAdminSettingsPage() {
  const [settings, setSettings] = useState<SettingsRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(
    null,
  );

  const defaultForm = {
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
  };

  const [form, setForm] = useState(defaultForm);

  function set<K extends keyof typeof defaultForm>(
    key: K,
    val: (typeof defaultForm)[K],
  ) {
    setForm((p) => ({ ...p, [key]: val }));
  }

  async function load() {
    setLoading(true);
    setMsg(null);

    const r = await fetch("/api/super-admin/settings");
    const j = await r.json().catch(() => ({}));

    if (!r.ok) {
      setMsg({ kind: "err", text: j.error ?? "Failed to load settings." });
      setLoading(false);
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
        max_booking_window_days: Number(
          s.max_booking_window_days ?? s.max_days_ahead ?? 7,
        ),
        max_booking_duration_hours: Number(
          s.max_booking_duration_hours ?? 3,
        ),
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
      max_booking_window_days: Number(
        settings.max_booking_window_days ?? settings.max_days_ahead ?? 7,
      ),
      max_booking_duration_hours: Number(
        settings.max_booking_duration_hours ?? 3,
      ),
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
      setMsg({ kind: "err", text: j.error ?? "Failed to save." });
      setSaving(false);
      return;
    }

    setMsg({ kind: "ok", text: "Settings saved successfully." });
    setSaving(false);
    await load();
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F9FAFB]">
        <div className="bg-white border-b-2 border-[#003595]">
          <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
            <div className="h-1 w-16 bg-[#003595] -mb-px" />
            <div className="py-6 space-y-2 animate-pulse">
              <div className="h-3 w-40 rounded bg-[#F3F4F6]" />
              <div className="h-9 w-48 rounded bg-[#F3F4F6]" />
              <div className="h-4 w-72 rounded bg-[#F3F4F6]" />
            </div>
          </div>
        </div>
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 py-8 space-y-4 animate-pulse">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="bg-white rounded-xl border border-[#E5E7EB] h-48"
            />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F9FAFB]">
      <div className="bg-white border-b-2 border-[#003595]">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
          <div className="h-1 w-16 bg-[#003595] -mb-px" />
          <div className="py-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-[10px] font-semibold tracking-[0.2em] uppercase text-[#003595] mb-1.5">
                Super Admin — Configuration
              </p>
              <h1
                style={{ fontFamily: "Georgia, serif" }}
                className="text-3xl sm:text-4xl font-bold text-[#1F2937]"
              >
                Settings
              </h1>
              <p className="mt-1.5 text-sm text-[#6B7280] max-w-lg">
                Global booking rules and enforcement thresholds applied across
                the entire system.
              </p>
            </div>

            <div className="flex flex-col items-start sm:items-end gap-2 shrink-0">
              <nav className="flex items-center gap-1.5 text-xs text-[#9CA3AF]">
                <span>Super Admin</span>
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none">
                  <path
                    d="m9 18 6-6-6-6"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                <span className="font-semibold text-[#003595]">Settings</span>
              </nav>

              <button
                onClick={save}
                disabled={!dirty || saving}
                className="hidden sm:inline-flex items-center gap-2 rounded-lg bg-[#003595] px-4 py-2 text-sm font-bold text-white hover:bg-[#002366] disabled:opacity-50 transition-colors"
              >
                {saving ? (
                  <>
                    <Spinner light size={14} /> Saving…
                  </>
                ) : (
                  "Save Settings"
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {msg && (
          <div
            className={`flex items-start gap-2.5 rounded-xl border px-4 py-3.5 text-sm ${
              msg.kind === "ok"
                ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                : "border-red-200 bg-red-50 text-red-800"
            }`}
          >
            {msg.kind === "ok" ? (
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                className="mt-0.5 shrink-0 text-emerald-600"
              >
                <circle
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="2"
                />
                <path
                  d="m8 12 2.5 2.5L16 9"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            ) : (
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                className="mt-0.5 shrink-0 text-red-600"
              >
                <circle
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="2"
                />
                <path
                  d="M12 8v4M12 16h.01"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
              </svg>
            )}
            <p className="font-medium">{msg.text}</p>
          </div>
        )}

        {dirty && (
          <div className="flex items-center gap-2.5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            <svg
              width="15"
              height="15"
              viewBox="0 0 24 24"
              fill="none"
              className="shrink-0 text-amber-600"
            >
              <path
                d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinejoin="round"
              />
              <path
                d="M12 9v4M12 17h.01"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
            <span className="font-medium">You have unsaved changes.</span>
          </div>
        )}

        <Section title="Access & Availability">
          <SettingField
            label="Student self-booking"
            hint="When disabled, students cannot create bookings. Admins and super admins are unaffected."
          >
            <Toggle
              checked={form.student_booking_enabled}
              onChange={(v) => set("student_booking_enabled", v)}
              label={form.student_booking_enabled ? "Enabled" : "Disabled"}
            />
          </SettingField>

          <SettingField
            label="Slot duration (minutes)"
            hint="The length of each bookable time slot shown in the slot picker."
          >
            <NumberInput
              value={form.slot_minutes}
              onChange={(v) => set("slot_minutes", v)}
              min={15}
              max={120}
              step={15}
            />
          </SettingField>
        </Section>

        <Section title="Booking Limits">
          <SettingField
            label="Max bookings per day"
            hint="Maximum number of bookings a single student may make within one calendar day."
          >
            <NumberInput
              value={form.max_bookings_per_day}
              onChange={(v) => set("max_bookings_per_day", v)}
              min={0}
              max={10}
            />
          </SettingField>

          <SettingField
            label="Max booking window (days)"
            hint="Alternative advance-booking cap used by some interfaces."
          >
            <NumberInput
              value={form.max_booking_window_days}
              onChange={(v) => set("max_booking_window_days", v)}
              min={0}
              max={30}
            />
          </SettingField>

          <SettingField
            label="Max booking duration (hours)"
            hint="Hard upper limit on how long a single booking may run."
          >
            <NumberInput
              value={form.max_booking_duration_hours}
              onChange={(v) => set("max_booking_duration_hours", v)}
              min={1}
              max={8}
            />
          </SettingField>

          <SettingField
            label="Max consecutive hours"
            hint="Maximum number of back-to-back booking hours permitted per user."
          >
            <NumberInput
              value={form.max_consecutive_hours}
              onChange={(v) => set("max_consecutive_hours", v)}
              min={1}
              max={8}
            />
          </SettingField>
        </Section>

        <Section title="Waitlist">
          <SettingField
            label="Offer expiry (minutes)"
            hint="Time a student has to accept a waitlist offer before it is automatically rescinded."
          >
            <NumberInput
              value={form.waitlist_offer_minutes}
              onChange={(v) => set("waitlist_offer_minutes", v)}
              min={5}
              max={240}
            />
          </SettingField>
        </Section>

        <Section title="No-Show Enforcement">
          <SettingField
            label="No-show threshold"
            hint="Number of no-shows within the rolling window that triggers a temporary ban."
          >
            <NumberInput
              value={form.no_show_threshold}
              onChange={(v) => set("no_show_threshold", v)}
              min={1}
              max={20}
            />
          </SettingField>

          <SettingField
            label="Rolling window (days)"
            hint="How far back the system looks when counting no-shows against the threshold."
          >
            <NumberInput
              value={form.no_show_window_days}
              onChange={(v) => set("no_show_window_days", v)}
              min={1}
              max={365}
            />
          </SettingField>

          <SettingField
            label="Ban duration (days)"
            hint="Length of the booking suspension applied when a student crosses the threshold."
          >
            <NumberInput
              value={form.no_show_ban_days}
              onChange={(v) => set("no_show_ban_days", v)}
              min={0}
              max={365}
            />
          </SettingField>
        </Section>

        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pt-2">
          <p className="text-xs text-[#9CA3AF]">
            Last updated:{" "}
            {settings?.updated_at
              ? new Date(settings.updated_at).toLocaleString("en-US", {
                  dateStyle: "medium",
                  timeStyle: "short",
                })
              : "—"}
          </p>

          <button
            onClick={save}
            disabled={!dirty || saving}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-lg bg-[#003595] px-6 py-2.5 text-sm font-bold text-white hover:bg-[#002366] disabled:opacity-50 transition-colors"
          >
            {saving ? (
              <>
                <Spinner light size={14} /> Saving…
              </>
            ) : (
              "Save Settings"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}