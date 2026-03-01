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
    date: string; // YYYY-MM-DD
    slots: Slot[];
    slotMinutes: number;
    bufferMinutes: number;
    maxConsecutive: number; // hours (from server)
    maxDurationHours: number; // hours (from server)
  };
}) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();

  // Auto-open modal on mount (this component is used only when we *want* it open)
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
      slotMinutes: Number.isFinite(slotMinutes) && slotMinutes > 0 ? slotMinutes : 60,
      bufferMinutes: Number.isFinite(bufferMinutes) && bufferMinutes >= 0 ? bufferMinutes : 0,
      maxConsecutiveHours:
        Number.isFinite(maxConsecutiveHours) && maxConsecutiveHours > 0 ? maxConsecutiveHours : 1,
      maxBookingDurationHours:
        Number.isFinite(maxBookingDurationHours) && maxBookingDurationHours > 0
          ? maxBookingDurationHours
          : 1,
    };
  }, [props.dto]);

  // Lock background scroll while open
  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "unset";
    };
  }, []);

  // Build URL that removes the query param that opened this modal
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

  // Escape closes modal
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") close();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [close]);

  if (!open) return null;

  function getFriendlyDateLabel(dateStr: string) {
    const input = new Date(dateStr);
    const today = new Date();
    const d1 = new Date(input.getFullYear(), input.getMonth(), input.getDate());
    const d2 = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const diffDays = Math.round((d1.getTime() - d2.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return "Today";
    if (diffDays === 1) return "Tomorrow";

    return input.toLocaleDateString(undefined, {
      weekday: "long",
      month: "long",
      day: "numeric",
    });
  }

  return (
    <>
      {/* Isabella UI: Modal overlay */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        {/* Backdrop */}
        <button
          type="button"
          aria-label="Close modal"
          onClick={close}
          className="absolute inset-0 bg-[#121212]/60 backdrop-blur-sm"
        />

        {/* Modal Window */}
        <div className="relative w-[min(720px,92vw)] h-[80vh] bg-white rounded-2xl shadow-2xl flex flex-col overflow-hidden border border-[#E5E7EB]">
          {/* Header */}
          <div className="px-8 py-6 bg-[#EAF6FF]/30 border-b border-[#E5E7EB] shrink-0">
            <div className="flex justify-between items-start gap-4">
              <div className="min-w-0">
                <h2 className="text-2xl font-black text-[#1F2937] truncate">
                  Book this room <span className="text-[#003595]">({safe.roomName})</span>
                </h2>
                <p className="mt-1 text-sm text-[#1F2937]/70 font-medium">
                  Available sessions for{" "}
                  <span className="text-[#003595] font-bold">{getFriendlyDateLabel(safe.date)}</span>
                </p>
              </div>

              <button
                type="button"
                onClick={close}
                className="text-[#1F2937]/40 hover:text-[#1F2937] transition-colors"
                aria-label="Close"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto px-8 py-6 min-h-0 bg-white">
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

          {/* Footer */}
          <div className="border-t border-[#E5E7EB] px-8 py-4 flex items-center justify-between bg-[#F9FAFB] shrink-0">
            <button
              type="button"
              onClick={close}
              className="rounded-xl border border-[#E5E7EB] bg-white px-5 py-2.5 text-sm font-bold text-[#1F2937] hover:bg-[#F3F4F6] transition-all"
            >
              Cancel
            </button>

            {/* SlotPicker already contains the confirm button.
                Keeping this anchor for future if you decide to portal the button out. */}
            <div id="confirm-button-anchor" className="flex-shrink-0" />
          </div>
        </div>
      </div>
    </>
  );
}