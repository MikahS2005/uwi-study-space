// src/app/(app)/super-admin/bookings/page.tsx
import BookingsPage from "@/components/admin/bookings/BookingsPage";

export default function SuperAdminBookingsPage() {
  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
      <BookingsPage mode="super_admin" />
    </div>
  );
}