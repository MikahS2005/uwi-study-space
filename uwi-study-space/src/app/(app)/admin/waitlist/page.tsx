// src/app/(app)/admin/waitlist/page.tsx
// Admin Waitlist page (department admins see scoped waitlist; super admins see all)

// src/app/(app)/admin/waitlist/page.tsx
import WaitlistPage from "@/components/admin/waitlist/WaitlistPage";

export default function AdminWaitlistPage() {
  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
      <WaitlistPage mode="admin" />
    </div>
  );
}