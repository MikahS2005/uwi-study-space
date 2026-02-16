// src/app/(app)/dashboard/page.tsx
// Student dashboard page: minimal functional layout.
// UI team can redesign later; keep the data contract stable.

import UserBar from "@/components/auth/UserBar";
import { getStudentDashboard } from "@/lib/db/studentDashboard";
import Link from "next/link";

export default async function DashboardPage() {
  const data = await getStudentDashboard();

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <p className="mt-2 text-gray-600">
          Quick view of your bookings and availability.
        </p>
      </div>

      {/* Session / role debug (you already had this) */}
      <div className="mb-6">
        <UserBar />
      </div>

      {/* Stat cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
          <div className="text-sm text-neutral-600">Active Bookings</div>
          <div className="mt-2 text-3xl font-semibold">
            {data.stats.activeBookings}
          </div>
        </div>

        <div className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
          <div className="text-sm text-neutral-600">Upcoming Today</div>
          <div className="mt-2 text-3xl font-semibold">
            {data.stats.upcomingToday}
          </div>
        </div>

        <div className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
          <div className="text-sm text-neutral-600">Bookings Left Today</div>
          <div className="mt-2 text-3xl font-semibold">
            {data.stats.bookingsLeftToday}
          </div>
          <div className="mt-2 text-xs text-neutral-500">
            Daily limit: {data.stats.maxBookingsPerDay}
          </div>
        </div>
      </div>

      {/* Quick actions */}
      <div className="mt-8">
        <h2 className="text-lg font-semibold">Quick Actions</h2>
        <div className="mt-3 flex flex-wrap gap-3">
          <Link
            href="/rooms"
            className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            Book a Room
          </Link>
          <Link
            href="/schedule"
            className="rounded-xl border border-neutral-200 bg-white px-4 py-2 text-sm font-medium hover:bg-neutral-50"
          >
            View Schedule
          </Link>
          <Link
            href="/bookings"
            className="rounded-xl border border-neutral-200 bg-white px-4 py-2 text-sm font-medium hover:bg-neutral-50"
          >
            My Bookings
          </Link>
        </div>
      </div>

      {/* Upcoming bookings */}
      <div className="mt-8">
        <h2 className="text-lg font-semibold">Upcoming Bookings</h2>

        <div className="mt-3 rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
          {data.upcoming.length === 0 ? (
            <div className="text-sm text-neutral-600">
              No upcoming bookings.{" "}
              <Link href="/rooms" className="text-blue-600 hover:underline">
                Book a room
              </Link>{" "}
              to get started!
            </div>
          ) : (
            <ul className="space-y-3">
              {data.upcoming.map((b) => (
                <li
                  key={b.id}
                  className="flex items-start justify-between gap-4 rounded-xl border border-neutral-200 px-4 py-3"
                >
                  <div>
                    <div className="font-medium">{b.room.name}</div>
                    <div className="mt-1 text-sm text-neutral-600">
                      {new Date(b.start_time).toLocaleString()} –{" "}
                      {new Date(b.end_time).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                      <span className="mx-2">•</span>
                      {b.room.building}
                      {b.room.floor ? `, Floor ${b.room.floor}` : ""}
                    </div>
                  </div>

                  {/* Keep as link for now. UI team can turn this into a menu/icon. */}
                  <Link
                    href="/bookings"
                    className="text-sm font-medium text-blue-600 hover:underline"
                  >
                    Manage →
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
