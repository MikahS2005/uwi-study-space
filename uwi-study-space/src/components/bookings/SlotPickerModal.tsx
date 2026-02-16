// src/components/bookings/SlotPickerModal.tsx
"use client";

/**
 * SlotPickerModal
 * - Keeps SlotPicker in a popup instead of inline on the page.
 * - UI team can redesign modal visuals later; keep structure + props.
 */

import { useEffect, useState } from "react";
import SlotPicker from "@/components/bookings/SlotPicker";

type Slot = {
  start: string;
  end: string;
  isBooked: boolean;
};

export default function SlotPickerModal(props: {
  roomId: number;
  date: string; // YYYY-MM-DD (for display only)
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

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
      >
        Book this room
      </button>

      {open ? (
        <div className="fixed inset-0 z-50">
          {/* Backdrop */}
          <button
            type="button"
            aria-label="Close modal"
            onClick={() => setOpen(false)}
            className="absolute inset-0 cursor-default bg-black/40"
          />

          {/* Modal panel */}
          <div className="absolute left-1/2 top-1/2 w-[min(720px,92vw)] -translate-x-1/2 -translate-y-1/2 rounded-2xl bg-white p-5 shadow-xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold">Select a time</h2>
                <p className="mt-1 text-sm text-neutral-600">
                  Date: <span className="font-medium">{props.date}</span>
                </p>
              </div>

              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded border px-3 py-1.5 text-sm hover:bg-neutral-50"
              >
                Close
              </button>
            </div>

            {/* SlotPicker inside the modal */}
            <div className="mt-4">
                <SlotPicker
                roomId={props.roomId}
                slots={props.slots}
                slotMinutes={props.slotMinutes}
                maxConsecutive={props.maxConsecutive}
                maxDurationHours={props.maxDurationHours}
                onBooked={() => setOpen(false)}
                />


            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
