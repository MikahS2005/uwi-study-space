// src/components/admin/bookings/BookingsPage.tsx
import BookingsClient from "./BookingsClient";
import AdminSectionBanner from "@/components/admin/shared/AdminSectionBanner";

/**
 * Server wrapper:
 * - Just renders the client component.
 * - Client fetches /api/admin/bookings with default date range = today.
 *
 * Keeping it thin makes it easy to reuse for /admin and /super-admin.
 */
export default function BookingsPage({ mode }: { mode: "admin" | "super_admin" }) {
  const description =
    mode === "super_admin"
      ? "Monitor and manage all room reservations institution-wide."
      : "Monitor and manage room reservations for departments in your scope.";

  return (
    <div className="space-y-6">
      <AdminSectionBanner
        mode={mode}
        areaLabel="Reservations"
        title="Bookings"
        description={description}
        breadcrumbLabel="Bookings"
      />
      <BookingsClient mode={mode} showPageHeader={false} />
    </div>
  );
}