// src/app/(app)/super-admin/page.tsx
import { redirect } from "next/navigation";

export default function SuperAdminHome() {
  // pick your default tab
  redirect("/super-admin/rooms");
}