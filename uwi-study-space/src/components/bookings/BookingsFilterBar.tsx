// src/components/bookings/BookingsFilterBar.tsx
"use client";
 
import { useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
 
type WhenFilter = "upcoming" | "past" | "all";
type StatusFilter = "all" | "active" | "cancelled" | "completed" | "no_show";
type ViewMode = "list" | "calendar";
 
// ── icons ───────────────────────────────────────────────────────────────────
function ListIcon() {
  return (
    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 10h16M4 14h16M4 18h16" />
    </svg>
  );
}
function CalendarIcon() {
  return (
    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}>
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M16 2v4M8 2v4M3 10h18" />
    </svg>
  );
}
function ChevronDown() {
  return (
    <svg className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
    </svg>
  );
}
 
// ── stat pill config ────────────────────────────────────────────────────────
const STAT_STYLES = {
  total:     { dot: "bg-blue-900",    pill: "bg-blue-50 text-blue-900 ring-1 ring-blue-200" },
  active:    { dot: "bg-emerald-500", pill: "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200" },
  cancelled: { dot: "bg-slate-400",   pill: "bg-slate-100 text-slate-600 ring-1 ring-slate-200" },
  completed: { dot: "bg-blue-700",    pill: "bg-blue-50 text-blue-800 ring-1 ring-blue-200" },
  no_show:   { dot: "bg-rose-400",    pill: "bg-rose-50 text-rose-700 ring-1 ring-rose-200" },
} as const;
 
export default function BookingsFilterBar(props: {
  counts: { total: number; active: number; cancelled: number; completed: number; no_show: number };
}) {
  const router = useRouter();
  const sp = useSearchParams();
 
  const when   = (sp.get("when")   as WhenFilter)   ?? "upcoming";
  const status = (sp.get("status") as StatusFilter) ?? "all";
  const view   = (sp.get("view")   as ViewMode)     ?? "list";
 
  const isActiveOnly = status === "active";
 
  function pushWith(updates: (params: URLSearchParams) => void) {
    const params = new URLSearchParams(sp.toString());
    updates(params);
    params.delete("page");
    const qs = params.toString();
    router.push(`/bookings${qs ? `?${qs}` : ""}`);
  }
 
  function toggleActiveOnly() {
    pushWith((params) => {
      if (isActiveOnly) params.delete("status");
      else params.set("status", "active");
    });
  }
 
  const statusChips = useMemo(() => {
    const c = props.counts;
    return [
      { key: "total"     as const, label: "Total",     value: c.total },
      { key: "active"    as const, label: "Active",    value: c.active },
      { key: "cancelled" as const, label: "Cancelled", value: c.cancelled },
      { key: "completed" as const, label: "Completed", value: c.completed },
      { key: "no_show"   as const, label: "No-show",   value: c.no_show },
    ];
  }, [props.counts]);
 
  return (
    // ↓ FIX: was `rounded border` (no colour = black box). Now soft shadow + light ring.
    <div className="mt-4 overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-100">
 
      {/* ── Top row: view toggle + active-only ──────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 bg-slate-50/70 px-4 py-3">
 
        {/* Segmented view toggle */}
        <div className="inline-flex items-center gap-1 rounded-xl bg-slate-200/70 p-1">
          <button
            type="button"
            onClick={() => pushWith((p) => p.set("view", "list"))}
            className={[
              "flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-sm font-semibold transition-all duration-150",
              view === "list"
                ? "bg-blue-900 text-white shadow-sm"
                : "text-slate-500 hover:text-slate-800",
            ].join(" ")}
          >
            <ListIcon />
            List
          </button>
          <button
            type="button"
            onClick={() => pushWith((p) => p.set("view", "calendar"))}
            className={[
              "flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-sm font-semibold transition-all duration-150",
              view === "calendar"
                ? "bg-blue-900 text-white shadow-sm"
                : "text-slate-500 hover:text-slate-800",
            ].join(" ")}
          >
            <CalendarIcon />
            Calendar
          </button>
        </div>
 
        {/* Active-only toggle */}
        <button
          type="button"
          onClick={toggleActiveOnly}
          className={[
            "flex items-center gap-2 rounded-xl border px-3.5 py-2 text-xs font-semibold transition-all duration-150",
            isActiveOnly
              ? "border-blue-800 bg-blue-900 text-white"
              : "border-slate-200 bg-white text-slate-600 hover:border-blue-200 hover:text-blue-900",
          ].join(" ")}
        >
          <span className={[
            "h-2 w-2 rounded-full transition-colors",
            isActiveOnly ? "bg-emerald-400" : "bg-slate-300",
          ].join(" ")} />
          {isActiveOnly ? "Showing active only" : "Show active only"}
        </button>
      </div>
 
      {/* ── Middle row: stat chips ───────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 px-4 py-3">
        {statusChips.map((x) => {
          const s = STAT_STYLES[x.key];
          return (
            <span key={x.key} className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${s.pill}`}>
              <span className={`h-1.5 w-1.5 rounded-full ${s.dot}`} />
              {x.label}: <span className="font-bold">{x.value}</span>
            </span>
          );
        })}
      </div>
 
      {/* ── Bottom row: filters ──────────────────────────────────────────── */}
      <div className="flex flex-wrap items-end gap-3 px-4 py-3">
 
        {/* When */}
        <div className="flex flex-col gap-1">
          <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
            When
          </label>
          <div className="relative">
            <select
              value={when}
              onChange={(e) =>
                pushWith((p) => {
                  const v = e.target.value;
                  if (v === "upcoming") p.delete("when");
                  else p.set("when", v);
                })
              }
              className="h-9 w-40 appearance-none rounded-xl border border-slate-200 bg-white pl-3 pr-9 text-sm font-medium text-blue-900 shadow-sm transition focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100 hover:border-slate-300"
            >
              <option value="upcoming">⏳  Upcoming</option>
              <option value="past">🕐  Past</option>
              <option value="all">📋  All time</option>
            </select>
            <ChevronDown />
          </div>
        </div>
 
        {/* Status */}
        <div className="flex flex-col gap-1">
          <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
            Status
          </label>
          <div className="relative">
            <select
              value={status}
              onChange={(e) =>
                pushWith((p) => {
                  const v = e.target.value;
                  if (v === "all") p.delete("status");
                  else p.set("status", v);
                })
              }
              className="h-9 w-44 appearance-none rounded-xl border border-slate-200 bg-white pl-3 pr-9 text-sm font-medium text-blue-900 shadow-sm transition focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100 hover:border-slate-300"
            >
              <option value="all">All statuses</option>
              <option value="active">🟢  Active</option>
              <option value="cancelled">⚫  Cancelled</option>
              <option value="completed">🔵  Completed</option>
              <option value="no_show">🔴  No-show</option>
            </select>
            <ChevronDown />
          </div>
        </div>
 
        {/* Reset */}
        <button
          type="button"
          onClick={() => router.push("/bookings")}
          className="ml-auto flex h-9 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 text-xs font-semibold text-slate-500 shadow-sm transition hover:border-slate-300 hover:bg-slate-50 hover:text-slate-700"
        >
          {/* Refresh icon */}
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          Reset
        </button>
      </div>
    </div>
  );
}