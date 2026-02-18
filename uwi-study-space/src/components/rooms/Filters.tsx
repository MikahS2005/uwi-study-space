// src/components/rooms/Filters.tsx
"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";

/**
 * Reusable filter bar.
 * - Defaults to /rooms
 * - Schedule page can pass basePath="/schedule"
 */
export default function RoomFilters(props: { basePath?: string } = {}) {
  const basePath = props.basePath ?? "/rooms";

  const router = useRouter();
  const sp = useSearchParams();

  const [building, setBuilding] = useState(sp.get("building") ?? "");
  const [minCapacity, setMinCapacity] = useState(sp.get("minCapacity") ?? "");
  const [amenity, setAmenity] = useState(sp.get("amenity") ?? "");

  const nextUrl = useMemo(() => {
    const params = new URLSearchParams(sp.toString());

    // Overwrite only the filter keys we manage.
    if (building) params.set("building", building);
    else params.delete("building");

    if (minCapacity) params.set("minCapacity", minCapacity);
    else params.delete("minCapacity");

    if (amenity) params.set("amenity", amenity);
    else params.delete("amenity");

    // Reset paging or any other future keys if you add them later:
    params.delete("page");

    const qs = params.toString();
    return `${basePath}${qs ? `?${qs}` : ""}`;
  }, [sp, basePath, building, minCapacity, amenity]);

  return (
<div className="mt-4 grid gap-3 rounded border p-4 md:grid-cols-3"> {/* Added these classes back */}
  <div>
    <label className="text-xs font-medium text-black uppercase tracking-wide">Building</label>
    <input
      className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-black outline-none"
      placeholder="e.g. Alma Jordan Library"
      value={building}
      onChange={(e) => setBuilding(e.target.value)}
    />
  </div>

  <div>
    <label className="text-xs font-medium text-black uppercase tracking-wide">Minimum Capacity</label>
    <input
      className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-black outline-none"
      placeholder="e.g. 6"
      value={minCapacity}
      onChange={(e) => setMinCapacity(e.target.value)}
      inputMode="numeric"
    />
  </div>

  <div>
    <label className="text-xs font-medium text-black uppercase tracking-wide">Amenity</label>
    <input
      className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-black outline-none"
      placeholder="e.g. Whiteboard"
      value={amenity}
      onChange={(e) => setAmenity(e.target.value)}
    />
  </div>

  <div className="md:col-span-3 flex gap-2">
    <button
      className="rounded bg-black px-3 py-2 text-sm text-white hover:bg-gray-800"
      onClick={() => router.push(nextUrl)}
    >
      Apply
    </button>
    <button
      className="rounded border border-gray-300 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
      onClick={() => router.push(basePath)}
    >
      Reset
    </button>
  </div>
</div>
  );
}
