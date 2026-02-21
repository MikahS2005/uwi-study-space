// src/components/admin/RoomRowActions.tsx
//
// Client-side actions for each room row (Admin Rooms page).
//
// Why client component?
// - Buttons call API routes (fetch)
// - After mutations, we call router.refresh() to re-render the Server Component page.
//
// Current actions:
// - Edit (opens RoomEditModal; saves via /api/admin/rooms/update)
// - Toggle Active (POST /api/admin/rooms/toggle-active)

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { RoomRow } from "@/lib/db/rooms";
import { RoomEditModal } from "@/components/admin/RoomEditModal";

export function RoomRowActions({ room }: { room: RoomRow }) {
  const router = useRouter();

  // Keep separate busy flags so Edit does not block Toggle and vice-versa.
  const [toggleBusy, setToggleBusy] = useState(false);
  const [editOpen, setEditOpen] = useState(false);

  async function onToggle() {
    try {
      setToggleBusy(true);

      const res = await fetch("/api/admin/rooms/toggle-active", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roomId: room.id }),
      });

      const payload = await res.json().catch(() => ({}));

      if (!res.ok) {
        // ✅ Log in console for debugging (keeps UI clean)
        console.error("Toggle Active failed:", { status: res.status, payload });
        throw new Error(payload?.error ?? `Failed (${res.status})`);
      }

      // Re-fetch Server Component data (rooms list) after mutation
      router.refresh();
    } catch (e: any) {
      alert(e?.message ?? "Something went wrong");
    } finally {
      setToggleBusy(false);
    }
  }

  return (
    <div className="flex items-center gap-2">
      {/* Edit modal (prefilled instantly from `room`) */}
      <RoomEditModal
        open={editOpen}
        onClose={() => setEditOpen(false)}
        room={{
          id: room.id,
          name: room.name,
          building: room.building,
          floor: room.floor ?? null,
          capacity: room.capacity,
          amenities: room.amenities ?? [],
          is_active: room.is_active,
        }}
        onSaved={() => router.refresh()}
      />

      <button
        type="button"
        className="rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-60"
        disabled={toggleBusy}
        onClick={() => setEditOpen(true)}
      >
        Edit
      </button>

      <button
        type="button"
        className="rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-60"
        disabled={toggleBusy}
        onClick={onToggle}
      >
        {toggleBusy ? "Toggling..." : room.is_active === false ? "Activate" : "Deactivate"}
      </button>
    </div>
  );
}
