"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import ExpiryCountdown from "@/components/shared/ExpiryCountdown";
import { formatTtDateTime } from "@/lib/utils/datetime";
import { FiCheckCircle, FiClock, FiFilter, FiRefreshCw, FiSearch } from "react-icons/fi";

type Row = {
  id: number;
  room_id: number;
  start_time: string;
  end_time: string;
  status: "waiting" | "offered" | "accepted" | "expired";
  offer_expires_at: string | null;
  created_at: string;
  room: null | { id: number; name: string; building: string; floor: string | null; department_id: number };
};

type StatusFilter = "all" | "waiting" | "offered" | "accepted" | "expired";
type SortFilter = "start_asc" | "start_desc" | "created_desc";

const STATUS_STYLES: Record<Row["status"], string> = {
  waiting: "bg-amber-50 text-amber-700 ring-1 ring-amber-200",
  offered: "bg-[#EAF6FF] text-[#003595] ring-1 ring-[#003595]/20",
  accepted: "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200",
  expired: "bg-slate-100 text-slate-600 ring-1 ring-slate-200",
};

function asStatusFilter(value: string | null): StatusFilter {
  if (value === "waiting" || value === "offered" || value === "accepted" || value === "expired") {
    return value;
  }
  return "all";
}

function sortRows(rows: Row[], sortBy: SortFilter) {
  const copy = [...rows];
  if (sortBy === "start_asc") {
    copy.sort((a, b) => Date.parse(a.start_time) - Date.parse(b.start_time));
    return copy;
  }
  if (sortBy === "start_desc") {
    copy.sort((a, b) => Date.parse(b.start_time) - Date.parse(a.start_time));
    return copy;
  }
  copy.sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at));
  return copy;
}

export default function StudentWaitlistPage() {
  const sp = useSearchParams();

  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [err, setErr] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>(asStatusFilter(sp.get("status")));
  const [sortBy, setSortBy] = useState<SortFilter>("start_asc");
  const [query, setQuery] = useState("");

  useEffect(() => {
    setStatusFilter(asStatusFilter(sp.get("status")));
  }, [sp]);

  const stats = useMemo(() => {
    const total = rows.length;
    const waiting = rows.filter((r) => r.status === "waiting").length;
    const offered = rows.filter((r) => r.status === "offered").length;
    const accepted = rows.filter((r) => r.status === "accepted").length;
    return { total, waiting, offered, accepted };
  }, [rows]);

  const filteredRows = useMemo(() => {
    const q = query.trim().toLowerCase();
    const byStatus = statusFilter === "all" ? rows : rows.filter((r) => r.status === statusFilter);
    const bySearch = q
      ? byStatus.filter((r) => {
          const roomName = r.room?.name?.toLowerCase() ?? "";
          const building = r.room?.building?.toLowerCase() ?? "";
          return roomName.includes(q) || building.includes(q);
        })
      : byStatus;
    return sortRows(bySearch, sortBy);
  }, [rows, query, sortBy, statusFilter]);

  async function load() {
    setLoading(true);
    setErr("");
    try {
      const res = await fetch("/api/waitlist/my");
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

  async function refreshRows() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function accept(waitlistId: number) {
    const res = await fetch("/api/waitlist/accept", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ waitlistId }),
    });

    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      alert(json?.error ?? "Failed to accept offer");
      return;
    }

    await load();
    alert("Offer accepted! Booking created.");
  }

  return (
    <div className="min-h-screen bg-[#F9FAFB] px-4 py-8 font-sans">
      <div className="mx-auto max-w-7xl space-y-6">

          <div className="overflow-hidden rounded-2xl border border-[#E5E7EB] bg-white shadow-sm">
            <div className="px-6 py-5">
            <div>
              <p className="mb-1 text-[11px] font-bold uppercase tracking-[0.12em] text-[#003595]/70">
                Alma Jordan Library
              </p>
              <h1 className="text-4xl font-extrabold tracking-tight text-[#1F2937]">My Waitlist</h1>
              <p className="mt-1.5 text-sm font-medium text-[#4B5563]">
                Track your queue requests and accept offers before they expire.
              </p>
            </div>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-3xl border border-[#C7D5E6] bg-[#EAF2FC] px-5 py-4">
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#2F5AA7]">Total Entries</p>
              <p className="mt-2 font-serif text-4xl font-bold leading-none text-[#0B2A5B]">{stats.total}</p>
            </div>
            <div className="rounded-3xl border border-[#D8E0EA] bg-white px-5 py-4">
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#7C8CA0]">Waiting</p>
              <p className="mt-2 font-serif text-4xl font-bold leading-none text-[#0B2A5B]">{stats.waiting}</p>
            </div>
            <div className="rounded-3xl border border-[#D8E0EA] bg-white px-5 py-4">
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#7C8CA0]">Offered</p>
              <p className="mt-2 font-serif text-4xl font-bold leading-none text-[#0B2A5B]">{stats.offered}</p>
            </div>
            <div className="rounded-3xl border border-[#D8E0EA] bg-white px-5 py-4">
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#7C8CA0]">Accepted</p>
              <p className="mt-2 font-serif text-4xl font-bold leading-none text-[#0B2A5B]">{stats.accepted}</p>
            </div>
        </div>

        <section className="rounded-[28px] border border-[#E5E7EB] bg-white p-4 shadow-sm md:p-5">
          <div className="space-y-4">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <h2 className="text-base font-semibold text-[#1F2937]">Filters</h2>
                <p className="text-sm text-slate-500">
                  Narrow entries by status, time order, and room name.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setStatusFilter("all");
                    setSortBy("start_asc");
                    setQuery("");
                  }}
                  className="inline-flex h-9 items-center rounded-xl border border-[#E5E7EB] bg-white px-4 text-sm font-medium text-[#1F2937] transition-colors hover:bg-[#F9FAFB]"
                >
                  Reset
                </button>
                <button
                  type="button"
                  onClick={refreshRows}
                  disabled={refreshing || loading}
                  className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 text-sm font-medium text-slate-600 transition hover:bg-slate-50 disabled:opacity-60"
                >
                  <FiRefreshCw className={["h-3.5 w-3.5", refreshing ? "animate-spin" : ""].join(" ")} />
                  Refresh
                </button>
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <div>
                <label className="mb-1.5 block text-xs font-medium uppercase tracking-[0.16em] text-slate-500">Status</label>
                <div className="flex items-center rounded-xl border border-[#E5E7EB] bg-[#F9FAFB] px-3 focus-within:border-[#003595] focus-within:bg-white">
                  <FiCheckCircle className="h-4 w-4 shrink-0 text-[#003595]/55" />
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
                    className="h-10 w-full appearance-none bg-transparent px-3 text-sm text-[#1F2937] outline-none"
                  >
                    <option value="all">All statuses</option>
                    <option value="waiting">Waiting</option>
                    <option value="offered">Offered</option>
                    <option value="accepted">Accepted</option>
                    <option value="expired">Expired</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-medium uppercase tracking-[0.16em] text-slate-500">Sort</label>
                <div className="flex items-center rounded-xl border border-[#E5E7EB] bg-[#F9FAFB] px-3 focus-within:border-[#003595] focus-within:bg-white">
                  <FiFilter className="h-4 w-4 shrink-0 text-[#003595]/55" />
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value as SortFilter)}
                    className="h-10 w-full appearance-none bg-transparent px-3 text-sm text-[#1F2937] outline-none"
                  >
                    <option value="start_asc">Start time (soonest)</option>
                    <option value="start_desc">Start time (latest)</option>
                    <option value="created_desc">Recently added</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-medium uppercase tracking-[0.16em] text-slate-500">Search room</label>
                <div className="flex items-center rounded-xl border border-[#E5E7EB] bg-[#F9FAFB] px-3 focus-within:border-[#003595] focus-within:bg-white">
                  <FiSearch className="h-4 w-4 shrink-0 text-[#003595]/55" />
                  <input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search by room or building"
                    className="h-10 w-full bg-transparent px-3 text-sm text-[#1F2937] outline-none"
                  />
                </div>
              </div>

              <div className="flex items-end">
                <button
                  type="button"
                  onClick={() => setQuery((q) => q.trim())}
                  className="inline-flex h-10 w-full items-center justify-center rounded-xl bg-[#003595] px-4 text-sm font-semibold text-white transition-colors hover:bg-[#002366]"
                >
                  Apply filters
                </button>
              </div>
            </div>
          </div>
        </section>

        {err ? (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {err}
          </div>
        ) : loading ? (
          <div className="rounded-2xl border border-slate-200 bg-white px-4 py-6 text-sm text-slate-500">
            Loading waitlist entries...
          </div>
        ) : filteredRows.length === 0 ? (
          <div className="rounded-2xl border border-slate-200 bg-white px-6 py-12 text-center">
            <h2 className="text-lg font-bold text-[#1F2937]">No matching waitlist entries</h2>
            <p className="mt-1 text-sm text-slate-500">Try changing your filters or join a waitlist from Rooms.</p>
            <div className="mt-4">
              <Link
                href="/rooms"
                className="inline-flex h-10 items-center rounded-xl bg-[#003595] px-4 text-sm font-bold text-white transition hover:bg-[#002366]"
              >
                Browse rooms
              </Link>
            </div>
          </div>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-[#E5E7EB] bg-white shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-[#F9FAFB] text-left text-slate-600">
                  <tr className="border-b border-[#E5E7EB]">
                    <th className="px-4 py-3">Room</th>
                    <th className="px-4 py-3">Time</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Offer timer</th>
                    <th className="px-4 py-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRows.map((w) => {
                    const roomName = w.room?.name ?? `Room #${w.room_id}`;
                    const building = w.room?.building ?? "";
                    const canAccept =
                      w.status === "offered" &&
                      w.offer_expires_at &&
                      Date.parse(w.offer_expires_at) > Date.now();

                    return (
                      <tr key={w.id} className="border-b border-[#E5E7EB] last:border-b-0">
                        <td className="px-4 py-3">
                          <div className="font-semibold text-[#1F2937]">{roomName}</div>
                          <div className="text-xs text-slate-500">
                            {building}
                            {w.room?.floor ? ` · Floor ${w.room.floor}` : ""}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="inline-flex items-center gap-1.5 text-slate-600">
                            <FiClock className="h-3.5 w-3.5 text-slate-400" />
                            <span className="text-xs font-medium">{formatTtDateTime(w.start_time)}</span>
                          </div>
                          <div className="mt-0.5 text-xs text-slate-400">to {formatTtDateTime(w.end_time)}</div>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`rounded-full px-2.5 py-1 text-xs font-semibold capitalize ${STATUS_STYLES[w.status]}`}>
                            {w.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-slate-600">
                          {w.status === "offered" ? <ExpiryCountdown iso={w.offer_expires_at} /> : <span>-</span>}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex justify-end">
                            {canAccept ? (
                              <button
                                onClick={() => accept(w.id)}
                                className="h-9 rounded-xl bg-[#003595] px-3.5 text-xs font-bold text-white transition hover:bg-[#002366]"
                              >
                                Accept offer
                              </button>
                            ) : (
                              <span className="text-xs text-slate-400">-</span>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}