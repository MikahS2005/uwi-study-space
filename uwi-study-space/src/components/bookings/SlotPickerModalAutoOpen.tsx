// src/components/bookings/SlotPickerModalAutoOpen.tsx
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import SlotPicker from "@/components/bookings/SlotPicker";

type Slot = { start: string; end: string; isBooked: boolean };

export default function SlotPickerModalAutoOpen(props: {
  dto: {
    roomId: number;
    roomName: string; // ✅ Update the type definition
    date: string;
    slots: Slot[];
    slotMinutes: number;
    maxConsecutive: number;
    maxDurationHours: number;
  };
}) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();

  const [open, setOpen] = useState(true);

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
        
        {/* Header Section */}
        <div className="flex items-start justify-between border-b border-gray-100 pb-4 mb-4">
          <div>
            {/* ✅ Updated Header with Room Name */}
            <h2 className="text-2xl font-bold text-black tracking-tight">
              Book this room ({props.dto.roomName})
            </h2>
            <p className="mt-1 text-sm font-medium text-gray-800">
              Date: <span className="font-bold text-black">{props.dto.date}</span>
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

        {/* Slot Selection Content */}
        <div className="max-h-[65vh] overflow-y-auto pr-1">
          <SlotPicker
            roomId={props.dto.roomId}
            slots={props.dto.slots}
            slotMinutes={props.dto.slotMinutes}
            maxConsecutive={props.dto.maxConsecutive}
            maxDurationHours={props.dto.maxDurationHours}
            onBooked={close}
          />
        </div>
      </div>
    </div>
  );
}