"use client";

// src/app/(app)/super-admin/users/page.tsx

import { useEffect, useMemo, useState } from "react";

/* ─────────────────────────────────────────────────────────────
   Types
───────────────────────────────────────────────────────────── */
type Role = "student" | "staff" | "admin" | "super_admin";

type UserRow = {
  id: string;
  email: string;
  fullName: string;
  uwiId: string;
  phone: string;
  faculty: string;
  academicStatus: string | null;
  accountStatus: string | null;
  emailVerifiedAt: string | null;
  createdAt: string | null;
  updatedAt: string | null;
  role: Role;
  departmentId: number | null;
  departmentName: string | null;
  scopedDepartmentIds: number[];
};

type Dept = { id: number; name: string };

type MeResponse = {
  user: null | {
    id: string;
    email: string | null;
    role: Role | null;
    departmentId: number | null;
  };
};

const ROLE_PRIORITY: Record<Role, number> = {
  super_admin: 0,
  admin: 1,
  staff: 2,
  student: 3,
};

function fmtDate(iso?: string | null) {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("en-GB", {
    year: "numeric",
    month: "short",
    day: "2-digit",
  }).format(new Date(iso));
}

/* ─────────────────────────────────────────────────────────────
   Shared primitives
───────────────────────────────────────────────────────────── */
function Spinner({
  light = false,
  size = 14,
}: {
  light?: boolean;
  size?: number;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      className="animate-spin shrink-0"
      aria-hidden="true"
    >
      <circle
        cx="12"
        cy="12"
        r="10"
        stroke={light ? "rgba(255,255,255,0.25)" : "rgba(0,53,149,0.15)"}
        strokeWidth="3"
      />
      <path
        d="M12 2a10 10 0 0 1 10 10"
        stroke={light ? "#fff" : "#003595"}
        strokeWidth="3"
        strokeLinecap="round"
      />
    </svg>
  );
}

function RoleBadge({ role }: { role: Role }) {
  const styles: Record<Role, string> = {
    super_admin: "bg-[#003595] text-white ring-[#003595]",
    admin: "bg-[#EAF6FF] text-[#003595] ring-[#003595]/20",
    staff: "bg-[#F3F4F6] text-[#374151] ring-[#E5E7EB]",
    student: "bg-[#F3F4F6] text-[#374151] ring-[#E5E7EB]",
  };

  const labels: Record<Role, string> = {
    super_admin: "Super Admin",
    admin: "Admin",
    staff: "Staff",
    student: "Student",
  };

  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-bold tracking-wide uppercase ring-1 ${styles[role]}`}
    >
      {labels[role]}
    </span>
  );
}

function StatusBadge({ value }: { value: string | null }) {
  const text = value || "—";

  const cls =
    value === "active"
      ? "bg-emerald-50 text-emerald-700 ring-emerald-100"
      : value === "pending_verification"
        ? "bg-amber-50 text-amber-700 ring-amber-100"
        : value === "suspended"
          ? "bg-rose-50 text-rose-700 ring-rose-100"
          : "bg-slate-50 text-slate-700 ring-slate-200";

  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-medium ring-1 ${cls}`}
    >
      {text}
    </span>
  );
}

function SkeletonRow() {
  return (
    <tr className="animate-pulse border-b border-[#F3F4F6]">
      <td className="py-3.5 pl-5 pr-4">
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-full bg-[#F3F4F6] shrink-0" />
          <div className="space-y-1.5">
            <div className="h-3.5 w-32 rounded bg-[#F3F4F6]" />
            <div className="h-2.5 w-44 rounded bg-[#F3F4F6]" />
          </div>
        </div>
      </td>
      <td className="py-3.5 px-4 hidden md:table-cell">
        <div className="h-5 w-20 rounded-full bg-[#F3F4F6]" />
      </td>
      <td className="py-3.5 px-4 hidden lg:table-cell">
        <div className="h-4 w-28 rounded bg-[#F3F4F6]" />
      </td>
      <td className="py-3.5 pl-4 pr-5">
        <div className="h-8 w-32 rounded-lg bg-[#F3F4F6] ml-auto" />
      </td>
    </tr>
  );
}

/* ─────────────────────────────────────────────────────────────
   Scope assignment modal
───────────────────────────────────────────────────────────── */
function ScopeModal({
  open,
  onClose,
  user,
  departments,
  onSave,
}: {
  open: boolean;
  onClose: () => void;
  user: UserRow | null;
  departments: Dept[];
  onSave: (deptIds: number[]) => Promise<void>;
}) {
  const [selected, setSelected] = useState<number[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (user) setSelected(user.scopedDepartmentIds ?? []);
  }, [user]);

  if (!open || !user) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/30 backdrop-blur-[2px] p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget && !saving) onClose();
      }}
    >
      <div className="w-full max-w-md bg-white rounded-xl shadow-2xl border border-[#E5E7EB] overflow-hidden">
        <div className="px-5 py-4 border-b border-[#E5E7EB] bg-[#F9FAFB]">
          <p className="text-[10px] font-semibold tracking-[0.18em] uppercase text-[#003595] mb-0.5">
            Admin Permissions
          </p>
          <h2
            style={{ fontFamily: "Georgia, serif" }}
            className="text-lg font-bold text-[#1F2937]"
          >
            Assign Departments
          </h2>
          <p className="mt-0.5 text-xs text-[#6B7280]">
            {user.fullName || user.email} — select departments this admin can
            manage.
          </p>
        </div>

        <div className="px-5 py-4 max-h-72 overflow-y-auto space-y-1.5">
          {departments.length === 0 ? (
            <p className="text-xs text-[#9CA3AF] text-center py-4">
              No departments found.
            </p>
          ) : (
            departments.map((d) => {
              const checked = selected.includes(d.id);
              return (
                <label
                  key={d.id}
                  className="flex cursor-pointer items-center justify-between rounded-lg border border-[#E5E7EB] px-3.5 py-2.5 hover:border-[#003595]/30 hover:bg-[#EAF6FF]/40 transition-colors"
                >
                  <div className="flex items-center gap-2.5">
                    <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded bg-[#EAF6FF] text-[#003595] text-[10px] font-extrabold">
                      {d.name[0]?.toUpperCase()}
                    </div>
                    <span className="text-sm font-medium text-[#1F2937]">
                      {d.name}
                    </span>
                  </div>
                  <input
                    type="checkbox"
                    checked={checked}
                    disabled={saving}
                    onChange={(e) => {
                      setSelected(
                        e.target.checked
                          ? Array.from(new Set([...selected, d.id]))
                          : selected.filter((x) => x !== d.id),
                      );
                    }}
                    className="h-4 w-4 rounded border-[#E5E7EB] accent-[#003595]"
                  />
                </label>
              );
            })
          )}
        </div>

        <div className="flex gap-2.5 px-5 pb-5 border-t border-[#E5E7EB] pt-4">
          <button
            onClick={onClose}
            disabled={saving}
            className="flex-1 rounded-lg border border-[#E5E7EB] bg-white py-2.5 text-sm font-semibold text-[#374151] hover:bg-[#F3F4F6] disabled:opacity-50 transition-colors"
          >
            Cancel
          </button>
          <button
            disabled={saving}
            onClick={async () => {
              setSaving(true);
              try {
                await onSave(selected);
                onClose();
              } finally {
                setSaving(false);
              }
            }}
            className="flex-1 inline-flex items-center justify-center gap-2 rounded-lg bg-[#003595] py-2.5 text-sm font-bold text-white hover:bg-[#002366] disabled:opacity-50 transition-colors"
          >
            {saving ? (
              <>
                <Spinner light size={14} />
                Saving…
              </>
            ) : (
              "Save Permissions"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
   Main page
───────────────────────────────────────────────────────────── */
export default function SuperAdminUsersPage() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [departments, setDepartments] = useState<Dept[]>([]);
  const [loading, setLoading] = useState(true);

  const [myId, setMyId] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [roleFilter, setRoleFilter] = useState<"all" | Role>("all");

  const [busyUserId, setBusyUserId] = useState<string | null>(null);
  const [scopeModalOpen, setScopeModalOpen] = useState(false);
  const [scopeUser, setScopeUser] = useState<UserRow | null>(null);

  async function refresh() {
    const [meRes, usersRes, deptsRes] = await Promise.all([
      fetch("/api/me"),
      fetch("/api/super-admin/users/list"),
      fetch("/api/departments"),
    ]);

    const meJson = (await meRes.json().catch(() => null)) as MeResponse | null;
    setMyId(meJson?.user?.id ?? null);

    const uJson = await usersRes.json().catch(() => ({}));
    setUsers(uJson.users ?? []);

    const dJson = await deptsRes.json().catch(() => ({}));
    setDepartments(dJson.departments ?? []);
  }

  useEffect(() => {
    setLoading(true);
    refresh()
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();

    return users
      .filter((u) => {
        if (roleFilter !== "all" && u.role !== roleFilter) return false;
        if (!needle) return true;

        const hay = [
          u.fullName ?? "",
          u.email ?? "",
          u.uwiId ?? "",
          u.phone ?? "",
          u.faculty ?? "",
          u.academicStatus ?? "",
          u.accountStatus ?? "",
          u.departmentName ?? "",
        ]
          .join(" ")
          .toLowerCase();

        return hay.includes(needle);
      })
      .sort((a, b) => {
        const byRole = ROLE_PRIORITY[a.role] - ROLE_PRIORITY[b.role];
        if (byRole !== 0) return byRole;
        return (a.fullName || a.email || "").localeCompare(
          b.fullName || b.email || "",
        );
      });
  }, [users, q, roleFilter]);

  const counts = useMemo(
    () => ({
      total: users.length,
      super_admin: users.filter((u) => u.role === "super_admin").length,
      admin: users.filter((u) => u.role === "admin").length,
      staff: users.filter((u) => u.role === "staff").length,
      student: users.filter((u) => u.role === "student").length,
    }),
    [users],
  );

  async function updateRole(targetUserId: string, newRole: Role) {
    setBusyUserId(targetUserId);
    try {
      const r = await fetch("/api/super-admin/users/update-role", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetUserId, newRole }),
      });

      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        alert(j.error ?? "Failed to update role");
        return;
      }

      await refresh();
    } finally {
      setBusyUserId(null);
    }
  }

  async function saveDeptScopes(adminUserId: string, deptIds: number[]) {
    const r = await fetch("/api/super-admin/scopes/set-departments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ adminUserId, departmentIds: deptIds }),
    });

    if (!r.ok) {
      const j = await r.json().catch(() => ({}));
      throw new Error(j.error ?? "Failed");
    }

    await refresh();
  }

  return (
    <div className="min-h-screen bg-[#F9FAFB]">
      <div className="bg-white border-b-2 border-[#003595]">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="h-1 w-16 bg-[#003595] -mb-px" />
          <div className="py-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-[10px] font-semibold tracking-[0.2em] uppercase text-[#003595] mb-1.5">
                Super Admin — User Management
              </p>
              <h1
                style={{ fontFamily: "Georgia, serif" }}
                className="text-3xl sm:text-4xl font-bold text-[#1F2937]"
              >
                Users
              </h1>
              <p className="mt-1.5 text-sm text-[#6B7280] max-w-lg">
                Manage roles and department permissions for all registered users.
              </p>
            </div>
            <nav className="flex items-center gap-1.5 text-xs text-[#9CA3AF] shrink-0 pb-1">
              <span>Super Admin</span>
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none">
                <path
                  d="m9 18 6-6-6-6"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              <span className="font-semibold text-[#003595]">Users</span>
            </nav>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {(["student", "staff", "admin", "super_admin"] as Role[]).map(
            (role) => (
              <button
                key={role}
                onClick={() =>
                  setRoleFilter(roleFilter === role ? "all" : role)
                }
                className={`rounded-xl border px-4 py-3 text-left transition-all ${
                  roleFilter === role
                    ? "border-[#003595] bg-[#EAF6FF]"
                    : "border-[#E5E7EB] bg-white hover:border-[#003595]/30"
                }`}
              >
                <p className="text-[10px] font-bold tracking-[0.15em] uppercase text-[#9CA3AF]">
                  {role === "super_admin"
                    ? "Super Admin"
                    : role.charAt(0).toUpperCase() + role.slice(1)}
                </p>
                <p
                  style={{ fontFamily: "Georgia, serif" }}
                  className={`text-2xl font-bold mt-0.5 ${
                    roleFilter === role ? "text-[#003595]" : "text-[#1F2937]"
                  }`}
                >
                  {counts[role]}
                </p>
              </button>
            ),
          )}
        </div>

        <div className="bg-white rounded-xl border border-[#E5E7EB] shadow-sm overflow-hidden">
          <div className="px-5 py-3.5 border-b border-[#E5E7EB] bg-[#F9FAFB]">
            <h2 className="text-xs font-bold tracking-[0.12em] uppercase text-[#374151]">
              Filter & Search
            </h2>
          </div>
          <div className="px-5 py-4 flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-[#9CA3AF]">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                  <circle
                    cx="11"
                    cy="11"
                    r="7"
                    stroke="currentColor"
                    strokeWidth="2"
                  />
                  <path
                    d="m16.5 16.5 4 4"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                  />
                </svg>
              </span>
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search by name, email, ID, phone, faculty…"
                className="w-full rounded-lg border border-[#E5E7EB] bg-[#F9FAFB] py-2.5 pl-9 pr-4 text-sm text-[#1F2937] outline-none placeholder:text-[#9CA3AF] transition focus:border-[#003595] focus:ring-2 focus:ring-[#003595]/10"
              />
            </div>

            <select
              value={roleFilter}
              onChange={(e) =>
                setRoleFilter(e.target.value as "all" | Role)
              }
              className="rounded-lg border border-[#E5E7EB] bg-[#F9FAFB] px-3.5 py-2.5 text-sm text-[#1F2937] outline-none transition focus:border-[#003595] focus:ring-2 focus:ring-[#003595]/10 sm:w-44"
            >
              <option value="all">All Roles</option>
              <option value="student">Student</option>
              <option value="staff">Staff</option>
              <option value="admin">Admin</option>
              <option value="super_admin">Super Admin</option>
            </select>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-[#E5E7EB] shadow-sm overflow-hidden">
          <div className="px-5 py-3.5 border-b border-[#E5E7EB] bg-[#F9FAFB] flex items-center justify-between">
            <h2 className="text-xs font-bold tracking-[0.12em] uppercase text-[#374151]">
              All Users
            </h2>
            {!loading && (
              <span className="text-xs text-[#9CA3AF]">
                {filtered.length} of {users.length}
              </span>
            )}
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm" aria-label="Users table">
              <thead>
                <tr className="border-b border-[#E5E7EB]">
                  <th className="py-3 pl-5 pr-4 text-left text-[10px] font-bold tracking-[0.15em] uppercase text-[#9CA3AF]">
                    User
                  </th>
                  <th className="py-3 px-4 text-left text-[10px] font-bold tracking-[0.15em] uppercase text-[#9CA3AF] hidden md:table-cell">
                    Role
                  </th>
                  <th className="py-3 px-4 text-left text-[10px] font-bold tracking-[0.15em] uppercase text-[#9CA3AF] hidden lg:table-cell">
                    Dept. Scope
                  </th>
                  <th className="py-3 pl-4 pr-5 text-right text-[10px] font-bold tracking-[0.15em] uppercase text-[#9CA3AF]">
                    Actions
                  </th>
                </tr>
              </thead>

              <tbody className="divide-y divide-[#F3F4F6]">
                {loading ? (
                  <>
                    {[1, 2, 3, 4, 5].map((i) => (
                      <SkeletonRow key={i} />
                    ))}
                  </>
                ) : filtered.length === 0 ? (
                  <tr>
                    <td colSpan={4}>
                      <div className="flex flex-col items-center justify-center py-16 text-center">
                        <div className="h-12 w-12 rounded-xl bg-[#F3F4F6] flex items-center justify-center mb-3 text-[#9CA3AF]">
                          <svg
                            width="22"
                            height="22"
                            viewBox="0 0 24 24"
                            fill="none"
                          >
                            <circle
                              cx="12"
                              cy="8"
                              r="4"
                              stroke="currentColor"
                              strokeWidth="1.5"
                            />
                            <path
                              d="M4 20c0-4 3.582-7 8-7s8 3 8 7"
                              stroke="currentColor"
                              strokeWidth="1.5"
                              strokeLinecap="round"
                            />
                          </svg>
                        </div>
                        <p className="text-sm font-semibold text-[#374151]">
                          No users found
                        </p>
                        <p className="mt-1 text-xs text-[#9CA3AF]">
                          Try adjusting your search or filter.
                        </p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filtered.map((u) => {
                    const isMe = myId === u.id;
                    const isBusy = busyUserId === u.id;

                    return (
                      <tr
                        key={u.id}
                        className="group hover:bg-[#F9FAFB] transition-colors"
                      >
                        <td className="py-3.5 pl-5 pr-4">
                          <div className="flex items-center gap-3">
                            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#EAF6FF] text-[#003595] text-[11px] font-extrabold select-none ring-1 ring-[#003595]/10">
                              {(u.fullName || u.email).charAt(0).toUpperCase()}
                            </div>
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5">
                                <p className="text-sm font-semibold text-[#1F2937] group-hover:text-[#003595] transition-colors truncate">
                                  {u.fullName || "—"}
                                </p>
                                {isMe && (
                                  <span className="shrink-0 rounded-full bg-[#F3F4F6] px-1.5 py-0.5 text-[10px] font-bold text-[#6B7280] ring-1 ring-[#E5E7EB]">
                                    You
                                  </span>
                                )}
                              </div>
                              <p className="text-[11px] text-[#9CA3AF] truncate">
                                {u.email}
                              </p>
                              {u.uwiId && (
                                <p className="text-[11px] text-[#9CA3AF]">
                                  ID: {u.uwiId}
                                </p>
                              )}
                              <div className="mt-1 flex flex-wrap items-center gap-1.5">
                                {u.accountStatus && (
                                  <StatusBadge value={u.accountStatus} />
                                )}
                                {u.academicStatus && (
                                  <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium bg-slate-50 text-slate-700 ring-1 ring-slate-200">
                                    {u.academicStatus}
                                  </span>
                                )}
                                {u.faculty && (
                                  <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium bg-slate-50 text-slate-700 ring-1 ring-slate-200">
                                    {u.faculty}
                                  </span>
                                )}
                              </div>
                              <p className="mt-1 text-[11px] text-[#9CA3AF]">
                                Verified:{" "}
                                {u.emailVerifiedAt ? fmtDate(u.emailVerifiedAt) : "No"}
                              </p>
                            </div>
                          </div>
                        </td>

                        <td className="py-3.5 px-4 hidden md:table-cell">
                          <RoleBadge role={u.role} />
                        </td>

                        <td className="py-3.5 px-4 hidden lg:table-cell">
                          {u.role === "admin" ? (
                            <div className="flex flex-wrap gap-1.5">
                              {(u.scopedDepartmentIds ?? []).length === 0 ? (
                                <span className="text-xs text-[#9CA3AF] italic">
                                  No scope assigned
                                </span>
                              ) : (
                                u.scopedDepartmentIds.map((deptId) => {
                                  const d = departments.find((x) => x.id === deptId);
                                  return (
                                    <span
                                      key={deptId}
                                      className="rounded-full bg-[#F3F4F6] px-2 py-0.5 text-[11px] text-[#374151] ring-1 ring-[#E5E7EB]"
                                    >
                                      {d?.name ?? `#${deptId}`}
                                    </span>
                                  );
                                })
                              )}
                            </div>
                          ) : (
                            <span className="text-xs text-[#9CA3AF]">—</span>
                          )}
                        </td>

                        <td className="py-3.5 pl-4 pr-5">
                          {isMe ? (
                            <div className="flex justify-end">
                              <span className="text-xs text-[#9CA3AF] italic">
                                Current account
                              </span>
                            </div>
                          ) : isBusy ? (
                            <div className="flex justify-end">
                              <span className="inline-flex items-center gap-1.5 text-xs text-[#6B7280]">
                                <Spinner size={13} /> Updating…
                              </span>
                            </div>
                          ) : (
                            <div className="flex items-center justify-end gap-1.5 flex-wrap">
                              {(u.role === "student" || u.role === "staff") && (
                                <button
                                  onClick={() => updateRole(u.id, "admin")}
                                  className="rounded-lg border border-[#E5E7EB] bg-white px-2.5 py-1.5 text-[11px] font-semibold text-[#374151] hover:border-[#003595] hover:bg-[#EAF6FF] hover:text-[#003595] transition-all whitespace-nowrap"
                                >
                                  Make Admin
                                </button>
                              )}

                              {u.role === "admin" && (
                                <>
                                  <button
                                    onClick={() => {
                                      setScopeUser(u);
                                      setScopeModalOpen(true);
                                    }}
                                    className="rounded-lg border border-[#E5E7EB] bg-white px-2.5 py-1.5 text-[11px] font-semibold text-[#374151] hover:border-[#003595] hover:bg-[#EAF6FF] hover:text-[#003595] transition-all whitespace-nowrap"
                                  >
                                    Assign Dept.
                                  </button>

                                  <button
                                    onClick={() => updateRole(u.id, "super_admin")}
                                    className="rounded-lg border border-[#003595]/20 bg-[#EAF6FF] px-2.5 py-1.5 text-[11px] font-bold text-[#003595] hover:bg-[#003595] hover:text-white transition-all whitespace-nowrap"
                                  >
                                    Make Super
                                  </button>

                                  <button
                                    onClick={() => updateRole(u.id, "staff")}
                                    className="rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-[11px] font-semibold text-amber-700 hover:bg-amber-100 transition-colors whitespace-nowrap"
                                  >
                                    Demote to Staff
                                  </button>

                                  <button
                                    onClick={() => updateRole(u.id, "student")}
                                    className="rounded-lg border border-red-200 bg-red-50 px-2.5 py-1.5 text-[11px] font-semibold text-red-700 hover:bg-red-100 transition-colors whitespace-nowrap"
                                  >
                                    Demote to Student
                                  </button>
                                </>
                              )}

                              {u.role === "super_admin" && (
                                <span className="text-xs text-[#9CA3AF]">—</span>
                              )}
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {!loading && filtered.length > 0 && (
            <div className="border-t border-[#E5E7EB] px-5 py-3 bg-[#F9FAFB]">
              <p className="text-xs text-[#9CA3AF]">
                {filtered.length} user{filtered.length !== 1 ? "s" : ""} displayed
                {roleFilter !== "all" ? ` · filtered by ${roleFilter}` : ""}
                {q ? ` · matching "${q}"` : ""}
              </p>
            </div>
          )}
        </div>
      </div>

      <ScopeModal
        open={scopeModalOpen}
        user={scopeUser}
        departments={departments}
        onClose={() => {
          setScopeModalOpen(false);
          setScopeUser(null);
        }}
        onSave={(ids) => saveDeptScopes(scopeUser!.id, ids)}
      />
    </div>
  );
}