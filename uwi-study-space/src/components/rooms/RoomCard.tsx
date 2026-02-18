// src/components/rooms/RoomCard.tsx
"use client";
import Link from "next/link";

// Define your constant image URL at the top
const DEFAULT_IMAGE = "/ajl_normal.jpg";

export default function RoomCard(props: {
  room: any; // Using any for brevity; ensure your RoomRow type includes image_url
  preserve: any;
}) {
  const r = props.room;
  const roomId = typeof r.id === "number" ? r.id : Number(r.id);

  const qs = new URLSearchParams();
  if (props.preserve.building) qs.set("building", props.preserve.building);
  if (props.preserve.amenity) qs.set("amenity", props.preserve.amenity);
  if (props.preserve.minCapacityRaw) qs.set("minCapacity", props.preserve.minCapacityRaw);
  qs.set("date", props.preserve.date);
  qs.set("bookRoomId", String(roomId));

  const deptName = Array.isArray(r.department)
    ? r.department[0]?.name ?? "—"
    : r.department?.name ?? "—";

  return (
    <div className="flex flex-col overflow-hidden rounded-xl border bg-white shadow-sm transition hover:shadow-md">
      
      {/* IMAGE SECTION */}
      <div className="relative h-44 w-full bg-gray-100">
        <img
          src={r.image_url || DEFAULT_IMAGE}
          alt={r.name}
          className="h-full w-full object-cover"
          // Safety fallback if the provided image_url is a broken link
          onError={(e) => {
            (e.target as HTMLImageElement).src = DEFAULT_IMAGE;
          }}
        />
      </div>

      {/* CONTENT SECTION */}
      <div className="p-5">
        <h2 className="text-lg font-bold text-black uppercase tracking-tight">
          {r.name}
        </h2>

        <p className="mt-2 text-sm font-medium text-gray-900">
          {r.building}
          {r.floor ? ` • Floor ${r.floor}` : ""} • Capacity {r.capacity}
        </p>

        <p className="mt-1 text-xs font-semibold text-gray-700">
          Department: {deptName}
        </p>

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
            href={`/rooms?${qs.toString()}`}
            className="inline-flex w-full items-center justify-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-bold text-white transition hover:bg-blue-700 shadow-sm"
          >
            Book Room
          </Link>
        </div>
      </div>
    </div>
  );
}