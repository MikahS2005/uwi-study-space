"use client";

// src/app/(app)/super-admin/departments/page.tsx

import { useEffect, useMemo, useState, useRef } from "react";

/* ─────────────────────────────────────────────────────────────
   Types
───────────────────────────────────────────────────────────── */
type DeptRow = { id: number; name: string; roomCount: number };

/* ─────────────────────────────────────────────────────────────
   Small shared primitives
───────────────────────────────────────────────────────────── */

function Spinner({ size = 14, light = false }: { size?: number; light?: boolean }) {
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
        cx="12" cy="12" r="10"
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

// Thin horizontal rule used as section dividers
function Rule() {
  return <div className="border-t border-[#E5E7EB]" />;
}

/* ─────────────────────────────────────────────────────────────
   Stat pill used in the page header
───────────────────────────────────────────────────────────── */
function StatPill({
  label,
  value,
  accent = false,
}: {
  label: string;
  value: number;
  accent?: boolean;
}) {
  return (
    <div
      className={`flex flex-col items-center justify-center rounded-lg border px-5 py-2.5 min-w-[72px] ${
        accent
          ? "border-[#003595]/20 bg-[#EAF6FF]"
          : "border-[#E5E7EB] bg-white"
      }`}
    >
      <span
        className={`text-[10px] font-bold tracking-[0.15em] uppercase ${
          accent ? "text-[#003595]" : "text-[#9CA3AF]"
        }`}
      >
        {label}
      </span>
      <span
        className={`text-xl font-bold leading-tight mt-0.5 ${
          accent ? "text-[#003595]" : "text-[#1F2937]"
        }`}
        style={{ fontFamily: "Georgia, serif" }}
      >
        {value}
      </span>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
   Rename modal
───────────────────────────────────────────────────────────── */
function RenameModal({
  dept,
  onClose,
  onSave,
}: {
  dept: DeptRow | null;
  onClose: () => void;
  onSave: (id: number, name: string) => Promise<void>;
}) {
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (dept) {
      setName(dept.name);
      setError(null);
      setTimeout(() => inputRef.current?.focus(), 60);
    }
  }, [dept]);

  if (!dept) return null;

  async function handleSave() {
    if (!name.trim() || !dept) return;
    setError(null);
    setSaving(true);
    try {
      await onSave(dept.id, name.trim());
    } catch (e: any) {
      setError(e?.message ?? "An error occurred.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/30 backdrop-blur-[2px] p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="w-full max-w-md bg-white rounded-xl shadow-2xl border border-[#E5E7EB] overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#E5E7EB]">
          <div>
            <p className="text-[10px] font-semibold tracking-[0.18em] uppercase text-[#003595]">
              Edit Department
            </p>
            <h2
              style={{ fontFamily: "Georgia, serif" }}
              className="text-lg font-bold text-[#1F2937] mt-0.5"
            >
              Rename
            </h2>
          </div>
          <button
            onClick={onClose}
            disabled={saving}
            aria-label="Close"
            className="rounded-md p-1.5 text-[#9CA3AF] hover:bg-[#F3F4F6] hover:text-[#374151] transition-colors disabled:opacity-40"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <path d="M18 6 6 18M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="px-5 py-5 space-y-1.5">
          <label
            htmlFor="rename-input"
            className="block text-xs font-semibold text-[#374151] tracking-wide"
          >
            Department Name
          </label>
          <input
            id="rename-input"
            ref={inputRef}
            value={name}
            onChange={(e) => { setName(e.target.value); setError(null); }}
            onKeyDown={(e) => { if (e.key === "Enter" && !saving) handleSave(); }}
            placeholder="e.g., Faculty of Engineering"
            className="w-full rounded-lg border border-[#E5E7EB] bg-[#F9FAFB] px-3.5 py-2.5 text-sm text-[#1F2937] outline-none transition placeholder:text-[#9CA3AF] focus:border-[#003595] focus:ring-2 focus:ring-[#003595]/10"
          />
          {error && (
            <p className="text-xs text-red-600 pt-0.5 flex items-center gap-1.5">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2"/>
                <path d="M12 8v4M12 16h.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
              </svg>
              {error}
            </p>
          )}
        </div>

        {/* Footer */}
        <div className="flex gap-2.5 px-5 pb-5">
          <button
            onClick={onClose}
            disabled={saving}
            className="flex-1 rounded-lg border border-[#E5E7EB] bg-white py-2.5 text-sm font-semibold text-[#374151] hover:bg-[#F3F4F6] transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !name.trim() || name.trim() === dept.name}
            className="flex-1 inline-flex items-center justify-center gap-2 rounded-lg bg-[#003595] py-2.5 text-sm font-bold text-white hover:bg-[#002366] transition-colors disabled:opacity-50"
          >
            {saving ? <><Spinner light size={14} /> Saving…</> : "Save Changes"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
   Delete confirmation modal
───────────────────────────────────────────────────────────── */
function DeleteModal({
  dept,
  onClose,
  onConfirm,
  deleting,
}: {
  dept: DeptRow | null;
  onClose: () => void;
  onConfirm: () => void;
  deleting: boolean;
}) {
  if (!dept) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/30 backdrop-blur-[2px] p-4"
      onClick={(e) => { if (e.target === e.currentTarget && !deleting) onClose(); }}
    >
      <div className="w-full max-w-md bg-white rounded-xl shadow-2xl border border-[#E5E7EB] overflow-hidden">

        {/* Header */}
        <div className="px-5 pt-5 pb-4 border-b border-[#E5E7EB]">
          <p className="text-[10px] font-semibold tracking-[0.18em] uppercase text-red-500 mb-0.5">
            Irreversible Action
          </p>
          <h2
            style={{ fontFamily: "Georgia, serif" }}
            className="text-lg font-bold text-[#1F2937]"
          >
            Delete Department
          </h2>
        </div>

        {/* Body */}
        <div className="px-5 py-5">
          <p className="text-sm text-[#374151] leading-relaxed">
            You are about to permanently delete{" "}
            <span className="font-semibold text-[#1F2937]">"{dept.name}"</span>.
            This action cannot be undone and will remove all associated configuration.
          </p>
        </div>

        {/* Footer */}
        <div className="flex gap-2.5 px-5 pb-5">
          <button
            onClick={onClose}
            disabled={deleting}
            className="flex-1 rounded-lg border border-[#E5E7EB] bg-white py-2.5 text-sm font-semibold text-[#374151] hover:bg-[#F3F4F6] transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={deleting}
            className="flex-1 inline-flex items-center justify-center gap-2 rounded-lg bg-red-600 py-2.5 text-sm font-bold text-white hover:bg-red-700 transition-colors disabled:opacity-50"
          >
            {deleting ? <><Spinner light size={14} /> Deleting…</> : "Delete Department"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
   Skeleton row
───────────────────────────────────────────────────────────── */
function SkeletonRow() {
  return (
    <tr className="animate-pulse">
      <td className="py-3.5 pl-5 pr-4">
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded bg-[#F3F4F6]" />
          <div className="space-y-1.5">
            <div className="h-3.5 w-36 rounded bg-[#F3F4F6]" />
            <div className="h-2.5 w-16 rounded bg-[#F3F4F6]" />
          </div>
        </div>
      </td>
      <td className="py-3.5 px-4 hidden sm:table-cell">
        <div className="h-5 w-20 rounded-full bg-[#F3F4F6]" />
      </td>
      <td className="py-3.5 pl-4 pr-5">
        <div className="flex justify-end gap-2">
          <div className="h-8 w-20 rounded-lg bg-[#F3F4F6]" />
          <div className="h-8 w-20 rounded-lg bg-[#F3F4F6]" />
        </div>
      </td>
    </tr>
  );
}

/* ─────────────────────────────────────────────────────────────
   Main page
───────────────────────────────────────────────────────────── */
export default function SuperAdminDepartmentsPage() {
  const [departments, setDepartments] = useState<DeptRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");

  // Create
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  // Rename
  const [renameTarget, setRenameTarget] = useState<DeptRow | null>(null);

  // Delete
  const [deleteTarget, setDeleteTarget] = useState<DeptRow | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  /* ── data ── */
  async function refresh() {
    const r = await fetch("/api/super-admin/departments/list");
    const j = await r.json().catch(() => ({}));
    setDepartments(j.departments ?? []);
  }

  useEffect(() => {
    setLoading(true);
    refresh()
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return departments;
    return departments.filter(
      (d) =>
        d.name.toLowerCase().includes(needle) || String(d.id).includes(needle),
    );
  }, [departments, q]);

  const totalRooms = useMemo(
    () => departments.reduce((s, d) => s + d.roomCount, 0),
    [departments],
  );

  /* ── actions ── */
  async function createDepartment() {
    const name = newName.trim();
    if (!name) return;
    setCreateError(null);
    setCreating(true);
    try {
      const r = await fetch("/api/super-admin/departments/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        setCreateError(j.error ?? "Failed to create department.");
        return;
      }
      setNewName("");
      await refresh();
    } finally {
      setCreating(false);
    }
  }

  async function handleRename(id: number, name: string) {
    const r = await fetch("/api/super-admin/departments/rename", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, name }),
    });
    if (!r.ok) {
      const j = await r.json().catch(() => ({}));
      throw new Error(j.error ?? "Failed to rename.");
    }
    setRenameTarget(null);
    await refresh();
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    const id = deleteTarget.id;
    setDeletingId(id);
    setDeleteTarget(null);
    try {
      const r = await fetch("/api/super-admin/departments/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        alert(j.error ?? "Failed to delete department.");
      }
      await refresh();
    } finally {
      setDeletingId(null);
    }
  }

  /* ── render ── */
  return (
    <div className="min-h-screen bg-[#F9FAFB]">

      {/* ════════════════════════════════════════════════════════
          Page banner
      ════════════════════════════════════════════════════════ */}
      <div className="bg-white border-b-2 border-[#003595]">
        <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">

          {/* Accent rule */}
          <div className="h-1 w-16 bg-[#003595] -mb-px" />

          <div className="py-6 flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
            {/* Title block */}
            <div>
              <p className="text-[10px] font-semibold tracking-[0.2em] uppercase text-[#003595] mb-1.5">
                Super Admin — Organisation
              </p>
              <h1
                style={{ fontFamily: "Georgia, serif" }}
                className="text-3xl sm:text-4xl font-bold text-[#1F2937] leading-tight"
              >
                Departments
              </h1>
              <p className="mt-1.5 text-sm text-[#6B7280] max-w-lg">
                Create, rename, and remove academic departments. Deletion requires
                all rooms to be reassigned or removed first.
              </p>
            </div>

            {/* Stats + breadcrumb */}
            <div className="flex flex-col items-start sm:items-end gap-3">
              <nav
                aria-label="Breadcrumb"
                className="flex items-center gap-1.5 text-xs text-[#9CA3AF]"
              >
                <span>Super Admin</span>
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none">
                  <path d="m9 18 6-6-6-6" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                <span className="font-semibold text-[#003595]">Departments</span>
              </nav>

              <div className="flex gap-2">
                <StatPill label="Departments" value={departments.length} />
                <StatPill label="Total Rooms" value={totalRooms} accent />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ════════════════════════════════════════════════════════
          Body
      ════════════════════════════════════════════════════════ */}
      <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 py-8 space-y-6">

        {/* ── Create + Search row ── */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">

          {/* Create card */}
          <div className="bg-white rounded-xl border border-[#E5E7EB] shadow-sm overflow-hidden">
            <div className="px-5 py-3.5 border-b border-[#E5E7EB] bg-[#F9FAFB]">
              <h2 className="text-xs font-bold tracking-[0.12em] uppercase text-[#374151]">
                Add New Department
              </h2>
            </div>
            <div className="px-5 py-4 space-y-3">
              <div>
                <label
                  htmlFor="new-dept-name"
                  className="block text-xs font-semibold text-[#374151] mb-1.5"
                >
                  Department Name
                </label>
                <input
                  id="new-dept-name"
                  value={newName}
                  onChange={(e) => { setNewName(e.target.value); setCreateError(null); }}
                  onKeyDown={(e) => e.key === "Enter" && !creating && createDepartment()}
                  placeholder="e.g., Faculty of Engineering"
                  className="w-full rounded-lg border border-[#E5E7EB] bg-[#F9FAFB] px-3.5 py-2.5 text-sm text-[#1F2937] outline-none placeholder:text-[#9CA3AF] transition focus:border-[#003595] focus:ring-2 focus:ring-[#003595]/10"
                />
                {createError && (
                  <p className="mt-1.5 text-xs text-red-600 flex items-center gap-1">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2"/>
                      <path d="M12 8v4M12 16h.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                    </svg>
                    {createError}
                  </p>
                )}
              </div>
              <button
                onClick={createDepartment}
                disabled={creating || !newName.trim()}
                className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-[#003595] px-4 py-2.5 text-sm font-bold text-white hover:bg-[#002366] transition-colors disabled:opacity-50"
              >
                {creating ? (
                  <><Spinner light size={14} /> Creating…</>
                ) : (
                  <>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                      <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/>
                    </svg>
                    Create Department
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Search card */}
          <div className="bg-white rounded-xl border border-[#E5E7EB] shadow-sm overflow-hidden">
            <div className="px-5 py-3.5 border-b border-[#E5E7EB] bg-[#F9FAFB]">
              <h2 className="text-xs font-bold tracking-[0.12em] uppercase text-[#374151]">
                Search Departments
              </h2>
            </div>
            <div className="px-5 py-4 space-y-3">
              <div>
                <label
                  htmlFor="search-dept"
                  className="block text-xs font-semibold text-[#374151] mb-1.5"
                >
                  Keyword or ID
                </label>
                <div className="relative">
                  <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-[#9CA3AF]">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                      <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2"/>
                      <path d="m16.5 16.5 4 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                    </svg>
                  </span>
                  <input
                    id="search-dept"
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                    placeholder="Search by name or ID…"
                    className="w-full rounded-lg border border-[#E5E7EB] bg-[#F9FAFB] py-2.5 pl-9 pr-9 text-sm text-[#1F2937] outline-none placeholder:text-[#9CA3AF] transition focus:border-[#003595] focus:ring-2 focus:ring-[#003595]/10"
                  />
                  {q && (
                    <button
                      onClick={() => setQ("")}
                      aria-label="Clear search"
                      className="absolute inset-y-0 right-3 flex items-center text-[#9CA3AF] hover:text-[#374151] transition-colors"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                        <path d="M18 6 6 18M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                      </svg>
                    </button>
                  )}
                </div>
              </div>

              {/* Search result note */}
              <div className="rounded-lg bg-[#F9FAFB] border border-[#E5E7EB] px-3.5 py-2.5">
                {q ? (
                  <p className="text-xs text-[#374151]">
                    <span className="font-bold text-[#003595]">{filtered.length}</span>{" "}
                    result{filtered.length !== 1 ? "s" : ""} for{" "}
                    <span className="font-semibold">"{q}"</span>
                  </p>
                ) : (
                  <p className="text-xs text-[#9CA3AF]">
                    Showing all{" "}
                    <span className="font-semibold text-[#374151]">{departments.length}</span>{" "}
                    department{departments.length !== 1 ? "s" : ""}
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* ── Department table ── */}
        <div className="bg-white rounded-xl border border-[#E5E7EB] shadow-sm overflow-hidden">

          {/* Table header */}
          <div className="px-5 py-3.5 border-b border-[#E5E7EB] bg-[#F9FAFB] flex items-center justify-between">
            <h2 className="text-xs font-bold tracking-[0.12em] uppercase text-[#374151]">
              All Departments
            </h2>
            {!loading && (
              <span className="text-xs text-[#9CA3AF]">
                {filtered.length} of {departments.length}
              </span>
            )}
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm" aria-label="Departments table">
              <thead>
                <tr className="border-b border-[#E5E7EB]">
                  <th
                    scope="col"
                    className="py-3 pl-5 pr-4 text-left text-[10px] font-bold tracking-[0.15em] uppercase text-[#9CA3AF]"
                  >
                    Department
                  </th>
                  <th
                    scope="col"
                    className="py-3 px-4 text-left text-[10px] font-bold tracking-[0.15em] uppercase text-[#9CA3AF] hidden sm:table-cell"
                  >
                    Rooms
                  </th>
                  <th
                    scope="col"
                    className="py-3 pl-4 pr-5 text-right text-[10px] font-bold tracking-[0.15em] uppercase text-[#9CA3AF]"
                  >
                    Actions
                  </th>
                </tr>
              </thead>

              <tbody className="divide-y divide-[#F3F4F6]">
                {loading ? (
                  <>
                    <SkeletonRow />
                    <SkeletonRow />
                    <SkeletonRow />
                    <SkeletonRow />
                    <SkeletonRow />
                  </>
                ) : filtered.length === 0 ? (
                  <tr>
                    <td colSpan={3}>
                      <div className="flex flex-col items-center justify-center py-16 text-center">
                        <div className="h-12 w-12 rounded-xl bg-[#F3F4F6] flex items-center justify-center mb-3 text-[#9CA3AF]">
                          <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                            <path d="M5 21V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
                            <path d="M3 21h18" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                          </svg>
                        </div>
                        <p className="text-sm font-semibold text-[#374151]">
                          {q ? "No results found" : "No departments yet"}
                        </p>
                        <p className="mt-1 text-xs text-[#9CA3AF]">
                          {q
                            ? "Try searching with a different keyword."
                            : "Use the form above to create the first department."}
                        </p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filtered.map((dept) => {
                    const initials = dept.name
                      .split(" ")
                      .slice(0, 2)
                      .map((w) => w[0]?.toUpperCase() ?? "")
                      .join("");
                    const canDelete = dept.roomCount === 0;
                    const isDeleting = deletingId === dept.id;

                    return (
                      <tr
                        key={dept.id}
                        className="group hover:bg-[#F9FAFB] transition-colors"
                      >
                        {/* Name cell */}
                        <td className="py-3.5 pl-5 pr-4">
                          <div className="flex items-center gap-3">
                            {/* Monogram */}
                            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#EAF6FF] text-[#003595] text-[11px] font-extrabold select-none ring-1 ring-[#003595]/10">
                              {initials || "?"}
                            </div>
                            <div>
                              <p className="font-semibold text-[#1F2937] group-hover:text-[#003595] transition-colors leading-tight">
                                {dept.name}
                              </p>
                              <p className="text-[11px] text-[#9CA3AF] mt-0.5">
                                ID #{dept.id}
                              </p>
                            </div>
                          </div>
                        </td>

                        {/* Room count — hidden on mobile */}
                        <td className="py-3.5 px-4 hidden sm:table-cell">
                          <span
                            className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold ring-1 ${
                              dept.roomCount > 0
                                ? "bg-[#EAF6FF] text-[#003595] ring-[#003595]/15"
                                : "bg-[#F3F4F6] text-[#9CA3AF] ring-[#E5E7EB]"
                            }`}
                          >
                            <svg width="10" height="10" viewBox="0 0 24 24" fill="none">
                              <path d="M3 9.5L12 3l9 6.5V20a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9.5Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round"/>
                              <path d="M9 21V12h6v9" stroke="currentColor" strokeWidth="2" strokeLinejoin="round"/>
                            </svg>
                            {dept.roomCount} {dept.roomCount === 1 ? "room" : "rooms"}
                          </span>
                        </td>

                        {/* Actions */}
                        <td className="py-3.5 pl-4 pr-5">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => setRenameTarget(dept)}
                              className="rounded-lg border border-[#E5E7EB] bg-white px-3 py-1.5 text-xs font-semibold text-[#374151] hover:border-[#003595] hover:bg-[#EAF6FF] hover:text-[#003595] transition-all"
                            >
                              Rename
                            </button>

                            <button
                              onClick={() => canDelete && setDeleteTarget(dept)}
                              disabled={!canDelete || isDeleting}
                              title={
                                !canDelete
                                  ? `Reassign or delete the ${dept.roomCount} room${dept.roomCount !== 1 ? "s" : ""} first`
                                  : "Delete this department"
                              }
                              className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-100 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                            >
                              {isDeleting ? (
                                <><Spinner size={12} /> Deleting</>
                              ) : (
                                "Delete"
                              )}
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Table footer */}
          {!loading && filtered.length > 0 && (
            <>
              <Rule />
              <div className="px-5 py-3 flex items-center justify-between">
                <p className="text-xs text-[#9CA3AF]">
                  {filtered.length} department{filtered.length !== 1 ? "s" : ""}
                  {q ? ` matching "${q}"` : " total"}
                </p>
                <p className="text-xs text-[#9CA3AF]">
                  {totalRooms} room{totalRooms !== 1 ? "s" : ""} assigned
                </p>
              </div>
            </>
          )}
        </div>

        {/* ── Tip note ── */}
        <div className="flex items-start gap-3 rounded-xl border border-[#E5E7EB] bg-white px-4 py-3.5">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" className="text-[#003595] mt-0.5 shrink-0">
            <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2"/>
            <path d="M12 8v4M12 16h.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
          </svg>
          <p className="text-xs text-[#6B7280] leading-relaxed">
            <span className="font-semibold text-[#374151]">Note: </span>
            A department cannot be deleted while it has rooms assigned to it.
            Reassign or delete all associated rooms before removing a department.
          </p>
        </div>
      </div>

      {/* ── Modals ── */}
      <RenameModal
        dept={renameTarget}
        onClose={() => setRenameTarget(null)}
        onSave={handleRename}
      />
      <DeleteModal
        dept={deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        deleting={deletingId !== null}
      />
    </div>
  );
}