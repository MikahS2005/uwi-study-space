// src/components/admin/NewRoomModal.tsx
//
// Admin "Create Room" modal.
//
// Key rules enforced by design:
// - Admin can ONLY create rooms in allowed department scopes (dropdown sourced from API)
// - Super admin can create rooms in any department (same endpoint returns all departments)
// - Department selection is required (but can auto-select if only 1 option)
//
// Data collected here matches your schema:
// rooms: (name, department_id, building, floor, capacity, amenities)
//
// Notes:
// - Amenities are entered as comma-separated for speed.
// - This modal fetches allowed departments ONLY when opened (reduces unnecessary calls).
// - The create endpoint (/api/admin/rooms/create) must enforce the same restrictions.

"use client";

import { useEffect, useMemo, useState } from "react";

type Dept = { id: number; name: string };

export function NewRoomModal(props: {
  open: boolean;
  onClose: () => void;
  onCreated: () => void; // usually router.refresh() from parent
}) {
  const { open, onClose, onCreated } = props;

  const [busy, setBusy] = useState(false);
  const [loadingDepts, setLoadingDepts] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [departments, setDepartments] = useState<Dept[]>([]);
  const [departmentId, setDepartmentId] = useState<string>("");

  // Form fields
  const [name, setName] = useState("");
  const [building, setBuilding] = useState("");
  const [floor, setFloor] = useState("");
  const [capacity, setCapacity] = useState("6");
  const [amenitiesText, setAmenitiesText] = useState("");

  // Fetch allowed departments on open
  useEffect(() => {
    if (!open) return;

    setBusy(false);
    setErrorMsg(null);

    // reset form each time modal opens (simple predictable UX)
    setName("");
    setBuilding("");
    setFloor("");
    setCapacity("6");
    setAmenitiesText("");

    setLoadingDepts(true);
    fetch("/api/admin/departments/allowed")
      .then((r) => r.json())
      .then((data) => {
        const list = Array.isArray(data?.departments) ? (data.departments as Dept[]) : [];
        setDepartments(list);

        // Auto-select if only one department is allowed
        if (list.length === 1) {
          setDepartmentId(String(list[0].id));
        } else {
          setDepartmentId("");
        }
      })
      .catch(() => {
        setDepartments([]);
        setDepartmentId("");
        setErrorMsg("Failed to load allowed departments.");
      })
      .finally(() => setLoadingDepts(false));
  }, [open]);

  const parsed = useMemo(() => {
    const n = name.trim();
    const b = building.trim();
    const f = floor.trim() ? floor.trim() : null;
    const cap = Number(capacity);

    const deptIdNum = Number(departmentId);

    if (!n) return { ok: false as const, message: "Room name is required." };
    if (!b) return { ok: false as const, message: "Building is required." };
    if (!Number.isFinite(cap) || cap <= 0) {
      return { ok: false as const, message: "Capacity must be a positive number." };
    }
    if (!Number.isFinite(deptIdNum) || deptIdNum <= 0) {
      return { ok: false as const, message: "Please select a department." };
    }

    // Amenities: comma-separated -> trimmed -> remove empties -> de-dupe
    const parsedAmenities = amenitiesText
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    const uniqueAmenities = Array.from(new Set(parsedAmenities));

    return {
      ok: true as const,
      departmentId: deptIdNum,
      name: n,
      building: b,
      floor: f,
      capacity: cap,
      amenities: uniqueAmenities,
    };
  }, [name, building, floor, capacity, amenitiesText, departmentId]);

  async function onCreate() {
    if (!parsed.ok) {
      setErrorMsg(parsed.message);
      return;
    }

    try {
      setBusy(true);
      setErrorMsg(null);

      const res = await fetch("/api/admin/rooms/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          departmentId: parsed.departmentId,
          name: parsed.name,
          building: parsed.building,
          floor: parsed.floor,
          capacity: parsed.capacity,
          amenities: parsed.amenities,
        }),
      });

      const payload = await res.json().catch(() => ({}));

      if (!res.ok) {
        console.error("Room create failed:", { status: res.status, payload });
        throw new Error(payload?.error ?? `Create failed (${res.status})`);
      }

      onCreated();
      onClose();
    } catch (e: any) {
      setErrorMsg(e?.message ?? "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  if (!open) return null;

  const disableClose = busy;

  return (
    <div className="fixed inset-0 z-50">
      {/* Backdrop */}
      <button
        type="button"
        aria-label="Close"
        className="absolute inset-0 bg-black/30"
        onClick={() => !disableClose && onClose()}
      />

      {/* Panel */}
      <div className="absolute left-1/2 top-1/2 w-[92vw] max-w-xl -translate-x-1/2 -translate-y-1/2 rounded-2xl bg-white p-6 shadow-xl ring-1 ring-slate-200">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-base font-semibold text-slate-900">Create New Room</h2>
            <p className="mt-1 text-sm text-slate-600">
              Department admins can only create rooms inside their allowed department scope.
            </p>
          </div>

          <button
            type="button"
            className="rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-60"
            disabled={disableClose}
            onClick={onClose}
          >
            Close
          </button>
        </div>

        {errorMsg && (
          <div className="mt-4 rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-800 ring-1 ring-rose-100">
            {errorMsg}
          </div>
        )}

        <div className="mt-5 grid grid-cols-1 gap-4">
          {/* Department */}
          <label className="grid gap-1">
            <span className="text-sm font-medium text-slate-700">Department</span>
            <select
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:ring-2 focus:ring-slate-200 disabled:opacity-60"
              disabled={busy || loadingDepts || departments.length <= 1}
              value={departmentId}
              onChange={(e) => setDepartmentId(e.target.value)}
            >
              {departments.length !== 1 && (
                <option value="">
                  {loadingDepts ? "Loading departments..." : "Select a department"}
                </option>
              )}

              {departments.map((d) => (
                <option key={d.id} value={String(d.id)}>
                  {d.name}
                </option>
              ))}
            </select>

            {departments.length === 0 && !loadingDepts && (
              <span className="text-xs text-amber-700">
                No allowed departments found for this admin. Ask a super admin to assign scopes.
              </span>
            )}
          </label>

          <label className="grid gap-1">
            <span className="text-sm font-medium text-slate-700">Room name</span>
            <input
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900 outline-none focus:ring-2 focus:ring-slate-200"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={busy}
              placeholder="e.g., AJL-101"
            />
          </label>

          <label className="grid gap-1">
            <span className="text-sm font-medium text-slate-700">Building</span>
            <input
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900 outline-none focus:ring-2 focus:ring-slate-200"
              value={building}
              onChange={(e) => setBuilding(e.target.value)}
              disabled={busy}
              placeholder="e.g., Alma Jordan Library"
            />
          </label>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <label className="grid gap-1">
              <span className="text-sm font-medium text-slate-700">Floor</span>
              <input
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900 outline-none focus:ring-2 focus:ring-slate-200"
                value={floor}
                onChange={(e) => setFloor(e.target.value)}
                disabled={busy}
                placeholder="e.g., 1"
              />
            </label>

            <label className="grid gap-1">
              <span className="text-sm font-medium text-slate-700">Capacity</span>
              <input
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900 outline-none focus:ring-2 focus:ring-slate-200"
                value={capacity}
                onChange={(e) => setCapacity(e.target.value)}
                disabled={busy}
                inputMode="numeric"
                placeholder="e.g., 8"
              />
            </label>
          </div>

          <label className="grid gap-1">
            <span className="text-sm font-medium text-slate-700">Amenities (comma-separated)</span>
            <input
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900 outline-none focus:ring-2 focus:ring-slate-200"
              value={amenitiesText}
              onChange={(e) => setAmenitiesText(e.target.value)}
              disabled={busy}
              placeholder="e.g., Whiteboard, Projector, AC"
            />
          </label>
        </div>

        <div className="mt-6 flex items-center justify-end gap-2">
          <button
            type="button"
            className="rounded-xl border border-slate-200 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-60"
            disabled={busy}
            onClick={onClose}
          >
            Cancel
          </button>

          <button
            type="button"
            className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60"
            disabled={busy || loadingDepts || departments.length === 0 || !parsed.ok}
            onClick={onCreate}
          >
            {busy ? "Creating..." : "Create Room"}
          </button>
        </div>
      </div>
    </div>
  );
}
