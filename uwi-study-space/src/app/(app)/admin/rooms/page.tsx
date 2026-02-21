// src/app/(app)/admin/rooms/page.tsx
//
// Thin wrapper: Admin Rooms uses the shared RoomsManagementPage with mode="admin".
// This eliminates duplication between /admin/rooms and /super-admin/rooms.

import { RoomsManagementPage } from "@/components/admin/rooms/RoomsManagementPage";

export default async function AdminRoomsPage() {
  return <RoomsManagementPage mode="admin" />;
}