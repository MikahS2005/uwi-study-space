// src/components/bookings/SlotPickerModalAutoOpen.tsx
"use client";

/**
 * SlotPickerModalAutoOpen
 * - Used on /rooms and /schedule
 * - Opens immediately when bookingDTO exists in the URL.
 * - When user closes, remove `bookRoomId` from the URL (keep other params).
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import SlotPicker from "@/components/bookings/SlotPicker";

type Slot = { start: string; end: string; isBooked: boolean };

export default function SlotPickerModalAutoOpen(props: {
  dto: {
    roomId: number;
    date: string;
    slots: Slot[];
    slotMinutes: number;
    maxConsecutive: number;
    maxDurationHours: number;
  };
}) {
  const router = useRouter();
  const pathname = usePathname(); // ✅ important: works on /rooms AND /schedule
  const sp = useSearchParams();

  const [open, setOpen] = useState(false);

  // Open immediately on mount (because user clicked "Book")
  useEffect(() => {
    setOpen(true);
  }, []);

  // Build close URL: remove bookRoomId only, keep everything else
  const closeUrl = useMemo(() => {
    const next = new URLSearchParams(sp.toString());
    next.delete("bookRoomId");

    const qs = next.toString();
    return `${pathname}${qs ? `?${qs}` : ""}`;
  }, [sp, pathname]);

  const close = useCallback(() => {
    setOpen(false);
    router.replace(closeUrl);
    router.refresh();
  }, [router, closeUrl]);

  // Close on Escape key
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") close();
    }
    if (open) window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, close]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50">
      {/* Backdrop */}
      <button
        type="button"
        aria-label="Close booking modal"
        onClick={close}
        className="absolute inset-0 cursor-default bg-black/40"
      />

      {/* Panel */}
      <div className="absolute left-1/2 top-1/2 w-[min(760px,92vw)] -translate-x-1/2 -translate-y-1/2 rounded-2xl bg-white p-5 shadow-xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold">Book this room</h2>
            <p className="mt-1 text-sm text-neutral-600">
              Date: <span className="font-medium">{props.dto.date}</span>
            </p>
          </div>

          <button
            type="button"
            onClick={close}
            className="rounded border px-3 py-1.5 text-sm hover:bg-neutral-50"
          >
            Close
          </button>
        </div>

        <div className="mt-4">
          <SlotPicker
            roomId={props.dto.roomId}
            slots={props.dto.slots}
            slotMinutes={props.dto.slotMinutes}
            maxConsecutive={props.dto.maxConsecutive}
            maxDurationHours={props.dto.maxDurationHours}
            onBooked={close} // ✅ closes after a successful booking
          />
        </div>
      </div>
    </div>
  );
}
