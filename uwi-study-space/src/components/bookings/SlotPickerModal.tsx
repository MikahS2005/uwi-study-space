// src/components/bookings/SlotPickerModal.tsx
// src/components/bookings/SlotPickerModalAutoOpen.tsx
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import SlotPicker from "@/components/bookings/SlotPicker";

type Slot = { start: string; end: string; isBooked: boolean };

export default function SlotPickerModalAutoOpen(props: {
  dto: {
    roomId: number;
    roomName: string;
    date: string;
    slots: Slot[];
    slotMinutes: number;
    bufferMinutes: number;
    maxConsecutive: number;      // hours (from server)
    maxDurationHours: number;    // hours (from server)
  };
}) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();

  const [open, setOpen] = useState(true);

  // Safety: ensure we always pass real numbers to SlotPicker (prevents NaN)
  const safe = useMemo(() => {
    const d = props.dto;

    const slotMinutes = Number(d.slotMinutes);
    const bufferMinutes = Number(d.bufferMinutes);

    const maxConsecutiveHours = Number(d.maxConsecutive);
    const maxBookingDurationHours = Number(d.maxDurationHours);

    return {
      ...d,
      slotMinutes: Number.isFinite(slotMinutes) ? slotMinutes : 60,
      bufferMinutes: Number.isFinite(bufferMinutes) ? bufferMinutes : 0,
      maxConsecutiveHours: Number.isFinite(maxConsecutiveHours) ? maxConsecutiveHours : 1,
      maxBookingDurationHours: Number.isFinite(maxBookingDurationHours) ? maxBookingDurationHours : 1,
    };
  }, [props.dto]);

  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "unset";
    };
  }, []);

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

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") close();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [close]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        onClick={close}
        className="fixed inset-0 h-full w-full bg-black/60 backdrop-blur-md"
        aria-hidden="true"
      />

      {/* Modal Panel */}
      <div className="relative z-[10000] w-full max-w-[760px] rounded-2xl bg-white p-6 shadow-2xl animate-in fade-in zoom-in duration-200">
        {/* Header */}
        <div className="flex items-start justify-between border-b border-gray-100 pb-4 mb-4">
          <div>
            <h2 className="text-2xl font-bold text-black tracking-tight">
              Book this room ({safe.roomName})
            </h2>
            <p className="mt-1 text-sm font-medium text-gray-800">
              Date: <span className="font-bold text-black">{safe.date}</span>
            </p>
          </div>

          <button
            type="button"
            onClick={close}
            className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-bold text-black shadow-sm hover:bg-gray-50 hover:border-gray-400"
          >
            Close
          </button>
        </div>

        {/* Slot Selection */}
        <div className="max-h-[65vh] overflow-y-auto pr-1">
          <SlotPicker
            roomId={safe.roomId}
            slots={safe.slots}
            slotMinutes={safe.slotMinutes}
            bufferMinutes={safe.bufferMinutes}
            maxConsecutiveHours={safe.maxConsecutiveHours}
            maxBookingDurationHours={safe.maxBookingDurationHours}
            onBooked={close}
          />
        </div>
      </div>
    </div>
  );
}