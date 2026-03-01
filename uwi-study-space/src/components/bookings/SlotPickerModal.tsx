"use client";

import { useEffect, useState } from "react";
import SlotPicker from "@/components/bookings/SlotPicker";

type Slot = {
  start: string;
  end: string;
  isBooked: boolean;
};

export default function SlotPickerModal(props: {
  roomId: number;
  date: string; // YYYY-MM-DD
  slots: Slot[];
  slotMinutes: number;
  maxConsecutive: number;
  maxDurationHours: number;
}) {
  const [open, setOpen] = useState(false);

  // Close on Escape
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    if (open) window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open]);

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
      {/* Trigger Button - Uses Primary Blue (#003595) */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-xl bg-[#003595] px-6 py-3 text-sm font-bold text-white hover:bg-[#002366] transition-all shadow-md shadow-blue-900/10 active:scale-95"
      >
        Book this room
      </button>

      {open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          
          {/* Backdrop - Darkened for focus */}
          <button
            type="button"
            aria-label="Close modal"
            onClick={() => setOpen(false)}
            className="absolute inset-0 bg-[#121212]/60 backdrop-blur-sm"
          />

          {/* Modal Window */}
          <div className="relative w-[min(720px,92vw)] h-[80vh] bg-white rounded-2xl shadow-2xl flex flex-col overflow-hidden border border-[#E5E7EB]">

            {/* HEADER - Uses Soft Blue background accent */}
            <div className="px-8 py-6 bg-[#EAF6FF]/30 border-b border-[#E5E7EB] shrink-0">
              <div className="flex justify-between items-start">
                <div>
                  <h2 className="text-2xl font-black text-[#1F2937]">Select Time Slots</h2>
                  <p className="mt-1 text-sm text-[#1F2937]/70 font-medium">
                    Available sessions for <span className="text-[#003595] font-bold">{getFriendlyDateLabel(props.date)}</span>
                  </p>
                </div>
                <button 
                  onClick={() => setOpen(false)}
                  className="text-[#1F2937]/40 hover:text-[#1F2937] transition-colors"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            {/* CONTENT AREA */}
            <div className="flex-1 overflow-y-auto px-8 py-6 min-h-0 bg-white">
              <SlotPicker
                roomId={props.roomId}
                slots={props.slots}
                slotMinutes={props.slotMinutes}
                maxConsecutive={props.maxConsecutive}
                maxDurationHours={props.maxDurationHours}
                onBooked={() => setOpen(false)}
              />
            </div>

            {/* FOOTER - Sticky Action Bar */}
            <div className="border-t border-[#E5E7EB] px-8 py-4 flex items-center justify-between bg-[#F9FAFB] shrink-0">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-xl border border-[#E5E7EB] bg-white px-5 py-2.5 text-sm font-bold text-[#1F2937] hover:bg-[#F3F4F6] transition-all"
              >
                Cancel
              </button>

              {/* Confirm button is usually injected by SlotPicker here */}
              <div id="confirm-button-anchor" className="flex-shrink-0" />
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}