// src/components/admin/waitlist/WaitlistPage.tsx
import WaitlistManagement from "@/components/admin/waitlist/WaitlistManagement";

export default function WaitlistPage({ mode }: { mode: "admin" | "super_admin" }) {
  return <WaitlistManagement mode={mode} />;
}