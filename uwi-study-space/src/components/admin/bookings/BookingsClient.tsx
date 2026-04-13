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

/* ─────────────────────────────────────────────────────────────
   Types (unchanged)
───────────────────────────────────────────────────────────── */
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

/* ─────────────────────────────────────────────────────────────
   Helpers (unchanged logic)
───────────────────────────────────────────────────────────── */
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
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: CAMPUS_TZ,
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  }).format(new Date(iso));
}

function fmtTtTime(iso: string) {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: CAMPUS_TZ,
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  }).format(new Date(iso));
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

function shortId(id?: string | null) {
  if (!id) return "—";
  return `${id.slice(0, 6)}…${id.slice(-4)}`;
}

/* ─────────────────────────────────────────────────────────────
   Design primitives
───────────────────────────────────────────────────────────── */
function Spinner({ light = false, size = 14 }: { light?: boolean; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      className="animate-spin shrink-0"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="10"
        stroke={light ? "rgba(255,255,255,0.25)" : "rgba(0,53,149,0.15)"}
        strokeWidth="3"
      />
      <path d="M12 2a10 10 0 0 1 10 10"
        stroke={light ? "#fff" : "#003595"}
        strokeWidth="3"
        strokeLinecap="round"
      />
    </svg>
  );
}

function StatusBadge({ status }: { status: string }) {
  const s = String(status || "").toLowerCase();
  const styles =
    s === "active"    ? "bg-[#EAF6FF] text-[#003595] ring-[#003595]/20" :
    s === "cancelled" ? "bg-[#F3F4F6] text-[#6B7280] ring-[#E5E7EB]" :
    s === "completed" ? "bg-emerald-50 text-emerald-700 ring-emerald-100" :
    s === "no_show"   ? "bg-rose-50 text-rose-700 ring-rose-100" :
                        "bg-[#F3F4F6] text-[#6B7280] ring-[#E5E7EB]";
  const label =
    s === "active"    ? "Active" :
    s === "cancelled" ? "Cancelled" :
    s === "completed" ? "Completed" :
    s === "no_show"   ? "No-Show" : status;
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-bold tracking-wide uppercase ring-1 ${styles}`}>
      {label}
    </span>
  );
}

function SourceBadge({ source }: { source: "internal" | "external" }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1 ${
      source === "internal"
        ? "bg-[#EAF6FF] text-[#003595] ring-[#003595]/20"
        : "bg-amber-50 text-amber-700 ring-amber-100"
    }`}>
      {source === "internal" ? "Internal" : "External"}
    </span>
  );
}

function SkeletonRow() {
  return (
    <tr className="animate-pulse border-b border-[#F3F4F6]">
      <td className="py-4 pl-5 pr-4">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-xl bg-[#F3F4F6] shrink-0" />
          <div className="space-y-1.5">
            <div className="h-3.5 w-32 rounded bg-[#F3F4F6]" />
            <div className="h-2.5 w-24 rounded bg-[#F3F4F6]" />
          </div>
        </div>
      </td>
      <td className="py-4 px-4 hidden md:table-cell">
        <div className="h-3.5 w-24 rounded bg-[#F3F4F6]" />
        <div className="mt-1.5 h-2.5 w-16 rounded bg-[#F3F4F6]" />
      </td>
      <td className="py-4 px-4 hidden lg:table-cell">
        <div className="h-3.5 w-28 rounded bg-[#F3F4F6]" />
        <div className="mt-1.5 h-2.5 w-20 rounded bg-[#F3F4F6]" />
      </td>
      <td className="py-4 px-4 hidden xl:table-cell">
        <div className="h-5 w-16 rounded-full bg-[#F3F4F6]" />
      </td>
      <td className="py-4 pl-4 pr-5">
        <div className="flex justify-end gap-2">
          <div className="h-8 w-14 rounded-lg bg-[#F3F4F6]" />
          <div className="h-8 w-20 rounded-lg bg-[#F3F4F6]" />
        </div>
      </td>
    </tr>
  );
}

/* ─────────────────────────────────────────────────────────────
   Shared style constants
───────────────────────────────────────────────────────────── */
const inputCls =
  "w-full rounded-lg border border-[#E5E7EB] bg-[#F9FAFB] px-3 py-2.5 text-sm text-[#1F2937] outline-none placeholder:text-[#9CA3AF] transition focus:border-[#003595] focus:ring-2 focus:ring-[#003595]/10 disabled:opacity-60";

const labelCls =
  "block text-[10px] font-bold tracking-[0.15em] uppercase text-[#9CA3AF] mb-1.5";

const modeBtnCls = (active: boolean) =>
  `rounded-lg px-4 py-2 text-sm font-semibold transition-all ${
    active
      ? "bg-[#003595] text-white shadow-sm"
      : "border border-[#E5E7EB] bg-white text-[#374151] hover:border-[#003595]/30 hover:bg-[#F9FAFB]"
  }`;

/* ─────────────────────────────────────────────────────────────
   Stat card
───────────────────────────────────────────────────────────── */
function StatCard({ label, count, active, onClick }: {
  label: string; count: number; active: boolean; onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-xl border px-4 py-3 text-left transition-all ${
        active
          ? "border-[#003595] bg-[#EAF6FF]"
          : "border-[#E5E7EB] bg-white hover:border-[#003595]/30 hover:bg-[#F9FAFB]"
      }`}
    >
      <p className="text-[10px] font-bold tracking-[0.15em] uppercase text-[#9CA3AF]">{label}</p>
      <p style={{ fontFamily: "Georgia, serif" }}
        className={`text-2xl font-bold mt-0.5 ${active ? "text-[#003595]" : "text-[#1F2937]"}`}
      >
        {count}
      </p>
    </button>
  );
}

/* ─────────────────────────────────────────────────────────────
   Display helpers
───────────────────────────────────────────────────────────── */
function getDisplayBookedUser(b: BookingRow) {
  return {
    primary:
      b.booked_for_name?.trim() ||
      b.booked_for?.full_name?.trim() ||
      b.booked_for_email?.trim() ||
      b.booked_for?.email?.trim() ||
      shortId(b.booked_for_user_id),
    uwiId:    b.booked_for_uwi_id?.trim() || b.booked_for?.uwi_id?.trim() || "—",
    email:    b.booked_for_email?.trim()  || b.booked_for?.email?.trim()  || "—",
    phone:    b.booked_for_phone?.trim()  || "—",
    faculty:  b.booked_for_faculty?.trim()|| "—",
    academicStatus: b.booked_for_academic_status?.trim() || "—",
    attendeeCount:  Number(b.attendee_count ?? 1),
    source: b.booking_source,
  };
}

function getDisplayCreator(b: BookingRow) {
  if (b.creator) {
    return {
      primary:   b.creator.full_name?.trim() || b.creator.email?.trim() || shortId(b.creator.id),
      secondary: b.creator.email?.trim() || "—",
    };
  }
  return { primary: shortId(b.created_by), secondary: "created_by" };
}

/* ─────────────────────────────────────────────────────────────
   Cancel modal
───────────────────────────────────────────────────────────── */
function CancelModal({ open, target, onClose, onConfirm }: {
  open: boolean; target: BookingRow | null;
  onClose: () => void; onConfirm: (reason: string) => Promise<void>;
}) {
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (open) setReason(""); }, [open]);
  if (!open || !target) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/30 backdrop-blur-[2px] p-4"
      onClick={(e) => { if (e.target === e.currentTarget && !busy) onClose(); }}
    >
      <div className="w-full max-w-md bg-white rounded-xl shadow-2xl border border-[#E5E7EB] overflow-hidden">
        <div className="px-5 py-4 border-b border-[#E5E7EB] bg-[#F9FAFB]">
          <p className="text-[10px] font-semibold tracking-[0.18em] uppercase text-[#003595] mb-0.5">Admin Action</p>
          <h2 style={{ fontFamily: "Georgia, serif" }} className="text-lg font-bold text-[#1F2937]">Cancel Booking</h2>
          <p className="mt-0.5 text-xs text-[#6B7280]">Booking ID: {target.id}</p>
        </div>
        <div className="px-5 py-4">
          <label className={labelCls}>Reason (optional)</label>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Enter a reason for the audit log…"
            className={`${inputCls} resize-none`}
            rows={3}
            disabled={busy}
          />
        </div>
        <div className="flex gap-2.5 px-5 pb-5">
          <button onClick={onClose} disabled={busy}
            className="flex-1 rounded-lg border border-[#E5E7EB] bg-white py-2.5 text-sm font-semibold text-[#374151] hover:bg-[#F3F4F6] disabled:opacity-50 transition-colors"
          >
            Back
          </button>
          <button
            disabled={busy}
            onClick={async () => { setBusy(true); try { await onConfirm(reason); } finally { setBusy(false); } }}
            className="flex-1 inline-flex items-center justify-center gap-2 rounded-lg bg-rose-600 py-2.5 text-sm font-bold text-white hover:bg-rose-700 disabled:opacity-50 transition-colors"
          >
            {busy ? <><Spinner light size={14} />Cancelling…</> : "Confirm Cancel"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
   Details modal
───────────────────────────────────────────────────────────── */
function DetailsModal({ open, row, onClose, onMarkNoShow, onOpenCancel }: {
  open: boolean; row: BookingRow | null;
  onClose: () => void;
  onMarkNoShow: (b: BookingRow) => void;
  onOpenCancel: (b: BookingRow) => void;
}) {
  if (!open || !row) return null;
  const u = getDisplayBookedUser(row);
  const c = getDisplayCreator(row);
  const attendees = Array.isArray(row.booking_attendees) ? row.booking_attendees : [];
  const isActive = String(row.status).toLowerCase() === "active";

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/30 backdrop-blur-[2px] p-3 sm:p-6"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="relative mx-auto flex h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-xl border border-[#E5E7EB] bg-white shadow-2xl">
        {/* Header */}
        <div className="shrink-0 border-b border-[#E5E7EB] bg-[#F9FAFB] px-5 py-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[10px] font-semibold tracking-[0.18em] uppercase text-[#003595] mb-0.5">Booking Details</p>
              <h2 style={{ fontFamily: "Georgia, serif" }} className="text-lg font-bold text-[#1F2937]">
                {row.rooms?.name ?? `Room #${row.room_id}`}
              </h2>
              <p className="mt-0.5 text-xs text-[#9CA3AF]">ID: {row.id}</p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <StatusBadge status={row.status} />
              <button onClick={onClose}
                className="rounded-lg border border-[#E5E7EB] bg-white px-3 py-1.5 text-sm text-[#374151] hover:bg-[#F3F4F6] transition-colors"
              >✕</button>
            </div>
          </div>
        </div>

        {/* Body */}
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {/* When */}
            <div className="rounded-xl border border-[#E5E7EB] bg-[#F9FAFB] p-4">
              <p className={labelCls}>When (TT)</p>
              <p className="text-sm font-semibold text-[#1F2937]">{fmtTtDateTime(row.start_time)}</p>
              <p className="text-xs text-[#6B7280] mt-0.5">{fmtTtTime(row.start_time)} – {fmtTtTime(row.end_time)}</p>
            </div>
            {/* Room */}
            <div className="rounded-xl border border-[#E5E7EB] bg-[#F9FAFB] p-4">
              <p className={labelCls}>Room</p>
              <p className="text-sm font-semibold text-[#1F2937]">{row.rooms?.name ?? `Room #${row.room_id}`}</p>
              <p className="text-xs text-[#6B7280] mt-0.5">{String(row.rooms?.building ?? "—")}</p>
              {row.rooms?.departments?.name && <p className="text-xs text-[#9CA3AF]">{row.rooms.departments.name}</p>}
            </div>
            {/* Booked For */}
            <div className="rounded-xl border border-[#E5E7EB] bg-[#F9FAFB] p-4">
              <div className="flex items-center justify-between mb-2">
                <p className={labelCls} style={{ marginBottom: 0 }}>Booked For</p>
                <SourceBadge source={row.booking_source} />
              </div>
              <p className="text-sm font-semibold text-[#1F2937] mt-1">{u.primary}</p>
              <div className="mt-1.5 space-y-0.5">
                {[["UWI ID", u.uwiId],["Email", u.email],["Phone", u.phone],["Faculty", u.faculty],["Status", u.academicStatus],["Attendees", String(u.attendeeCount)]].map(([k, v]) => (
                  <p key={k} className="text-xs text-[#6B7280]">
                    <span className="font-medium text-[#374151]">{k}:</span> {v}
                  </p>
                ))}
              </div>
            </div>
            {/* Created By */}
            <div className="rounded-xl border border-[#E5E7EB] bg-[#F9FAFB] p-4">
              <p className={labelCls}>Created By</p>
              <p className="text-sm font-semibold text-[#1F2937]">{c.primary}</p>
              <p className="text-xs text-[#6B7280] mt-0.5">{c.secondary}</p>
              <p className="text-xs text-[#9CA3AF] mt-0.5">Created: {fmtDateOnly(row.created_at)}</p>
            </div>
            {/* Purpose */}
            <div className="rounded-xl border border-[#E5E7EB] bg-[#F9FAFB] p-4">
              <p className={labelCls}>Purpose</p>
              <p className="text-sm text-[#1F2937]">{(row.purpose ?? "").trim() || "—"}</p>
            </div>
            {/* Status */}
            <div className="rounded-xl border border-[#E5E7EB] bg-[#F9FAFB] p-4">
              <p className={labelCls}>Status</p>
              <StatusBadge status={row.status} />
              <p className="text-xs text-[#9CA3AF] mt-2">Source: {row.booking_source === "internal" ? "Internal" : "External"}</p>
            </div>
            {/* Attendees */}
            <div className="rounded-xl border border-[#E5E7EB] bg-[#F9FAFB] p-4 sm:col-span-2">
              <p className={labelCls}>Attendees ({attendees.length})</p>
              {attendees.length === 0 ? (
                <p className="text-sm text-[#9CA3AF] italic">No attendee rows stored for this booking.</p>
              ) : (
                <div className="space-y-2 mt-1">
                  {attendees.map((a) => (
                    <div key={a.id} className="rounded-lg border border-[#E5E7EB] bg-white px-3.5 py-3">
                      <div className="flex flex-wrap items-center justify-between gap-2 mb-1.5">
                        <p className="text-sm font-semibold text-[#1F2937]">{a.full_name || "Unnamed"}</p>
                        <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold tracking-wide uppercase ring-1 ${
                          a.attendee_type === "primary"
                            ? "bg-[#EAF6FF] text-[#003595] ring-[#003595]/20"
                            : "bg-[#F3F4F6] text-[#6B7280] ring-[#E5E7EB]"
                        }`}>
                          {a.attendee_type === "primary" ? "Primary" : "Additional"}
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 sm:grid-cols-3">
                        {[["Email", a.email],["Phone", a.phone],["UWI ID", a.uwi_id],["Faculty", a.faculty],["Status", a.academic_status],["Linked", a.profile_user_id ? "Yes" : "No"]].map(([k, v]) => (
                          <p key={k} className="text-xs text-[#6B7280]">
                            <span className="font-medium text-[#374151]">{k}:</span> {v || "—"}
                          </p>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="shrink-0 border-t border-[#E5E7EB] bg-[#F9FAFB] px-5 py-4">
          <div className="flex flex-wrap justify-end gap-2">
            {isActive && (
              <>
                <button onClick={() => onMarkNoShow(row)}
                  className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-2 text-sm font-semibold text-amber-700 hover:bg-amber-100 transition-colors"
                >Mark No-Show</button>
                <button onClick={() => onOpenCancel(row)}
                  className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-2 text-sm font-semibold text-rose-700 hover:bg-rose-100 transition-colors"
                >Cancel Booking</button>
              </>
            )}
            <button onClick={onClose}
              className="rounded-lg bg-[#003595] px-4 py-2 text-sm font-bold text-white hover:bg-[#002366] transition-colors"
            >Close</button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
   Book-for-student modal
───────────────────────────────────────────────────────────── */
function BookForStudentModal({ open, onClose, meta, today }: {
  open: boolean; onClose: () => void;
  meta: ApiResponse["meta"]; today: string;
}) {
  const [targetMode, setTargetMode] = useState<BookingTargetMode>("internal");
  const [studentQ, setStudentQ] = useState("");
  const [studentResults, setStudentResults] = useState<StudentRow[]>([]);
  const [studentLoading, setStudentLoading] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<StudentRow | null>(null);

  const [bfRoomId, setBfRoomId] = useState("");
  const [bfDate, setBfDate] = useState(today);
  const [bfStart, setBfStart] = useState("10:00");
  const [bfEnd, setBfEnd] = useState("12:00");
  const [bfPurpose, setBfPurpose] = useState("");
  const [bfAttendees, setBfAttendees] = useState<AdditionalAttendeeInput[]>([]);

  const [bfExternalName, setBfExternalName] = useState("");
  const [bfExternalEmail, setBfExternalEmail] = useState("");
  const [bfExternalPhone, setBfExternalPhone] = useState("");
  const [bfExternalId, setBfExternalId] = useState("");
  const [bfExternalFaculty, setBfExternalFaculty] = useState("");
  const [bfExternalAcademicStatus, setBfExternalAcademicStatus] = useState<AcademicStatus>("UG");
  const [bfSubmitting, setBfSubmitting] = useState(false);

  const normalizedBfAttendees = useMemo(() => bfAttendees
    .map((a) => ({
      profileUserId: typeof a.profileUserId === "string" && a.profileUserId.trim() ? a.profileUserId.trim() : null,
      fullName: a.fullName.trim(), email: a.email.trim(), phone: a.phone.trim(),
      uwiId: a.uwiId.trim(), faculty: a.faculty.trim(), academicStatus: a.academicStatus,
    }))
    .filter((a) => a.fullName || a.uwiId || a.email || a.profileUserId),
  [bfAttendees]);

  const derivedBfAttendeeCount = 1 + normalizedBfAttendees.length;

  useEffect(() => {
    if (!open || targetMode !== "internal") return;
    const t = setTimeout(async () => {
      const term = studentQ.trim();
      if (!term) { setStudentResults([]); return; }
      setStudentLoading(true);
      try {
        const res = await fetch(`/api/admin/students?q=${encodeURIComponent(term)}`);
        const data = await res.json().catch(() => ({}));
        setStudentResults(data?.rows ?? []);
      } catch { setStudentResults([]); }
      finally { setStudentLoading(false); }
    }, 300);
    return () => clearTimeout(t);
  }, [studentQ, open, targetMode]);

  function makeEmptyAttendee(): AdditionalAttendeeInput {
    return { mode: "manual", searchQuery: "", searchResults: [], searching: false,
      profileUserId: null, fullName: "", email: "", phone: "", uwiId: "", faculty: "", academicStatus: "UG" };
  }

  function updateAttr(index: number, field: keyof AdditionalAttendeeInput, value: string | null) {
    setBfAttendees((prev) => prev.map((row, i) => (i === index ? { ...row, [field]: value } : row)));
  }

  async function searchAttendeeUsers(index: number, termRaw: string) {
    const term = termRaw.trim();
    setBfAttendees((prev) => prev.map((row, i) => i === index ? { ...row, searchQuery: termRaw, searching: !!term } : row));
    if (!term) {
      setBfAttendees((prev) => prev.map((row, i) => i === index ? { ...row, searchResults: [], searching: false } : row));
      return;
    }
    try {
      const res = await fetch(`/api/admin/students?q=${encodeURIComponent(term)}`);
      const data = await res.json().catch(() => ({}));
      setBfAttendees((prev) => prev.map((row, i) => i === index ? { ...row, searchResults: data?.rows ?? [], searching: false } : row));
    } catch {
      setBfAttendees((prev) => prev.map((row, i) => i === index ? { ...row, searchResults: [], searching: false } : row));
    }
  }

  function selectAttendeeResult(index: number, row: StudentRow) {
    setBfAttendees((prev) => prev.map((a, i) => i === index ? {
      ...a, mode: "internal", profileUserId: row.id,
      searchQuery: row.full_name ?? "", searchResults: [], searching: false,
      fullName: row.full_name ?? "", email: row.email ?? "", phone: row.phone ?? "",
      uwiId: row.uwi_id ?? "", faculty: row.faculty ?? "",
      academicStatus: (row.academic_status as AcademicStatus) ?? "UG",
    } : a));
  }

  async function submitBookForStudent() {
    if (!bfRoomId) { alert("Select a room."); return; }
    const startISO = new Date(`${bfDate}T${bfStart}:00-04:00`).toISOString();
    const endISO   = new Date(`${bfDate}T${bfEnd}:00-04:00`).toISOString();
    setBfSubmitting(true);
    try {
      const payload: any = {
        roomId: Number(bfRoomId), startISO, endISO,
        purpose: bfPurpose.trim() || null,
        attendeeCount: derivedBfAttendeeCount,
        attendees: normalizedBfAttendees,
      };
      if (targetMode === "internal") {
        if (!selectedStudent) { alert("Select a student first."); setBfSubmitting(false); return; }
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
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 409 && data?.canWaitlist && targetMode === "internal" && selectedStudent) {
        const ok = window.confirm(`${data?.message ?? "This slot is already booked."}\n\nAdd this student to the waitlist instead?`);
        if (!ok) return;
        const wlRes = await fetch("/api/admin/waitlist/join", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ roomId: Number(bfRoomId), start: startISO, end: endISO, bookedForUserId: selectedStudent.id }),
        });
        const wlData = await wlRes.json().catch(() => ({}));
        if (!wlRes.ok) throw new Error(wlData?.error ?? "Failed to join waitlist.");
        alert("Student added to waitlist.");
        onClose();
        return;
      }
      if (!res.ok) throw new Error(data?.error ?? data?.message ?? "Failed to create booking");
      onClose();
    } catch (e: any) {
      alert(e?.message ?? "Failed to create booking.");
    } finally {
      setBfSubmitting(false);
    }
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/30 backdrop-blur-[2px] p-3 sm:p-6"
      onClick={(e) => { if (e.target === e.currentTarget && !bfSubmitting) onClose(); }}
    >
      <div className="relative mx-auto flex h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-xl border border-[#E5E7EB] bg-white shadow-2xl">
        {/* Header */}
        <div className="shrink-0 border-b border-[#E5E7EB] bg-[#F9FAFB] px-5 py-4 sm:px-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-[10px] font-semibold tracking-[0.18em] uppercase text-[#003595] mb-0.5">Admin Action</p>
              <h2 style={{ fontFamily: "Georgia, serif" }} className="text-xl font-bold text-[#1F2937]">Create Booking</h2>
              <p className="mt-0.5 text-sm text-[#6B7280]">Book a room on behalf of an internal or external student.</p>
            </div>
            <button onClick={() => !bfSubmitting && onClose()}
              className="rounded-lg border border-[#E5E7EB] bg-white px-3 py-1.5 text-sm text-[#374151] hover:bg-[#F3F4F6] transition-colors shrink-0"
            >✕</button>
          </div>
        </div>

        {/* Body */}
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-6">
          <div className="space-y-5">

            {/* Mode toggle */}
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={() => setTargetMode("internal")} className={modeBtnCls(targetMode === "internal")}>
                Internal user
              </button>
              <button type="button" onClick={() => setTargetMode("external")} className={modeBtnCls(targetMode === "external")}>
                External / manual
              </button>
            </div>

            {/* Primary attendee */}
            <div className="rounded-xl border border-[#E5E7EB] bg-[#F9FAFB] p-4">
              <p className={labelCls}>Primary Attendee</p>

              {targetMode === "internal" ? (
                <>
                  <label className={labelCls} style={{ marginTop: "8px" }}>Search student</label>
                  <input value={studentQ} onChange={(e) => setStudentQ(e.target.value)}
                    placeholder="Name, email, or UWI ID…" className={inputCls} />
                  <div className="mt-3 rounded-lg border border-[#E5E7EB] bg-white overflow-hidden">
                    {studentLoading ? (
                      <div className="flex items-center gap-2 p-3 text-sm text-[#6B7280]"><Spinner size={13} /> Searching…</div>
                    ) : studentResults.length === 0 ? (
                      <div className="p-3 text-sm text-[#9CA3AF]">{studentQ.trim() ? "No results found." : "Type to search students."}</div>
                    ) : (
                      <div className="max-h-52 overflow-auto divide-y divide-[#F3F4F6]">
                        {studentResults.map((s) => (
                          <button key={s.id} type="button" onClick={() => setSelectedStudent(s)}
                            className={`w-full px-3.5 py-2.5 text-left transition-colors ${selectedStudent?.id === s.id ? "bg-[#EAF6FF]" : "hover:bg-[#F9FAFB]"}`}
                          >
                            <div className="flex items-center gap-2.5">
                              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#EAF6FF] text-[#003595] text-[10px] font-extrabold">
                                {(s.full_name || s.email || "?").charAt(0).toUpperCase()}
                              </div>
                              <div>
                                <p className="text-sm font-semibold text-[#1F2937]">{s.full_name || s.email || shortId(s.id)}</p>
                                <p className="text-xs text-[#9CA3AF]">
                                  {s.uwi_id ? `ID: ${s.uwi_id}` : "UWI ID: —"}{s.email ? ` · ${s.email}` : ""}
                                </p>
                              </div>
                              {selectedStudent?.id === s.id && <span className="ml-auto text-[#003595] font-bold">✓</span>}
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  {selectedStudent && (
                    <div className="mt-3 flex items-center gap-3 rounded-lg border border-[#003595]/20 bg-[#EAF6FF] px-3.5 py-2.5">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#003595] text-white text-[11px] font-extrabold">
                        {(selectedStudent.full_name || selectedStudent.email || "?").charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <p className="text-sm font-bold text-[#003595]">{selectedStudent.full_name || selectedStudent.email}</p>
                        <p className="text-xs text-[#003595]/70">{selectedStudent.uwi_id ? `ID: ${selectedStudent.uwi_id}` : ""}</p>
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 mt-3">
                  {([["Full name", bfExternalName, setBfExternalName, "text"],
                     ["Email", bfExternalEmail, setBfExternalEmail, "email"],
                     ["Phone", bfExternalPhone, setBfExternalPhone, "tel"],
                     ["UWI ID", bfExternalId, setBfExternalId, "text"],
                     ["Faculty", bfExternalFaculty, setBfExternalFaculty, "text"],
                  ] as const).map(([lbl, val, setter, type]) => (
                    <div key={lbl}>
                      <label className={labelCls}>{lbl}</label>
                      <input type={type} value={val} onChange={(e) => setter(e.target.value)} className={inputCls} />
                    </div>
                  ))}
                  <div>
                    <label className={labelCls}>Academic status</label>
                    <select value={bfExternalAcademicStatus}
                      onChange={(e) => setBfExternalAcademicStatus(e.target.value as AcademicStatus)}
                      className={inputCls}
                    >
                      <option value="UG">UG</option>
                      <option value="PG">PG</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>
                </div>
              )}
            </div>

            {/* Booking details */}
            <div className="rounded-xl border border-[#E5E7EB] bg-[#F9FAFB] p-4">
              <p className={labelCls}>Booking Details</p>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 mt-3">
                <div>
                  <label className={labelCls}>Room</label>
                  <select value={bfRoomId} onChange={(e) => setBfRoomId(e.target.value)} className={inputCls}>
                    <option value="">Select room…</option>
                    {(meta.rooms ?? []).map((r) => <option key={r.id} value={String(r.id)}>{r.name} ({r.building})</option>)}
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Date (TT)</label>
                  <input type="date" value={bfDate} onChange={(e) => setBfDate(e.target.value)} className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Start time</label>
                  <input type="time" value={bfStart} onChange={(e) => setBfStart(e.target.value)} className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>End time</label>
                  <input type="time" value={bfEnd} onChange={(e) => setBfEnd(e.target.value)} className={inputCls} />
                </div>
                <div className="sm:col-span-2">
                  <label className={labelCls}>Purpose</label>
                  <input value={bfPurpose} onChange={(e) => setBfPurpose(e.target.value)}
                    placeholder="e.g. Study session, Group project…" className={inputCls} />
                </div>
                <div className="sm:col-span-2 rounded-lg border border-[#003595]/20 bg-[#EAF6FF] px-4 py-3">
                  <p className="text-[10px] font-bold tracking-[0.15em] uppercase text-[#003595]/60">Total attendees (auto)</p>
                  <p style={{ fontFamily: "Georgia, serif" }} className="text-2xl font-bold text-[#003595] mt-0.5">{derivedBfAttendeeCount}</p>
                  <p className="text-xs text-[#003595]/70 mt-0.5">Includes primary. Updates as attendees are added.</p>
                </div>
              </div>
            </div>

            {/* Additional attendees */}
            <div className="rounded-xl border border-[#E5E7EB] bg-[#F9FAFB] p-4">
              <div className="flex items-center justify-between gap-3 mb-3">
                <div>
                  <p className={labelCls} style={{ marginBottom: "2px" }}>Additional Attendees</p>
                  <p className="text-xs text-[#9CA3AF]">Optional. These are added to the booking record.</p>
                </div>
                <button type="button" disabled={bfSubmitting}
                  onClick={() => setBfAttendees((p) => [...p, makeEmptyAttendee()])}
                  className="rounded-lg border border-[#003595]/20 bg-white px-3 py-1.5 text-xs font-bold text-[#003595] hover:bg-[#EAF6FF] transition-colors disabled:opacity-50"
                >+ Add</button>
              </div>

              <div className="space-y-3">
                {bfAttendees.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-[#E5E7EB] px-4 py-4 text-sm text-[#9CA3AF] text-center">
                    No additional attendees yet.
                  </div>
                ) : bfAttendees.map((attendee, index) => (
                  <div key={index} className="rounded-xl border border-[#E5E7EB] bg-white p-4">
                    <div className="mb-3 flex items-center justify-between">
                      <p className="text-xs font-bold text-[#374151]">Attendee {index + 1}</p>
                      <button type="button" disabled={bfSubmitting}
                        onClick={() => setBfAttendees((p) => p.filter((_, i) => i !== index))}
                        className="rounded-lg px-2 py-1 text-xs font-semibold text-rose-600 hover:bg-rose-50 transition-colors"
                      >Remove</button>
                    </div>
                    <div className="mb-3 flex gap-2">
                      <button type="button" onClick={() => updateAttr(index, "mode", "manual")} className={modeBtnCls(attendee.mode === "manual")}>Manual</button>
                      <button type="button" onClick={() => updateAttr(index, "mode", "internal")} className={modeBtnCls(attendee.mode === "internal")}>Search account</button>
                    </div>
                    {attendee.mode === "internal" ? (
                      <div>
                        <label className={labelCls}>Search by name / email / UWI ID</label>
                        <input value={attendee.searchQuery} onChange={(e) => searchAttendeeUsers(index, e.target.value)} className={inputCls} />
                        <div className="mt-2 rounded-lg border border-[#E5E7EB] bg-[#F9FAFB] overflow-hidden">
                          {attendee.searching ? (
                            <div className="flex items-center gap-2 p-3 text-sm text-[#6B7280]"><Spinner size={13} /> Searching…</div>
                          ) : attendee.searchResults.length === 0 ? (
                            <div className="p-3 text-sm text-[#9CA3AF]">No results</div>
                          ) : (
                            <div className="max-h-44 overflow-auto divide-y divide-[#F3F4F6]">
                              {attendee.searchResults.map((row) => (
                                <button key={row.id} type="button" onClick={() => selectAttendeeResult(index, row)}
                                  className="w-full px-3.5 py-2.5 text-left hover:bg-[#EAF6FF] transition-colors"
                                >
                                  <p className="text-sm font-semibold text-[#1F2937]">{row.full_name || row.email || shortId(row.id)}</p>
                                  <p className="text-xs text-[#9CA3AF]">{row.uwi_id ? `ID: ${row.uwi_id}` : "—"}{row.email ? ` · ${row.email}` : ""}</p>
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                        {(attendee.fullName || attendee.uwiId) && (
                          <div className="mt-2 rounded-lg border border-[#003595]/20 bg-[#EAF6FF] px-3 py-2">
                            <p className="text-sm font-bold text-[#003595]">{attendee.fullName || "—"}</p>
                            <p className="text-xs text-[#003595]/70">ID: {attendee.uwiId || "—"} · {attendee.email || "—"}</p>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        {(["fullName","uwiId","email","phone","faculty"] as const).map((f) => (
                          <div key={f}>
                            <label className={labelCls}>{f === "fullName" ? "Full name" : f === "uwiId" ? "UWI ID" : f.charAt(0).toUpperCase() + f.slice(1)}</label>
                            <input value={attendee[f] as string} onChange={(e) => updateAttr(index, f, e.target.value)} className={inputCls} />
                          </div>
                        ))}
                        <div>
                          <label className={labelCls}>Academic status</label>
                          <select value={attendee.academicStatus} onChange={(e) => updateAttr(index, "academicStatus", e.target.value)} className={inputCls}>
                            <option value="UG">UG</option><option value="PG">PG</option><option value="Other">Other</option>
                          </select>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="shrink-0 border-t border-[#E5E7EB] bg-[#F9FAFB] px-5 py-4 sm:px-6">
          <div className="flex flex-wrap justify-end gap-2">
            <button onClick={() => !bfSubmitting && onClose()} disabled={bfSubmitting}
              className="rounded-lg border border-[#E5E7EB] bg-white px-5 py-2.5 text-sm font-semibold text-[#374151] hover:bg-[#F3F4F6] disabled:opacity-50 transition-colors"
            >Cancel</button>
            <button onClick={submitBookForStudent} disabled={bfSubmitting}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#003595] px-5 py-2.5 text-sm font-bold text-white hover:bg-[#002366] disabled:opacity-50 transition-colors"
            >
              {bfSubmitting ? <><Spinner light size={14} />Creating…</> : "Create Booking"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
   Main component
───────────────────────────────────────────────────────────── */
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
  const [meta, setMeta] = useState<ApiResponse["meta"]>({ rooms: [], buildings: [], departments: [] });

  const [openDetails, setOpenDetails] = useState(false);
  const [activeRow, setActiveRow] = useState<BookingRow | null>(null);
  const [openCancel, setOpenCancel] = useState(false);
  const [cancelTarget, setCancelTarget] = useState<BookingRow | null>(null);
  const [openBookForStudent, setOpenBookForStudent] = useState(false);

  async function fetchBookings() {
    setLoading(true); setErr("");
    const sp = new URLSearchParams();
    sp.set("from", from); sp.set("to", to);
    if (roomId) sp.set("roomId", roomId);
    if (building) sp.set("building", building);
    if (departmentId) sp.set("departmentId", departmentId);
    if (status && status !== "all") sp.set("status", status);
    if (q.trim()) sp.set("q", q.trim());
    try {
      const res = await fetch(`/api/admin/bookings?${sp.toString()}`);
      const data = (await res.json().catch(() => ({}))) as ApiResponse | { error?: string; detail?: string };
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
    } finally { setLoading(false); }
  }

  useEffect(() => { fetchBookings(); }, []);

  async function markNoShow(row: BookingRow) {
    if (!confirm("Mark this booking as No-Show?")) return;
    const res = await fetch(`/api/admin/bookings/${row.id}/no-show`, { method: "POST" });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) { alert(data?.error ?? "Failed to mark no-show."); return; }
    await fetchBookings();
  }

  async function submitCancel(reason: string) {
    if (!cancelTarget) return;
    const res = await fetch(`/api/admin/bookings/${cancelTarget.id}/cancel`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason: reason.trim() || undefined }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) { alert(data?.error ?? "Failed to cancel."); return; }
    setOpenCancel(false); setOpenDetails(false);
    setCancelTarget(null); setActiveRow(null);
    await fetchBookings();
  }

  const roomsForSelect = useMemo(() => {
    let list = meta.rooms ?? [];
    if (building) list = list.filter((r) => r.building === building);
    if (departmentId) list = list.filter((r) => String(r.departmentId) === String(departmentId));
    return list;
  }, [meta.rooms, building, departmentId]);

  const counts = useMemo(() => ({
    total:     rows.length,
    active:    rows.filter((r) => r.status.toLowerCase() === "active").length,
    completed: rows.filter((r) => r.status.toLowerCase() === "completed").length,
    cancelled: rows.filter((r) => r.status.toLowerCase() === "cancelled").length,
    no_show:   rows.filter((r) => r.status.toLowerCase() === "no_show").length,
  }), [rows]);

  return (
    <div className="min-h-screen bg-[#F9FAFB]">

      {/* ── Page header ── */}
      {showPageHeader && (
        <div className="bg-white border-b-2 border-[#003595]">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="h-1 w-16 bg-[#003595] -mb-px" />
            <div className="py-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-[10px] font-semibold tracking-[0.2em] uppercase text-[#003595] mb-1.5">
                  {mode === "super_admin" ? "Super Admin" : "Admin"} — Room Management
                </p>
                <h1 style={{ fontFamily: "Georgia, serif" }} className="text-3xl sm:text-4xl font-bold text-[#1F2937]">
                  Bookings
                </h1>
                <p className="mt-1.5 text-sm text-[#6B7280] max-w-lg">
                  {mode === "super_admin"
                    ? "View and manage bookings across all departments."
                    : "View and manage bookings for rooms within your department scope."}
                </p>
              </div>
              <nav className="flex items-center gap-1.5 text-xs text-[#9CA3AF] shrink-0 pb-1">
                <span>{mode === "super_admin" ? "Super Admin" : "Admin"}</span>
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none">
                  <path d="m9 18 6-6-6-6" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                <span className="font-semibold text-[#003595]">Bookings</span>
              </nav>
            </div>
          </div>
        </div>
      )}

      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8 space-y-6">

        {/* ── Stat cards ── */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          <StatCard label="Total" count={counts.total} active={status === "all"} onClick={() => setStatus("all")} />
          <StatCard label="Active" count={counts.active} active={status === "active"} onClick={() => setStatus(status === "active" ? "all" : "active")} />
          <StatCard label="Completed" count={counts.completed} active={status === "completed"} onClick={() => setStatus(status === "completed" ? "all" : "completed")} />
          <StatCard label="Cancelled" count={counts.cancelled} active={status === "cancelled"} onClick={() => setStatus(status === "cancelled" ? "all" : "cancelled")} />
          <StatCard label="No-Show" count={counts.no_show} active={status === "no_show"} onClick={() => setStatus(status === "no_show" ? "all" : "no_show")} />
        </div>

        {/* ── Filter card ── */}
        <div className="bg-white rounded-xl border border-[#E5E7EB] shadow-sm overflow-hidden">
          <div className="px-5 py-3.5 border-b border-[#E5E7EB] bg-[#F9FAFB] flex items-center justify-between flex-wrap gap-3">
            <h2 className="text-xs font-bold tracking-[0.12em] uppercase text-[#374151]">Filter Bookings</h2>
            <button
              type="button"
              onClick={() => setOpenBookForStudent(true)}
              className="inline-flex items-center gap-2 rounded-lg bg-[#003595] px-4 py-2 text-sm font-bold text-white hover:bg-[#002366] transition-colors"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
              </svg>
              Book for Student
            </button>
          </div>

          <div className="px-5 py-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-12">
              {/* Search */}
              <div className="sm:col-span-2 lg:col-span-4">
                <label className={labelCls}>Search</label>
                <div className="relative">
                  <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-[#9CA3AF]">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                      <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" />
                      <path d="m16.5 16.5 4 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                    </svg>
                  </span>
                  <input value={q} onChange={(e) => setQ(e.target.value)}
                    placeholder="Name, email, UWI ID, purpose…"
                    className={`${inputCls} pl-9`}
                  />
                </div>
              </div>
              {/* From */}
              <div className="lg:col-span-2">
                <label className={labelCls}>From</label>
                <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className={inputCls} />
              </div>
              {/* To */}
              <div className="lg:col-span-2">
                <label className={labelCls}>To</label>
                <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className={inputCls} />
              </div>
              {/* Building */}
              <div className="lg:col-span-2">
                <label className={labelCls}>Building</label>
                <select value={building} onChange={(e) => { setBuilding(e.target.value); setRoomId(""); }} className={inputCls}>
                  <option value="">All buildings</option>
                  {(meta.buildings ?? []).map((b) => <option key={b} value={b}>{b}</option>)}
                </select>
              </div>
              {/* Status */}
              <div className="lg:col-span-2">
                <label className={labelCls}>Status</label>
                <select value={status} onChange={(e) => setStatus(e.target.value as Status)} className={inputCls}>
                  <option value="all">All</option>
                  <option value="active">Active</option>
                  <option value="cancelled">Cancelled</option>
                  <option value="completed">Completed</option>
                  <option value="no_show">No-Show</option>
                </select>
              </div>
              {/* Department */}
              <div className="lg:col-span-3">
                <label className={labelCls}>Department</label>
                <select value={departmentId} onChange={(e) => { setDepartmentId(e.target.value); setRoomId(""); }} className={inputCls}>
                  <option value="">All departments</option>
                  {(meta.departments ?? []).map((d) => <option key={d.id} value={String(d.id)}>{d.name}</option>)}
                </select>
              </div>
              {/* Room */}
              <div className="lg:col-span-3">
                <label className={labelCls}>Room</label>
                <select value={roomId} onChange={(e) => setRoomId(e.target.value)} className={inputCls}>
                  <option value="">All rooms</option>
                  {roomsForSelect.map((r) => <option key={r.id} value={String(r.id)}>{r.name} ({r.building})</option>)}
                </select>
              </div>
              {/* Apply */}
              <div className="sm:col-span-2 lg:col-span-3 flex items-end">
                <button type="button" onClick={() => fetchBookings()}
                  className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-[#003595] py-2.5 text-sm font-bold text-white hover:bg-[#002366] transition-colors"
                >
                  {loading ? <><Spinner light size={13} />Loading…</> : "Apply Filters"}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* ── Results table ── */}
        <div className="bg-white rounded-xl border border-[#E5E7EB] shadow-sm overflow-hidden">
          <div className="px-5 py-3.5 border-b border-[#E5E7EB] bg-[#F9FAFB] flex items-center justify-between">
            <h2 className="text-xs font-bold tracking-[0.12em] uppercase text-[#374151]">Results</h2>
            {!loading && (
              <span className="text-xs text-[#9CA3AF]">
                {rows.length} booking{rows.length !== 1 ? "s" : ""}
              </span>
            )}
          </div>

          {err ? (
            <div className="m-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{err}</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm" aria-label="Bookings table">
                <thead>
                  <tr className="border-b border-[#E5E7EB]">
                    <th className="py-3 pl-5 pr-4 text-left text-[10px] font-bold tracking-[0.15em] uppercase text-[#9CA3AF]">Booking</th>
                    <th className="py-3 px-4 text-left text-[10px] font-bold tracking-[0.15em] uppercase text-[#9CA3AF] hidden md:table-cell">Room</th>
                    <th className="py-3 px-4 text-left text-[10px] font-bold tracking-[0.15em] uppercase text-[#9CA3AF] hidden lg:table-cell">Booked For</th>
                    <th className="py-3 px-4 text-left text-[10px] font-bold tracking-[0.15em] uppercase text-[#9CA3AF] hidden xl:table-cell">Status</th>
                    <th className="py-3 pl-4 pr-5 text-right text-[10px] font-bold tracking-[0.15em] uppercase text-[#9CA3AF]">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F3F4F6]">
                  {loading ? (
                    <>{[1,2,3,4,5].map((i) => <SkeletonRow key={i} />)}</>
                  ) : rows.length === 0 ? (
                    <tr>
                      <td colSpan={5}>
                        <div className="flex flex-col items-center justify-center py-16 text-center">
                          <div className="h-12 w-12 rounded-xl bg-[#F3F4F6] flex items-center justify-center mb-3 text-[#9CA3AF]">
                            <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                              <rect x="3" y="4" width="18" height="18" rx="3" stroke="currentColor" strokeWidth="1.5" />
                              <path d="M3 9h18M8 2v4M16 2v4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                            </svg>
                          </div>
                          <p className="text-sm font-semibold text-[#374151]">No bookings found</p>
                          <p className="mt-1 text-xs text-[#9CA3AF]">Try adjusting your filters or date range.</p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    rows.map((b) => {
                      const u = getDisplayBookedUser(b);
                      const c = getDisplayCreator(b);
                      const isActive = String(b.status).toLowerCase() === "active";
                      const initial = (u.primary || "?").charAt(0).toUpperCase();

                      return (
                        <tr key={b.id} className="group hover:bg-[#F9FAFB] transition-colors align-top">
                          {/* Booking */}
                          <td className="py-4 pl-5 pr-4">
                            <div className="flex items-start gap-3">
                              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#EAF6FF] text-[#003595] text-[11px] font-extrabold mt-0.5 select-none ring-1 ring-[#003595]/10">
                                {initial}
                              </div>
                              <div>
                                <p className="text-sm font-semibold text-[#1F2937] group-hover:text-[#003595] transition-colors">
                                  {fmtTtDateTime(b.start_time)}
                                </p>
                                <p className="text-xs text-[#6B7280] mt-0.5">
                                  {fmtTtTime(b.start_time)} – {fmtTtTime(b.end_time)}
                                </p>
                                <p className="text-xs text-[#9CA3AF] mt-0.5">ID: {b.id}</p>
                                <div className="mt-1.5 xl:hidden"><StatusBadge status={b.status} /></div>
                              </div>
                            </div>
                          </td>
                          {/* Room */}
                          <td className="py-4 px-4 hidden md:table-cell">
                            <p className="text-sm font-semibold text-[#1F2937]">{b.rooms?.name ?? `Room #${b.room_id}`}</p>
                            <p className="text-xs text-[#6B7280] mt-0.5">{b.rooms?.building ?? "—"}</p>
                            {b.rooms?.departments?.name && <p className="text-xs text-[#9CA3AF]">{b.rooms.departments.name}</p>}
                          </td>
                          {/* Booked For */}
                          <td className="py-4 px-4 hidden lg:table-cell">
                            <p className="text-sm font-semibold text-[#1F2937]">{u.primary}</p>
                            <p className="text-xs text-[#6B7280] mt-0.5">{u.uwiId !== "—" ? `ID: ${u.uwiId}` : u.email}</p>
                            <div className="mt-1.5 flex flex-wrap gap-1">
                              <SourceBadge source={b.booking_source} />
                              <span className="inline-flex items-center rounded-full bg-[#F3F4F6] px-2 py-0.5 text-[10px] font-medium text-[#6B7280] ring-1 ring-[#E5E7EB]">
                                {u.attendeeCount} attendee{u.attendeeCount !== 1 ? "s" : ""}
                              </span>
                            </div>
                            <p className="text-xs text-[#9CA3AF] mt-1">By: {c.primary}</p>
                          </td>
                          {/* Status */}
                          <td className="py-4 px-4 hidden xl:table-cell">
                            <StatusBadge status={b.status} />
                            {b.purpose?.trim() && (
                              <p className="text-xs text-[#6B7280] mt-1.5 max-w-[12rem] truncate">{b.purpose.trim()}</p>
                            )}
                          </td>
                          {/* Actions */}
                          <td className="py-4 pl-4 pr-5">
                            <div className="flex items-center justify-end flex-wrap gap-1.5">
                              <button
                                onClick={() => { setActiveRow(b); setOpenDetails(true); }}
                                className="rounded-lg border border-[#E5E7EB] bg-white px-2.5 py-1.5 text-[11px] font-semibold text-[#374151] hover:border-[#003595] hover:bg-[#EAF6FF] hover:text-[#003595] transition-all whitespace-nowrap"
                              >View</button>
                              {isActive && (
                                <>
                                  <button onClick={() => markNoShow(b)}
                                    className="rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-[11px] font-semibold text-amber-700 hover:bg-amber-100 transition-colors whitespace-nowrap"
                                  >No-Show</button>
                                  <button onClick={() => { setCancelTarget(b); setOpenCancel(true); }}
                                    className="rounded-lg border border-rose-200 bg-rose-50 px-2.5 py-1.5 text-[11px] font-semibold text-rose-700 hover:bg-rose-100 transition-colors whitespace-nowrap"
                                  >Cancel</button>
                                </>
                              )}
                              {!isActive && <span className="text-xs text-[#9CA3AF]">—</span>}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          )}

          {!loading && rows.length > 0 && (
            <div className="border-t border-[#E5E7EB] px-5 py-3 bg-[#F9FAFB]">
              <p className="text-xs text-[#9CA3AF]">
                {rows.length} booking{rows.length !== 1 ? "s" : ""} displayed
                {status !== "all" ? ` · filtered by ${status}` : ""}
                {q ? ` · matching "${q}"` : ""}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* ── Modals ── */}
      <DetailsModal
        open={openDetails}
        row={activeRow}
        onClose={() => { setOpenDetails(false); setActiveRow(null); }}
        onMarkNoShow={markNoShow}
        onOpenCancel={(b) => { setCancelTarget(b); setOpenDetails(false); setOpenCancel(true); }}
      />

      <CancelModal
        open={openCancel}
        target={cancelTarget}
        onClose={() => { setOpenCancel(false); setCancelTarget(null); }}
        onConfirm={submitCancel}
      />

      <BookForStudentModal
        open={openBookForStudent}
        onClose={() => setOpenBookForStudent(false)}
        meta={meta}
        today={today}
      />
    </div>
  );
}
