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
const MAX_IMAGES = 1;
const MAX_BYTES = 5 * 1024 * 1024;
const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

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
  const [imageUrls, setImageUrls] = useState<string[]>([]);
  const [pendingFiles, setPendingFiles] = useState<FileList | null>(null);
  const [uploadBusy, setUploadBusy] = useState(false);
  const [uploadMsg, setUploadMsg] = useState<string | null>(null);

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
    setImageUrls([]);
    setPendingFiles(null);
    setUploadBusy(false);
    setUploadMsg(null);

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

  async function uploadSelectedImages() {
    if (!pendingFiles || pendingFiles.length === 0) {
      setUploadMsg("Choose image files to upload.");
      return;
    }

    const files = Array.from(pendingFiles);

    if (imageUrls.length + files.length > MAX_IMAGES) {
      setUploadMsg(`You can only have ${MAX_IMAGES} image per room.`);
      return;
    }

    for (const f of files) {
      if (!ALLOWED_TYPES.has(f.type)) {
        setUploadMsg("Only jpg, png, or webp files are allowed.");
        return;
      }
      if (f.size > MAX_BYTES) {
        setUploadMsg("Each image must be 5MB or less.");
        return;
      }
    }

    try {
      setUploadBusy(true);
      setUploadMsg(null);

      const uploaded: string[] = [];

      for (const f of files) {
        const form = new FormData();
        form.append("file", f);

        const res = await fetch("/api/admin/rooms/upload-image", {
          method: "POST",
          body: form,
        });

        const payload = await res.json().catch(() => ({}));

        if (!res.ok) {
          throw new Error(payload?.error ?? "Upload failed");
        }

        if (typeof payload?.url !== "string" || payload.url.length === 0) {
          throw new Error("Upload failed to return a URL");
        }

        uploaded.push(payload.url);
      }

      setImageUrls((prev) => [...prev, ...uploaded].slice(0, MAX_IMAGES));
      setPendingFiles(null);
      setUploadMsg("Image uploaded.");
    } catch (e: any) {
      setUploadMsg(e?.message ?? "Upload failed.");
    } finally {
      setUploadBusy(false);
    }
  }

  async function deleteImage(url: string) {
    try {
      setUploadBusy(true);
      setUploadMsg(null);

      const res = await fetch("/api/admin/rooms/delete-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });

      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(payload?.error ?? "Delete failed");
      }

      setImageUrls((prev) => prev.filter((x) => x !== url));
      setUploadMsg("Image removed.");
    } catch (e: any) {
      setUploadMsg(e?.message ?? "Delete failed.");
    } finally {
      setUploadBusy(false);
    }
  }

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
          imageUrls: imageUrls.length ? imageUrls : [],
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

  async function closeWithCleanup() {
    if (imageUrls.length === 0) {
      onClose();
      return;
    }

    try {
      setUploadBusy(true);
      setUploadMsg(null);

      await Promise.allSettled(
        imageUrls.map(async (url) => {
          await fetch("/api/admin/rooms/delete-image", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ url }),
          });
        }),
      );
    } finally {
      setUploadBusy(false);
      setImageUrls([]);
      setPendingFiles(null);
      setUploadMsg(null);
      onClose();
    }
  }

  if (!open) return null;

  const disableClose = busy || uploadBusy;

  return (
    <div className="fixed inset-0 z-50">
      {/* Backdrop */}
      <button
        type="button"
        aria-label="Close"
        className="absolute inset-0 bg-black/30"
        onClick={() => !disableClose && closeWithCleanup()}
      />

      {/* Panel */}
      <div className="absolute top-1/2 left-1/2 w-[92vw] max-w-xl -translate-x-1/2 -translate-y-1/2 rounded-2xl bg-white p-6 shadow-xl ring-1 ring-slate-200">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-base font-semibold text-slate-900">Create New Room</h2>
            <p className="mt-1 text-sm text-slate-600">
              Department admins can only create rooms inside their allowed department
              scope.
            </p>
          </div>

          <button
            type="button"
            className="rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-60"
            disabled={disableClose}
            onClick={closeWithCleanup}
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
                No allowed departments found for this admin. Ask a super admin to assign
                scopes.
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
            <span className="text-sm font-medium text-slate-700">
              Amenities (comma-separated)
            </span>
            <input
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900 outline-none focus:ring-2 focus:ring-slate-200"
              value={amenitiesText}
              onChange={(e) => setAmenitiesText(e.target.value)}
              disabled={busy}
              placeholder="e.g., Whiteboard, Projector, AC"
            />
          </label>

          <div className="rounded-2xl border border-slate-200 p-3">
            <div className="text-sm font-medium text-slate-800">Room image (max 1)</div>
            <p className="mt-1 text-xs text-slate-600">
              JPG, PNG, or WebP up to 5MB each.
            </p>

            <div className="mt-3 flex flex-wrap items-center gap-2">
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                disabled={uploadBusy || imageUrls.length >= MAX_IMAGES}
                onChange={(e) => setPendingFiles(e.target.files)}
                className="text-sm"
              />

              <button
                type="button"
                className="rounded-xl bg-slate-900 px-3 py-2 text-xs font-medium text-white hover:bg-slate-800 disabled:opacity-60"
                disabled={uploadBusy || !pendingFiles || pendingFiles.length === 0}
                onClick={uploadSelectedImages}
              >
                {uploadBusy ? "Uploading..." : "Upload"}
              </button>
            </div>

            {uploadMsg && (
              <div className="mt-2 text-xs text-slate-600" aria-live="polite">
                {uploadMsg}
              </div>
            )}

            <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
              {imageUrls.length === 0 ? (
                <div className="text-xs text-slate-500">No images uploaded yet.</div>
              ) : (
                imageUrls.map((url) => (
                  <div
                    key={url}
                    className="overflow-hidden rounded-xl border border-slate-200"
                  >
                    <img src={url} alt="Room" className="h-28 w-full object-cover" />
                    <button
                      type="button"
                      className="w-full border-t border-slate-200 px-3 py-2 text-xs text-rose-700 hover:bg-rose-50"
                      disabled={uploadBusy}
                      onClick={() => deleteImage(url)}
                    >
                      Remove
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        <div className="mt-6 flex items-center justify-end gap-2">
          <button
            type="button"
            className="rounded-xl border border-slate-200 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-60"
            disabled={busy || uploadBusy}
            onClick={closeWithCleanup}
          >
            Cancel
          </button>

          <button
            type="button"
            className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60"
            disabled={
              busy || uploadBusy || loadingDepts || departments.length === 0 || !parsed.ok
            }
            onClick={onCreate}
          >
            {busy ? "Creating..." : "Create Room"}
          </button>
        </div>
      </div>
    </div>
  );
}
