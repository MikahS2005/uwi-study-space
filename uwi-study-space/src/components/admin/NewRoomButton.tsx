// src/components/admin/NewRoomButton.tsx
//
// Client wrapper for the "+ New Room" button.
// We keep the Admin Rooms page as a Server Component, but this button needs state (modal open/close).

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { NewRoomModal } from "@/components/admin/NewRoomModal";

export function NewRoomButton() {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  return (
    <>
      <NewRoomModal
        open={open}
        onClose={() => setOpen(false)}
        onCreated={() => router.refresh()}
      />

      <button
        className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
        type="button"
        onClick={() => setOpen(true)}
      >
        + New Room
      </button>
    </>
  );
}
