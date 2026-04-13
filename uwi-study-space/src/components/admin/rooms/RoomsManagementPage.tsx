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
import { getDepartmentOptionsForRoomsManagement } from "@/lib/db/rooms";
import { RoomRowActions } from "@/components/admin/RoomRowActions";
import { NewRoomButton } from "@/components/admin/NewRoomButton";
import AdminSectionBanner from "@/components/admin/shared/AdminSectionBanner";
import Link from "next/link";

export type RoomsManagementMode = "admin" | "super_admin";
type RoomsVisibilityFilter = "all" | "active" | "inactive" | "with_amenities";

function StatCard({
  label,
  value,
  href,
  active,
}: {
  label: string;
  value: number;
  href: string;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      className={`rounded-2xl border px-4 py-3 ${
        active
          ? "border-[var(--color-primary)]/15 bg-[var(--color-primary-soft)]"
          : "border-[var(--color-border-light)] bg-white hover:border-[var(--color-primary)]/20 hover:bg-[var(--color-surface-light)]"
      }`}
    >
      <p
        className={`text-[10px] font-bold uppercase tracking-[0.15em] ${
          active
            ? "text-[var(--color-primary)]/70"
            : "text-[var(--color-text-light)]/45"
        }`}
      >
        {label}
      </p>
      <p
        style={{ fontFamily: "Georgia, serif" }}
        className={`mt-0.5 text-2xl font-bold ${
          active
            ? "text-[var(--color-primary)]"
            : "text-[var(--color-text-light)]"
        }`}
      >
        {value}
      </p>
    </Link>
  );
}

export async function RoomsManagementPage(props: {
  mode: RoomsManagementMode;
  selectedDepartmentId?: number;
  selectedVisibilityFilter?: RoomsVisibilityFilter;
}) {
  const { mode, selectedDepartmentId, selectedVisibilityFilter = "all" } = props;

  const [rooms, departmentOptions] = await Promise.all([
    getRoomsForRoomsManagement({ mode, departmentId: selectedDepartmentId }),
    getDepartmentOptionsForRoomsManagement({ mode }),
  ]);

  const basePath = mode === "super_admin" ? "/super-admin/rooms" : "/admin/rooms";

  const description =
    mode === "super_admin"
      ? "View, create, and configure all study rooms across every faculty and department."
      : "View, create, and configure study rooms available in your department scope.";

  const totalRooms = rooms.length;
  const inactiveRooms = rooms.filter((r) => r.is_active === false).length;
  const activeRooms = totalRooms - inactiveRooms;
  const roomsWithAmenities = rooms.filter((r) => (r.amenities ?? []).length > 0).length;

  const visibleRooms =
    selectedVisibilityFilter === "active"
      ? rooms.filter((r) => r.is_active !== false)
      : selectedVisibilityFilter === "inactive"
        ? rooms.filter((r) => r.is_active === false)
        : selectedVisibilityFilter === "with_amenities"
          ? rooms.filter((r) => (r.amenities ?? []).length > 0)
          : rooms;

  function withFilters(visibility: RoomsVisibilityFilter) {
    const params = new URLSearchParams();
    if (selectedDepartmentId) params.set("departmentId", String(selectedDepartmentId));
    if (visibility !== "all") params.set("visibility", visibility);
    const q = params.toString();
    return q ? `${basePath}?${q}` : basePath;
  }

  return (
    <div className="space-y-6">
      <AdminSectionBanner
        mode={mode}
        areaLabel="Room Management"
        title="Study Rooms"
        description={description}
        breadcrumbLabel="Rooms"
      />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard
          label="Total Rooms"
          value={totalRooms}
          href={withFilters("all")}
          active={selectedVisibilityFilter === "all"}
        />
        <StatCard
          label="Active"
          value={activeRooms}
          href={withFilters("active")}
          active={selectedVisibilityFilter === "active"}
        />
        <StatCard
          label="Inactive"
          value={inactiveRooms}
          href={withFilters("inactive")}
          active={selectedVisibilityFilter === "inactive"}
        />
        <StatCard
          label="Amenities"
          value={roomsWithAmenities}
          href={withFilters("with_amenities")}
          active={selectedVisibilityFilter === "with_amenities"}
        />
      </div>

      <div className="bg-white rounded-xl border border-[#E5E7EB] shadow-sm overflow-hidden">
        <div className="px-5 py-3.5 border-b border-[#E5E7EB] bg-[#F9FAFB] flex items-center justify-between">
          <h2 className="text-xs font-bold tracking-[0.12em] uppercase text-[#374151]">
            Filter Rooms
          </h2>

          <div className="shrink-0">
            <NewRoomButton />
          </div>
        </div>

        <form className="px-5 py-4 flex flex-col gap-2 sm:flex-row sm:items-end" method="get" action={basePath}>
          {selectedVisibilityFilter !== "all" ? (
            <input type="hidden" name="visibility" value={selectedVisibilityFilter} />
          ) : null}

          <div className="w-full sm:w-52">
            <label
              htmlFor="rooms-department-filter"
              className="text-[10px] font-bold uppercase tracking-[0.15em] text-[#9CA3AF]"
            >
              Department
            </label>
            <select
              id="rooms-department-filter"
              name="departmentId"
              defaultValue={selectedDepartmentId ? String(selectedDepartmentId) : ""}
              className="mt-1.5 h-10 w-full rounded-lg border border-[#E5E7EB] bg-[#F9FAFB] px-3 text-sm text-[#1F2937] outline-none transition focus:border-[#003595] focus:ring-2 focus:ring-[#003595]/10"
            >
              <option value="">All departments</option>
              {departmentOptions.map((dept) => (
                <option key={dept.id} value={dept.id}>
                  {dept.name}
                </option>
              ))}
            </select>
          </div>

          <button
            type="submit"
            className="h-10 rounded-xl bg-[#003595] px-5 text-sm font-semibold text-white transition hover:bg-[#002366]"
          >
            Apply Filters
          </button>

          {selectedDepartmentId || selectedVisibilityFilter !== "all" ? (
            <Link
              href={basePath}
              className="inline-flex h-10 items-center rounded-lg border border-[#E5E7EB] bg-[#F9FAFB] px-4 text-sm font-semibold text-[#374151] transition hover:bg-white"
            >
              Clear
            </Link>
          ) : null}
        </form>
      </div>

      <section className="overflow-hidden rounded-[28px] border border-[var(--color-border-light)] bg-white shadow-[0_12px_35px_rgba(17,24,39,0.06)]">
        <div className="border-b border-[var(--color-border-light)] bg-[var(--color-surface-light)] px-5 py-4 sm:px-6">
          <div>
            <h2 className="text-sm font-semibold text-[var(--color-text-light)] sm:text-base">
              Rooms Directory
            </h2>
            <p className="mt-1 text-sm text-[var(--color-text-light)]/62">
              {mode === "super_admin"
                ? `${rooms.length} room(s) available across the full system.`
                : `${rooms.length} room(s) visible within your assigned scope.`}
            </p>
          </div>
        </div>

        {visibleRooms.length === 0 ? (
          <div className="px-6 py-14 text-center">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--color-primary-soft)] text-[var(--color-primary)]">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path
                  d="M3 9.5L12 3l9 6.5V20a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9.5Z"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinejoin="round"
                />
                <path
                  d="M9 21V12h6v9"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinejoin="round"
                />
              </svg>
            </div>

            <p className="text-sm font-semibold text-[var(--color-text-light)]">
              {selectedVisibilityFilter === "all"
                ? mode === "super_admin"
                  ? "No rooms found"
                  : "No rooms available in your scope"
                : "No rooms found for the selected filter"}
            </p>
            <p className="mt-1 text-xs text-[var(--color-text-light)]/52">
              {selectedVisibilityFilter === "all"
                ? mode === "super_admin"
                  ? "Create the first study room to begin managing availability and bookings."
                  : "Ask a super admin to assign departments or rooms to your scope if needed."
                : "Try a different status card or clear the active filters."}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-[var(--color-border-light)]">
            {visibleRooms.map((r) => (
              <div
                key={r.id}
                className="flex flex-col gap-4 px-5 py-5 transition-colors hover:bg-[var(--color-surface-light)]/55 sm:px-6 lg:flex-row lg:items-center lg:justify-between"
              >
                <div className="min-w-0 flex-1">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-base font-semibold text-[var(--color-text-light)]">
                        {r.name}
                      </h3>

                        {r.is_active === false ? (
                          <span className="inline-flex items-center rounded-full border border-amber-200 bg-amber-50 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-700">
                            Inactive
                          </span>
                        ) : (
                          <span className="inline-flex items-center rounded-full border border-emerald-100 bg-emerald-50 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-emerald-700">
                            Active
                          </span>
                        )}
                    </div>

                    <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-[var(--color-text-light)]/65">
                      <span>{r.building}</span>
                      {r.floor ? <span>• Floor {r.floor}</span> : null}
                      <span>• Capacity {r.capacity}</span>
                      {r.department?.name ? <span>• {r.department.name}</span> : null}
                    </div>

                    <div className="mt-3 flex flex-wrap gap-2">
                      {(r.amenities ?? []).length > 0 ? (
                        r.amenities.map((a) => (
                          <span
                            key={a}
                            className="rounded-full border border-[var(--color-border-light)] bg-[var(--color-surface-light)] px-2.5 py-1 text-xs font-medium text-[var(--color-text-light)]/72"
                          >
                            {a}
                          </span>
                        ))
                      ) : (
                        <span className="text-xs text-[var(--color-text-light)]/45">
                          No amenities listed
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="shrink-0">
                  <RoomRowActions room={r} />
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}