// src/components/admin/rooms/RoomsManagementPage.tsx
//
// Shared Rooms management UI for BOTH:
//   - /admin/rooms
//   - /super-admin/rooms
//
// Key goal: avoid duplicating markup + logic.
// The only difference between the pages is "mode":
//   - mode="admin"       -> scoped rooms only
//   - mode="super_admin" -> all rooms
//
// This is a Server Component (no "use client") so it can fetch data directly
// via lib/db and render the same UI consistently.

import { getRoomsForRoomsManagement } from "@/lib/db/rooms";
import { RoomRowActions } from "@/components/admin/RoomRowActions";
import { NewRoomButton } from "@/components/admin/NewRoomButton";

export type RoomsManagementMode = "admin" | "super_admin";

export async function RoomsManagementPage(props: { mode: RoomsManagementMode }) {
  const { mode } = props;

  // Server-side scoped/global list. Authorization enforced inside DB helper.
  const rooms = await getRoomsForRoomsManagement({ mode });

  // Small UI copy difference: admins see "visible based on scope", super admins see "total".
  const subtitle =
    mode === "super_admin"
      ? `${rooms.length} room(s) total.`
      : `${rooms.length} room(s) visible based on your scope.`;

  return (
    <div className="rounded-2xl bg-white p-6 ring-1 ring-slate-200">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-lg font-semibold text-slate-900">Rooms</h1>
          <p className="mt-1 text-sm text-slate-600">{subtitle}</p>

          {mode === "super_admin" ? (
            <p className="mt-1 text-xs text-slate-500">
              Super admins can view and manage rooms across all departments.
            </p>
          ) : null}
        </div>

        {/* Uses the SAME button + modal as admin.
            The server endpoint already allows super_admin to create in any department. */}
        <NewRoomButton />
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

            {/* Uses the SAME actions as admin.
                These endpoints already allow super_admin, so no duplication needed. */}
            <RoomRowActions room={r} />
          </div>
        ))}

        {rooms.length === 0 && (
          <div className="p-6 text-sm text-slate-600">
            {mode === "super_admin"
              ? "No rooms found."
              : "No rooms available in your scope."}
          </div>
        )}
      </div>
    </div>
  );
}