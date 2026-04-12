// src/app/(app)/super-admin/waitlist/page.tsx
import WaitlistPage from "@/components/admin/waitlist/WaitlistPage";

export default function SuperAdminWaitlistPage() {
  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
      <WaitlistPage mode="super_admin" />
    </div>
  );
}