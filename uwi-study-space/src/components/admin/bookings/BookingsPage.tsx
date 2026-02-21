// src/components/admin/bookings/BookingsPage.tsx
import BookingsClient from "./BookingsClient";

/**
 * Server wrapper:
 * - Just renders the client component.
 * - Client fetches /api/admin/bookings with default date range = today.
 *
 * Keeping it thin makes it easy to reuse for /admin and /super-admin.
 */
export default function BookingsPage({ mode }: { mode: "admin" | "super_admin" }) {
  return <BookingsClient mode={mode} />;
}