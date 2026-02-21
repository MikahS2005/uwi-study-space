"use client";

import { useEffect, useMemo, useState } from "react";
import { formatTtDateTime } from "@/lib/utils/datetime";

function pad2(n: number) {
  return n.toString().padStart(2, "0");
}

function msToParts(ms: number) {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const mm = Math.floor(totalSec / 60);
  const ss = totalSec % 60;
  return { mm, ss };
}

export default function ExpiryCountdown({
  iso,
  tickMs = 1000,
  showExact = true,
}: {
  iso: string | null;
  tickMs?: number;
  showExact?: boolean;
}) {
  const targetMs = useMemo(() => (iso ? Date.parse(iso) : NaN), [iso]);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!iso) return;
    const id = setInterval(() => setNow(Date.now()), tickMs);
    return () => clearInterval(id);
  }, [iso, tickMs]);

  if (!iso || Number.isNaN(targetMs)) {
    return <span className="text-slate-500">—</span>;
  }

  const diff = targetMs - now;

  // Expired
  if (diff <= 0) {
    return (
      <div className="space-y-1">
        <div className="inline-flex items-center rounded-full bg-rose-50 px-2 py-1 text-xs font-medium text-rose-700 ring-1 ring-rose-200">
          Expired
        </div>
        {showExact ? (
          <div className="text-[11px] text-slate-500">Was: {formatTtDateTime(iso)}</div>
        ) : null}
      </div>
    );
  }

  const { mm, ss } = msToParts(diff);

  // "Urgent" styling under 5 minutes
  const urgent = diff <= 5 * 60 * 1000;

  return (
    <div className="space-y-1">
      <div
        className={[
          "inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ring-1",
          urgent
            ? "bg-amber-50 text-amber-800 ring-amber-200"
            : "bg-slate-50 text-slate-700 ring-slate-200",
        ].join(" ")}
      >
        Expires in {pad2(mm)}:{pad2(ss)}
      </div>

      {showExact ? (
        <div className="text-[11px] text-slate-500">At: {formatTtDateTime(iso)}</div>
      ) : null}
    </div>
  );
}