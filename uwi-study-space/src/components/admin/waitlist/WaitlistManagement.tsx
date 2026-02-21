"use client";

import { useEffect, useState } from "react";
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

export default function WaitlistManagement({ mode }: { mode: Mode }) {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

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

  async function offer(waitlistId: number) {
    if (!confirm("Send offer to this student?")) return;

    const res = await fetch("/api/admin/waitlist/offer", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ waitlistId }),
    });

    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      alert(json?.error ?? "Failed to offer");
      return;
    }

    await load();
  }

  const title = mode === "super_admin" ? "Waitlist (Super Admin)" : "Waitlist";

  return (
    <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
      <div className="mb-4">
        <h1 className="text-lg font-semibold text-slate-900">{title}</h1>
        <p className="text-sm text-slate-600">
          Offer waitlist slots to students. Students accept offers on their end.
        </p>
      </div>

      {err ? (
        <div className="rounded-xl bg-rose-50 p-4 text-sm text-rose-700 ring-1 ring-rose-200">
          {err}
        </div>
      ) : loading ? (
        <div className="rounded-xl bg-slate-50 p-4 text-sm text-slate-600 ring-1 ring-slate-200">
          Loading…
        </div>
      ) : rows.length === 0 ? (
        <div className="rounded-xl bg-slate-50 p-4 text-sm text-slate-600 ring-1 ring-slate-200">
          No waitlist entries found.
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
                <th className="px-4 py-3">Offer Expires</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((w) => {
                const roomName = w.room?.name ?? `Room #${w.room_id}`;
                const offerTxt = formatTtDateTime(w.offer_expires_at);

                const canOffer = w.status === "waiting" || w.status === "expired";

                return (
                  <tr key={w.id} className="border-b last:border-b-0">
                    <td className="px-4 py-3">
                      <div className="font-medium text-slate-900">{roomName}</div>
                      <div className="text-xs text-slate-500">
                        {(w.room?.building ?? "").toString()}
                        {w.room?.department?.name ? ` • ${w.room.department.name}` : ""}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-700">{formatTtDateTime(w.start_time)}</td>
                    <td className="px-4 py-3 text-slate-700">{formatTtDateTime(w.end_time)}</td>
                    <td className="px-4 py-3">
                      <span className="rounded-full bg-slate-100 px-2 py-1 text-xs text-slate-700 ring-1 ring-slate-200">
                        {w.status}
                      </span>
                    </td>
                                      <td className="px-4 py-3">
                    {w.status === "offered" ? (
                      <ExpiryCountdown iso={w.offer_expires_at} />
                    ) : (
                      <span className="text-slate-500">—</span>
                    )}
                  </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-2">
                        {canOffer ? (
                          <button
                            onClick={() => offer(w.id)}
                            className="rounded-xl bg-slate-900 px-3 py-2 text-xs font-medium text-white hover:bg-slate-800"
                          >
                            Offer
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