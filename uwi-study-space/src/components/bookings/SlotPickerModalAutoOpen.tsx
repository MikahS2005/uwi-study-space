// src/components/bookings/SlotPickerModalAutoOpen.tsx
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import SlotPicker from "@/components/bookings/SlotPicker";

type Slot = { start: string; end: string; isBooked: boolean };

function parseYmdLocal(dateStr: string) {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function getFriendlyDateLabel(dateStr: string) {
  const input = parseYmdLocal(dateStr);
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

export default function SlotPickerModalAutoOpen(props: {
  dto: {
    roomId: number;
    roomName: string;
    date: string;
    slots: Slot[];
    slotMinutes: number;
    bufferMinutes: number;
    maxConsecutive: number;
    maxDurationHours: number;
  };
}) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();

  const [open, setOpen] = useState(true);

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
    <div className="fixed inset-0 z-[9999] flex items-start justify-center p-3 sm:items-center sm:p-6">
      {/* Backdrop */}
      <button
        type="button"
        aria-label="Close modal"
        onClick={close}
        className="absolute inset-0 bg-[rgba(18,18,18,0.58)] backdrop-blur-[6px]"
      />

      {/* Panel */}
     <div className="relative z-[10000] flex h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-[32px] border border-[var(--color-border-light)] bg-white shadow-[0_30px_80px_rgba(0,0,0,0.28)]">
        {/* Header */}
        <div className="border-b border-[var(--color-border-light)] bg-[linear-gradient(135deg,var(--color-background-light)_0%,var(--color-primary-soft)_100%)] px-6 py-6 sm:px-8">
          <div className="flex items-start justify-between gap-4">
            <div className="flex min-w-0 items-start gap-4">
              <div className="hidden h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-white shadow-sm sm:flex">
                <svg
                  aria-hidden="true"
                  viewBox="0 0 24 24"
                  className="h-6 w-6 text-[var(--color-primary)]"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
                  <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2Z" />
                </svg>
              </div>

              <div className="min-w-0">
                <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-white/80 px-3 py-1 text-xs font-semibold text-[var(--color-primary)] backdrop-blur">
                  <span className="inline-block h-2 w-2 rounded-full bg-[var(--color-primary)]" />
                  Booking assistant
                </div>

                <h2 className="truncate text-2xl font-bold tracking-tight text-[var(--color-text-light)] sm:text-3xl">
                  {safe.roomName}
                </h2>

                <p className="mt-1 text-sm text-[var(--color-text-light)]/72">
                  Select available time slots and confirm your booking.
                </p>

                <div className="mt-4 flex flex-wrap gap-2">
                  <span className="rounded-full border border-[var(--color-border-light)] bg-white px-3 py-1.5 text-xs font-semibold text-[var(--color-primary)] shadow-sm">
                    {getFriendlyDateLabel(safe.date)}
                  </span>

                  <span className="rounded-full border border-[var(--color-border-light)] bg-white px-3 py-1.5 text-xs font-semibold text-[var(--color-text-light)] shadow-sm">
                    {safe.slotMinutes}-minute slots
                  </span>

                  {safe.bufferMinutes > 0 ? (
                    <span className="rounded-full border border-[var(--color-border-light)] bg-white px-3 py-1.5 text-xs font-semibold text-[var(--color-text-light)] shadow-sm">
                      {safe.bufferMinutes} min buffer
                    </span>
                  ) : null}
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={close}
              className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-[var(--color-border-light)] bg-white text-[var(--color-text-light)] shadow-sm hover:bg-[var(--color-secondary)]"
              aria-label="Close"
            >
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M6 18 18 6" strokeLinecap="round" strokeLinejoin="round" />
                <path d="m6 6 12 12" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="min-h-0 flex-1 overflow-hidden bg-white px-6 py-6 sm:px-8">
          <div className="h-full overflow-hidden">
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

        {/* Footer */}
        <div className="shrink-0 border-t border-[var(--color-border-light)] bg-[var(--color-surface-light)] px-6 py-4 sm:px-8">
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={close}
              className="rounded-2xl border border-[var(--color-border-light)] bg-white px-5 py-2.5 text-sm font-bold text-[var(--color-text-light)] shadow-sm transition-all hover:bg-[var(--color-secondary)]"
            >
              Cancel
            </button>

            <div id="confirm-button-anchor" className="flex-shrink-0" />
          </div>
        </div>
      </div>
    </div>
  );
}