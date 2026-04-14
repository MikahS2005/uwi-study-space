// src/components/bookings/MyOffersPanel.tsx
"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { FiBell, FiClock, FiGift, FiRefreshCw } from "react-icons/fi";
import { MdOutlineHourglassEmpty } from "react-icons/md";

const CAMPUS_TZ = "America/Port_of_Spain";

type Row = {
  id: number;
  room_id: number;
  start_time: string;
  end_time: string;
  status: "waiting" | "offered" | "accepted" | "expired";
  offer_expires_at: string | null;
  created_at: string;
  room: null | {
    id: number;
    name: string;
    building: string;
    floor: string | null;
    department: null | { name: string };
  };
};

function fmtDT(iso: string) {
  return new Date(iso).toLocaleString([], {
    timeZone: CAMPUS_TZ,
    month:    "short",
    day:      "numeric",
    hour:     "2-digit",
    minute:   "2-digit",
  });
}

function msLeft(expiresIso: string | null) {
  if (!expiresIso) return null;
  const t = Date.parse(expiresIso);
  if (Number.isNaN(t)) return null;
  return t - Date.now();
}

function fmtCountdown(ms: number) {
  if (ms <= 0) return "Expired";
  const totalSec = Math.floor(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

// ── icons ─────────────────────────────────────────────────────────────────────
function ClockIcon({ className }: { className?: string }) {
  return (
    <FiClock className={className ?? "h-4 w-4"} />
  );
}
function RefreshIcon() {
  return <FiRefreshCw className="h-3.5 w-3.5" />;
}

export default function MyOffersPanel() {
  const [rows,    setRows]    = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [err,     setErr]     = useState("");

  // ticking clock for countdown
  const [, setTick] = useState(0);

  async function load() {
    setLoading(true);
    setErr("");
    try {
      const res  = await fetch("/api/waitlist/my");
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error ?? "Failed to load waitlist");
      setRows(json.rows ?? []);
    } catch (e: any) {
      setErr(e?.message ?? "Failed to load waitlist");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  useEffect(() => {
    const id = window.setInterval(() => setTick((x) => x + 1), 1000);
    return () => window.clearInterval(id);
  }, []);

  const offered = useMemo(() => rows.filter((r) => r.status === "offered"), [rows]);
  const waiting = useMemo(() => rows.filter((r) => r.status === "waiting"), [rows]);

  async function accept(waitlistId: number) {
    if (!confirm("Accept this offer and create the booking?")) return;
    const res  = await fetch("/api/waitlist/accept", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ waitlistId }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) { alert(json?.error ?? "Accept failed"); return; }
    await load();
  }

  // ── loading ──────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="overflow-hidden rounded-2xl border border-[#E5E7EB] bg-white shadow-sm">
        <PanelHeader />
        <div className="flex items-center gap-3 px-5 py-6 text-sm text-slate-400">
          <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth={4} />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
          </svg>
          Loading…
        </div>
      </div>
    );
  }

  // ── error ─────────────────────────────────────────────────────────────────
  if (err) {
    return (
      <div className="overflow-hidden rounded-2xl border border-[#E5E7EB] bg-white shadow-sm">
        <PanelHeader onRefresh={load} />
        <div className="px-5 py-4">
          <div className="rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700 ring-1 ring-rose-200">
            {err}
          </div>
        </div>
      </div>
    );
  }

  // ── empty ─────────────────────────────────────────────────────────────────
  if (offered.length === 0 && waiting.length === 0) {
    return (
      <div className="overflow-hidden rounded-2xl border border-[#E5E7EB] bg-white shadow-sm">
        <PanelHeader onRefresh={load} />
        <div className="flex flex-col items-center gap-3 px-5 py-10 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-50 ring-1 ring-slate-200">
            <FiGift className="h-5 w-5 text-[#003595]" />
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-700">No active offers</p>
            <p className="mt-0.5 text-xs text-slate-400">
              When a space becomes available, it will appear here.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // ── content ───────────────────────────────────────────────────────────────
  return (
    <div className="overflow-hidden rounded-2xl border border-[#E5E7EB] bg-white shadow-sm">
      <PanelHeader onRefresh={load} />

      <div className="divide-y divide-slate-100">

        {/* Offered */}
        {offered.length > 0 && (
          <div className="px-5 py-4">
            <SectionLabel icon={<FiBell className="h-3.5 w-3.5" />} text="Offers" count={offered.length} />
            <div className="mt-3 space-y-3">
              {offered.map((r) => {
                const left     = msLeft(r.offer_expires_at);
                const roomName = r.room?.name ?? `Room #${r.room_id}`;
                const dept     = r.room?.department?.name;
                const isExpired = left !== null && left <= 0;
                const isUrgent  = left !== null && left > 0 && left < 60_000;

                return (
                  <div
                    key={r.id}
                    className={[
                      "overflow-hidden rounded-xl ring-1 transition",
                      isExpired
                        ? "bg-slate-50 ring-slate-200 opacity-60"
                        : isUrgent
                          ? "bg-rose-50 ring-rose-200"
                          : "bg-[#EAF6FF] ring-[#003595]/20",
                    ].join(" ")}
                  >
                    <div className="px-4 py-3">
                      {/* Room name + dept */}
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-bold text-[#003595]">{roomName}</p>
                          {dept && <p className="text-xs text-slate-500">{dept}</p>}
                        </div>
                        {/* Countdown */}
                        <div className={[
                          "flex shrink-0 flex-col items-center rounded-lg px-2.5 py-1.5 text-center ring-1",
                          isExpired  ? "bg-slate-100 ring-slate-200 text-slate-400"
                          : isUrgent ? "bg-rose-100 ring-rose-200 text-rose-700"
                          :            "bg-white ring-[#003595]/20 text-[#003595]",
                        ].join(" ")}>
                          <span className="text-[9px] font-bold uppercase tracking-widest opacity-60">Expires</span>
                          <span className="font-mono text-sm font-bold leading-tight">
                            {left === null ? "—" : fmtCountdown(left)}
                          </span>
                        </div>
                      </div>

                      {/* Time */}
                      <div className="mt-2 flex items-center gap-1.5 text-xs text-slate-500">
                        <ClockIcon className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                        <span className="font-mono">{fmtDT(r.start_time)} → {fmtDT(r.end_time)}</span>
                      </div>
                    </div>

                    {/* Accept footer */}
                    {!isExpired && (
                      <div className="border-t border-[#003595]/10 bg-white/60 px-4 py-2.5">
                        <button
                          onClick={() => accept(r.id)}
                          className="w-full rounded-lg bg-[#003595] py-2 text-xs font-bold text-white transition hover:bg-[#002366]"
                        >
                          Accept offer
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Waiting */}
        {waiting.length > 0 && (
          <div className="px-5 py-4">
            <SectionLabel icon={<MdOutlineHourglassEmpty className="h-3.5 w-3.5" />} text="Waiting" count={waiting.length} />
            <div className="mt-3 space-y-2">
              {waiting.map((r) => (
                <div key={r.id} className="rounded-xl bg-slate-50 px-4 py-3 ring-1 ring-slate-200">
                  <p className="text-sm font-semibold text-slate-700">
                    {r.room?.name ?? `Room #${r.room_id}`}
                  </p>
                  <div className="mt-1 flex items-center gap-1.5 text-xs text-slate-400">
                    <ClockIcon className="h-3.5 w-3.5 shrink-0" />
                    <span className="font-mono">{fmtDT(r.start_time)} → {fmtDT(r.end_time)}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── sub-components ────────────────────────────────────────────────────────────
function PanelHeader({ onRefresh }: { onRefresh?: () => void }) {
  return (
    <div className="flex items-center justify-between border-b border-[#E5E7EB] bg-[#F9FAFB] px-5 py-4">
      <div>
        <h2 className="text-lg font-bold text-[#1F2937]">Offers & Waitlist</h2>
        <p className="mt-0.5 text-sm text-slate-500">Accept an offer before the timer hits zero.</p>
        <div className="mt-1 flex items-center gap-2 text-xs font-semibold">
          <Link href="/waitlist?status=offered" className="text-[#003595] hover:underline">
            View offers
          </Link>
          <span className="text-slate-300">|</span>
          <Link href="/waitlist?status=waiting" className="text-[#003595] hover:underline">
            View waitlist
          </Link>
        </div>
      </div>
      {onRefresh && (
        <button
          onClick={onRefresh}
          className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-500 transition hover:bg-slate-50 hover:text-slate-700"
        >
          <RefreshIcon />
          Refresh
        </button>
      )}
    </div>
  );
}

function SectionLabel({ icon, text, count }: { icon: ReactNode; text: string; count: number }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-[#003595]">{icon}</span>
      <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500">{text}</span>
      <span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold text-slate-500">
        {count}
      </span>
    </div>
  );
}
