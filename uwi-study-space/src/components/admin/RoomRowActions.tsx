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

// src/components/admin/RoomRowActions.tsx
//
// Client-side actions for each room row.
// Matches the action-button language used across
// BookingsClient, UsersPage, and DepartmentsPage.

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { RoomRow } from "@/lib/db/rooms";
import { RoomEditModal } from "@/components/admin/RoomEditModal";

/* ─────────────────────────────────────────────────────────────
   Spinner
───────────────────────────────────────────────────────────── */
function Spinner({ size = 12, light = false }: { size?: number; light?: boolean }) {
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
        cx="12" cy="12" r="10"
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

/* ─────────────────────────────────────────────────────────────
   Toggle-confirmation modal
───────────────────────────────────────────────────────────── */
function ToggleConfirmModal({
  open,
  room,
  onClose,
  onConfirm,
}: {
  open: boolean;
  room: RoomRow | null;
  onClose: () => void;
  onConfirm: () => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);

  if (!open || !room) return null;

  const isActive = room.is_active !== false;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/30 backdrop-blur-[2px] p-4"
      onClick={(e) => { if (e.target === e.currentTarget && !busy) onClose(); }}
    >
      <div className="w-full max-w-md bg-white rounded-xl shadow-2xl border border-[#E5E7EB] overflow-hidden">

        {/* Header */}
        <div className="px-5 py-4 border-b border-[#E5E7EB] bg-[#F9FAFB]">
          <p className="text-[10px] font-semibold tracking-[0.18em] uppercase text-[#003595] mb-0.5">
            Admin Action
          </p>
          <h2
            style={{ fontFamily: "Georgia, serif" }}
            className="text-lg font-bold text-[#1F2937]"
          >
            {isActive ? "Deactivate Room" : "Activate Room"}
          </h2>
          <p className="mt-0.5 text-xs text-[#6B7280]">{room.name}</p>
        </div>

        {/* Body */}
        <div className="px-5 py-4">
          <p className="text-sm text-[#374151] leading-relaxed">
            {isActive ? (
              <>
                <span className="font-semibold text-[#1F2937]">"{room.name}"</span> will be
                marked as inactive and will no longer be bookable by students or staff.
                Existing bookings are unaffected.
              </>
            ) : (
              <>
                <span className="font-semibold text-[#1F2937]">"{room.name}"</span> will
                become active and available for new bookings.
              </>
            )}
          </p>
        </div>

        {/* Footer */}
        <div className="flex gap-2.5 px-5 pb-5">
          <button
            onClick={onClose}
            disabled={busy}
            className="flex-1 rounded-lg border border-[#E5E7EB] bg-white py-2.5 text-sm font-semibold text-[#374151] hover:bg-[#F3F4F6] disabled:opacity-50 transition-colors"
          >
            Cancel
          </button>
          <button
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              try { await onConfirm(); }
              finally { setBusy(false); }
            }}
            className={`flex-1 inline-flex items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-bold text-white disabled:opacity-50 transition-colors ${
              isActive
                ? "bg-amber-500 hover:bg-amber-600"
                : "bg-emerald-600 hover:bg-emerald-700"
            }`}
          >
            {busy ? (
              <><Spinner light size={14} />{isActive ? "Deactivating…" : "Activating…"}</>
            ) : (
              isActive ? "Deactivate" : "Activate"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
   Main export
───────────────────────────────────────────────────────────── */
export function RoomRowActions({ room }: { room: RoomRow }) {
  const router = useRouter();

  const [editOpen, setEditOpen] = useState(false);
  const [toggleBusy, setToggleBusy] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const isActive = room.is_active !== false;

  async function doToggle() {
    try {
      setToggleBusy(true);

      const res = await fetch("/api/admin/rooms/toggle-active", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roomId: room.id }),
      });

      const payload = await res.json().catch(() => ({}));

      if (!res.ok) {
        console.error("Toggle Active failed:", { status: res.status, payload });
        throw new Error(payload?.error ?? `Failed (${res.status})`);
      }

      setConfirmOpen(false);
      router.refresh();
    } catch (e: any) {
      alert(e?.message ?? "Something went wrong.");
    } finally {
      setToggleBusy(false);
    }
  }

  return (
    <>
      <div className="flex items-center justify-end flex-wrap gap-1.5">
        {/* Edit */}
        <button
          type="button"
          onClick={() => setEditOpen(true)}
          className="rounded-lg border border-[#003595]/20 bg-[#EAF6FF] px-2.5 py-1.5 text-[11px] font-bold text-[#003595] hover:bg-[#003595] hover:text-white transition-all whitespace-nowrap"
        >
          Edit
        </button>

        {/* Toggle active / inactive */}
        <button
          type="button"
          disabled={toggleBusy}
          onClick={() => setConfirmOpen(true)}
          className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[11px] font-semibold transition-colors whitespace-nowrap disabled:opacity-50 ${
            isActive
              ? "border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100"
              : "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
          }`}
        >
          {toggleBusy ? (
            <><Spinner size={11} />{isActive ? "Deactivating" : "Activating"}</>
          ) : (
            isActive ? "Deactivate" : "Activate"
          )}
        </button>
      </div>

      {/* Edit modal — prefilled from room prop */}
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
          image_url: Array.isArray(room.image_url)
            ? room.image_url
            : room.image_url
              ? [room.image_url]
              : [],
          is_active: room.is_active,
        }}
        onSaved={() => router.refresh()}
      />

      {/* Toggle confirmation modal */}
      <ToggleConfirmModal
        open={confirmOpen}
        room={room}
        onClose={() => setConfirmOpen(false)}
        onConfirm={doToggle}
      />
    </>
  );
}
