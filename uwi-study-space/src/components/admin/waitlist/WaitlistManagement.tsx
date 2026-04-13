"use client";

import { useEffect, useMemo, useState } from "react";
import { formatTtDateTime } from "@/lib/utils/datetime";
import ExpiryCountdown from "@/components/shared/ExpiryCountdown";

type Mode = "admin" | "super_admin";

type Row = {
  id: number;
  room_id: number;
  start_time: string;
  end_time: string;
  status: "waiting" | "offered" | "accepted" | "expired";
  offer_expires_at: string | null;
  created_at: string;
  user_id: string;
  room: null | {
    id: number;
    name: string;
    building: string;
    floor: string | null;
    department_id: number;
    department: null | { name: string };
  };
};

function Spinner({ light = false, size = 14 }: { light?: boolean; size?: number }) {
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

function StatusBadge({ status }: { status: Row["status"] }) {
  const styles =
    status === "waiting"
      ? "bg-amber-50 text-amber-700 ring-amber-100"
      : status === "offered"
        ? "bg-[#EAF6FF] text-[#003595] ring-[#003595]/20"
        : status === "accepted"
          ? "bg-emerald-50 text-emerald-700 ring-emerald-100"
          : "bg-[#F3F4F6] text-[#6B7280] ring-[#E5E7EB]";

  const label =
    status === "waiting"
      ? "Waiting"
      : status === "offered"
        ? "Offered"
        : status === "accepted"
          ? "Accepted"
          : "Expired";

  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-bold tracking-wide uppercase ring-1 ${styles}`}
    >
      {label}
    </span>
  );
}

function StatCard({
  label,
  count,
  active,
  onClick,
}: {
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-xl border px-4 py-3 text-left transition-all ${
        active
          ? "border-[#003595] bg-[#EAF6FF]"
          : "border-[#E5E7EB] bg-white hover:border-[#003595]/30 hover:bg-[#F9FAFB]"
      }`}
    >
      <p className="text-[10px] font-bold tracking-[0.15em] uppercase text-[#9CA3AF]">
        {label}
      </p>
      <p
        style={{ fontFamily: "Georgia, serif" }}
        className={`mt-0.5 text-2xl font-bold ${
          active ? "text-[#003595]" : "text-[#1F2937]"
        }`}
      >
        {count}
      </p>
    </button>
  );
}

function SkeletonRow() {
  return (
    <tr className="animate-pulse border-b border-[#F3F4F6]">
      <td className="py-4 pl-5 pr-4">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-xl bg-[#F3F4F6] shrink-0" />
          <div className="space-y-1.5">
            <div className="h-3.5 w-32 rounded bg-[#F3F4F6]" />
            <div className="h-2.5 w-24 rounded bg-[#F3F4F6]" />
          </div>
        </div>
      </td>
      <td className="py-4 px-4 hidden md:table-cell">
        <div className="h-3.5 w-28 rounded bg-[#F3F4F6]" />
      </td>
      <td className="py-4 px-4 hidden lg:table-cell">
        <div className="h-3.5 w-28 rounded bg-[#F3F4F6]" />
      </td>
      <td className="py-4 px-4">
        <div className="h-5 w-16 rounded-full bg-[#F3F4F6]" />
      </td>
      <td className="py-4 px-4 hidden xl:table-cell">
        <div className="h-5 w-20 rounded bg-[#F3F4F6]" />
      </td>
      <td className="py-4 pl-4 pr-5">
        <div className="flex justify-end">
          <div className="h-8 w-16 rounded-lg bg-[#F3F4F6]" />
        </div>
      </td>
    </tr>
  );
}

function ToastNotice({
  toast,
  onClose,
}: {
  toast: { type: "success" | "error"; message: string } | null;
  onClose: () => void;
}) {
  if (!toast) return null;

  const styles =
    toast.type === "success"
      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
      : "border-rose-200 bg-rose-50 text-rose-700";

  return (
    <div className="fixed right-4 top-4 z-[60] w-full max-w-sm">
      <div className={`rounded-2xl border px-4 py-3 shadow-lg ${styles}`}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.14em]">
              {toast.type === "success" ? "Success" : "Error"}
            </p>
            <p className="mt-1 text-sm font-medium">{toast.message}</p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="shrink-0 text-current/70 transition hover:text-current"
            aria-label="Close notification"
          >
            ✕
          </button>
        </div>
      </div>
    </div>
  );
}

function OfferConfirmModal({
  row,
  busy,
  onClose,
  onConfirm,
}: {
  row: Row | null;
  busy: boolean;
  onClose: () => void;
  onConfirm: (waitlistId: number) => Promise<void>;
}) {
  if (!row) return null;

  const roomName = row.room?.name ?? `Room #${row.room_id}`;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/30 p-4 backdrop-blur-[2px] sm:items-center"
      onClick={(e) => {
        if (e.target === e.currentTarget && !busy) onClose();
      }}
    >
      <div className="w-full max-w-md overflow-hidden rounded-2xl border border-[#E5E7EB] bg-white shadow-2xl">
        <div className="border-b border-[#E5E7EB] bg-[#F9FAFB] px-5 py-4">
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#003595]">
            Confirm Action
          </p>
          <h2
            style={{ fontFamily: "Georgia, serif" }}
            className="mt-0.5 text-lg font-bold text-[#1F2937]"
          >
            Send Waitlist Offer
          </h2>
        </div>

        <div className="px-5 py-5">
          <p className="text-sm leading-relaxed text-[#374151]">
            Send an offer for{" "}
            <span className="font-semibold text-[#1F2937]">{roomName}</span>?
          </p>

          <div className="mt-4 rounded-xl border border-[#E5E7EB] bg-[#F9FAFB] px-4 py-3 text-sm text-[#6B7280]">
            <p>
              <span className="font-medium text-[#374151]">Start:</span>{" "}
              {formatTtDateTime(row.start_time)}
            </p>
            <p className="mt-1">
              <span className="font-medium text-[#374151]">End:</span>{" "}
              {formatTtDateTime(row.end_time)}
            </p>
          </div>
        </div>

        <div className="flex gap-2.5 border-t border-[#E5E7EB] px-5 py-4">
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="flex-1 rounded-xl border border-[#E5E7EB] bg-white py-2.5 text-sm font-semibold text-[#374151] transition-colors hover:bg-[#F3F4F6] disabled:opacity-50"
          >
            Cancel
          </button>

          <button
            type="button"
            disabled={busy}
            onClick={() => onConfirm(row.id)}
            className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-[#003595] py-2.5 text-sm font-bold text-white transition-colors hover:bg-[#002366] disabled:opacity-50"
          >
            {busy ? (
              <>
                <Spinner light size={14} />
                Sending…
              </>
            ) : (
              "Send Offer"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function WaitlistManagement({
  mode,
  showPageHeader = true,
}: {
  mode: Mode;
  showPageHeader?: boolean;
}) {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | Row["status"]>("all");
  const [offeringId, setOfferingId] = useState<number | null>(null);
  const [offerTarget, setOfferTarget] = useState<Row | null>(null);
  const [toast, setToast] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  async function load() {
    setLoading(true);
    setErr("");
    try {
      const res = await fetch("/api/admin/waitlist/list");
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

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(t);
  }, [toast]);

  async function offer(waitlistId: number) {
    setOfferingId(waitlistId);

    try {
      const res = await fetch("/api/admin/waitlist/offer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ waitlistId }),
      });

      const json = await res.json().catch(() => ({}));

      if (!res.ok) {
        setToast({
          type: "error",
          message: json?.error ?? "Failed to send offer.",
        });
        return;
      }

      setToast({
        type: "success",
        message: "Offer sent successfully.",
      });

      await load();
    } finally {
      setOfferingId(null);
      setOfferTarget(null);
    }
  }

  const filteredRows = useMemo(() => {
    if (statusFilter === "all") return rows;
    return rows.filter((row) => row.status === statusFilter);
  }, [rows, statusFilter]);

  const counts = useMemo(
    () => ({
      total: rows.length,
      waiting: rows.filter((r) => r.status === "waiting").length,
      offered: rows.filter((r) => r.status === "offered").length,
      accepted: rows.filter((r) => r.status === "accepted").length,
      expired: rows.filter((r) => r.status === "expired").length,
    }),
    [rows],
  );

  return (
    <div className="min-h-screen bg-[#F9FAFB]">
      {showPageHeader ? (
        <div className="border-b-2 border-[#003595] bg-white">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="h-1 w-16 bg-[#003595] -mb-px" />
            <div className="flex flex-col gap-4 py-6 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.2em] text-[#003595]">
                  {mode === "super_admin" ? "Super Admin" : "Admin"} — Booking Queue
                </p>
                <h1
                  style={{ fontFamily: "Georgia, serif" }}
                  className="text-3xl font-bold text-[#1F2937] sm:text-4xl"
                >
                  Waitlist
                </h1>
                <p className="mt-1.5 max-w-lg text-sm text-[#6B7280]">
                  Monitor pending demand and send booking offers to students when slots become
                  available.
                </p>
              </div>

              <nav className="flex shrink-0 items-center gap-1.5 pb-1 text-xs text-[#9CA3AF]">
                <span>{mode === "super_admin" ? "Super Admin" : "Admin"}</span>
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none">
                  <path
                    d="m9 18 6-6-6-6"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                <span className="font-semibold text-[#003595]">Waitlist</span>
              </nav>
            </div>
          </div>
        </div>
      ) : null}

      <div className="mx-auto max-w-7xl space-y-6 px-4 py-8 sm:px-6 lg:px-8">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          <StatCard
            label="Total"
            count={counts.total}
            active={statusFilter === "all"}
            onClick={() => setStatusFilter("all")}
          />
          <StatCard
            label="Waiting"
            count={counts.waiting}
            active={statusFilter === "waiting"}
            onClick={() =>
              setStatusFilter(statusFilter === "waiting" ? "all" : "waiting")
            }
          />
          <StatCard
            label="Offered"
            count={counts.offered}
            active={statusFilter === "offered"}
            onClick={() =>
              setStatusFilter(statusFilter === "offered" ? "all" : "offered")
            }
          />
          <StatCard
            label="Accepted"
            count={counts.accepted}
            active={statusFilter === "accepted"}
            onClick={() =>
              setStatusFilter(statusFilter === "accepted" ? "all" : "accepted")
            }
          />
          <StatCard
            label="Expired"
            count={counts.expired}
            active={statusFilter === "expired"}
            onClick={() =>
              setStatusFilter(statusFilter === "expired" ? "all" : "expired")
            }
          />
        </div>

        <div className="overflow-hidden rounded-xl border border-[#E5E7EB] bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-[#E5E7EB] bg-[#F9FAFB] px-5 py-3.5">
            <h2 className="text-xs font-bold uppercase tracking-[0.12em] text-[#374151]">
              Waitlist Entries
            </h2>
            {!loading && (
              <span className="text-xs text-[#9CA3AF]">
                {filteredRows.length} of {rows.length}
              </span>
            )}
          </div>

          {err ? (
            <div className="m-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {err}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm" aria-label="Waitlist table">
                <thead>
                  <tr className="border-b border-[#E5E7EB]">
                    <th className="py-3 pl-5 pr-4 text-left text-[10px] font-bold uppercase tracking-[0.15em] text-[#9CA3AF]">
                      Room
                    </th>
                    <th className="hidden px-4 py-3 text-left text-[10px] font-bold uppercase tracking-[0.15em] text-[#9CA3AF] md:table-cell">
                      Start
                    </th>
                    <th className="hidden px-4 py-3 text-left text-[10px] font-bold uppercase tracking-[0.15em] text-[#9CA3AF] lg:table-cell">
                      End
                    </th>
                    <th className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-[0.15em] text-[#9CA3AF]">
                      Status
                    </th>
                    <th className="hidden px-4 py-3 text-left text-[10px] font-bold uppercase tracking-[0.15em] text-[#9CA3AF] xl:table-cell">
                      Offer Expires
                    </th>
                    <th className="py-3 pl-4 pr-5 text-right text-[10px] font-bold uppercase tracking-[0.15em] text-[#9CA3AF]">
                      Actions
                    </th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-[#F3F4F6]">
                  {loading ? (
                    <>
                      {[1, 2, 3, 4, 5].map((i) => (
                        <SkeletonRow key={i} />
                      ))}
                    </>
                  ) : filteredRows.length === 0 ? (
                    <tr>
                      <td colSpan={6}>
                        <div className="flex flex-col items-center justify-center py-16 text-center">
                          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-[#F3F4F6] text-[#9CA3AF]">
                            <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                              <path
                                d="M8 11a4 4 0 1 1 8 0c0 1.657-1.343 3-3 3h-2a3 3 0 0 0 0 6h5"
                                stroke="currentColor"
                                strokeWidth="1.7"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              />
                              <path
                                d="M16 20h5m-2.5-2.5V22.5"
                                stroke="currentColor"
                                strokeWidth="1.7"
                                strokeLinecap="round"
                              />
                            </svg>
                          </div>
                          <p className="text-sm font-semibold text-[#374151]">
                            No waitlist entries found
                          </p>
                          <p className="mt-1 text-xs text-[#9CA3AF]">
                            {statusFilter === "all"
                              ? "There are currently no waitlisted requests."
                              : `No entries found for status "${statusFilter}".`}
                          </p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    filteredRows.map((w) => {
                      const roomName = w.room?.name ?? `Room #${w.room_id}`;
                      const canOffer = w.status === "waiting" || w.status === "expired";
                      const isOffering = offeringId === w.id;

                      return (
                        <tr
                          key={w.id}
                          className="group align-top transition-colors hover:bg-[#F9FAFB]"
                        >
                          <td className="py-4 pl-5 pr-4">
                            <div className="flex items-start gap-3">
                              <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#EAF6FF] text-[11px] font-extrabold text-[#003595] ring-1 ring-[#003595]/10">
                                {(roomName || "?").charAt(0).toUpperCase()}
                              </div>
                              <div>
                                <p className="text-sm font-semibold text-[#1F2937] transition-colors group-hover:text-[#003595]">
                                  {roomName}
                                </p>
                                <p className="mt-0.5 text-xs text-[#6B7280]">
                                  {(w.room?.building ?? "").toString() || "—"}
                                  {w.room?.department?.name
                                    ? ` • ${w.room.department.name}`
                                    : ""}
                                </p>
                                {w.room?.floor ? (
                                  <p className="mt-0.5 text-xs text-[#9CA3AF]">
                                    Floor {w.room.floor}
                                  </p>
                                ) : null}
                              </div>
                            </div>
                          </td>

                          <td className="hidden px-4 py-4 text-[#374151] md:table-cell">
                            <div className="text-sm font-medium">
                              {formatTtDateTime(w.start_time)}
                            </div>
                          </td>

                          <td className="hidden px-4 py-4 text-[#374151] lg:table-cell">
                            <div className="text-sm font-medium">
                              {formatTtDateTime(w.end_time)}
                            </div>
                          </td>

                          <td className="px-4 py-4">
                            <div className="space-y-1.5">
                              <StatusBadge status={w.status} />
                              {w.status === "offered" && (
                                <div className="xl:hidden text-xs text-[#6B7280]">
                                  <ExpiryCountdown iso={w.offer_expires_at} />
                                </div>
                              )}
                            </div>
                          </td>

                          <td className="hidden px-4 py-4 xl:table-cell">
                            {w.status === "offered" ? (
                              <ExpiryCountdown iso={w.offer_expires_at} />
                            ) : (
                              <span className="text-xs text-[#9CA3AF]">—</span>
                            )}
                          </td>

                          <td className="py-4 pl-4 pr-5">
                            <div className="flex justify-end gap-2">
                              {canOffer ? (
                                <button
                                  onClick={() => setOfferTarget(w)}
                                  disabled={isOffering}
                                  className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#003595] px-3 py-2 text-xs font-bold text-white transition-colors hover:bg-[#002366] disabled:opacity-50"
                                >
                                  {isOffering ? (
                                    <>
                                      <Spinner light size={12} />
                                      Offering…
                                    </>
                                  ) : (
                                    "Offer"
                                  )}
                                </button>
                              ) : (
                                <span className="text-xs text-[#9CA3AF]">—</span>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          )}

          {!loading && !err && filteredRows.length > 0 ? (
            <div className="border-t border-[#E5E7EB] bg-[#F9FAFB] px-5 py-3">
              <p className="text-xs text-[#9CA3AF]">
                {filteredRows.length} waitlist entr{filteredRows.length === 1 ? "y" : "ies"}{" "}
                displayed
                {statusFilter !== "all" ? ` · filtered by ${statusFilter}` : ""}
              </p>
            </div>
          ) : null}
        </div>
      </div>

      <OfferConfirmModal
        row={offerTarget}
        busy={offeringId !== null}
        onClose={() => {
          if (offeringId === null) setOfferTarget(null);
        }}
        onConfirm={offer}
      />

      <ToastNotice
        toast={toast}
        onClose={() => setToast(null)}
      />
    </div>
  );
}