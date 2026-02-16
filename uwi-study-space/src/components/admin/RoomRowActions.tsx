// src/components/admin/RoomRowActions.tsx
// Client-side actions for each room row (Admin Rooms page).
//
// Why client component?
// - Buttons need to call API routes (fetch)
// - After a successful toggle, we call router.refresh() to re-render the Server Component page.

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function RoomRowActions({ roomId }: { roomId: number }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function onToggle() {
    try {
      setBusy(true);

      const res = await fetch("/api/admin/rooms/toggle-active", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roomId }),
      });

      if (!res.ok) {
        const msg = await res.json().catch(() => ({}));
        throw new Error(msg?.error ?? "Failed to toggle room");
      }

      // Re-fetch Server Component data (rooms list) after mutation
      router.refresh();
    } catch (e: any) {
      alert(e?.message ?? "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        className="rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-60"
        disabled={busy}
        onClick={() => alert("Next step: wire up Edit modal + save endpoint.")}
      >
        Edit
      </button>

      <button
        type="button"
        className="rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-60"
        disabled={busy}
        onClick={onToggle}
      >
        {busy ? "Toggling..." : "Toggle Active"}
      </button>
    </div>
  );
}
