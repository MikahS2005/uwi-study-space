// src/components/bookings/MyBookingsList.tsx
"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { FiAlertTriangle } from "react-icons/fi";

function fmtLocal(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString([], {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

type BookingRow = {
  id: number;
  start_time: string;
  end_time: string;
  status: string;
  purpose: string | null;
  rooms: { id: number; name: string; building: string; floor: string | null } | null;
};

// Colour scheme matched to the dashboard navy palette
const STATUS_CONFIG: Record<string, { label: string; dot: string; badge: string; bar: string }> = {
  active: {
    label: "Active",
    dot: "bg-emerald-500",
    badge: "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200",
    bar: "bg-emerald-500",
  },
  cancelled: {
    label: "Cancelled",
    dot: "bg-slate-400",
    badge: "bg-slate-100 text-slate-500 ring-1 ring-slate-200",
    bar: "bg-slate-300",
  },
  completed: {
    label: "Completed",
    dot: "bg-blue-800",
    badge: "bg-blue-50 text-blue-800 ring-1 ring-blue-200",
    bar: "bg-blue-800",
  },
  no_show: {
    label: "No-show",
    dot: "bg-rose-400",
    badge: "bg-rose-50 text-rose-700 ring-1 ring-rose-200",
    bar: "bg-rose-400",
  },
};

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] ?? {
    label: status,
    dot: "bg-slate-400",
    badge: "bg-slate-100 text-slate-600 ring-1 ring-slate-200",
    bar: "bg-slate-300",
  };
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${cfg.badge}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${cfg.dot}`} />
      {cfg.label}
    </span>
  );
}

function BookingCard({
  booking,
  mounted,
  loadingId,
  onCancel,
}: {
  booking: BookingRow;
  mounted: boolean;
  loadingId: number | null;
  onCancel: (b: { id: number; label: string; time: string }) => void;
}) {
  const isActive = booking.status === "active";
  const cfg = STATUS_CONFIG[booking.status] ?? STATUS_CONFIG.cancelled;

  const roomLabel = booking.rooms?.name ?? "Room";
  const locationLabel = booking.rooms
    ? `${booking.rooms.building}${booking.rooms.floor ? ` · Floor ${booking.rooms.floor}` : ""}`
    : "";
  const timeLabel = mounted
    ? `${fmtLocal(booking.start_time)} → ${fmtLocal(booking.end_time)}`
    : "—";

  return (
    <div className="group relative overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-200 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md hover:ring-slate-300">
      {/* Left accent bar */}
      <div className={`absolute left-0 top-0 h-full w-1 ${cfg.bar}`} />

      <div className="flex flex-col gap-3 py-4 pl-6 pr-5 md:flex-row md:items-center md:justify-between">
        {/* Left: room info */}
        <div className="min-w-0 flex-1 pl-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-bold text-blue-900">{roomLabel}</span>
            {locationLabel && (
              <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-500">
                {locationLabel}
              </span>
            )}
          </div>

          <div className="mt-1.5 flex items-center gap-1.5 text-slate-500">
            <svg className="h-3.5 w-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
              <circle cx="12" cy="12" r="9" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 7v5l3 3" />
            </svg>
            <span className="font-mono text-xs">{timeLabel}</span>
          </div>

          {booking.purpose?.trim() && (
            <div className="mt-1.5 flex items-start gap-1.5">
              <svg className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
              <span className="text-xs text-slate-500">{booking.purpose}</span>
            </div>
          )}
        </div>

        {/* Right: badge + action */}
        <div className="flex items-center gap-2 pl-2 md:pl-0 md:shrink-0">
          <StatusBadge status={booking.status} />
          {isActive ? (
            <button
              type="button"
              disabled={loadingId === booking.id}
              onClick={() =>
                onCancel({ id: booking.id, label: `${roomLabel} · ${locationLabel}`, time: timeLabel })
              }
              className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:border-rose-300 hover:bg-rose-50 hover:text-rose-600 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loadingId === booking.id ? "Cancelling…" : "Cancel"}
            </button>
          ) : (
            <div className="w-[68px]" />
          )}
        </div>
      </div>
    </div>
  );
}

function PaginationButtons({
  page,
  totalPages,
  onGoTo,
}: {
  page: number;
  totalPages: number;
  onGoTo: (p: number) => void;
}) {
  return (
    <div className="flex items-center gap-1.5">
      <button
        className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
        disabled={page <= 1}
        onClick={() => onGoTo(page - 1)}
      >
        ← Prev
      </button>
      <span className="px-2 text-xs text-slate-400">
        {page} / {totalPages}
      </span>
      <button
        className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
        disabled={page >= totalPages}
        onClick={() => onGoTo(page + 1)}
      >
        Next →
      </button>
    </div>
  );
}

export default function MyBookingsList(props: {
  bookings: BookingRow[];
  pagination: { total: number; page: number; pageSize: number };
}) {
  const router = useRouter();
  const sp = useSearchParams();

  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const [loadingId, setLoadingId] = useState<number | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<null | { id: number; label: string; time: string }>(null);

  const totalPages = Math.max(1, Math.ceil(props.pagination.total / props.pagination.pageSize));

  function goToPage(nextPage: number) {
    const params = new URLSearchParams(sp.toString());
    if (nextPage <= 1) params.delete("page");
    else params.set("page", String(nextPage));
    router.push(`/bookings?${params.toString()}`);
  }

  async function cancelBookingConfirmed(bookingId: number) {
    setErrorMsg(null);
    setLoadingId(bookingId);
    try {
      const res = await fetch("/api/bookings/cancel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bookingId }),
      });
      const data = (await res.json().catch(() => null)) as any;
      if (!res.ok) {
        setErrorMsg(data?.error ?? "Cancel failed");
        setLoadingId(null);
        return;
      }
      setLoadingId(null);
      setConfirm(null);
      router.refresh();
    } catch {
      setErrorMsg("Network error. Try again.");
      setLoadingId(null);
    }
  }

  return (
    <div className="mt-4">
      {/* Error banner */}
      {errorMsg && (
        <div className="mb-4 flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
          </svg>
          {errorMsg}
        </div>
      )}

      {/* Top bar */}
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-slate-500">
          <span className="font-semibold text-blue-900">{props.pagination.total}</span>{" "}
          booking{props.pagination.total !== 1 ? "s" : ""}
        </p>
        {totalPages > 1 && (
          <PaginationButtons page={props.pagination.page} totalPages={totalPages} onGoTo={goToPage} />
        )}
      </div>

      {/* Cards */}
      <div className="grid gap-2.5">
        {props.bookings.map((b) => (
          <BookingCard
            key={b.id}
            booking={b}
            mounted={mounted}
            loadingId={loadingId}
            onCancel={setConfirm}
          />
        ))}

        {props.bookings.length === 0 && (
          <div className="flex flex-col items-center justify-center gap-4 rounded-2xl border-2 border-dashed border-blue-100 bg-blue-50/40 py-16 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white shadow-sm ring-1 ring-blue-100">
              <svg className="h-7 w-7 text-blue-800" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-semibold text-blue-900">No bookings yet</p>
              <p className="mt-1 text-xs text-slate-400">Your upcoming study sessions will appear here.</p>
            </div>
          </div>
        )}
      </div>

      {/* Bottom pagination */}
      {props.bookings.length > 0 && totalPages > 1 && (
        <div className="mt-4 flex justify-end">
          <PaginationButtons page={props.pagination.page} totalPages={totalPages} onGoTo={goToPage} />
        </div>
      )}

      {/* Cancel confirmation modal */}
      {confirm && (
        <div className="fixed inset-0 z-50">
          <button
            aria-label="Close"
            className="absolute inset-0 bg-black/25 backdrop-blur-sm"
            onClick={() => setConfirm(null)}
          />

          <div className="absolute left-1/2 top-1/2 w-[min(460px,92vw)] -translate-x-1/2 -translate-y-1/2 rounded-2xl bg-white p-6 shadow-2xl ring-1 ring-slate-200">
            <div className="flex items-start gap-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-rose-50 ring-1 ring-rose-200">
                <svg className="h-5 w-5 text-rose-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </div>
              <div className="flex-1 min-w-0">
                <h2 className="text-base font-bold text-blue-900">Cancel this booking?</h2>
                <p className="mt-1.5 text-sm font-semibold text-slate-700 truncate">{confirm.label}</p>
                <p className="mt-0.5 font-mono text-xs text-slate-400">{confirm.time}</p>
              </div>
            </div>

            <p className="mt-4 flex items-start gap-2 rounded-xl bg-amber-50 px-3 py-2.5 text-xs text-amber-700 ring-1 ring-amber-200">
              <FiAlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span>This action cannot be undone. The room slot will be released.</span>
            </p>

            <div className="mt-5 flex justify-end gap-2">
              <button
                className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                onClick={() => setConfirm(null)}
                disabled={loadingId === confirm.id}
              >
                Keep booking
              </button>
              <button
                className="rounded-xl bg-rose-600 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-700 disabled:opacity-50"
                onClick={() => cancelBookingConfirmed(confirm.id)}
                disabled={loadingId === confirm.id}
              >
                {loadingId === confirm.id ? "Cancelling…" : "Yes, cancel"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}