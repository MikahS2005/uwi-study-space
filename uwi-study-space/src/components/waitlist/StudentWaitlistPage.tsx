"use client";

import { useEffect, useState } from "react";
import ExpiryCountdown from "@/components/shared/ExpiryCountdown";
import { formatTtDateTime } from "@/lib/utils/datetime";

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

export default function StudentWaitlistPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

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
    <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
      <div className="mb-4">
        <h1 className="text-lg font-semibold text-slate-900">My Waitlist & Offers</h1>
        <p className="text-sm text-slate-600">
          If you receive an offer, accept it before it expires. Times are shown in Trinidad (America/Port_of_Spain).
        </p>
      </div>

      {err ? (
        <div className="rounded-xl bg-rose-50 p-4 text-sm text-rose-700 ring-1 ring-rose-200">{err}</div>
      ) : loading ? (
        <div className="rounded-xl bg-slate-50 p-4 text-sm text-slate-600 ring-1 ring-slate-200">Loading…</div>
      ) : rows.length === 0 ? (
        <div className="rounded-xl bg-slate-50 p-4 text-sm text-slate-600 ring-1 ring-slate-200">
          You have no waitlist entries.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl ring-1 ring-slate-200">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-slate-600">
              <tr className="border-b">
                <th className="px-4 py-3">Room</th>
                <th className="px-4 py-3">Start</th>
                <th className="px-4 py-3">End</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Offer</th>
                <th className="px-4 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((w) => {
                const roomName = w.room?.name ?? `Room #${w.room_id}`;
                const canAccept =
                  w.status === "offered" &&
                  w.offer_expires_at &&
                  Date.parse(w.offer_expires_at) > Date.now();

                return (
                  <tr key={w.id} className="border-b last:border-b-0">
                    <td className="px-4 py-3">
                      <div className="font-medium text-slate-900">{roomName}</div>
                      <div className="text-xs text-slate-500">{w.room?.building ?? ""}</div>
                    </td>
                    <td className="px-4 py-3 text-slate-700">{formatTtDateTime(w.start_time)}</td>
                    <td className="px-4 py-3 text-slate-700">{formatTtDateTime(w.end_time)}</td>
                    <td className="px-4 py-3">
                      <span className="rounded-full bg-slate-100 px-2 py-1 text-xs text-slate-700 ring-1 ring-slate-200">
                        {w.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {w.status === "offered" ? <ExpiryCountdown iso={w.offer_expires_at} /> : <span>—</span>}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end">
                        {canAccept ? (
                          <button
                            onClick={() => accept(w.id)}
                            className="rounded-xl bg-slate-900 px-3 py-2 text-xs font-medium text-white hover:bg-slate-800"
                          >
                            Accept
                          </button>
                        ) : (
                          <span className="text-xs text-slate-400">—</span>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}