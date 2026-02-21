// src/components/rooms/RoomCard.tsx
"use client";

import Link from "next/link";
import { useMemo } from "react";

const DEFAULT_IMAGE = "/ajl_normal.jpg";

type Tone = "gray" | "amber" | "green" | "red";
type Badge = { tone: Tone; text: string };

type RoomCardStatus = {
  isClosed: boolean; // outside opening hours OR closed day
  blackoutReason: string | null; // if temporarily closed
  openLabel: string ; // optional if you want to show it
  openNow: boolean | null; 
};

export default function RoomCard(props: {
  room: any;
  preserve: any; // includes date
  status?: RoomCardStatus; // ✅ passed from server
}) {
  const r = props.room;
  const roomId = typeof r.id === "number" ? r.id : Number(r.id);
  const selectedDate = props.preserve?.date as string;

  // Build booking link
  const qs = useMemo(() => {
    const q = new URLSearchParams();
    if (props.preserve.building) q.set("building", props.preserve.building);
    if (props.preserve.amenity) q.set("amenity", props.preserve.amenity);
    if (props.preserve.minCapacityRaw) q.set("minCapacity", props.preserve.minCapacityRaw);
    q.set("date", selectedDate);
    q.set("bookRoomId", String(roomId));
    return q.toString();
  }, [props.preserve, selectedDate, roomId]);

  const deptName = Array.isArray(r.department)
    ? r.department[0]?.name ?? "—"
    : r.department?.name ?? "—";

  const bufferMinutes = Number(r.buffer_minutes ?? 0);

  const primaryBadge = useMemo<Badge | null>(() => {
    const st = props.status;
    if (!st) return null;

    // blackout takes priority (temporary closure)
    if (st.blackoutReason) {
      return { tone: "amber", text: `Temporarily closed: ${st.blackoutReason}` };
    }

    if (st.isClosed) {
      return { tone: "gray", text: "Closed" };
    }

    return null;
  }, [props.status]);

  const nowBadge = useMemo<Badge | null>(() => {
    const st = props.status;
    if (!st || st.openNow == null) return null;
    return st.openNow ? { tone: "green", text: "Open now" } : { tone: "red", text: "Closed now" };
  }, [props.status]);

  function badgeStyle(tone: Tone) {
    switch (tone) {
      case "gray":
        return { backgroundColor: "#111827", color: "#ffffff" };
      case "amber":
        return { backgroundColor: "#f59e0b", color: "#000000" };
      case "green":
        return { backgroundColor: "#16a34a", color: "#ffffff" };
      case "red":
        return { backgroundColor: "#dc2626", color: "#ffffff" };
    }
  }

  return (
    <div className="flex flex-col overflow-visible rounded-xl border bg-white shadow-sm transition hover:shadow-md">
      {/* IMAGE SECTION */}
      <div className="relative h-44 w-full bg-gray-100 overflow-visible">
        <img
          src={r.image_url || DEFAULT_IMAGE}
          alt={r.name}
          className="h-full w-full object-cover"
          onError={(e) => {
            (e.target as HTMLImageElement).src = DEFAULT_IMAGE;
          }}
        />

        {/* Primary badge */}
        {primaryBadge ? (
          <div className="absolute left-3 top-3 z-10">
            <span
              style={badgeStyle(primaryBadge.tone)}
              className="inline-flex max-w-[calc(100vw-4rem)] items-center rounded-full px-3 py-1 text-xs font-bold shadow"
              title={primaryBadge.text}
            >
              {primaryBadge.text}
            </span>
          </div>
        ) : null}

        {/* Optional “now” badge */}
        {nowBadge ? (
          <div className="absolute right-3 top-3 z-10">
            <span
              style={badgeStyle(nowBadge.tone)}
              className="inline-flex items-center rounded-full px-3 py-1 text-xs font-bold shadow"
              title={nowBadge.text}
            >
              {nowBadge.text}
            </span>
          </div>
        ) : null}
      </div>

      {/* CONTENT */}
      <div className="p-5">
        <h2 className="text-lg font-bold text-black uppercase tracking-tight">{r.name}</h2>

        <p className="mt-2 text-sm font-medium text-gray-900">
          {r.building}
          {r.floor ? ` • Floor ${r.floor}` : ""} • Capacity {r.capacity}
        </p>

        <p className="mt-1 text-xs font-semibold text-gray-700">Department: {deptName}</p>

        {/* meta pills */}
        <div className="mt-3 flex flex-wrap gap-2">
          {props.status?.openLabel ? (
            <span className="rounded-full bg-white px-3 py-1 text-xs font-bold text-gray-900 border border-gray-300">
              Hours: {props.status.openLabel}
            </span>
          ) : null}

          {bufferMinutes > 0 ? (
            <span className="rounded-full bg-white px-3 py-1 text-xs font-bold text-gray-900 border border-gray-300">
              {bufferMinutes} min buffer
            </span>
          ) : null}
        </div>

        {/* amenities */}
        <div className="mt-3 flex flex-wrap gap-2">
          {(r.amenities ?? []).length > 0 ? (
            r.amenities!.slice(0, 4).map((a: string) => (
              <span
                key={a}
                className="rounded-full bg-gray-200 px-3 py-1 text-xs font-bold text-gray-800 border border-gray-300"
              >
                {a}
              </span>
            ))
          ) : (
            <span className="text-xs italic text-gray-500">No amenities listed</span>
          )}
        </div>

        <div className="mt-5">
          <Link
            href={`/rooms?${qs}`}
            className="inline-flex w-full items-center justify-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-bold text-white transition hover:bg-blue-700 shadow-sm"
          >
            Book Room
          </Link>
        </div>
      </div>
    </div>
  );
}