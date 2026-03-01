"use client";

import { useEffect, useMemo, useState } from "react";

const CAMPUS_TZ = "America/Port_of_Spain";

type Row = {
  id: number;
  room_id: number;
  start_time: string;
  end_time: string;
  status: "waiting" | "offered" | "accepted" | "expired";
  offer_expires_at: string | null;
  created_at: string;
  room: null | {
    id: number;
    name: string;
    building: string;
    floor: string | null;
    department: null | { name: string };
  };
};

function fmtDT(iso: string) {
  // Force campus timezone in UI
  return new Date(iso).toLocaleString([], { timeZone: CAMPUS_TZ });
}

function msLeft(expiresIso: string | null) {
  if (!expiresIso) return null;
  const t = Date.parse(expiresIso);
  if (Number.isNaN(t)) return null;
  return t - Date.now();
}

function fmtCountdown(ms: number) {
  if (ms <= 0) return "Expired";
  const totalSec = Math.floor(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export default function MyOffersPanel() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  // ticking clock for countdown rendering
  const [, setTick] = useState(0);

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

  useEffect(() => {
    const id = window.setInterval(() => setTick((x) => x + 1), 1000);
    return () => window.clearInterval(id);
  }, []);

  const offered = useMemo(() => rows.filter((r) => r.status === "offered"), [rows]);
  const waiting = useMemo(() => rows.filter((r) => r.status === "waiting"), [rows]);

  async function accept(waitlistId: number) {
    if (!confirm("Accept this offer and create the booking?")) return;

    const res = await fetch("/api/waitlist/accept", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ waitlistId }),
    });

    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      alert(json?.error ?? "Accept failed");
      return;
    }

    await load();
  }

  return (
    <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
      <div className="mb-3">
        <h2 className="text-lg font-semibold text-slate-900">My Offers</h2>
        <p className="text-sm text-slate-600">
          If you receive an offer, accept it before the countdown hits zero.
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
      ) : offered.length === 0 && waiting.length === 0 ? (
        <div className="rounded-xl bg-slate-50 p-4 text-sm text-slate-600 ring-1 ring-slate-200">
          No offers or waitlist entries yet.
        </div>
      ) : (
        <div className="space-y-3">
          {offered.length ? (
            <div>
              <div className="mb-2 text-xs font-semibold text-slate-600">OFFERS</div>
              <div className="space-y-2">
                {offered.map((r) => {
                  const left = msLeft(r.offer_expires_at);
                  const roomName = r.room?.name ?? `Room #${r.room_id}`;
                  const dept = r.room?.department?.name ?? "—";

                  return (
                    <div
                      key={r.id}
                      className="rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-200 flex flex-wrap items-center justify-between gap-3"
                    >
                      <div>
                        <div className="font-semibold text-slate-900">{roomName}</div>
                        <div className="text-xs text-slate-600">
                          {dept} • {fmtDT(r.start_time)} → {fmtDT(r.end_time)}
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        <div className="rounded-xl bg-white px-3 py-2 text-sm ring-1 ring-slate-200">
                          <div className="text-[10px] text-slate-500">Expires in</div>
                          <div className="font-semibold text-slate-900">
                            {left === null ? "—" : fmtCountdown(left)}
                          </div>
                        </div>

                        <button
                          onClick={() => accept(r.id)}
                          className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
                        >
                          Accept
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : null}

          {waiting.length ? (
            <div>
              <div className="mb-2 text-xs font-semibold text-slate-600">WAITING</div>
              <div className="space-y-2">
                {waiting.map((r) => (
                  <div key={r.id} className="rounded-2xl bg-white p-4 ring-1 ring-slate-200">
                    <div className="font-semibold text-slate-900">
                      {r.room?.name ?? `Room #${r.room_id}`}
                    </div>
                    <div className="text-xs text-slate-600">
                      {fmtDT(r.start_time)} → {fmtDT(r.end_time)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}