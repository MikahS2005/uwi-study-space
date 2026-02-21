// src/app/(app)/super-admin/rooms/page.tsx
//
// Super Admin Rooms page (global).
// Uses the same shared RoomsManagementPage, but with mode="super_admin".
// Authorization is ALSO enforced in the DB helper as defense-in-depth.

import { RoomsManagementPage } from "@/components/admin/rooms/RoomsManagementPage";

export default async function SuperAdminRoomsPage() {
  return <RoomsManagementPage mode="super_admin" />;
}