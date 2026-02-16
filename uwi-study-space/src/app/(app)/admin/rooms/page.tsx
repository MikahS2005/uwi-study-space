// src/app/(app)/admin/rooms/page.tsx
import { getRoomsForAdminPanel } from "@/lib/db/rooms";
import { RoomRowActions } from "@/components/admin/RoomRowActions";

/**
 * Server page:
 * - pulls scoped rooms from server helper
 * - renders a simple list for now
 */
export default async function AdminRoomsPage() {
  const rooms = await getRoomsForAdminPanel();

  return (
    <div className="rounded-2xl bg-white p-6 ring-1 ring-slate-200">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-lg font-semibold text-slate-900">Rooms</h1>
          <p className="mt-1 text-sm text-slate-600">
            {rooms.length} room(s) visible based on your scope.
          </p>
        </div>

        <button
          className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
          type="button"
        >
          + New Room
        </button>
      </div>

      <div className="mt-6 divide-y divide-slate-100 overflow-hidden rounded-xl ring-1 ring-slate-200">
        {rooms.map((r) => (
          <div key={r.id} className="flex items-center justify-between gap-4 p-4">
            <div>
              <div className="font-medium text-slate-900">{r.name}</div>
              <div className="text-sm text-slate-600">
                {r.building}
                {r.floor ? ` • Floor ${r.floor}` : ""} • Capacity {r.capacity}
                {r.department?.name ? ` • ${r.department.name}` : ""}
              </div>
              <div className="mt-1 flex flex-wrap gap-2">
                {(r.amenities ?? []).map((a) => (
                  <span
                    key={a}
                    className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-700"
                  >
                    {a}
                  </span>
                ))}

                {r.is_active === false && (
                  <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs text-amber-700 ring-1 ring-amber-100">
                    Inactive
                  </span>
                )}
              </div>
            </div>

            {/* ✅ Client component handles fetch + refresh */}
            <RoomRowActions roomId={r.id} />
          </div>
        ))}

        {rooms.length === 0 && (
          <div className="p-6 text-sm text-slate-600">No rooms available in your scope.</div>
        )}
      </div>
    </div>
  );
}
