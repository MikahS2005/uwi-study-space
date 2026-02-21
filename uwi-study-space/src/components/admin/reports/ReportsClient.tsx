"use client";

import { useEffect, useMemo, useState } from "react";

type Mode = "admin" | "super_admin";

type ReportResponse = {
  range: { from: string; to: string };
  scope: { mode: Mode; allowedRoomCount: number | null };
  bookings: {
    total: number;
    byStatus: Record<string, number>;
  };
  waitlist: {
    total: number;
    byStatus: Record<string, number>;
  };
};

const CAMPUS_TZ = "America/Port_of_Spain";

function ymdTodayTT() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: CAMPUS_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());

  const yyyy = parts.find((p) => p.type === "year")?.value ?? "1970";
  const mm = parts.find((p) => p.type === "month")?.value ?? "01";
  const dd = parts.find((p) => p.type === "day")?.value ?? "01";
  return `${yyyy}-${mm}-${dd}`;
}

function cardClass() {
  return "rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200";
}

export default function ReportsClient({ mode }: { mode: Mode }) {
  const today = useMemo(() => ymdTodayTT(), []);
  const [from, setFrom] = useState(today);
  const [to, setTo] = useState(today);

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [data, setData] = useState<ReportResponse | null>(null);

  async function fetchReports() {
    setLoading(true);
    setErr("");

    const sp = new URLSearchParams();
    sp.set("from", from);
    sp.set("to", to);

    try {
      const res = await fetch(`/api/admin/reports?${sp.toString()}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error ?? "Failed to load reports");
      setData(json as ReportResponse);
    } catch (e: any) {
      setErr(e?.message ?? "Failed to load reports");
      setData(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchReports();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const title = mode === "super_admin" ? "Reports (Super Admin)" : "Reports";

  return (
    <div className="space-y-4">
      <div className={cardClass()}>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-lg font-semibold text-slate-900">{title}</h1>
            <p className="text-sm text-slate-600">
              Summary counts for bookings and waitlist. Date range uses the report window.
            </p>
          </div>

          <div className="flex flex-wrap items-end gap-2">
            <div>
              <label className="block text-xs font-medium text-slate-600">From</label>
              <input
                type="date"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
                className="mt-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none ring-blue-200 focus:ring-2"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-600">To</label>
              <input
                type="date"
                value={to}
                onChange={(e) => setTo(e.target.value)}
                className="mt-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none ring-blue-200 focus:ring-2"
              />
            </div>

            <button
              onClick={() => fetchReports()}
              className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
            >
              Apply
            </button>
          </div>
        </div>

        {err ? (
          <div className="mt-4 rounded-xl bg-rose-50 p-4 text-sm text-rose-700 ring-1 ring-rose-200">
            {err}
          </div>
        ) : loading ? (
          <div className="mt-4 rounded-xl bg-slate-50 p-4 text-sm text-slate-600 ring-1 ring-slate-200">
            Loading…
          </div>
        ) : data ? (
          <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-200">
              <div className="text-xs font-medium text-slate-600">Bookings (Total)</div>
              <div className="mt-1 text-2xl font-semibold text-slate-900">{data.bookings.total}</div>
              <div className="mt-2 text-xs text-slate-500">
                Scope rooms:{" "}
                {data.scope.allowedRoomCount === null ? "All" : data.scope.allowedRoomCount}
              </div>
            </div>

            <div className="rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-200">
              <div className="text-xs font-medium text-slate-600">Waitlist (Total)</div>
              <div className="mt-1 text-2xl font-semibold text-slate-900">{data.waitlist.total}</div>
              <div className="mt-2 text-xs text-slate-500">
                Range: {data.range.from} → {data.range.to}
              </div>
            </div>

            <div className="rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-200 sm:col-span-2">
              <div className="text-xs font-medium text-slate-600">Bookings by Status</div>
              <div className="mt-2 grid grid-cols-2 gap-2">
                {Object.entries(data.bookings.byStatus).map(([k, v]) => (
                  <div key={k} className="rounded-xl bg-white px-3 py-2 ring-1 ring-slate-200">
                    <div className="text-xs text-slate-500">{k}</div>
                    <div className="text-lg font-semibold text-slate-900">{v}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-200 lg:col-span-4">
              <div className="text-xs font-medium text-slate-600">Waitlist by Status</div>
              <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
                {Object.entries(data.waitlist.byStatus).map(([k, v]) => (
                  <div key={k} className="rounded-xl bg-white px-3 py-2 ring-1 ring-slate-200">
                    <div className="text-xs text-slate-500">{k}</div>
                    <div className="text-lg font-semibold text-slate-900">{v}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}