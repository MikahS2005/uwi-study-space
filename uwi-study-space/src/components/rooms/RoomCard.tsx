// src/components/rooms/RoomCard.tsx
import Link from "next/link";

type RoomRow = {
  id: number | string;
  name: string;
  building: string;
  floor: string | null;
  capacity: number;
  amenities: string[] | null;
  department?: { name: string } | { name: string }[] | null;
};

export default function RoomCard(props: {
  room: RoomRow;
  preserve: {
    building?: string;
    amenity?: string;
    minCapacityRaw?: string;
    date: string;
  };
}) {
  const r = props.room;
  const roomId = typeof r.id === "number" ? r.id : Number(r.id);

  // Build booking query string while preserving filters
  const qs = new URLSearchParams();
  if (props.preserve.building) qs.set("building", props.preserve.building);
  if (props.preserve.amenity) qs.set("amenity", props.preserve.amenity);
  if (props.preserve.minCapacityRaw) qs.set("minCapacity", props.preserve.minCapacityRaw);

  qs.set("date", props.preserve.date);
  qs.set("bookRoomId", String(roomId));

const deptName =
  Array.isArray(r.department)
    ? r.department[0]?.name ?? "—"
    : r.department?.name ?? "—";



  return (
    <div className="rounded-xl border bg-white p-5 shadow-sm transition hover:shadow-md">
      {/* Room Name */}
      <h2 className="text-lg font-semibold">{r.name}</h2>

      {/* Meta */}
      <p className="mt-2 text-sm text-gray-600">
        {r.building}
        {r.floor ? ` • Floor ${r.floor}` : ""} • Capacity {r.capacity}
      </p>

      <p className="mt-1 text-xs text-gray-500">
        Department: {deptName}
      </p>

      {/* Amenities */}
      <div className="mt-3 flex flex-wrap gap-2">
        {(r.amenities ?? []).length > 0 ? (
          r.amenities!.slice(0, 4).map((a) => (
            <span
              key={a}
              className="rounded-full bg-gray-100 px-3 py-1 text-xs text-gray-700"
            >
              {a}
            </span>
          ))
        ) : (
          <span className="text-xs text-gray-400">No amenities listed</span>
        )}
      </div>

      {/* Action */}
      <div className="mt-5">
        <Link
          href={`/rooms?${qs.toString()}`}
          className="inline-flex w-full items-center justify-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700"
        >
          Book Room
        </Link>
      </div>
    </div>
  );
}
