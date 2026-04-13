"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";

type DepartmentOption = {
  id: number;
  name: string;
};

type RoomFiltersProps = {
  basePath?: string;
  departments?: DepartmentOption[];
  floors?: string[];
  amenities?: string[];
};

export default function RoomFilters({
  basePath = "/rooms",
  departments = [],
  floors = [],
  amenities = [],
}: RoomFiltersProps = {}) {
  const router = useRouter();
  const sp = useSearchParams();

  // Defensive normalization for props that may not be arrays at runtime
  const safeDepartments = Array.isArray(departments) ? departments : [];
  const safeFloors = Array.isArray(floors) ? floors : [];
  const safeAmenities = Array.isArray(amenities) ? amenities : [];

  const [departmentId, setDepartmentId] = useState(sp.get("departmentId") ?? "");
  const [floor, setFloor] = useState(sp.get("floor") ?? "");
  const [minCapacity, setMinCapacity] = useState(sp.get("minCapacity") ?? "");
  const [maxCapacity, setMaxCapacity] = useState(sp.get("maxCapacity") ?? "");
  const [amenity, setAmenity] = useState(sp.get("amenity") ?? "");

  const nextUrl = useMemo(() => {
    const params = new URLSearchParams(sp.toString());

    if (departmentId.trim()) params.set("departmentId", departmentId.trim());
    else params.delete("departmentId");

    if (floor.trim()) params.set("floor", floor.trim());
    else params.delete("floor");

    if (minCapacity.trim()) params.set("minCapacity", minCapacity.trim());
    else params.delete("minCapacity");

    if (maxCapacity.trim()) params.set("maxCapacity", maxCapacity.trim());
    else params.delete("maxCapacity");

    if (amenity.trim()) params.set("amenity", amenity.trim());
    else params.delete("amenity");

    params.delete("page");

    const qs = params.toString();
    return `${basePath}${qs ? `?${qs}` : ""}`;
  }, [sp, basePath, departmentId, floor, minCapacity, maxCapacity, amenity]);

  function handleReset() {
    setDepartmentId("");
    setFloor("");
    setMinCapacity("");
    setMaxCapacity("");
    setAmenity("");
    router.replace(basePath);
  }

  return (
    <section className="rounded-[28px] border border-[var(--color-border-light)] bg-white p-4 shadow-sm md:p-5">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          router.replace(nextUrl);
        }}
        className="space-y-4"
      >
        {/* Header */}
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-base font-semibold text-[var(--color-text-light)]">Filters</h2>
            <p className="text-sm text-[var(--color-text-light)]/60">
              Narrow rooms by department, floor, capacity, and amenities.
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
          {/* Department */}
          <div>
            <label className="mb-1.5 block text-xs font-medium uppercase tracking-[0.16em] text-[var(--color-text-light)]/55">
              Department
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
              <select
                className="w-full bg-transparent px-3 py-2.5 text-sm text-[var(--color-text-light)] outline-none"
                value={departmentId}
                onChange={(e) => setDepartmentId(e.target.value)}
              >
                <option value="">All departments</option>
                {safeDepartments.map((dept) => (
                  <option key={dept.id} value={String(dept.id)}>
                    {dept.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Floor */}
          <div>
            <label className="mb-1.5 block text-xs font-medium uppercase tracking-[0.16em] text-[var(--color-text-light)]/55">
              Floor
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
                <path d="M12 2v20" />
                <path d="M2 7h20" />
                <path d="M2 12h20" />
                <path d="M2 17h20" />
              </svg>
              <select
                className="w-full bg-transparent px-3 py-2.5 text-sm text-[var(--color-text-light)] outline-none"
                value={floor}
                onChange={(e) => setFloor(e.target.value)}
              >
                <option value="">All floors</option>
                {safeFloors.map((item) => (
                  <option key={item} value={item}>
                    Floor {item}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Min capacity */}
          <div>
            <label className="mb-1.5 block text-xs font-medium uppercase tracking-[0.16em] text-[var(--color-text-light)]/55">
              Min capacity
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
                placeholder="4"
                value={minCapacity}
                onChange={(e) => setMinCapacity(e.target.value)}
                inputMode="numeric"
              />
            </div>
          </div>

          {/* Max capacity */}
          <div>
            <label className="mb-1.5 block text-xs font-medium uppercase tracking-[0.16em] text-[var(--color-text-light)]/55">
              Max capacity
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
                <path d="M17 12h6" />
              </svg>
              <input
                className="w-full bg-transparent px-3 py-2.5 text-sm text-[var(--color-text-light)] outline-none placeholder:text-[var(--color-text-light)]/35"
                placeholder="10"
                value={maxCapacity}
                onChange={(e) => setMaxCapacity(e.target.value)}
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
              <select
                className="w-full bg-transparent px-3 py-2.5 text-sm text-[var(--color-text-light)] outline-none"
                value={amenity}
                onChange={(e) => setAmenity(e.target.value)}
              >
                <option value="">All amenities</option>
                {safeAmenities.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
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
      </form>
    </section>
  );
}