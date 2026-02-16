// src/app/(app)/admin/waitlist/page.tsx
// Admin Waitlist page (department admins see scoped waitlist; super admins see all)

import { getWaitlistForAdminPanel } from "@/lib/db/adminPanel";

export default async function AdminWaitlistPage() {
  const rows = await getWaitlistForAdminPanel();

  return (
    <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
      <div className="mb-4">
        <h1 className="text-lg font-semibold text-slate-900">Waitlist</h1>
        <p className="text-sm text-slate-600">
          Department admins see waitlist entries for rooms in their scope. Super admins see all.
        </p>
      </div>

      {rows.length === 0 ? (
        <div className="rounded-xl bg-slate-50 p-4 text-sm text-slate-600 ring-1 ring-slate-200">
          No waitlist entries found (or you have no scoped rooms).
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
              {rows.map((w) => (
                <tr key={w.id} className="border-b last:border-b-0">
                  <td className="py-2 pr-4 font-medium text-slate-900">
                    {w.room?.name ?? `Room #${w.room_id}`}
                  </td>
                  <td className="py-2 pr-4 text-slate-700">{w.room?.department?.name ?? "—"}</td>
                  <td className="py-2 pr-4 text-slate-700">
                    {new Date(w.start_time).toLocaleString()}
                  </td>
                  <td className="py-2 pr-4 text-slate-700">{new Date(w.end_time).toLocaleString()}</td>
                  <td className="py-2 pr-4">
                    <span className="rounded-full bg-slate-100 px-2 py-1 text-xs text-slate-700 ring-1 ring-slate-200">
                      {w.status}
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
