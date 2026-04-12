"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";

export default function RoomFilters(props: { basePath?: string } = {}) {
  const basePath = props.basePath ?? "/rooms";

  const router = useRouter();
  const sp = useSearchParams();

  const [building, setBuilding] = useState(sp.get("building") ?? "");
  const [minCapacity, setMinCapacity] = useState(sp.get("minCapacity") ?? "");
  const [amenity, setAmenity] = useState(sp.get("amenity") ?? "");

  const quickAmenities = ["Whiteboard", "Projector", "AC", "TV", "Cameras"];

  const nextUrl = useMemo(() => {
    const params = new URLSearchParams(sp.toString());

    if (building.trim()) params.set("building", building.trim());
    else params.delete("building");

    if (minCapacity.trim()) params.set("minCapacity", minCapacity.trim());
    else params.delete("minCapacity");

    if (amenity.trim()) params.set("amenity", amenity.trim());
    else params.delete("amenity");

    params.delete("page");

    const qs = params.toString();
    return `${basePath}${qs ? `?${qs}` : ""}`;
  }, [sp, basePath, building, minCapacity, amenity]);

  function handleReset() {
    setBuilding("");
    setMinCapacity("");
    setAmenity("");
    router.replace(basePath);
  }

  return (
    <section className="rounded-2xl border border-[var(--color-border-light)] bg-white p-4 shadow-sm md:p-5">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          router.replace(nextUrl);
        }}
        className="space-y-4"
      >
        {/* Top row */}
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-base font-semibold text-[var(--color-text-light)]">Filters</h2>
            <p className="text-sm text-[var(--color-text-light)]/60">
              Narrow rooms by location, capacity, or amenity.
            </p>
          </div>

          <button
            type="button"
            onClick={handleReset}
            className="inline-flex w-fit items-center justify-center rounded-xl border border-[var(--color-border-light)] bg-white px-4 py-2 text-sm font-medium text-[var(--color-text-light)] transition-colors hover:bg-[var(--color-secondary)]"
          >
            Reset
          </button>
        </div>

        {/* Inputs */}
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {/* Building */}
          <div>
            <label className="mb-1.5 block text-xs font-medium uppercase tracking-[0.16em] text-[var(--color-text-light)]/55">
              Building
            </label>
            <div className="flex items-center rounded-xl border border-[var(--color-border-light)] bg-[var(--color-surface-light)] px-3 focus-within:border-[var(--color-primary)] focus-within:bg-white">
              <svg
                aria-hidden="true"
                viewBox="0 0 24 24"
                className="h-4 w-4 shrink-0 text-[var(--color-primary)]/55"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M3 21h18" />
                <path d="M5 21V7l7-4 7 4v14" />
                <path d="M9 9h.01" />
                <path d="M9 13h.01" />
                <path d="M9 17h.01" />
                <path d="M15 9h.01" />
                <path d="M15 13h.01" />
                <path d="M15 17h.01" />
              </svg>
              <input
                className="w-full bg-transparent px-3 py-2.5 text-sm text-[var(--color-text-light)] outline-none placeholder:text-[var(--color-text-light)]/35"
                placeholder="Alma Jordan Library"
                value={building}
                onChange={(e) => setBuilding(e.target.value)}
              />
            </div>
          </div>

          {/* Capacity */}
          <div>
            <label className="mb-1.5 block text-xs font-medium uppercase tracking-[0.16em] text-[var(--color-text-light)]/55">
              Minimum capacity
            </label>
            <div className="flex items-center rounded-xl border border-[var(--color-border-light)] bg-[var(--color-surface-light)] px-3 focus-within:border-[var(--color-primary)] focus-within:bg-white">
              <svg
                aria-hidden="true"
                viewBox="0 0 24 24"
                className="h-4 w-4 shrink-0 text-[var(--color-primary)]/55"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                <circle cx="8.5" cy="7" r="4" />
                <path d="M20 8v6" />
                <path d="M23 11h-6" />
              </svg>
              <input
                className="w-full bg-transparent px-3 py-2.5 text-sm text-[var(--color-text-light)] outline-none placeholder:text-[var(--color-text-light)]/35"
                placeholder="6"
                value={minCapacity}
                onChange={(e) => setMinCapacity(e.target.value)}
                inputMode="numeric"
              />
            </div>
          </div>

          {/* Amenity */}
          <div>
            <label className="mb-1.5 block text-xs font-medium uppercase tracking-[0.16em] text-[var(--color-text-light)]/55">
              Amenity
            </label>
            <div className="flex items-center rounded-xl border border-[var(--color-border-light)] bg-[var(--color-surface-light)] px-3 focus-within:border-[var(--color-primary)] focus-within:bg-white">
              <svg
                aria-hidden="true"
                viewBox="0 0 24 24"
                className="h-4 w-4 shrink-0 text-[var(--color-primary)]/55"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M20 7h-9" />
                <path d="M14 17H5" />
                <circle cx="17" cy="17" r="3" />
                <circle cx="7" cy="7" r="3" />
              </svg>
              <input
                className="w-full bg-transparent px-3 py-2.5 text-sm text-[var(--color-text-light)] outline-none placeholder:text-[var(--color-text-light)]/35"
                placeholder="Whiteboard"
                value={amenity}
                onChange={(e) => setAmenity(e.target.value)}
              />
            </div>
          </div>

          {/* Apply button */}
          <div className="flex items-end">
            <button
              type="submit"
              className="inline-flex w-full items-center justify-center rounded-xl bg-[var(--color-primary)] px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[var(--color-primary-dark)]"
            >
              Apply filters
            </button>
          </div>
        </div>

        {/* Quick amenities */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="mr-1 text-xs font-medium uppercase tracking-[0.16em] text-[var(--color-text-light)]/50">
            Quick picks
          </span>

          {quickAmenities.map((item) => {
            const active = amenity.trim().toLowerCase() === item.toLowerCase();

            return (
              <button
                key={item}
                type="button"
                onClick={() => setAmenity(active ? "" : item)}
                className={[
                  "rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                  active
                    ? "border-[var(--color-primary)] bg-[var(--color-primary-soft)] text-[var(--color-primary)]"
                    : "border-[var(--color-border-light)] bg-white text-[var(--color-text-light)]/70 hover:border-[var(--color-primary)] hover:text-[var(--color-primary)]",
                ].join(" ")}
              >
                {item}
              </button>
            );
          })}
        </div>
      </form>
    </section>
  );
}