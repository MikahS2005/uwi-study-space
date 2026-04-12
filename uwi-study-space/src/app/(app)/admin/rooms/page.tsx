// src/app/(app)/admin/rooms/page.tsx
//
// Thin wrapper: Admin Rooms uses the shared RoomsManagementPage with mode="admin".
// This eliminates duplication between /admin/rooms and /super-admin/rooms.

import { RoomsManagementPage } from "@/components/admin/rooms/RoomsManagementPage";

export default async function AdminRoomsPage() {
  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
      <RoomsManagementPage mode="admin" />
    </div>
  );
}