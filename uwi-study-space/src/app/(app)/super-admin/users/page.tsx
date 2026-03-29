"use client";

import { useEffect, useMemo, useState } from "react";

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
  role: "student" | "staff" | "admin" | "super_admin";
  departmentId: number | null;
  departmentName: string | null;
  scopedDepartmentIds: number[];
};

type Dept = { id: number; name: string };

type MeResponse = {
  user: null | {
    id: string;
    email: string | null;
    role: "student" | "staff" | "admin" | "super_admin" | null;
    departmentId: number | null;
  };
};

const ROLE_PRIORITY: Record<UserRow["role"], number> = {
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

function RoleBadge({ role }: { role: UserRow["role"] }) {
  const cls =
    role === "super_admin"
      ? "bg-purple-50 text-purple-700 ring-purple-100"
      : role === "admin"
        ? "bg-blue-50 text-blue-700 ring-blue-100"
        : role === "staff"
          ? "bg-amber-50 text-amber-700 ring-amber-100"
          : "bg-slate-50 text-slate-700 ring-slate-200";

  return (
    <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-medium ring-1 ${cls}`}>
      {role === "super_admin" ? "Super Admin" : role === "admin" ? "Admin" : role === "staff" ? "Staff" : "Student"}
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
    <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-medium ring-1 ${cls}`}>
      {text}
    </span>
  );
}

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
    if (!user) return;
    setSelected(user.scopedDepartmentIds ?? []);
  }, [user]);

  if (!open || !user) return null;

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4">
      <div className="w-full max-w-lg rounded-2xl bg-white p-5 ring-1 ring-slate-200">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-lg font-semibold text-slate-900">Assign Departments</div>
            <div className="mt-1 text-sm text-slate-600">Select which departments this admin can manage.</div>
          </div>

          <button
            onClick={() => !saving && onClose()}
            className="rounded-lg px-2 py-1 text-slate-500 hover:bg-slate-100 disabled:opacity-60"
            aria-label="Close"
            disabled={saving}
          >
            ✕
          </button>
        </div>

        <div className="mt-4 rounded-xl border border-slate-200 p-3">
          <div className="text-sm font-medium text-slate-900">{user.fullName || "Unnamed User"}</div>
          <div className="text-xs text-slate-600">{user.email}</div>
        </div>

        <div className="mt-4 space-y-2">
          {departments.map((d) => {
            const checked = selected.includes(d.id);
            return (
              <label
                key={d.id}
                className="flex cursor-pointer items-center justify-between rounded-xl border border-slate-200 px-3 py-2 hover:bg-slate-50"
              >
                <div className="text-sm text-slate-900">{d.name}</div>
                <input
                  type="checkbox"
                  checked={checked}
                  disabled={saving}
                  onChange={(e) => {
                    const next = e.target.checked
                      ? Array.from(new Set([...selected, d.id]))
                      : selected.filter((x) => x !== d.id);
                    setSelected(next);
                  }}
                />
              </label>
            );
          })}
        </div>

        <div className="mt-5 flex items-center justify-end gap-2">
          <button
            onClick={onClose}
            className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-60"
            disabled={saving}
          >
            Cancel
          </button>

          <button
            onClick={async () => {
              try {
                setSaving(true);
                await onSave(selected);
                onClose();
              } finally {
                setSaving(false);
              }
            }}
            className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
            disabled={saving}
          >
            {saving ? "Saving..." : "Save Scopes"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function SuperAdminUsersPage() {
  const [busyUserId, setBusyUserId] = useState<string | null>(null);
  const [busyScopes, setBusyScopes] = useState(false);

  const [users, setUsers] = useState<UserRow[]>([]);
  const [departments, setDepartments] = useState<Dept[]>([]);
  const [q, setQ] = useState("");
  const [roleFilter, setRoleFilter] = useState<"all" | UserRow["role"]>("all");

  const [myId, setMyId] = useState<string | null>(null);

  const [scopeModalOpen, setScopeModalOpen] = useState(false);
  const [scopeUser, setScopeUser] = useState<UserRow | null>(null);

  async function refresh() {
    const meRes = await fetch("/api/me");
    const meJson = (await meRes.json().catch(() => null)) as MeResponse | null;
    setMyId(meJson?.user?.id ?? null);

    const r = await fetch("/api/super-admin/users/list");
    const j = await r.json().catch(() => ({}));
    setUsers(j.users ?? []);

    const d = await fetch("/api/departments");
    const dj = await d.json().catch(() => ({}));
    setDepartments(dj.departments ?? []);
  }

  useEffect(() => {
    refresh().catch(() => {});
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

        return (a.fullName || a.email || "").localeCompare(b.fullName || b.email || "");
      });
  }, [users, q, roleFilter]);

  async function updateRole(targetUserId: string, newRole: UserRow["role"]) {
    try {
      setBusyUserId(targetUserId);

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
    try {
      setBusyScopes(true);

      const r = await fetch("/api/super-admin/scopes/set-departments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ adminUserId, departmentIds: deptIds }),
      });

      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        alert(j.error ?? "Failed to update scopes");
        return;
      }

      await refresh();
    } finally {
      setBusyScopes(false);
    }
  }

  return (
    <div className="rounded-2xl bg-white p-6 ring-1 ring-slate-200">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-lg font-semibold text-slate-900">Users</h1>
          <p className="mt-1 text-sm text-slate-600">
            Manage roles, profile visibility, and department scopes.
          </p>
        </div>

        <div className="rounded-full bg-slate-50 px-3 py-1 text-xs text-slate-700 ring-1 ring-slate-200">
          {users.length} users
        </div>
      </div>

      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex w-full items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 sm:max-w-xl">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search by name, email, ID, phone, faculty..."
            className="w-full bg-transparent text-sm outline-none"
          />
        </div>

        <select
          className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm sm:w-44"
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value as "all" | UserRow["role"])}
        >
          <option value="all">All Roles</option>
          <option value="student">Student</option>
          <option value="staff">Staff</option>
          <option value="admin">Admin</option>
          <option value="super_admin">Super Admin</option>
        </select>
      </div>

      <div className="mt-4 overflow-hidden rounded-2xl border border-slate-200">
        <div className="grid grid-cols-12 bg-slate-50 px-4 py-3 text-xs font-semibold text-slate-600">
          <div className="col-span-3">User</div>
          <div className="col-span-2">Academic</div>
          <div className="col-span-2">Account</div>
          <div className="col-span-1">Role</div>
          <div className="col-span-2">Departments (Scope)</div>
          <div className="col-span-2 text-right">Actions</div>
        </div>

        <div className="divide-y divide-slate-200">
          {filtered.map((u) => {
            const isMe = myId != null && u.id === myId;

            return (
              <div key={u.id} className="grid grid-cols-12 items-start gap-2 px-4 py-3">
                <div className="col-span-3">
                  <div className="flex items-center gap-2">
                    <div className="text-sm font-semibold text-slate-900">{u.fullName || "—"}</div>
                    {isMe && (
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-700 ring-1 ring-slate-200">
                        You
                      </span>
                    )}
                  </div>

                  <div className="text-xs text-slate-600">{u.email}</div>
                  <div className="text-xs text-slate-500">ID: {u.uwiId || "—"}</div>
                  <div className="text-xs text-slate-500">Phone: {u.phone || "—"}</div>
                </div>

                <div className="col-span-2 text-xs text-slate-600">
                  <div>{u.faculty || "—"}</div>
                  <div>{u.academicStatus || "—"}</div>
                  <div>{u.departmentName || "—"}</div>
                </div>

                <div className="col-span-2 text-xs text-slate-600">
                  <div><StatusBadge value={u.accountStatus} /></div>
                  <div className="mt-2">Verified: {u.emailVerifiedAt ? fmtDate(u.emailVerifiedAt) : "No"}</div>
                  <div>Created: {fmtDate(u.createdAt)}</div>
                </div>

                <div className="col-span-1">
                  <RoleBadge role={u.role} />
                </div>

                <div className="col-span-2">
                  {u.role === "admin" ? (
                    <div className="flex flex-wrap gap-2">
                      {(u.scopedDepartmentIds ?? []).length === 0 ? (
                        <span className="text-xs text-slate-500">No scopes</span>
                      ) : (
                        u.scopedDepartmentIds.map((deptId) => {
                          const d = departments.find((x) => x.id === deptId);
                          return (
                            <span
                              key={deptId}
                              className="inline-flex items-center gap-2 rounded-full bg-slate-50 px-3 py-1 text-xs text-slate-700 ring-1 ring-slate-200"
                            >
                              {d?.name ?? `Dept ${deptId}`}
                            </span>
                          );
                        })
                      )}
                    </div>
                  ) : (
                    <span className="text-xs text-slate-500">—</span>
                  )}
                </div>

                <div className="col-span-2 flex flex-wrap justify-end gap-2">
                  {(u.role === "student" || u.role === "staff") && (
                    <button
                      onClick={() => updateRole(u.id, "admin")}
                      disabled={busyUserId === u.id || busyScopes || isMe}
                      className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                      title={isMe ? "Action disabled on your own account" : undefined}
                    >
                      {busyUserId === u.id ? "Working..." : "Make Admin"}
                    </button>
                  )}

                  {u.role === "admin" && (
                    <>
                      <button
                        onClick={() => {
                          setScopeUser(u);
                          setScopeModalOpen(true);
                        }}
                        disabled={busyUserId === u.id || busyScopes || isMe}
                        className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                        title={isMe ? "Action disabled on your own account" : undefined}
                      >
                        Assign Dept
                      </button>

                      <button
                        onClick={() => updateRole(u.id, "super_admin")}
                        disabled={busyUserId === u.id || busyScopes || isMe}
                        className="rounded-xl border border-purple-200 bg-purple-50 px-3 py-2 text-xs font-semibold text-purple-700 hover:bg-purple-100 disabled:opacity-60"
                        title={isMe ? "Action disabled on your own account" : undefined}
                      >
                        {busyUserId === u.id ? "Working..." : "Make Super"}
                      </button>

                      <button
                        onClick={() => updateRole(u.id, "staff")}
                        disabled={busyUserId === u.id || busyScopes || isMe}
                        className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-700 hover:bg-amber-100 disabled:opacity-60"
                        title={isMe ? "Action disabled on your own account" : undefined}
                      >
                        {busyUserId === u.id ? "Working..." : "Demote to Staff"}
                      </button>

                      <button
                        onClick={() => updateRole(u.id, "student")}
                        disabled={busyUserId === u.id || busyScopes || isMe}
                        className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700 hover:bg-red-100 disabled:opacity-60"
                        title={isMe ? "Action disabled on your own account" : undefined}
                      >
                        {busyUserId === u.id ? "Working..." : "Demote to Student"}
                      </button>
                    </>
                  )}

                  {u.role === "super_admin" && (
                    <span className="text-xs text-slate-500">—</span>
                  )}
                </div>
              </div>
            );
          })}

          {filtered.length === 0 && (
            <div className="px-4 py-10 text-center text-sm text-slate-600">No users found.</div>
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
        onSave={async (deptIds) => {
          if (!scopeUser) return;
          await saveDeptScopes(scopeUser.id, deptIds);
        }}
      />
    </div>
  );
}