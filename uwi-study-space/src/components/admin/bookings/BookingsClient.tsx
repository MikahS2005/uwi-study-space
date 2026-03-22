// src/components/admin/bookings/BookingsClient.tsx
"use client";

/**
 * Admin Bookings Client
 * - Lists bookings with filters (date, building, dept, room, status, search)
 * - Displays user names/IDs via safe API join fields (booked_for + creator)
 * - Allows admins/super-admins to create a booking on behalf of a student:
 *    - Search student (name/email/UWI ID)
 *    - Pick room + TT date + time range + optional purpose
 *    - POST /api/admin/bookings/create
 *
 * IMPORTANT:
 * This file expects your /api/admin/bookings endpoint to return:
 *   - rows[].booked_for (ProfileMini | null)
 *   - rows[].creator   (ProfileMini | null)
 *   - rows[].external_student_* fields
 *
 * It also expects a /api/admin/students endpoint for searching students.
 */

import { useEffect, useMemo, useState } from "react";

type Mode = "admin" | "super_admin";
type Status = "all" | "active" | "cancelled" | "completed" | "no_show";

type MetaRoom = {
  id: number;
  name: string;
  building: string;
  departmentId: number;
  departmentName: string;
};

type MetaDepartment = { id: number; name: string };

type ProfileMini = {
  id: string;
  email: string | null;
  full_name: string | null;
  uwi_id: string | null;
};

type BookingRow = {
  id: number;
  room_id: number;
  start_time: string;
  end_time: string;
  status: string;
  purpose: string | null;
  created_at: string | null;

  created_by: string | null;
  booked_for_user_id: string | null;

  external_student_email: string | null;
  external_student_phone: string | null;
  external_student_id: string | null;

  // These are the “safe profile mini” joins you’ll add on the API response
  booked_for: ProfileMini | null;
  creator: ProfileMini | null;

  rooms: null | {
    id: number;
    name: string | null;
    building: string | null;
    floor: string | number | null;
    department_id: number | null;
    departments: null | { id: number; name: string | null };
  };
};

type ApiResponse = {
  rows: BookingRow[];
  meta: {
    rooms: MetaRoom[];
    buildings: string[];
    departments: MetaDepartment[];
  };
};

type StudentRow = {
  id: string;
  email: string | null;
  full_name: string | null;
  uwi_id: string | null;
  role: "student";
};

const CAMPUS_TZ = "America/Port_of_Spain";

/** YYYY-MM-DD in TT timezone */
function ymdTodayTT() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: CAMPUS_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());

  const yyyy = parts.find((p) => p.type === "year")?.value ?? "1970";
  const mm = parts.find((p) => p.type === "month")?.value ?? "01";
  const dd = parts.find((p) => p.type === "day")?.value ?? "01";
  return `${yyyy}-${mm}-${dd}`;
}

function fmtTtDateTime(iso: string) {
  const d = new Date(iso);
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: CAMPUS_TZ,
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  }).format(d);
}

function fmtTtTime(iso: string) {
  const d = new Date(iso);
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: CAMPUS_TZ,
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  }).format(d);
}

function statusPill(status: string) {
  const s = String(status || "").toLowerCase();
  if (s === "active") return "bg-blue-50 text-blue-700 ring-blue-100";
  if (s === "cancelled") return "bg-slate-100 text-slate-700 ring-slate-200";
  if (s === "completed") return "bg-emerald-50 text-emerald-700 ring-emerald-100";
  if (s === "no_show") return "bg-rose-50 text-rose-700 ring-rose-100";
  return "bg-slate-100 text-slate-700 ring-slate-200";
}

function shortId(id?: string | null) {
  if (!id) return "—";
  return `${id.slice(0, 6)}…${id.slice(-4)}`;
}

export default function BookingsClient({ mode }: { mode: Mode }) {
  // ---------------------------------------------------------------------------
  // Filters state
  // ---------------------------------------------------------------------------
  const today = useMemo(() => ymdTodayTT(), []);
  const [from, setFrom] = useState(today);
  const [to, setTo] = useState(today);

  const [roomId, setRoomId] = useState<string>("");
  const [building, setBuilding] = useState<string>("");
  const [departmentId, setDepartmentId] = useState<string>("");
  const [status, setStatus] = useState<Status>("all");
  const [q, setQ] = useState<string>("");

  // Data state
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string>("");
  const [rows, setRows] = useState<BookingRow[]>([]);
  const [meta, setMeta] = useState<ApiResponse["meta"]>({
    rooms: [],
    buildings: [],
    departments: [],
  });

  // Details modal state
  const [openDetails, setOpenDetails] = useState(false);
  const [activeRow, setActiveRow] = useState<BookingRow | null>(null);

  // Cancel modal state
  const [openCancel, setOpenCancel] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [cancelTarget, setCancelTarget] = useState<BookingRow | null>(null);

  // ---------------------------------------------------------------------------
  // Book-for-student modal state
  // ---------------------------------------------------------------------------
  const [openBookForStudent, setOpenBookForStudent] = useState(false);
  const [studentQ, setStudentQ] = useState("");
  const [studentResults, setStudentResults] = useState<StudentRow[]>([]);
  const [studentLoading, setStudentLoading] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<StudentRow | null>(null);

  // booking form fields
  const [bfRoomId, setBfRoomId] = useState<string>("");
  const [bfDate, setBfDate] = useState<string>(today);
  const [bfStart, setBfStart] = useState<string>("10:00");
  const [bfEnd, setBfEnd] = useState<string>("12:00");
  const [bfPurpose, setBfPurpose] = useState<string>("");
  const [bfSubmitting, setBfSubmitting] = useState(false);

  // ---------------------------------------------------------------------------
  // Fetch bookings
  // ---------------------------------------------------------------------------
  async function fetchBookings() {
    setLoading(true);
    setErr("");

    const sp = new URLSearchParams();
    sp.set("from", from);
    sp.set("to", to);
    if (roomId) sp.set("roomId", roomId);
    if (building) sp.set("building", building);
    if (departmentId) sp.set("departmentId", departmentId);
    if (status && status !== "all") sp.set("status", status);
    if (q.trim()) sp.set("q", q.trim());

    try {
      const res = await fetch(`/api/admin/bookings?${sp.toString()}`);
      const data = (await res.json()) as ApiResponse | { error: string; detail?: string };

      if (!res.ok) {
        const msg = (data as any)?.error ?? "Failed to load bookings.";
        const detail = (data as any)?.detail ? ` (${(data as any).detail})` : "";
        throw new Error(msg + detail);
      }

      setRows((data as ApiResponse).rows ?? []);
      setMeta((data as ApiResponse).meta);
    } catch (e: any) {
      setErr(e?.message ?? "Failed to load bookings.");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }

  // initial load
  useEffect(() => {
    fetchBookings();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---------------------------------------------------------------------------
  // Student search (debounced)
  // ---------------------------------------------------------------------------
  async function searchStudents(termRaw: string) {
    const term = termRaw.trim();

    if (!term) {
      setStudentResults([]);
      return;
    }

    setStudentLoading(true);
    try {
      const res = await fetch(`/api/admin/students?q=${encodeURIComponent(term)}`);
      const data = await res.json().catch(() => ({}));

      if (!res.ok) throw new Error(data?.error ?? "Search failed");

      setStudentResults(data?.rows ?? []);
    } catch {
      setStudentResults([]);
    } finally {
      setStudentLoading(false);
    }
  }

  useEffect(() => {
    // only search while modal is open (prevents background spam)
    if (!openBookForStudent) return;

    const t = setTimeout(() => {
      searchStudents(studentQ);
    }, 300);

    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [studentQ, openBookForStudent]);

  // ---------------------------------------------------------------------------
  // Display helpers
  // ---------------------------------------------------------------------------
  function displayBookedUser(b: BookingRow) {
    // 1) Internal booking (linked profile)
    if (b.booked_for) {
      const primary =
        b.booked_for.full_name?.trim() ||
        b.booked_for.email?.trim() ||
        shortId(b.booked_for.id);

      const secondary = b.booked_for.uwi_id ? `UWI ID: ${b.booked_for.uwi_id}` : "UWI ID: —";
      return { primary, secondary };
    }

    // 2) External booking (on behalf)
    const extPrimary =
      b.external_student_id?.trim() ||
      b.external_student_email?.trim() ||
      "External student";

    const extSecondaryParts: string[] = [];
    if (b.external_student_email) extSecondaryParts.push(b.external_student_email);
    if (b.external_student_phone) extSecondaryParts.push(b.external_student_phone);

    const extSecondary = extSecondaryParts.length ? extSecondaryParts.join(" • ") : "—";

    if (b.external_student_id || b.external_student_email) {
      return { primary: extPrimary, secondary: extSecondary };
    }

    // 3) Fallback
    return { primary: shortId(b.booked_for_user_id), secondary: "booked_for_user_id" };
  }

  function displayCreator(b: BookingRow) {
    if (b.creator) {
      const primary =
        b.creator.full_name?.trim() || b.creator.email?.trim() || shortId(b.creator.id);
      const secondary = b.creator.email?.trim() || "—";
      return { primary, secondary };
    }
    return { primary: shortId(b.created_by), secondary: "created_by" };
  }

  // ---------------------------------------------------------------------------
  // Actions: no-show/cancel/details
  // ---------------------------------------------------------------------------
  async function markNoShow(row: BookingRow) {
    if (!confirm("Mark this booking as No-Show?")) return;

    const res = await fetch(`/api/admin/bookings/${row.id}/no-show`, { method: "POST" });
    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      alert(data?.error ?? "Failed to mark no-show.");
      return;
    }

    await fetchBookings();
  }

  function openCancelModal(row: BookingRow) {
    setCancelTarget(row);
    setCancelReason("");
    setOpenCancel(true);
  }

  async function submitCancel() {
    if (!cancelTarget) return;

    const res = await fetch(`/api/admin/bookings/${cancelTarget.id}/cancel`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason: cancelReason.trim() || undefined }),
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      alert(data?.error ?? "Failed to cancel booking.");
      return;
    }

    setOpenCancel(false);
    setCancelTarget(null);
    setCancelReason("");
    await fetchBookings();
  }

  function openDetailsForRow(row: BookingRow) {
    setActiveRow(row);
    setOpenDetails(true);
  }

  // ---------------------------------------------------------------------------
  // Book-for-student submission
  // ---------------------------------------------------------------------------
  async function submitBookForStudent() {
  if (!selectedStudent) {
    alert("Select a student first.");
    return;
  }
  if (!bfRoomId) {
    alert("Select a room.");
    return;
  }

  const startISO = new Date(`${bfDate}T${bfStart}:00-04:00`).toISOString();
  const endISO = new Date(`${bfDate}T${bfEnd}:00-04:00`).toISOString();

  setBfSubmitting(true);

  try {
    const payload = {
      roomId: Number(bfRoomId),
      startISO,
      endISO,
      purpose: bfPurpose.trim() || null,
      bookedForUserId: selectedStudent.id,
    };

    const res = await fetch("/api/admin/bookings/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const data = await res.json().catch(() => ({}));

    if (res.status === 409 && data?.canWaitlist) {
      const ok = window.confirm(
        `${data?.message ?? "This slot is already booked."}\n\nAdd this student to the waitlist instead?`
      );

      if (!ok) return;

      const wlRes = await fetch("/api/admin/waitlist/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          roomId: Number(bfRoomId),
          start: startISO,
          end: endISO,
          bookedForUserId: selectedStudent.id,
        }),
      });

      const wlData = await wlRes.json().catch(() => ({}));

      if (!wlRes.ok) {
        throw new Error(wlData?.error ?? "Failed to join waitlist.");
      }

      alert("Student added to waitlist.");
      setOpenBookForStudent(false);
      setSelectedStudent(null);
      setStudentQ("");
      setStudentResults([]);
      setBfRoomId("");
      setBfPurpose("");
      return;
    }

    if (!res.ok) {
      throw new Error(data?.error ?? data?.message ?? "Failed to create booking");
    }

    setOpenBookForStudent(false);
    setSelectedStudent(null);
    setStudentQ("");
    setStudentResults([]);
    setBfRoomId("");
    setBfPurpose("");

    await fetchBookings();
  } catch (e: any) {
    alert(e?.message ?? "Failed to create booking.");
  } finally {
    setBfSubmitting(false);
  }
}

  function openBookForStudentModal() {
    // Keep UX clean:
    // - clear previous student selection/search
    // - prefill date to today TT
    // - if admin already filtered by room, prefill that room in the form
    setOpenBookForStudent(true);
    setSelectedStudent(null);
    setStudentQ("");
    setStudentResults([]);
    setBfDate(today);
    setBfStart("10:00");
    setBfEnd("12:00");
    setBfPurpose("");
    setBfRoomId(roomId || "");
  }

  // ---------------------------------------------------------------------------
  // Derived lists for dropdowns (kept consistent with server meta)
  // ---------------------------------------------------------------------------
  const roomsForSelect = useMemo(() => {
    let list = meta.rooms ?? [];
    if (building) list = list.filter((r) => r.building === building);
    if (departmentId) list = list.filter((r) => String(r.departmentId) === String(departmentId));
    return list;
  }, [meta.rooms, building, departmentId]);

  const pageTitle = mode === "super_admin" ? "Bookings (Super Admin)" : "Bookings";

  return (
    <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
      {/* Header */}
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-slate-900">{pageTitle}</h1>
          <p className="text-sm text-slate-600">
            {mode === "super_admin"
              ? "Super admins can view and manage bookings across all departments."
              : "Department admins can view and manage bookings for rooms in their scope."}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
            onClick={openBookForStudentModal}
          >
            + Book for Student
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="mb-4 grid grid-cols-1 gap-3 md:grid-cols-12">
        {/* Search */}
        <div className="md:col-span-4">
          <label className="block text-xs font-medium text-slate-600">Search</label>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search purpose / user id..."
            className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none ring-blue-200 focus:ring-2"
          />
        </div>

        {/* Date range */}
        <div className="md:col-span-2">
          <label className="block text-xs font-medium text-slate-600">From</label>
          <input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none ring-blue-200 focus:ring-2"
          />
        </div>
        <div className="md:col-span-2">
          <label className="block text-xs font-medium text-slate-600">To</label>
          <input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none ring-blue-200 focus:ring-2"
          />
        </div>

        {/* Building */}
        <div className="md:col-span-2">
          <label className="block text-xs font-medium text-slate-600">Building</label>
          <select
            value={building}
            onChange={(e) => {
              setBuilding(e.target.value);
              setRoomId(""); // keep filters consistent
            }}
            className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none ring-blue-200 focus:ring-2"
          >
            <option value="">All</option>
            {(meta.buildings ?? []).map((b) => (
              <option key={b} value={b}>
                {b}
              </option>
            ))}
          </select>
        </div>

        {/* Department */}
        <div className="md:col-span-2">
          <label className="block text-xs font-medium text-slate-600">Department</label>
          <select
            value={departmentId}
            onChange={(e) => {
              setDepartmentId(e.target.value);
              setRoomId("");
            }}
            className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none ring-blue-200 focus:ring-2"
          >
            <option value="">All</option>
            {(meta.departments ?? []).map((d) => (
              <option key={d.id} value={String(d.id)}>
                {d.name}
              </option>
            ))}
          </select>
        </div>

        {/* Room */}
        <div className="md:col-span-3">
          <label className="block text-xs font-medium text-slate-600">Room</label>
          <select
            value={roomId}
            onChange={(e) => setRoomId(e.target.value)}
            className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none ring-blue-200 focus:ring-2"
          >
            <option value="">All</option>
            {roomsForSelect.map((r) => (
              <option key={r.id} value={String(r.id)}>
                {r.name} ({r.building})
              </option>
            ))}
          </select>
        </div>

        {/* Status */}
        <div className="md:col-span-2">
          <label className="block text-xs font-medium text-slate-600">Status</label>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as Status)}
            className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none ring-blue-200 focus:ring-2"
          >
            <option value="all">All</option>
            <option value="active">Active</option>
            <option value="cancelled">Cancelled</option>
            <option value="completed">Completed</option>
            <option value="no_show">No-Show</option>
          </select>
        </div>

        {/* Apply */}
        <div className="md:col-span-2 flex items-end gap-2">
          <button
            type="button"
            onClick={() => fetchBookings()}
            className="w-full rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
          >
            Apply
          </button>
        </div>
      </div>

      {/* Content */}
      {err ? (
        <div className="rounded-xl bg-rose-50 p-4 text-sm text-rose-700 ring-1 ring-rose-200">
          {err}
        </div>
      ) : loading ? (
        <div className="rounded-xl bg-slate-50 p-4 text-sm text-slate-600 ring-1 ring-slate-200">
          Loading bookings…
        </div>
      ) : rows.length === 0 ? (
        <div className="rounded-xl bg-slate-50 p-4 text-sm text-slate-600 ring-1 ring-slate-200">
          No bookings found for this filter range.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl ring-1 ring-slate-200">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-slate-600">
              <tr className="border-b">
                <th className="px-4 py-3">Start–End (TT)</th>
                <th className="px-4 py-3">Room</th>
                <th className="px-4 py-3">User</th>
                <th className="px-4 py-3">Purpose</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Created by</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>

            <tbody>
              {rows.map((b) => {
                const roomName = b.rooms?.name ?? `Room #${b.room_id}`;
                const deptName = b.rooms?.departments?.name ?? "";
                const bldg = b.rooms?.building ?? "";
                const purpose = b.purpose?.trim() || "—";

                const u = displayBookedUser(b);
                const c = displayCreator(b);

                return (
                  <tr key={b.id} className="border-b last:border-b-0">
                    <td className="px-4 py-3 text-slate-700">
                      <div className="font-medium text-slate-900">{fmtTtDateTime(b.start_time)}</div>
                      <div className="text-xs text-slate-500">
                        {fmtTtTime(b.start_time)} – {fmtTtTime(b.end_time)}
                      </div>
                    </td>

                    <td className="px-4 py-3">
                      <div className="font-medium text-slate-900">{roomName}</div>
                      <div className="text-xs text-slate-500">
                        {bldg}
                        {deptName ? ` • ${deptName}` : ""}
                      </div>
                    </td>

                    <td className="px-4 py-3 text-slate-700">
                      <div className="font-medium text-slate-900">{u.primary}</div>
                      <div className="text-xs text-slate-500">{u.secondary}</div>
                    </td>

                    <td className="px-4 py-3 text-slate-700">{purpose}</td>

                    <td className="px-4 py-3">
                      <span
                        className={[
                          "inline-flex items-center rounded-full px-2 py-1 text-xs ring-1",
                          statusPill(b.status),
                        ].join(" ")}
                      >
                        {b.status}
                      </span>
                    </td>

                    <td className="px-4 py-3 text-slate-700">
                      <div className="text-sm text-slate-900">{c.primary}</div>
                      <div className="text-xs text-slate-500">{c.secondary}</div>
                    </td>

                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => openDetailsForRow(b)}
                          className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
                        >
                          View
                        </button>

                        {String(b.status).toLowerCase() === "active" ? (
                          <>
                            <button
                              onClick={() => markNoShow(b)}
                              className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-medium text-rose-700 hover:bg-rose-100"
                            >
                              No-Show
                            </button>
                            <button
                              onClick={() => openCancelModal(b)}
                              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
                            >
                              Cancel
                            </button>
                          </>
                        ) : (
                          <span className="text-xs text-slate-400">—</span>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Details Modal */}
      {openDetails && activeRow ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4">
          <div className="w-full max-w-xl rounded-2xl bg-white p-5 shadow-xl ring-1 ring-slate-200">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-sm font-semibold text-slate-900">Booking Details</div>
                <div className="text-xs text-slate-500">ID: {activeRow.id}</div>
              </div>

              <button
                onClick={() => {
                  setOpenDetails(false);
                  setActiveRow(null);
                }}
                className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
              >
                ✕
              </button>
            </div>

            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="rounded-xl bg-slate-50 p-3 ring-1 ring-slate-200">
                <div className="text-xs font-medium text-slate-600">When (TT)</div>
                <div className="mt-1 text-sm text-slate-900">{fmtTtDateTime(activeRow.start_time)}</div>
                <div className="text-xs text-slate-500">
                  {fmtTtTime(activeRow.start_time)} – {fmtTtTime(activeRow.end_time)}
                </div>
              </div>

              <div className="rounded-xl bg-slate-50 p-3 ring-1 ring-slate-200">
                <div className="text-xs font-medium text-slate-600">Room</div>
                <div className="mt-1 text-sm text-slate-900">
                  {activeRow.rooms?.name ?? `Room #${activeRow.room_id}`}
                </div>
                <div className="text-xs text-slate-500">{String(activeRow.rooms?.building ?? "")}</div>
              </div>

              <div className="rounded-xl bg-slate-50 p-3 ring-1 ring-slate-200">
                <div className="text-xs font-medium text-slate-600">User</div>
                {(() => {
                  const u = displayBookedUser(activeRow);
                  return (
                    <>
                      <div className="mt-1 text-sm text-slate-900">{u.primary}</div>
                      <div className="text-xs text-slate-500">{u.secondary}</div>
                    </>
                  );
                })()}
              </div>

              <div className="rounded-xl bg-slate-50 p-3 ring-1 ring-slate-200">
                <div className="text-xs font-medium text-slate-600">Status</div>
                <div className="mt-1">
                  <span
                    className={[
                      "inline-flex items-center rounded-full px-2 py-1 text-xs ring-1",
                      statusPill(activeRow.status),
                    ].join(" ")}
                  >
                    {activeRow.status}
                  </span>
                </div>
              </div>

              <div className="sm:col-span-2 rounded-xl bg-slate-50 p-3 ring-1 ring-slate-200">
                <div className="text-xs font-medium text-slate-600">Purpose</div>
                <div className="mt-1 text-sm text-slate-900">{(activeRow.purpose ?? "").trim() || "—"}</div>
              </div>
            </div>

            <div className="mt-4 flex justify-end gap-2">
              {String(activeRow.status).toLowerCase() === "active" ? (
                <>
                  <button
                    onClick={() => markNoShow(activeRow)}
                    className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2 text-sm font-medium text-rose-700 hover:bg-rose-100"
                  >
                    Mark No-Show
                  </button>
                  <button
                    onClick={() => openCancelModal(activeRow)}
                    className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                  >
                    Cancel Booking
                  </button>
                </>
              ) : null}

              <button
                onClick={() => {
                  setOpenDetails(false);
                  setActiveRow(null);
                }}
                className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* Cancel Modal */}
      {openCancel && cancelTarget ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-5 shadow-xl ring-1 ring-slate-200">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-sm font-semibold text-slate-900">Cancel Booking</div>
                <div className="text-xs text-slate-500">ID: {cancelTarget.id}</div>
              </div>

              <button
                onClick={() => {
                  setOpenCancel(false);
                  setCancelTarget(null);
                  setCancelReason("");
                }}
                className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
              >
                ✕
              </button>
            </div>

            <div className="mt-4">
              <label className="block text-xs font-medium text-slate-600">Reason (optional)</label>
              <textarea
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                placeholder="Optional reason to store in audit logs…"
                className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none ring-blue-200 focus:ring-2"
                rows={3}
              />
            </div>

            <div className="mt-4 flex justify-end gap-2">
              <button
                onClick={() => {
                  setOpenCancel(false);
                  setCancelTarget(null);
                  setCancelReason("");
                }}
                className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Back
              </button>
              <button
                onClick={() => submitCancel()}
                className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
              >
                Confirm Cancel
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* Book for Student Modal */}
      {openBookForStudent ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4">
          <div className="w-full max-w-2xl rounded-2xl bg-white p-5 shadow-xl ring-1 ring-slate-200">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-sm font-semibold text-slate-900">Book for Student</div>
                <div className="text-xs text-slate-500">
                  Search a student and create a booking on their behalf.
                </div>
              </div>
              <button
                onClick={() => {
                  setOpenBookForStudent(false);
                  setSelectedStudent(null);
                }}
                className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
              >
                ✕
              </button>
            </div>

            {/* Student Search */}
            <div className="mt-4">
              <label className="block text-xs font-medium text-slate-600">
                Student (name / email / UWI ID)
              </label>
              <input
                value={studentQ}
                onChange={(e) => setStudentQ(e.target.value)}
                placeholder="e.g. 8160… or mikah@my.uwi.edu"
                className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none ring-blue-200 focus:ring-2"
              />

              {/* Results */}
              <div className="mt-2 rounded-xl border border-slate-200">
                {studentLoading ? (
                  <div className="p-3 text-sm text-slate-600">Searching…</div>
                ) : studentResults.length === 0 ? (
                  <div className="p-3 text-sm text-slate-600">No results</div>
                ) : (
                  <div className="max-h-56 overflow-auto">
                    {studentResults.map((s) => {
                      const isActive = selectedStudent?.id === s.id;
                      return (
                        <button
                          key={s.id}
                          type="button"
                          onClick={() => setSelectedStudent(s)}
                          className={[
                            "w-full text-left px-3 py-2 border-b last:border-b-0",
                            isActive ? "bg-blue-50" : "hover:bg-slate-50",
                          ].join(" ")}
                        >
                          <div className="text-sm font-medium text-slate-900">
                            {s.full_name || s.email || shortId(s.id)}
                          </div>
                          <div className="text-xs text-slate-500">
                            {s.uwi_id ? `UWI ID: ${s.uwi_id}` : "UWI ID: —"}
                            {s.email ? ` • ${s.email}` : ""}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Booking Fields */}
            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="block text-xs font-medium text-slate-600">Room</label>
                <select
                  value={bfRoomId}
                  onChange={(e) => setBfRoomId(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
                >
                  <option value="">Select room…</option>
                  {(meta.rooms ?? []).map((r) => (
                    <option key={r.id} value={String(r.id)}>
                      {r.name} ({r.building})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600">Date (TT)</label>
                <input
                  type="date"
                  value={bfDate}
                  onChange={(e) => setBfDate(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600">Start</label>
                <input
                  type="time"
                  value={bfStart}
                  onChange={(e) => setBfStart(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600">End</label>
                <input
                  type="time"
                  value={bfEnd}
                  onChange={(e) => setBfEnd(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-medium text-slate-600">Purpose (optional)</label>
                <input
                  value={bfPurpose}
                  onChange={(e) => setBfPurpose(e.target.value)}
                  placeholder="e.g. Study session"
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
                />
              </div>
            </div>

            {/* Actions */}
            <div className="mt-5 flex justify-end gap-2">
              <button
                onClick={() => setOpenBookForStudent(false)}
                className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                disabled={bfSubmitting}
              >
                Cancel
              </button>
              <button
                onClick={() => submitBookForStudent()}
                className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60"
                disabled={bfSubmitting}
              >
                {bfSubmitting ? "Creating…" : "Create Booking"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}