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

import { useEffect, useMemo, useRef, useState } from "react";

type Dept = { id: number; name: string };

const MAX_IMAGES = 1;
const MAX_BYTES = 5 * 1024 * 1024;
const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

export function NewRoomModal(props: {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}) {
  const { open, onClose, onCreated } = props;
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [busy, setBusy] = useState(false);
  const [loadingDepts, setLoadingDepts] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [departments, setDepartments] = useState<Dept[]>([]);
  const [departmentId, setDepartmentId] = useState<string>("");

  const [name, setName] = useState("");
  const [building, setBuilding] = useState("");
  const [floor, setFloor] = useState("");
  const [capacity, setCapacity] = useState("6");
  const [amenitiesText, setAmenitiesText] = useState("");
  const [imageUrls, setImageUrls] = useState<string[]>([]);
  const [pendingFiles, setPendingFiles] = useState<FileList | null>(null);
  const [uploadBusy, setUploadBusy] = useState(false);
  const [uploadMsg, setUploadMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;

    setBusy(false);
    setErrorMsg(null);

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

  const amenityPreview = useMemo(() => {
    return Array.from(
      new Set(
        amenitiesText
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
      ),
    );
  }, [amenitiesText]);

  const selectedFileNames = useMemo(() => {
    if (!pendingFiles || pendingFiles.length === 0) return [];
    return Array.from(pendingFiles).map((file) => file.name);
  }, [pendingFiles]);

  async function uploadSelectedImages() {
    if (!pendingFiles || pendingFiles.length === 0) {
      setUploadMsg("Choose an image file to upload.");
      return;
    }

    const files = Array.from(pendingFiles);

    if (imageUrls.length + files.length > MAX_IMAGES) {
      setUploadMsg(`You can only have ${MAX_IMAGES} image per room.`);
      return;
    }

    for (const f of files) {
      if (!ALLOWED_TYPES.has(f.type)) {
        setUploadMsg("Only JPG, PNG, or WebP files are allowed.");
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
      if (fileInputRef.current) fileInputRef.current.value = "";
      setUploadMsg("Image uploaded successfully.");
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
      setErrorMsg(e?.message ?? "Something went wrong.");
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

      const results = await Promise.allSettled(
        imageUrls.map(async (url) => {
          const res = await fetch("/api/admin/rooms/delete-image", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ url }),
          });
          if (!res.ok) throw new Error("Delete failed");
        }),
      );

      if (results.some((r) => r.status === "rejected")) {
        setUploadMsg("Some uploaded images could not be cleaned up. Please try again.");
        return;
      }

      setImageUrls([]);
      setPendingFiles(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      onClose();
    } finally {
      setUploadBusy(false);
    }
  }

  if (!open) return null;

  const disableClose = busy || uploadBusy;

  const labelClass =
    "mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--color-text-light)]/55";

  const inputClass =
    "h-11 w-full rounded-xl border border-[var(--color-border-light)] bg-[var(--color-surface-light)] px-3 text-sm text-[var(--color-text-light)] outline-none transition-colors placeholder:text-[var(--color-text-light)]/35 focus:border-[var(--color-primary)] focus:bg-white";

  const sectionClass =
    "rounded-2xl border border-[var(--color-border-light)] bg-[var(--color-surface-light)]/55 p-4";

  return (
    <div className="fixed inset-0 z-50 p-4 sm:p-6">
      <button
        type="button"
        aria-label="Close"
        className="absolute inset-0 bg-[rgba(15,23,42,0.45)] backdrop-blur-[2px]"
        onClick={() => !disableClose && closeWithCleanup()}
      />

      <div className="relative mx-auto flex h-[min(92vh,900px)] w-full max-w-3xl flex-col overflow-hidden rounded-[28px] border border-[var(--color-border-light)] bg-[var(--color-background-light)] shadow-[0_30px_80px_rgba(0,0,0,0.18)]">
        <div className="flex shrink-0 items-start justify-between gap-4 border-b border-[var(--color-border-light)] px-5 py-4 sm:px-6 sm:py-5">
          <div>
            <div className="inline-flex items-center rounded-full bg-[var(--color-primary-soft)] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--color-primary)]">
              Admin rooms
            </div>
            <h2 className="mt-3 text-lg font-semibold text-[var(--color-text-light)] sm:text-xl">
              Create New Room
            </h2>
            <p className="mt-1 max-w-2xl text-sm text-[var(--color-text-light)]/66">
              Add a new study room with its department, location, capacity, amenities, and image.
            </p>
          </div>

          <button
            type="button"
            className="inline-flex h-10 shrink-0 items-center justify-center rounded-xl border border-[var(--color-border-light)] bg-white px-4 text-sm font-medium text-[var(--color-text-light)] transition-colors hover:bg-[var(--color-secondary)] disabled:opacity-60"
            disabled={disableClose}
            onClick={closeWithCleanup}
          >
            Close
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4 sm:px-6 sm:py-5">
          {errorMsg ? (
            <div className="mb-5 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {errorMsg}
            </div>
          ) : null}

          <div className="space-y-5">
            <section className={sectionClass}>
              <div className="mb-4">
                <h3 className="text-sm font-semibold text-[var(--color-text-light)]">
                  Room details
                </h3>
                <p className="mt-1 text-xs text-[var(--color-text-light)]/60">
                  Enter the essential room information used for browsing and booking.
                </p>
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <label className="md:col-span-2">
                  <span className={labelClass}>Department</span>
                  <select
                    className={inputClass}
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

                  {departments.length === 0 && !loadingDepts ? (
                    <span className="mt-2 block text-xs text-amber-700">
                      No allowed departments were found for this admin. Ask a super admin to assign
                      scopes.
                    </span>
                  ) : null}
                </label>

                <label>
                  <span className={labelClass}>Room name</span>
                  <input
                    className={inputClass}
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    disabled={busy}
                    placeholder="e.g. AJL-101"
                  />
                </label>

                <label>
                  <span className={labelClass}>Building</span>
                  <input
                    className={inputClass}
                    value={building}
                    onChange={(e) => setBuilding(e.target.value)}
                    disabled={busy}
                    placeholder="e.g. Alma Jordan Library"
                  />
                </label>

                <label>
                  <span className={labelClass}>Floor</span>
                  <input
                    className={inputClass}
                    value={floor}
                    onChange={(e) => setFloor(e.target.value)}
                    disabled={busy}
                    placeholder="e.g. 2"
                  />
                </label>

                <label>
                  <span className={labelClass}>Capacity</span>
                  <input
                    className={inputClass}
                    value={capacity}
                    onChange={(e) => setCapacity(e.target.value)}
                    disabled={busy}
                    inputMode="numeric"
                    placeholder="e.g. 8"
                  />
                </label>
              </div>
            </section>

            <section className={sectionClass}>
              <div className="mb-4">
                <h3 className="text-sm font-semibold text-[var(--color-text-light)]">
                  Amenities
                </h3>
                <p className="mt-1 text-xs text-[var(--color-text-light)]/60">
                  Enter amenities as comma-separated values. They will be cleaned and saved as
                  unique items.
                </p>
              </div>

              <label>
                <span className={labelClass}>Amenities list</span>
                <input
                  className={inputClass}
                  value={amenitiesText}
                  onChange={(e) => setAmenitiesText(e.target.value)}
                  disabled={busy}
                  placeholder="e.g. Whiteboard, Projector, AC"
                />
              </label>

              {amenityPreview.length > 0 ? (
                <div className="mt-4 flex flex-wrap gap-2">
                  {amenityPreview.map((item) => (
                    <span
                      key={item}
                      className="rounded-full border border-[var(--color-primary)]/15 bg-[var(--color-primary-soft)] px-3 py-1 text-xs font-medium text-[var(--color-primary)]"
                    >
                      {item}
                    </span>
                  ))}
                </div>
              ) : (
                <div className="mt-4 text-xs text-[var(--color-text-light)]/52">
                  No amenities added yet.
                </div>
              )}
            </section>

            <section className={sectionClass}>
              <div className="mb-4">
                <h3 className="text-sm font-semibold text-[var(--color-text-light)]">
                  Room image
                </h3>
                <p className="mt-1 text-xs text-[var(--color-text-light)]/60">
                  Upload one image in JPG, PNG, or WebP format, up to 5MB.
                </p>
              </div>

              <div className="rounded-2xl border border-dashed border-[var(--color-border-light)] bg-white p-4">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  disabled={uploadBusy || imageUrls.length >= MAX_IMAGES}
                  onChange={(e) => setPendingFiles(e.target.files)}
                  className="hidden"
                />

                <div className="flex flex-col gap-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <div className="text-sm font-medium text-[var(--color-text-light)]">
                        Choose a room image
                      </div>
                      <div className="mt-1 text-xs text-[var(--color-text-light)]/60">
                        Recommended: a clear landscape image that shows the study space well.
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        className="inline-flex h-11 items-center justify-center rounded-xl border border-[var(--color-border-light)] bg-white px-4 text-sm font-medium text-[var(--color-text-light)] transition-colors hover:bg-[var(--color-secondary)] disabled:opacity-60"
                        disabled={uploadBusy || imageUrls.length >= MAX_IMAGES}
                        onClick={() => fileInputRef.current?.click()}
                      >
                        Choose image
                      </button>

                      <button
                        type="button"
                        className="inline-flex h-11 items-center justify-center rounded-xl bg-[var(--color-primary)] px-4 text-sm font-semibold text-white transition-colors hover:bg-[var(--color-primary-dark)] disabled:cursor-not-allowed disabled:opacity-60"
                        disabled={uploadBusy || !pendingFiles || pendingFiles.length === 0}
                        onClick={uploadSelectedImages}
                      >
                        {uploadBusy ? "Uploading..." : "Upload image"}
                      </button>
                    </div>
                  </div>

                  <div className="rounded-xl bg-[var(--color-surface-light)] px-4 py-3">
                    {selectedFileNames.length > 0 ? (
                      <div className="space-y-1">
                        <div className="text-xs font-medium uppercase tracking-[0.14em] text-[var(--color-text-light)]/52">
                          Selected file
                        </div>
                        {selectedFileNames.map((fileName) => (
                          <div key={fileName} className="text-sm text-[var(--color-text-light)]">
                            {fileName}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-sm text-[var(--color-text-light)]/55">
                        No file selected yet.
                      </div>
                    )}
                  </div>

                  {uploadMsg ? (
                    <div
                      className="rounded-xl bg-[var(--color-primary-soft)] px-3 py-2 text-xs text-[var(--color-primary)]"
                      aria-live="polite"
                    >
                      {uploadMsg}
                    </div>
                  ) : null}

                  <div>
                    {imageUrls.length === 0 ? (
                      <div className="rounded-xl bg-[var(--color-surface-light)] px-4 py-6 text-center text-xs text-[var(--color-text-light)]/52">
                        No image uploaded yet.
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 gap-3 sm:max-w-sm">
                        {imageUrls.map((url) => (
                          <div
                            key={url}
                            className="overflow-hidden rounded-2xl border border-[var(--color-border-light)] bg-white"
                          >
                            <img src={url} alt="Room" className="h-40 w-full object-cover" />
                            <div className="border-t border-[var(--color-border-light)] p-3">
                              <button
                                type="button"
                                className="w-full rounded-xl border border-red-200 px-3 py-2 text-xs font-medium text-red-700 transition-colors hover:bg-red-50 disabled:opacity-60"
                                disabled={uploadBusy}
                                onClick={() => deleteImage(url)}
                              >
                                Remove image
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </section>
          </div>
        </div>

        <div className="flex shrink-0 items-center justify-end gap-3 border-t border-[var(--color-border-light)] px-5 py-4 sm:px-6">
          <button
            type="button"
            className="inline-flex h-11 items-center justify-center rounded-xl border border-[var(--color-border-light)] bg-white px-5 text-sm font-medium text-[var(--color-text-light)] transition-colors hover:bg-[var(--color-secondary)] disabled:opacity-60"
            disabled={busy || uploadBusy}
            onClick={closeWithCleanup}
          >
            Cancel
          </button>

          <button
            type="button"
            className="inline-flex h-11 items-center justify-center rounded-xl bg-[var(--color-primary)] px-5 text-sm font-semibold text-white transition-colors hover:bg-[var(--color-primary-dark)] disabled:cursor-not-allowed disabled:opacity-60"
            disabled={busy || uploadBusy || loadingDepts || departments.length === 0 || !parsed.ok}
            onClick={onCreate}
          >
            {busy ? "Creating..." : "Create Room"}
          </button>
        </div>
      </div>
    </div>
  );
}