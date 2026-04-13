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
        type="button"
        onClick={() => setOpen(true)}
        className="
          inline-flex items-center gap-2
          rounded-xl
          bg-[var(--color-primary)]
          px-4 py-2.5
          text-sm font-semibold text-white
          shadow-sm
          transition-all duration-150
          hover:bg-[var(--color-primary-dark)]
          active:scale-[0.98]
          focus:outline-none
          focus:ring-2
          focus:ring-[var(--color-primary)]/40
        "
      >
        <span className="text-base leading-none">+</span>
        New Room
      </button>
    </>
  );
}
