// src/app/(app)/admin/waitlist/page.tsx
// Admin Waitlist page (department admins see scoped waitlist; super admins see all)

// src/app/(app)/admin/waitlist/page.tsx
import WaitlistPage from "@/components/admin/waitlist/WaitlistPage";

export default function AdminWaitlistPage() {
  return <WaitlistPage mode="admin" />;
}