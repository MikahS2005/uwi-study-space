// src/components/admin/bookings/BookingsClient.tsx

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

"use client";

import { useEffect, useMemo, useState } from "react";

type Mode = "admin" | "super_admin";
type Status = "all" | "active" | "cancelled" | "completed" | "no_show";
type BookingTargetMode = "internal" | "external";
type AcademicStatus = "UG" | "PG" | "Other";

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

type BookingAttendeeRow = {
  id: number;
  profile_user_id: string | null;
  attendee_type: "primary" | "additional";
  full_name: string;
  email: string | null;
  phone: string | null;
  uwi_id: string | null;
  faculty: string | null;
  academic_status: string | null;
  created_at: string | null;
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

  booked_for_name: string | null;
  booked_for_email: string | null;
  booked_for_phone: string | null;
  booked_for_uwi_id: string | null;
  booked_for_faculty: string | null;
  booked_for_academic_status: string | null;
  attendee_count: number | null;

  external_student_email: string | null;
  external_student_phone: string | null;
  external_student_id: string | null;

  booking_source: "internal" | "external";

  booked_for: ProfileMini | null;
  creator: ProfileMini | null;
  booking_attendees: BookingAttendeeRow[];

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
  phone: string | null;
  faculty: string | null;
  academic_status: string | null;
  role: "student";
};

type AdditionalAttendeeInput = {
  mode: "internal" | "manual";
  searchQuery: string;
  searchResults: StudentRow[];
  searching: boolean;

  profileUserId?: string | null;
  fullName: string;
  email: string;
  phone: string;
  uwiId: string;
  faculty: string;
  academicStatus: AcademicStatus;
};

const CAMPUS_TZ = "America/Port_of_Spain";

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

function fmtDateOnly(iso?: string | null) {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: CAMPUS_TZ,
    year: "numeric",
    month: "short",
    day: "2-digit",
  }).format(new Date(iso));
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

export default function BookingsClient({
  mode,
  showPageHeader = true,
}: {
  mode: Mode;
  showPageHeader?: boolean;
}) {
  const today = useMemo(() => ymdTodayTT(), []);
  const [from, setFrom] = useState(today);
  const [to, setTo] = useState(today);

  const [roomId, setRoomId] = useState<string>("");
  const [building, setBuilding] = useState<string>("");
  const [departmentId, setDepartmentId] = useState<string>("");
  const [status, setStatus] = useState<Status>("all");
  const [q, setQ] = useState<string>("");

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string>("");
  const [rows, setRows] = useState<BookingRow[]>([]);
  const [meta, setMeta] = useState<ApiResponse["meta"]>({
    rooms: [],
    buildings: [],
    departments: [],
  });

  const [openDetails, setOpenDetails] = useState(false);
  const [activeRow, setActiveRow] = useState<BookingRow | null>(null);

  const [openCancel, setOpenCancel] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [cancelTarget, setCancelTarget] = useState<BookingRow | null>(null);

  const [openBookForStudent, setOpenBookForStudent] = useState(false);
  const [targetMode, setTargetMode] = useState<BookingTargetMode>("internal");

  const [studentQ, setStudentQ] = useState("");
  const [studentResults, setStudentResults] = useState<StudentRow[]>([]);
  const [studentLoading, setStudentLoading] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<StudentRow | null>(null);

  const [bfRoomId, setBfRoomId] = useState<string>("");
  const [bfDate, setBfDate] = useState<string>(today);
  const [bfStart, setBfStart] = useState<string>("10:00");
  const [bfEnd, setBfEnd] = useState<string>("12:00");
  const [bfPurpose, setBfPurpose] = useState<string>("");
  const [bfAttendees, setBfAttendees] = useState<AdditionalAttendeeInput[]>([]);

function makeEmptyAttendee(): AdditionalAttendeeInput {
  return {
    mode: "manual",
    searchQuery: "",
    searchResults: [],
    searching: false,
    profileUserId: null,
    fullName: "",
    email: "",
    phone: "",
    uwiId: "",
    faculty: "",
    academicStatus: "UG",
  };
}

function addBfAttendee() {
  setBfAttendees((prev) => [...prev, makeEmptyAttendee()]);
}

function updateBfAttendee(
  index: number,
  field: keyof AdditionalAttendeeInput,
  value: string | null,
) {
  setBfAttendees((prev) =>
    prev.map((row, i) => (i === index ? { ...row, [field]: value } : row)),
  );
}

function removeBfAttendee(index: number) {
  setBfAttendees((prev) => prev.filter((_, i) => i !== index));
}

const normalizedBfAttendees = useMemo(() => {
  return bfAttendees
    .map((a) => ({
      profileUserId:
        typeof a.profileUserId === "string" && a.profileUserId.trim()
          ? a.profileUserId.trim()
          : null,
      fullName: a.fullName.trim(),
      email: a.email.trim(),
      phone: a.phone.trim(),
      uwiId: a.uwiId.trim(),
      faculty: a.faculty.trim(),
      academicStatus: a.academicStatus,
    }))
    .filter((a) => a.fullName || a.uwiId || a.email || a.profileUserId);
}, [bfAttendees]);

const derivedBfAttendeeCount = 1 + normalizedBfAttendees.length;

  const [bfExternalName, setBfExternalName] = useState("");
  const [bfExternalEmail, setBfExternalEmail] = useState("");
  const [bfExternalPhone, setBfExternalPhone] = useState("");
  const [bfExternalId, setBfExternalId] = useState("");
  const [bfExternalFaculty, setBfExternalFaculty] = useState("");
  const [bfExternalAcademicStatus, setBfExternalAcademicStatus] =
    useState<AcademicStatus>("UG");

  const [bfSubmitting, setBfSubmitting] = useState(false);

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
      const data = (await res.json().catch(() => ({}))) as
      | ApiResponse
      | { error?: string; detail?: string };
      
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

  useEffect(() => {
    fetchBookings();
  }, []);

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

  async function searchAttendeeUsers(index: number, termRaw: string) {
  const term = termRaw.trim();

  setBfAttendees((prev) =>
    prev.map((row, i) =>
      i === index ? { ...row, searchQuery: termRaw, searching: !!term } : row,
    ),
  );

  if (!term) {
    setBfAttendees((prev) =>
      prev.map((row, i) =>
        i === index ? { ...row, searchResults: [], searching: false } : row,
      ),
    );
    return;
  }

  try {
    const res = await fetch(`/api/admin/students?q=${encodeURIComponent(term)}`);
    const data = await res.json().catch(() => ({}));

    setBfAttendees((prev) =>
      prev.map((row, i) =>
        i === index
          ? {
              ...row,
              searchResults: data?.rows ?? [],
              searching: false,
            }
          : row,
      ),
    );
  } catch {
    setBfAttendees((prev) =>
      prev.map((row, i) =>
        i === index ? { ...row, searchResults: [], searching: false } : row,
      ),
    );
  }
}

function selectAdminAttendeeResult(index: number, row: any) {
  setBfAttendees((prev) =>
    prev.map((attendee, i) =>
      i === index
        ? {
            ...attendee,
            mode: "internal",
            profileUserId: row.id,
            searchQuery: row.full_name ?? "",
            searchResults: [],
            searching: false,
            fullName: row.full_name ?? "",
            email: row.email ?? "",
            phone: row.phone ?? "",
            uwiId: row.uwi_id ?? "",
            faculty: row.faculty ?? "",
            academicStatus: row.academic_status ?? "UG",
          }
        : attendee,
    ),
  );
}

  useEffect(() => {
    if (!openBookForStudent || targetMode !== "internal") return;

    const t = setTimeout(() => {
      searchStudents(studentQ);
    }, 300);

    return () => clearTimeout(t);
  }, [studentQ, openBookForStudent, targetMode]);

  function displayBookedUser(b: BookingRow) {
    const primary =
      b.booked_for_name?.trim() ||
      b.booked_for?.full_name?.trim() ||
      b.booked_for_email?.trim() ||
      b.booked_for?.email?.trim() ||
      shortId(b.booked_for_user_id);

    return {
      primary,
      uwiId: b.booked_for_uwi_id?.trim() || b.booked_for?.uwi_id?.trim() || "—",
      email: b.booked_for_email?.trim() || b.booked_for?.email?.trim() || "—",
      phone: b.booked_for_phone?.trim() || "—",
      faculty: b.booked_for_faculty?.trim() || "—",
      academicStatus: b.booked_for_academic_status?.trim() || "—",
      attendeeCount: Number(b.attendee_count ?? 1),
      source: b.booking_source,
    };
  }

  function displayAttendees(b: BookingRow) {
  return Array.isArray(b.booking_attendees) ? b.booking_attendees : [];
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

  async function submitBookForStudent() {
    if (!bfRoomId) {
      alert("Select a room.");
      return;
    }

    const startISO = new Date(`${bfDate}T${bfStart}:00-04:00`).toISOString();
    const endISO = new Date(`${bfDate}T${bfEnd}:00-04:00`).toISOString();

    setBfSubmitting(true);

    try {
      const payload: any = {
        roomId: Number(bfRoomId),
        startISO,
        endISO,
        purpose: bfPurpose.trim() || null,
        attendeeCount: derivedBfAttendeeCount,
        attendees: normalizedBfAttendees,
      };

      if (targetMode === "internal") {
        if (!selectedStudent) {
          alert("Select a student first.");
          setBfSubmitting(false);
          return;
        }
        payload.bookedForUserId = selectedStudent.id;
      } else {
        payload.externalStudentName = bfExternalName.trim();
        payload.externalStudentEmail = bfExternalEmail.trim();
        payload.externalStudentPhone = bfExternalPhone.trim();
        payload.externalStudentId = bfExternalId.trim();
        payload.externalStudentFaculty = bfExternalFaculty.trim();
        payload.externalStudentAcademicStatus = bfExternalAcademicStatus;
      }

      const res = await fetch("/api/admin/bookings/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json().catch(() => ({}));

      if (res.status === 409 && data?.canWaitlist && targetMode === "internal" && selectedStudent) {
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
        await fetchBookings();
        return;
      }

      if (!res.ok) {
        throw new Error(data?.error ?? data?.message ?? "Failed to create booking");
      }

      setOpenBookForStudent(false);
      await fetchBookings();
    } catch (e: any) {
      alert(e?.message ?? "Failed to create booking.");
    } finally {
      setBfSubmitting(false);
    }
  }

  function resetBookModal() {
    setTargetMode("internal");
    setSelectedStudent(null);
    setStudentQ("");
    setStudentResults([]);

    setBfRoomId(roomId || "");
    setBfDate(today);
    setBfStart("10:00");
    setBfEnd("12:00");
    setBfPurpose("");
    setBfAttendees([]);

    setBfExternalName("");
    setBfExternalEmail("");
    setBfExternalPhone("");
    setBfExternalId("");
    setBfExternalFaculty("");
    setBfExternalAcademicStatus("UG");
  }

  function openBookForStudentModal() {
    resetBookModal();
    setOpenBookForStudent(true);
  }

  const roomsForSelect = useMemo(() => {
    let list = meta.rooms ?? [];
    if (building) list = list.filter((r) => r.building === building);
    if (departmentId) list = list.filter((r) => String(r.departmentId) === String(departmentId));
    return list;
  }, [meta.rooms, building, departmentId]);

  const pageTitle = mode === "super_admin" ? "Bookings (Super Admin)" : "Bookings";

  return (
    <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
      <div
        className={`mb-5 flex flex-wrap items-start gap-3 ${
          showPageHeader ? "justify-between" : "justify-end"
        }`}
      >
        {showPageHeader ? (
          <div>
            <h1 className="text-lg font-semibold text-slate-900">{pageTitle}</h1>
            <p className="text-sm text-slate-600">
              {mode === "super_admin"
                ? "Super admins can view and manage bookings across all departments."
                : "Department admins can view and manage bookings for rooms in their scope."}
            </p>
          </div>
        ) : null}

        <button
          type="button"
          className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          onClick={openBookForStudentModal}
        >
          + Book for Student
        </button>
      </div>

      <div className="mb-4 grid grid-cols-1 gap-3 md:grid-cols-12">
        <div className="md:col-span-4">
          <label className="block text-xs font-medium text-slate-600">Search</label>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search name / email / ID / faculty / purpose..."
            className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none ring-blue-200 focus:ring-2"
          />
        </div>

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

        <div className="md:col-span-2">
          <label className="block text-xs font-medium text-slate-600">Building</label>
          <select
            value={building}
            onChange={(e) => {
              setBuilding(e.target.value);
              setRoomId("");
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
                <th className="px-4 py-3">Booked For</th>
                <th className="px-4 py-3">Contact / Academic</th>
                <th className="px-4 py-3">Purpose / Status</th>
                <th className="px-4 py-3">Created</th>
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
                  <tr key={b.id} className="border-b last:border-b-0 align-top">
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

                    <td className="px-4 py-3">
                      <div className="font-medium text-slate-900">{u.primary}</div>
                      <div className="text-xs text-slate-500">UWI ID: {u.uwiId}</div>
                      <div className="mt-1">
                        <span className="inline-flex rounded-full bg-slate-100 px-2 py-1 text-[11px] font-medium text-slate-700 ring-1 ring-slate-200">
                          {u.source === "internal" ? "Internal" : "External"}
                        </span>
                      </div>
                    </td>

                    <td className="px-4 py-3 text-xs text-slate-600">
                      <div>{u.email}</div>
                      <div>{u.phone}</div>
                      <div>{u.faculty}</div>
                      <div>{u.academicStatus}</div>
                      <div>Attendees: {u.attendeeCount}</div>
                    </td>

                    <td className="px-4 py-3">
                      <div className="text-slate-700">{purpose}</div>
                      <div className="mt-2">
                        <span
                          className={[
                            "inline-flex items-center rounded-full px-2 py-1 text-xs ring-1",
                            statusPill(b.status),
                          ].join(" ")}
                        >
                          {b.status}
                        </span>
                      </div>
                    </td>

                    <td className="px-4 py-3 text-xs text-slate-600">
                      <div className="font-medium text-slate-900">{c.primary}</div>
                      <div>{c.secondary}</div>
                      <div className="mt-1">Created: {fmtDateOnly(b.created_at)}</div>
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
{openDetails && activeRow ? (
  <div className="fixed inset-0 z-50 bg-black/40 p-3 sm:p-6">
    <div className="mx-auto flex h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl bg-white shadow-xl ring-1 ring-slate-200">
      {/* Header */}
      <div className="shrink-0 border-b border-slate-200 px-5 py-4">
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
      </div>

      {/* Scrollable content */}
      <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
        {(() => {
          const u = displayBookedUser(activeRow);
          const c = displayCreator(activeRow);
          const attendees = displayAttendees(activeRow);

          return (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
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
                <div className="text-xs font-medium text-slate-600">Booked For</div>
                <div className="mt-1 text-sm text-slate-900">{u.primary}</div>
                <div className="text-xs text-slate-500">UWI ID: {u.uwiId}</div>
                <div className="text-xs text-slate-500">Email: {u.email}</div>
                <div className="text-xs text-slate-500">Phone: {u.phone}</div>
                <div className="text-xs text-slate-500">Faculty: {u.faculty}</div>
                <div className="text-xs text-slate-500">Status: {u.academicStatus}</div>
                <div className="text-xs text-slate-500">Attendees: {u.attendeeCount}</div>
              </div>

              <div className="rounded-xl bg-slate-50 p-3 ring-1 ring-slate-200">
                <div className="text-xs font-medium text-slate-600">Created</div>
                <div className="mt-1 text-sm text-slate-900">{c.primary}</div>
                <div className="text-xs text-slate-500">{c.secondary}</div>
                <div className="text-xs text-slate-500">Created at: {fmtDateOnly(activeRow.created_at)}</div>
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
                <div className="mt-2 text-xs text-slate-500">
                  Source: {activeRow.booking_source === "internal" ? "Internal" : "External"}
                </div>
              </div>

              <div className="rounded-xl bg-slate-50 p-3 ring-1 ring-slate-200">
                <div className="text-xs font-medium text-slate-600">Purpose</div>
                <div className="mt-1 text-sm text-slate-900">
                  {(activeRow.purpose ?? "").trim() || "—"}
                </div>
              </div>

              <div className="sm:col-span-2 rounded-xl bg-slate-50 p-3 ring-1 ring-slate-200">
                <div className="text-xs font-medium text-slate-600">Attendees</div>

                {attendees.length === 0 ? (
                  <div className="mt-2 text-sm text-slate-500">
                    No attendee rows stored for this booking.
                  </div>
                ) : (
                  <div className="mt-3 space-y-2">
                    {attendees.map((attendee) => (
                      <div
                        key={attendee.id}
                        className="rounded-xl border border-slate-200 bg-white px-3 py-3"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="text-sm font-medium text-slate-900">
                            {attendee.full_name || "Unnamed attendee"}
                          </div>

                          <span
                            className={`inline-flex rounded-full px-2 py-1 text-[11px] font-medium ring-1 ${
                              attendee.attendee_type === "primary"
                                ? "bg-blue-50 text-blue-700 ring-blue-100"
                                : "bg-slate-100 text-slate-700 ring-slate-200"
                            }`}
                          >
                            {attendee.attendee_type === "primary" ? "Primary" : "Additional"}
                          </span>
                        </div>

                        <div className="mt-2 grid grid-cols-1 gap-1 text-xs text-slate-500 sm:grid-cols-2">
                          <div>Email: {attendee.email || "—"}</div>
                          <div>Phone: {attendee.phone || "—"}</div>
                          <div>UWI ID: {attendee.uwi_id || "—"}</div>
                          <div>Faculty: {attendee.faculty || "—"}</div>
                          <div>Status: {attendee.academic_status || "—"}</div>
                          <div>Linked user: {attendee.profile_user_id ? "Yes" : "No"}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          );
        })()}
      </div>

      {/* Footer */}
      <div className="shrink-0 border-t border-slate-200 bg-white px-5 py-4">
        <div className="flex flex-wrap justify-end gap-2">
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
  </div>
) : null}
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

            <div className="mt-4 sm:col-span-2">
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

{openBookForStudent ? (
  <div className="fixed inset-0 z-50 bg-black/50 p-3 sm:p-6">
    <div className="mx-auto flex h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl ring-1 ring-slate-200">
      {/* Header */}
      <div className="shrink-0 border-b border-slate-200 bg-slate-50 px-5 py-4 sm:px-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-lg font-semibold text-slate-900">Create Booking</div>
            <div className="text-sm text-slate-500">
              Create an internal or external booking on behalf of a student.
            </div>
          </div>

          <button
            onClick={() => setOpenBookForStudent(false)}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
          >
            ✕
          </button>
        </div>
      </div>

      {/* Scrollable content */}
      <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-6">
        <div className="space-y-5">
          {/* Target mode */}
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setTargetMode("internal")}
              className={`rounded-xl px-4 py-2 text-sm font-medium ${
                targetMode === "internal"
                  ? "bg-blue-600 text-white"
                  : "border border-slate-200 bg-white text-slate-700"
              }`}
            >
              Internal user
            </button>

            <button
              type="button"
              onClick={() => setTargetMode("external")}
              className={`rounded-xl px-4 py-2 text-sm font-medium ${
                targetMode === "external"
                  ? "bg-blue-600 text-white"
                  : "border border-slate-200 bg-white text-slate-700"
              }`}
            >
              External / manual
            </button>
          </div>

          {/* Primary attendee */}
          {targetMode === "internal" ? (
            <div className="rounded-2xl border border-slate-200 p-4">
              <label className="block text-xs font-medium text-slate-600">
                Student (name / email / UWI ID)
              </label>

              <input
                value={studentQ}
                onChange={(e) => setStudentQ(e.target.value)}
                placeholder="e.g. 8160… or name@my.uwi.edu"
                className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none ring-blue-200 focus:ring-2"
              />

              <div className="mt-3 rounded-xl border border-slate-200">
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
                            "w-full border-b px-3 py-2 text-left last:border-b-0",
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
          ) : (
            <div className="rounded-2xl border border-slate-200 p-4">
              <div className="mb-3 text-sm font-semibold text-slate-900">Primary attendee</div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-medium text-slate-600">Full name</label>
                  <input
                    value={bfExternalName}
                    onChange={(e) => setBfExternalName(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-600">Email</label>
                  <input
                    value={bfExternalEmail}
                    onChange={(e) => setBfExternalEmail(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-600">Phone</label>
                  <input
                    value={bfExternalPhone}
                    onChange={(e) => setBfExternalPhone(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-600">UWI ID</label>
                  <input
                    value={bfExternalId}
                    onChange={(e) => setBfExternalId(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-600">Faculty</label>
                  <input
                    value={bfExternalFaculty}
                    onChange={(e) => setBfExternalFaculty(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-600">Academic status</label>
                  <select
                    value={bfExternalAcademicStatus}
                    onChange={(e) => setBfExternalAcademicStatus(e.target.value as AcademicStatus)}
                    className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                  >
                    <option value="UG">UG</option>
                    <option value="PG">PG</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* Booking details */}
          <div className="rounded-2xl border border-slate-200 p-4">
            <div className="mb-3 text-sm font-semibold text-slate-900">Booking details</div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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

              <div className="sm:col-span-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                <div className="text-xs font-medium text-slate-600">Total attendees</div>
                <div className="mt-1 text-lg font-semibold text-slate-900">
                  {derivedBfAttendeeCount}
                </div>
                <div className="text-xs text-slate-500">
                  This updates automatically as attendees are added or removed. It includes the primary attendee.
                </div>
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-medium text-slate-600">Purpose</label>
                <input
                  value={bfPurpose}
                  onChange={(e) => setBfPurpose(e.target.value)}
                  placeholder="e.g. Study session"
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
                />
              </div>
            </div>
          </div>

          {/* Additional attendees */}
   {/* Additional attendees */}
<div className="rounded-2xl border border-slate-200 p-4">
  <div className="mb-3 flex items-center justify-between gap-3">
    <div>
      <div className="text-sm font-semibold text-slate-900">Additional attendees</div>
      <div className="text-xs text-slate-500">
        Add extra attendees for this booking. These rows are optional.
      </div>
    </div>

    <button
      type="button"
      onClick={addBfAttendee}
      className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
      disabled={bfSubmitting}
    >
      + Add attendee
    </button>
  </div>

  <div className="space-y-3">
    {bfAttendees.length === 0 ? (
      <div className="rounded-xl border border-dashed border-slate-200 px-4 py-3 text-sm text-slate-500">
        No additional attendees yet.
      </div>
    ) : (
      bfAttendees.map((attendee, index) => (
        <div key={index} className="rounded-2xl border border-slate-200 p-4">
          <div className="mb-3 flex items-center justify-between">
            <div className="text-sm font-medium text-slate-900">
              Attendee {index + 1}
            </div>

            <button
              type="button"
              onClick={() => removeBfAttendee(index)}
              className="rounded-lg px-2 py-1 text-xs text-rose-600 hover:bg-rose-50"
              disabled={bfSubmitting}
            >
              Remove
            </button>
          </div>

          <div className="mb-3 flex gap-2">
            <button
              type="button"
              onClick={() => updateBfAttendee(index, "mode", "manual")}
              className={`rounded-xl px-3 py-2 text-xs font-medium ${
                attendee.mode === "manual"
                  ? "bg-blue-600 text-white"
                  : "border border-slate-200 bg-white text-slate-700"
              }`}
            >
              Add manually
            </button>

            <button
              type="button"
              onClick={() => updateBfAttendee(index, "mode", "internal")}
              className={`rounded-xl px-3 py-2 text-xs font-medium ${
                attendee.mode === "internal"
                  ? "bg-blue-600 text-white"
                  : "border border-slate-200 bg-white text-slate-700"
              }`}
            >
              Search account
            </button>
          </div>

          {attendee.mode === "internal" ? (
            <div>
              <label className="block text-xs font-medium text-slate-600">
                Search by name / email / UWI ID
              </label>

              <input
                value={attendee.searchQuery}
                onChange={(e) => searchAttendeeUsers(index, e.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
              />

              <div className="mt-2 rounded-xl border border-slate-200">
                {attendee.searching ? (
                  <div className="p-3 text-sm text-slate-600">Searching…</div>
                ) : attendee.searchResults.length === 0 ? (
                  <div className="p-3 text-sm text-slate-500">No results</div>
                ) : (
                  <div className="max-h-48 overflow-auto">
                    {attendee.searchResults.map((row) => (
                      <button
                        key={row.id}
                        type="button"
                        onClick={() => selectAdminAttendeeResult(index, row)}
                        className="w-full border-b px-3 py-2 text-left last:border-b-0 hover:bg-slate-50"
                      >
                        <div className="text-sm font-medium text-slate-900">
                          {row.full_name || row.email || shortId(row.id)}
                        </div>
                        <div className="text-xs text-slate-500">
                          {row.uwi_id ? `UWI ID: ${row.uwi_id}` : "UWI ID: —"}
                          {row.email ? ` • ${row.email}` : ""}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {(attendee.fullName || attendee.uwiId) && (
                <div className="mt-3 rounded-xl bg-slate-50 px-3 py-3 text-sm text-slate-700">
                  <div className="font-medium text-slate-900">{attendee.fullName || "—"}</div>
                  <div className="text-xs text-slate-500">ID: {attendee.uwiId || "—"}</div>
                  <div className="text-xs text-slate-500">Email: {attendee.email || "—"}</div>
                </div>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-xs font-medium text-slate-600">Full name</label>
                <input
                  value={attendee.fullName}
                  onChange={(e) => updateBfAttendee(index, "fullName", e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600">UWI ID</label>
                <input
                  value={attendee.uwiId}
                  onChange={(e) => updateBfAttendee(index, "uwiId", e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600">Email</label>
                <input
                  value={attendee.email}
                  onChange={(e) => updateBfAttendee(index, "email", e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600">Phone</label>
                <input
                  value={attendee.phone}
                  onChange={(e) => updateBfAttendee(index, "phone", e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600">Faculty</label>
                <input
                  value={attendee.faculty}
                  onChange={(e) => updateBfAttendee(index, "faculty", e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600">Academic status</label>
                <select
                  value={attendee.academicStatus}
                  onChange={(e) =>
                    updateBfAttendee(index, "academicStatus", e.target.value as AcademicStatus)
                  }
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                >
                  <option value="UG">UG</option>
                  <option value="PG">PG</option>
                  <option value="Other">Other</option>
                </select>
              </div>
            </div>
          )}
        </div>
      ))
    )}
  </div>
</div>
        </div>
      </div>

      {/* Footer */}
      <div className="shrink-0 border-t border-slate-200 bg-white px-5 py-4 sm:px-6">
        <div className="flex flex-wrap justify-end gap-2">
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
  </div>
) : null}
    </div>
  );
}