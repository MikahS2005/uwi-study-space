// src/components/bookings/useRoomAvailability.ts
"use client";

/**
 * Small hook to fetch availability.
 * The UI team can call this when a user selects a date tab.
 */

import { useEffect, useState } from "react";

export type Slot = { start: string; end: string; isBooked: boolean };

export function useRoomAvailability(roomId: number, ymd: string) {
  const [slots, setSlots] = useState<Slot[]>([]);
  const [slotMinutes, setSlotMinutes] = useState<number>(60);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!roomId || !ymd) return;

    let cancelled = false;
    setLoading(true);
    setError(null);

    fetch(`/api/rooms/${roomId}/availability?date=${encodeURIComponent(ymd)}`)
      .then(async (r) => {
        const data = await r.json().catch(() => null);
        if (!r.ok) throw new Error(data?.error ?? "Failed to load availability");
        return data;
      })
      .then((data) => {
        if (cancelled) return;
        setSlots(Array.isArray(data?.slots) ? data.slots : []);
        setSlotMinutes(typeof data?.slotMinutes === "number" ? data.slotMinutes : 60);
      })
      .catch((e) => {
        if (cancelled) return;
        setError(e?.message ?? "Error");
      })
      .finally(() => {
        if (cancelled) return;
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [roomId, ymd]);

  return { slots, slotMinutes, loading, error };
}
