// src/components/bookings/MyBookingsList.tsx
"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

/**
 * IMPORTANT: Avoid hydration mismatch.
 * - Server render timezone/locale differs from client
 * - So render "—" until mounted, then render local formatted times.
 */
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

function StatusBadge({ status }: { status: string }) {
  const base = "inline-flex items-center rounded-full px-3 py-1 text-xs font-medium";

  // Keep mapping explicit (UI team can revise later)
  const cls =
    status === "active"
      ? "bg-green-50 text-green-700 ring-1 ring-green-200"
      : status === "cancelled"
        ? "bg-gray-50 text-gray-700 ring-1 ring-gray-200"
        : status === "completed"
          ? "bg-blue-50 text-blue-700 ring-1 ring-blue-200"
          : status === "no_show"
            ? "bg-red-50 text-red-700 ring-1 ring-red-200"
            : "bg-neutral-50 text-neutral-700 ring-1 ring-neutral-200";

  return <span className={`${base} ${cls}`}>{status === "active" ? "Active" : status}</span>;
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

  // Confirmation modal state
  const [confirm, setConfirm] = useState<null | { id: number; label: string; time: string }>(null);

  const totalPages = Math.max(1, Math.ceil(props.pagination.total / props.pagination.pageSize));

  function goToPage(nextPage: number) {
    const params = new URLSearchParams(sp.toString());

    // Keep other filters; only change page
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

      // Refresh server-rendered list
      router.refresh();
    } catch {
      setErrorMsg("Network error. Try again.");
      setLoadingId(null);
    }
  }

  return (
    <div className="mt-6">
      {errorMsg ? (
        <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {errorMsg}
        </div>
      ) : null}

      {/* Top meta + pagination */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div className="text-sm text-gray-600">
          Page <b>{props.pagination.page}</b> of <b>{totalPages}</b> • Total{" "}
          <b>{props.pagination.total}</b>
        </div>

        <div className="flex gap-2">
          <button
            className="rounded-lg border bg-white px-3 py-1.5 text-sm hover:bg-gray-50 disabled:opacity-50"
            disabled={props.pagination.page <= 1}
            onClick={() => goToPage(props.pagination.page - 1)}
          >
            Prev
          </button>
          <button
            className="rounded-lg border bg-white px-3 py-1.5 text-sm hover:bg-gray-50 disabled:opacity-50"
            disabled={props.pagination.page >= totalPages}
            onClick={() => goToPage(props.pagination.page + 1)}
          >
            Next
          </button>
        </div>
      </div>

      {/* Booking cards */}
      <div className="grid gap-4">
        {props.bookings.map((b) => {
          const roomLabel = b.rooms
            ? `${b.rooms.name} • ${b.rooms.building}${b.rooms.floor ? ` • Floor ${b.rooms.floor}` : ""}`
            : "Room";

          const isActive = b.status === "active";

          const timeLabel =
            mounted ? `${fmtLocal(b.start_time)} → ${fmtLocal(b.end_time)}` : "—";

          return (
            <div
              key={b.id}
              className="rounded-2xl border bg-white p-5 shadow-sm transition hover:shadow-md"
            >
              <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                {/* Left */}
                <div>
                  <div className="text-base font-semibold text-gray-900">{roomLabel}</div>

                  <div className="mt-1 text-sm text-gray-700">{timeLabel}</div>

                  <div className="mt-2 text-sm text-gray-600">
                    <span className="font-medium text-gray-700">Purpose:</span>{" "}
                    {b.purpose?.trim() ? b.purpose : "—"}
                  </div>
                </div>

                {/* Right */}
                <div className="flex items-start gap-3 md:flex-col md:items-end">
                  <StatusBadge status={b.status} />

                  <button
                    type="button"
                    disabled={!isActive || loadingId === b.id}
                    onClick={() =>
                      setConfirm({
                        id: b.id,
                        label: roomLabel,
                        time: timeLabel,
                      })
                    }
                    className={[
                      "rounded-lg border px-4 py-2 text-sm font-medium",
                      "bg-white hover:bg-gray-50",
                      "disabled:cursor-not-allowed disabled:opacity-50",
                    ].join(" ")}
                  >
                    {loadingId === b.id ? "Cancelling..." : "Cancel"}
                  </button>
                </div>
              </div>
            </div>
          );
        })}

        {props.bookings.length === 0 ? (
          <div className="rounded-2xl border bg-white p-6 text-sm text-gray-600 shadow-sm">
            No bookings found.
          </div>
        ) : null}
      </div>

      {/* Bottom pagination */}
      <div className="mt-5 flex justify-end gap-2">
        <button
          className="rounded-lg border bg-white px-3 py-1.5 text-sm hover:bg-gray-50 disabled:opacity-50"
          disabled={props.pagination.page <= 1}
          onClick={() => goToPage(props.pagination.page - 1)}
        >
          Prev
        </button>
        <button
          className="rounded-lg border bg-white px-3 py-1.5 text-sm hover:bg-gray-50 disabled:opacity-50"
          disabled={props.pagination.page >= totalPages}
          onClick={() => goToPage(props.pagination.page + 1)}
        >
          Next
        </button>
      </div>

      {/* Cancel confirmation modal */}
      {confirm ? (
        <div className="fixed inset-0 z-50">
          <button
            aria-label="Close"
            className="absolute inset-0 bg-black/40"
            onClick={() => setConfirm(null)}
          />

          <div className="absolute left-1/2 top-1/2 w-[min(520px,92vw)] -translate-x-1/2 -translate-y-1/2 rounded-2xl bg-white p-6 shadow-xl">
            <h2 className="text-lg font-semibold text-gray-900">Cancel booking?</h2>

            <p className="mt-2 text-sm text-gray-700">
              <span className="font-medium">{confirm.label}</span>
              <br />
              <span className="text-gray-600">{confirm.time}</span>
            </p>

            <div className="mt-6 flex justify-end gap-2">
              <button
                className="rounded-lg border bg-white px-4 py-2 text-sm hover:bg-gray-50 disabled:opacity-50"
                onClick={() => setConfirm(null)}
                disabled={loadingId === confirm.id}
              >
                Keep
              </button>

              <button
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
                onClick={() => cancelBookingConfirmed(confirm.id)}
                disabled={loadingId === confirm.id}
              >
                {loadingId === confirm.id ? "Cancelling..." : "Cancel booking"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
