// src/app/(app)/super-admin/rooms/page.tsx
import { RoomsManagementPage } from "@/components/admin/rooms/RoomsManagementPage";

export default async function SuperAdminRoomsPage() {
  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
      <RoomsManagementPage mode="super_admin" />
    </div>
  );
}