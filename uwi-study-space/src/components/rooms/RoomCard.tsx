"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { toggleFavoriteAction } from "@/lib/actions/favourites"; 
const DEFAULT_IMAGE = "/ajl_normal.jpg";

type Tone = "primary" | "amber" | "green" | "red";

type Badge = {
  tone: Tone;
  text: string;
};

type RoomCardStatus = {
  isClosed: boolean;
  blackoutReason: string | null;
  openLabel: string;
  openNow: boolean | null;
};

export default function RoomCard(props: {
  room: any;
  preserve: any;
  status?: RoomCardStatus;
  isFavorited: boolean;
}) {
  const r = props.room;
  const roomId = typeof r.id === "number" ? r.id : Number(r.id);
  const selectedDate = props.preserve?.date as string;

  // --- Favorites Logic ---
  const [favorited, setFavorited] = useState(props.isFavorited);
  const [isPending, startTransition] = useTransition();

  function handleToggleFavorite(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    setFavorited((prev) => !prev); // Optimistic

    startTransition(async () => {
      try {
        await toggleFavoriteAction(roomId);
      } catch (err) {
        setFavorited((prev) => !prev); // Revert
        console.error("Failed to toggle favorite", err);
      }
    });
  }

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

  const deptName = Array.isArray(r.department) ? r.department[0]?.name ?? "—" : r.department?.name ?? "—";
  const bufferMinutes = Number(r.buffer_minutes ?? 0);

  const amenities = Array.isArray(r.amenities) ? r.amenities.slice(0, 4) : [];

  /**
   * Primary status:
   * - blackout takes priority
   * - then closed-day
   * - if neither, no primary badge
   */
  const primaryBadge = useMemo<Badge | null>(() => {
    const st = props.status;
    if (!st) return null;

    if (st.blackoutReason) {
      return { tone: "amber", text: `Temporarily closed: ${st.blackoutReason}` };
    }

    if (st.isClosed) {
      return { tone: "primary", text: "Closed" };
    }

    return null;
  }, [props.status]);

  /**
   * "Open now / Closed now" should only appear
   * when there is NO stronger primary badge.
   * This prevents duplicate states such as:
   * "Closed" + "Closed now"
   */
  const nowBadge = useMemo<Badge | null>(() => {
    const st = props.status;
    if (!st || st.openNow == null) return null;
    if (primaryBadge) return null;

    return st.openNow
      ? { tone: "green", text: "Open now" }
      : { tone: "red", text: "Closed now" };
  }, [props.status, primaryBadge]);

  function badgeClasses(tone: Tone) {
    switch (tone) {
      case "primary":
        return "bg-[var(--color-primary-dark)] text-white";
      case "amber":
        return "bg-amber-500 text-black";
      case "green":
        return "bg-green-600 text-white";
      case "red":
        return "bg-red-600 text-white";
    }
  }

  return (
    <article className="group overflow-hidden rounded-[26px] border border-[var(--color-border-light)] bg-[var(--color-background-light)] shadow-[0_10px_30px_rgba(17,24,39,0.08)] transition-all duration-300 hover:-translate-y-1.5 hover:shadow-[0_24px_50px_rgba(0,53,149,0.14)]">
      {/* Image */}
      <div className="relative h-52 overflow-hidden bg-[var(--color-surface-light)]">
        <img
          src={r.image_url || DEFAULT_IMAGE}
          alt={r.name}
          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.04]"
          onError={(e) => {
            (e.target as HTMLImageElement).src = DEFAULT_IMAGE;
          }}
        />

        {/* Dark overlay for depth */}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/40 via-black/5 to-transparent" />

        {/* Department chip */}
        <div className="absolute left-4 bottom-4 z-10">
          <span className="inline-flex items-center rounded-full border border-white/25 bg-white/12 px-3 py-1 text-xs font-semibold text-white backdrop-blur-md">
            {deptName}
          </span>
        </div>

        {/* Status badges */}
        {primaryBadge ? (
          <div className="absolute left-4 top-4 z-10">
            <span
              className={`inline-flex max-w-[240px] items-center rounded-full px-3 py-1.5 text-xs font-bold shadow-lg ${badgeClasses(
                primaryBadge.tone
              )}`}
              title={primaryBadge.text}
            >
              {primaryBadge.text}
            </span>
          </div>
        ) : null}

        {/* 'Now' badge */}
        {nowBadge ? (
          <div className="absolute right-4 top-4 z-10">
            <span
              className={`inline-flex items-center rounded-full px-3 py-1.5 text-xs font-bold shadow-lg ${badgeClasses(
                nowBadge.tone
              )}`}
              title={nowBadge.text}
            >
              {nowBadge.text}
            </span>
          </div>
        ) : null}
      </div>

      {/* Body */}
      <div className="p-5">
        {/* ROOM NAME AND FAVORITE BUTTON */}
        <div className="mb-3 flex items-start justify-between gap-4">
          <h2 className="text-[1.35rem] font-bold leading-tight tracking-tight text-[var(--color-text-light)]">
            {r.name}
          </h2>
          
          <button
            onClick={handleToggleFavorite}
            disabled={isPending}
            className="flex shrink-0 items-center justify-center rounded-full p-1 transition hover:scale-110 active:scale-95"
            title={favorited ? "Remove from favorites" : "Add to favorites"}
          >
            <svg
              width="22"
              height="22"
              viewBox="0 0 24 24"
              fill={favorited ? "#ef4444" : "none"} // Solid Red if favorited
              stroke={favorited ? "#ef4444" : "var(--color-border-dark)"}
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="transition-colors"
            >
              <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" />
            </svg>
          </button>
        </div>

        <p className="mb-4 text-sm text-[var(--color-text-light)]/78">
          {r.building}
          {r.floor ? ` • Floor ${r.floor}` : ""}
        </p>

        {/* Primary room facts */}
        <div className="mb-4 flex flex-wrap gap-2">
          <span className="rounded-full border border-[var(--color-border-light)] bg-[var(--color-surface-light)] px-3 py-1.5 text-xs font-semibold text-[var(--color-text-light)]">
            Capacity {r.capacity}
          </span>

          {props.status?.openLabel ? (
            <span className="rounded-full border border-[var(--color-border-light)] bg-white px-3 py-1.5 text-xs font-semibold text-[var(--color-text-light)]">
              Hours {props.status.openLabel}
            </span>
          ) : null}

          {bufferMinutes > 0 ? (
            <span className="rounded-full border border-[var(--color-border-light)] bg-white px-3 py-1.5 text-xs font-semibold text-[var(--color-text-light)]">
              {bufferMinutes} min buffer
            </span>
          ) : null}
        </div>

        {/* Amenities */}
        <div className="mb-5 flex min-h-[56px] flex-wrap gap-2">
          {amenities.length > 0 ? (
            amenities.map((a: string) => (
              <span
                key={a}
                className="rounded-full border border-[var(--color-border-light)] bg-[var(--color-primary-soft)] px-3 py-1.5 text-xs font-semibold text-[var(--color-primary)]"
              >
                {a}
              </span>
            ))
          ) : (
            <span className="text-sm italic text-[var(--color-text-light)]/45">
              No amenities listed
            </span>
          )}
        </div>

        {/* CTA */}
        <Link
          href={`/rooms?${qs}`}
          className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-[var(--color-primary)] px-4 py-3.5 text-sm font-semibold text-white shadow-[0_12px_24px_rgba(0,53,149,0.20)] transition-all hover:bg-[var(--color-primary-dark)]"
        >
          <span>Book Room</span>
          <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            className="h-4 w-4"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="M5 12h14" />
            <path d="m13 5 7 7-7 7" />
          </svg>
        </Link>
      </div>
    </article>
  );
}