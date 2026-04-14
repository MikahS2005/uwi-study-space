// src/components/bookings/BookingsFilterBar.tsx
"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { FiCheckCircle, FiClock, FiRotateCw } from "react-icons/fi";

type WhenFilter   = "upcoming" | "past" | "all";
type StatusFilter = "all" | "active" | "cancelled" | "completed" | "no_show";

function ChevronDown() {
  return (
    <svg
      className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
      fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
    </svg>
  );
}

export default function BookingsFilterBar(props: {
  counts: { total: number; active: number; cancelled: number; completed: number; no_show: number };
}) {
  const router = useRouter();
  const sp     = useSearchParams();

  const when   = (sp.get("when")   as WhenFilter)   ?? "upcoming";
  const status = (sp.get("status") as StatusFilter) ?? "all";

  const isActiveOnly = status === "active";

  function pushWith(updates: (params: URLSearchParams) => void) {
    const params = new URLSearchParams(sp.toString());
    updates(params);
    params.delete("view");
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

  return (
    <section className="rounded-[28px] border border-[#E5E7EB] bg-white p-4 shadow-sm md:p-5">
      <div className="space-y-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-base font-semibold text-[#1F2937]">Filters</h2>
            <p className="text-sm text-slate-500">
              Narrow bookings by timeline and status.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <p className="rounded-full bg-[#EAF6FF] px-2.5 py-1 text-xs font-semibold text-[#003595]">
              {props.counts.total} total
            </p>
            <button
              type="button"
              onClick={() => router.push("/bookings")}
              className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 text-sm font-medium text-slate-600 transition hover:bg-slate-50"
            >
              <FiRotateCw className="h-3.5 w-3.5" />
              Reset
            </button>
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">

          <div>
            <label className="mb-1.5 block text-xs font-medium uppercase tracking-[0.16em] text-slate-500">
              When
            </label>
            <div className="relative flex items-center rounded-xl border border-[#E5E7EB] bg-[#F9FAFB] px-3 focus-within:border-[#003595] focus-within:bg-white">
              <FiClock className="h-4 w-4 shrink-0 text-[#003595]/55" />
              <select
                value={when}
                onChange={(e) =>
                  pushWith((p) => {
                    const v = e.target.value;
                    if (v === "upcoming") p.delete("when");
                    else p.set("when", v);
                  })
                }
                className="h-10 w-full appearance-none bg-transparent px-3 pr-7 text-sm text-[#1F2937] outline-none"
              >
                <option value="upcoming">Upcoming</option>
                <option value="past">Past</option>
                <option value="all">All time</option>
              </select>
              <ChevronDown />
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium uppercase tracking-[0.16em] text-slate-500">
              Status
            </label>
            <div className="relative flex items-center rounded-xl border border-[#E5E7EB] bg-[#F9FAFB] px-3 focus-within:border-[#003595] focus-within:bg-white">
              <FiCheckCircle className="h-4 w-4 shrink-0 text-[#003595]/55" />
              <select
                value={status}
                onChange={(e) =>
                  pushWith((p) => {
                    const v = e.target.value;
                    if (v === "all") p.delete("status");
                    else p.set("status", v);
                  })
                }
                className="h-10 w-full appearance-none bg-transparent px-3 pr-7 text-sm text-[#1F2937] outline-none"
              >
                <option value="all">All statuses</option>
                <option value="active">Active</option>
                <option value="cancelled">Cancelled</option>
                <option value="completed">Completed</option>
                <option value="no_show">No-show</option>
              </select>
              <ChevronDown />
            </div>
          </div>

          <div className="flex items-end">
            <button
              type="button"
              onClick={toggleActiveOnly}
              className={[
                "inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl border px-3.5 text-sm font-medium transition-all",
                isActiveOnly
                  ? "border-[#003595] bg-[#003595] text-white"
                  : "border-[#E5E7EB] bg-[#F9FAFB] text-slate-600 hover:border-[#003595]/30 hover:text-[#003595]",
              ].join(" ")}
            >
              <span className={[
                "h-2 w-2 rounded-full",
                isActiveOnly ? "bg-emerald-300" : "bg-slate-300",
              ].join(" ")} />
              {isActiveOnly ? "Active only" : "Show active only"}
            </button>
          </div>

          <div className="flex items-end">
            <button
              type="button"
              onClick={() => pushWith(() => {})}
              className="inline-flex h-10 w-full items-center justify-center rounded-xl bg-[#003595] px-4 text-sm font-semibold text-white transition-colors hover:bg-[#002366]"
            >
              Apply filters
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
