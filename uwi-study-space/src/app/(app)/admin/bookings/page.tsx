// src/app/(app)/admin/bookings/page.tsx
// Admin Bookings page (department admins see scoped bookings; super admins see all)

import { getBookingsForAdminPanel } from "@/lib/db/adminPanel";

export default async function AdminBookingsPage() {
  const rows = await getBookingsForAdminPanel();

  return (
    <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
      <div className="mb-4">
        <h1 className="text-lg font-semibold text-slate-900">Bookings</h1>
        <p className="text-sm text-slate-600">
          Department admins see bookings for rooms in their scope. Super admins see all.
        </p>
      </div>

      {rows.length === 0 ? (
        <div className="rounded-xl bg-slate-50 p-4 text-sm text-slate-600 ring-1 ring-slate-200">
          No bookings found (or you have no scoped rooms).
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-slate-600">
              <tr className="border-b">
                <th className="py-2 pr-4">Room</th>
                <th className="py-2 pr-4">Department</th>
                <th className="py-2 pr-4">Start</th>
                <th className="py-2 pr-4">End</th>
                <th className="py-2 pr-4">Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((b) => (
                <tr key={b.id} className="border-b last:border-b-0">
                  <td className="py-2 pr-4 font-medium text-slate-900">
                    {b.room?.name ?? `Room #${b.room_id}`}
                  </td>
                  <td className="py-2 pr-4 text-slate-700">{b.room?.department?.name ?? "—"}</td>
                  <td className="py-2 pr-4 text-slate-700">
                    {new Date(b.start_time).toLocaleString()}
                  </td>
                  <td className="py-2 pr-4 text-slate-700">{new Date(b.end_time).toLocaleString()}</td>
                  <td className="py-2 pr-4">
                    <span className="rounded-full bg-slate-100 px-2 py-1 text-xs text-slate-700 ring-1 ring-slate-200">
                      {b.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
