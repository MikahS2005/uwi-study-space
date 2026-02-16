// src/components/bookings/BookingsFilterBar.tsx
"use client";

import { useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";

type WhenFilter = "upcoming" | "past" | "all";
type StatusFilter = "all" | "active" | "cancelled" | "completed" | "no_show";
type ViewMode = "list" | "calendar";

export default function BookingsFilterBar(props: {
  counts: { total: number; active: number; cancelled: number; completed: number; no_show: number };
}) {
  const router = useRouter();
  const sp = useSearchParams();

  const when = (sp.get("when") as WhenFilter) ?? "upcoming";
  const status = (sp.get("status") as StatusFilter) ?? "all";
  const view = (sp.get("view") as ViewMode) ?? "list";

  const isActiveOnly = status === "active";

  function pushWith(updates: (params: URLSearchParams) => void) {
    const params = new URLSearchParams(sp.toString());
    updates(params);

    // Any filter change resets pagination
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
      { key: "total", label: "Total", value: c.total },
      { key: "active", label: "Active", value: c.active },
      { key: "cancelled", label: "Cancelled", value: c.cancelled },
      { key: "completed", label: "Completed", value: c.completed },
      { key: "no_show", label: "No-show", value: c.no_show },
    ] as const;
  }, [props.counts]);

  return (
    <div className="mt-4 rounded border bg-white p-4">
      {/* View Toggle */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => pushWith((p) => p.set("view", "list"))}
            className={[
              "rounded-full px-4 py-2 text-sm font-medium",
              view === "list" ? "bg-black text-white" : "bg-gray-100 text-gray-800 hover:bg-gray-200",
            ].join(" ")}
          >
            List
          </button>
          <button
            type="button"
            onClick={() => pushWith((p) => p.set("view", "calendar"))}
            className={[
              "rounded-full px-4 py-2 text-sm font-medium",
              view === "calendar"
                ? "bg-black text-white"
                : "bg-gray-100 text-gray-800 hover:bg-gray-200",
            ].join(" ")}
          >
            Calendar
          </button>
        </div>

        {/* Quick toggle */}
        <button
          type="button"
          onClick={toggleActiveOnly}
          className={[
            "rounded-full px-4 py-2 text-sm font-medium",
            isActiveOnly ? "bg-green-600 text-white" : "bg-gray-100 text-gray-800 hover:bg-gray-200",
          ].join(" ")}
        >
          {isActiveOnly ? "Showing Active Only" : "Show Active Only"}
        </button>
      </div>

      {/* Count badges */}
      <div className="mb-4 flex flex-wrap gap-2">
        {statusChips.map((x) => (
          <span
            key={x.key}
            className="rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-800"
          >
            {x.label}: {x.value}
          </span>
        ))}
      </div>

      {/* Filters */}
      <div className="grid gap-3 md:grid-cols-3">
        <div>
          <label className="text-xs text-gray-600">When</label>
          <select
            className="mt-1 w-full rounded border px-3 py-2 text-sm"
            value={when}
            onChange={(e) =>
              pushWith((p) => {
                const v = e.target.value;
                if (v === "upcoming") p.delete("when");
                else p.set("when", v);
              })
            }
          >
            <option value="upcoming">Upcoming</option>
            <option value="past">Past</option>
            <option value="all">All</option>
          </select>
        </div>

        <div>
          <label className="text-xs text-gray-600">Status</label>
          <select
            className="mt-1 w-full rounded border px-3 py-2 text-sm"
            value={status}
            onChange={(e) =>
              pushWith((p) => {
                const v = e.target.value;
                if (v === "all") p.delete("status");
                else p.set("status", v);
              })
            }
          >
            <option value="all">All</option>
            <option value="active">Active</option>
            <option value="cancelled">Cancelled</option>
            <option value="completed">Completed</option>
            <option value="no_show">No-show</option>
          </select>
        </div>

        <div className="flex items-end">
          <button
            type="button"
            className="rounded border px-3 py-2 text-sm"
            onClick={() => router.push("/bookings")}
          >
            Reset
          </button>
        </div>
      </div>
    </div>
  );
}
