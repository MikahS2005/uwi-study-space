// src/app/(app)/admin/rooms/page.tsx
//
// Thin wrapper: Admin Rooms uses the shared RoomsManagementPage with mode="admin".
// This eliminates duplication between /admin/rooms and /super-admin/rooms.

import { RoomsManagementPage } from "@/components/admin/rooms/RoomsManagementPage";

export default async function AdminRoomsPage(props: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const searchParams = await props.searchParams;
  const departmentIdRaw =
    typeof searchParams.departmentId === "string" ? searchParams.departmentId : undefined;
  const departmentId = departmentIdRaw ? Number(departmentIdRaw) : undefined;
  const visibilityRaw =
    typeof searchParams.visibility === "string" ? searchParams.visibility : undefined;
  const visibility =
    visibilityRaw === "active" || visibilityRaw === "inactive" || visibilityRaw === "with_amenities"
      ? visibilityRaw
      : "all";

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
      <RoomsManagementPage
        mode="admin"
        selectedDepartmentId={Number.isFinite(departmentId) ? departmentId : undefined}
        selectedVisibilityFilter={visibility}
      />
    </div>
  );
}