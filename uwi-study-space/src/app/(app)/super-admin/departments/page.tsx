"use client";

import { useEffect, useMemo, useState } from "react";

type DeptRow = { id: number; name: string; roomCount: number };

export default function SuperAdminDepartmentsPage() {
  const [departments, setDepartments] = useState<DeptRow[]>([]);
  const [q, setQ] = useState("");

  // Create
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);

  // Rename modal
  const [renameOpen, setRenameOpen] = useState(false);
  const [renameId, setRenameId] = useState<number | null>(null);
  const [renameName, setRenameName] = useState("");
  const [renaming, setRenaming] = useState(false);

  // Delete busy (per-row)
  const [deletingId, setDeletingId] = useState<number | null>(null);

  async function refresh() {
    const r = await fetch("/api/super-admin/departments/list");
    const j = await r.json().catch(() => ({}));
    setDepartments(j.departments ?? []);
  }

  useEffect(() => {
    refresh().catch(() => {});
  }, []);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return departments;

    return departments.filter((d) => d.name.toLowerCase().includes(needle) || String(d.id).includes(needle));
  }, [departments, q]);

  async function createDepartment() {
    const name = newName.trim();
    if (!name) return;

    try {
      setCreating(true);
      const r = await fetch("/api/super-admin/departments/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });

      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        alert(j.error ?? "Failed to create department");
        return;
      }

      setNewName("");
      await refresh();
    } finally {
      setCreating(false);
    }
  }

  async function renameDepartment() {
    if (renameId == null) return;
    const name = renameName.trim();
    if (!name) return;

    try {
      setRenaming(true);
      const r = await fetch("/api/super-admin/departments/rename", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: renameId, name }),
      });

      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        alert(j.error ?? "Failed to rename department");
        return;
      }

      setRenameOpen(false);
      setRenameId(null);
      setRenameName("");
      await refresh();
    } finally {
      setRenaming(false);
    }
  }

  async function deleteDepartment(id: number) {
    try {
      setDeletingId(id);

      const r = await fetch("/api/super-admin/departments/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });

      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        alert(j.error ?? "Failed to delete department");
        return;
      }

      await refresh();
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="rounded-2xl bg-white p-6 ring-1 ring-slate-200">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-lg font-semibold text-slate-900">Departments</h1>
          <p className="mt-1 text-sm text-slate-600">
            Create, rename, and delete departments. Deletion is blocked if rooms exist.
          </p>
        </div>

        <div className="rounded-full bg-slate-50 px-3 py-1 text-xs text-slate-700 ring-1 ring-slate-200">
          {departments.length} departments
        </div>
      </div>

      {/* Create + Search */}
      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 p-4">
          <div className="text-sm font-semibold text-slate-900">New Department</div>
          <div className="mt-2 flex gap-2">
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="e.g., Engineering"
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none"
            />
            <button
              onClick={createDepartment}
              disabled={creating || !newName.trim()}
              className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
            >
              {creating ? "Creating..." : "Create"}
            </button>
          </div>
          <div className="mt-2 text-xs text-slate-500">
            Tip: keep names short and consistent (these appear in admin scope UI).
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 p-4">
          <div className="text-sm font-semibold text-slate-900">Search</div>
          <div className="mt-2">
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search departments..."
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none"
            />
          </div>
        </div>
      </div>

      {/* List */}
      <div className="mt-4 overflow-hidden rounded-2xl border border-slate-200">
        <div className="grid grid-cols-12 bg-slate-50 px-4 py-3 text-xs font-semibold text-slate-600">
          <div className="col-span-6">Department</div>
          <div className="col-span-2">Rooms</div>
          <div className="col-span-4 text-right">Actions</div>
        </div>

        <div className="divide-y divide-slate-200">
          {filtered.map((d) => {
            const canDelete = d.roomCount === 0;
            const rowDeleting = deletingId === d.id;

            return (
              <div key={d.id} className="grid grid-cols-12 items-center gap-2 px-4 py-3">
                <div className="col-span-6">
                  <div className="text-sm font-semibold text-slate-900">{d.name}</div>
                  <div className="text-xs text-slate-500">ID: {d.id}</div>
                </div>

                <div className="col-span-2">
                  <span className="inline-flex items-center rounded-full bg-slate-50 px-3 py-1 text-xs text-slate-700 ring-1 ring-slate-200">
                    {d.roomCount}
                  </span>
                </div>

                <div className="col-span-4 flex justify-end gap-2">
                  <button
                    onClick={() => {
                      setRenameOpen(true);
                      setRenameId(d.id);
                      setRenameName(d.name);
                    }}
                    className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    Rename
                  </button>

                  <button
                    onClick={() => deleteDepartment(d.id)}
                    disabled={!canDelete || rowDeleting}
                    title={
                      canDelete
                        ? "Delete department"
                        : "Cannot delete while rooms exist. Move/delete rooms first."
                    }
                    className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700 hover:bg-red-100 disabled:opacity-60"
                  >
                    {rowDeleting ? "Deleting..." : "Delete"}
                  </button>
                </div>
              </div>
            );
          })}

          {filtered.length === 0 && (
            <div className="px-4 py-10 text-center text-sm text-slate-600">No departments found.</div>
          )}
        </div>
      </div>

      {/* Rename Modal */}
      {renameOpen && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-5 ring-1 ring-slate-200">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-lg font-semibold text-slate-900">Rename Department</div>
                <div className="mt-1 text-sm text-slate-600">Update the department name.</div>
              </div>

              <button
                onClick={() => !renaming && setRenameOpen(false)}
                disabled={renaming}
                className="rounded-lg px-2 py-1 text-slate-500 hover:bg-slate-100 disabled:opacity-60"
                aria-label="Close"
              >
                ✕
              </button>
            </div>

            <div className="mt-4">
              <input
                value={renameName}
                onChange={(e) => setRenameName(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none"
              />
            </div>

            <div className="mt-5 flex items-center justify-end gap-2">
              <button
                onClick={() => setRenameOpen(false)}
                disabled={renaming}
                className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-60"
              >
                Cancel
              </button>

              <button
                onClick={renameDepartment}
                disabled={renaming || !renameName.trim()}
                className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
              >
                {renaming ? "Saving..." : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}