// src/components/admin/RoomEditModal.tsx
//
// Modal used by Admin Rooms page to edit an existing room.
//
// Added features:
// - Opening hours per day (room_opening_hours)
// - Room blackouts (room_blackouts) for repairs / closures
// - Buffer minutes between bookings (rooms.buffer_minutes)
//
// Notes:
// - All writes go through /api/admin/... endpoints (server enforces role + scope).
// - UI is intentionally simple: 7-day grid, blackout list, buffer input.
// - No external UI libs.

"use client";

import { useEffect, useMemo, useState } from "react";

export type EditableRoom = {
  id: number;
  name: string;
  building: string;
  floor: string | null;
  capacity: number;
  amenities: string[];
  image_url: string[] | null;
  is_active?: boolean;
};

type DayHours = {
  day_of_week: number; // 0..6 (Sun..Sat)
  open_minute: number; // 0..1439
  close_minute: number; // 1..1440
  is_closed: boolean;
};

type BlackoutRow = {
  id: number;
  start_time: string; // ISO
  end_time: string; // ISO
  reason: string | null;
};

const DOW_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MAX_IMAGES = 1;
const MAX_BYTES = 5 * 1024 * 1024;
const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

// Convert "HH:MM" -> minutes since midnight
function hhmmToMinutes(hhmm: string) {
  const [h, m] = hhmm.split(":").map((x) => Number(x));
  if (!Number.isFinite(h) || !Number.isFinite(m)) return null;
  if (h < 0 || h > 23) return null;
  if (m < 0 || m > 59) return null;
  return h * 60 + m;
}

// Convert minutes -> "HH:MM"
function minutesToHHMM(mins: number) {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  const hh = String(h).padStart(2, "0");
  const mm = String(m).padStart(2, "0");
  return `${hh}:${mm}`;
}

export function RoomEditModal(props: {
  open: boolean;
  onClose: () => void;
  room: EditableRoom;
  onSaved: () => void; // usually router.refresh() from parent
}) {
  const { open, onClose, room, onSaved } = props;

  const [busy, setBusy] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Room detail form state
  const [name, setName] = useState(room.name);
  const [building, setBuilding] = useState(room.building);
  const [floor, setFloor] = useState(room.floor ?? "");
  const [capacity, setCapacity] = useState(String(room.capacity));
  const [amenitiesText, setAmenitiesText] = useState((room.amenities ?? []).join(", "));
  const [imageUrls, setImageUrls] = useState<string[]>(
    Array.isArray(room.image_url) ? room.image_url : [],
  );
  const [pendingFiles, setPendingFiles] = useState<FileList | null>(null);
  const [uploadBusy, setUploadBusy] = useState(false);
  const [uploadMsg, setUploadMsg] = useState<string | null>(null);

  // === Room Rules state ===
  const [rulesBusy, setRulesBusy] = useState(false);
  const [rulesMsg, setRulesMsg] = useState<string | null>(null);

  const [bufferMinutes, setBufferMinutes] = useState<string>("0");

  const [hours, setHours] = useState<DayHours[]>(
    Array.from({ length: 7 }).map((_, i) => ({
      day_of_week: i,
      open_minute: 480, // default 08:00
      close_minute: 1200, // default 20:00
      is_closed: false,
    })),
  );

  const [blackouts, setBlackouts] = useState<BlackoutRow[]>([]);
  const [blkStart, setBlkStart] = useState<string>("");
  const [blkEnd, setBlkEnd] = useState<string>("");
  const [blkReason, setBlkReason] = useState<string>("");

  // Re-initialize form when opening OR when the room changes.
  useEffect(() => {
    if (!open) return;

    setBusy(false);
    setErrorMsg(null);

    setName(room.name);
    setBuilding(room.building);
    setFloor(room.floor ?? "");
    setCapacity(String(room.capacity));
    setAmenitiesText((room.amenities ?? []).join(", "));
    setImageUrls(Array.isArray(room.image_url) ? room.image_url : []);
    setPendingFiles(null);
    setUploadBusy(false);
    setUploadMsg(null);

    // Reset rules UI state
    setRulesBusy(false);
    setRulesMsg(null);
    setBlkStart("");
    setBlkEnd("");
    setBlkReason("");

    // Load rules for this room (hours, blackouts, buffer)
    // We keep this separate from the main form save.
    void (async () => {
      try {
        setRulesBusy(true);

        // 1) load opening hours
        const hrsRes = await fetch(`/api/admin/rooms/opening-hours/get?roomId=${room.id}`);
        const hrsPayload = await hrsRes.json().catch(() => ({}));
        if (!hrsRes.ok) throw new Error(hrsPayload?.error ?? "Failed to load opening hours.");

        const hrs = Array.isArray(hrsPayload?.hours) ? (hrsPayload.hours as DayHours[]) : [];
        // Ensure we always have 7 rows in UI
        const normalized: DayHours[] = Array.from({ length: 7 }).map((_, i) => {
          const match = hrs.find((x) => x.day_of_week === i);
          return (
            match ?? {
              day_of_week: i,
              open_minute: 480,
              close_minute: 1200,
              is_closed: false,
            }
          );
        });
        setHours(normalized);

        // 2) load blackouts
        const blkRes = await fetch(`/api/admin/rooms/blackouts/list?roomId=${room.id}`);
        const blkPayload = await blkRes.json().catch(() => ({}));
        if (!blkRes.ok) throw new Error(blkPayload?.error ?? "Failed to load blackouts.");
        setBlackouts(Array.isArray(blkPayload?.blackouts) ? blkPayload.blackouts : []);

        // 3) load buffer minutes (simple, read from a small endpoint to keep UI consistent)
        const bufRes = await fetch(`/api/admin/rooms/buffer/get?roomId=${room.id}`);
        const bufPayload = await bufRes.json().catch(() => ({}));
        if (!bufRes.ok) throw new Error(bufPayload?.error ?? "Failed to load buffer minutes.");
        setBufferMinutes(String(bufPayload?.bufferMinutes ?? 0));
      } catch (e: any) {
        setRulesMsg(e?.message ?? "Failed to load room rules.");
      } finally {
        setRulesBusy(false);
      }
    })();
  }, [open, room]);

  const parsed = useMemo(() => {
    const n = name.trim();
    const b = building.trim();
    const f = floor.trim() ? floor.trim() : null;

    const cap = Number(capacity);

    if (!n) return { ok: false as const, message: "Room name is required." };
    if (!b) return { ok: false as const, message: "Building is required." };
    if (!Number.isFinite(cap) || cap <= 0) {
      return { ok: false as const, message: "Capacity must be a positive number." };
    }

    const parsedAmenities = amenitiesText
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    const uniqueAmenities = Array.from(new Set(parsedAmenities));

    return {
      ok: true as const,
      name: n,
      building: b,
      floor: f,
      capacity: cap,
      amenities: uniqueAmenities,
    };
  }, [name, building, floor, capacity, amenitiesText]);

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

  async function onSave() {
    if (!parsed.ok) {
      setErrorMsg(parsed.message);
      return;
    }

    try {
      setBusy(true);
      setErrorMsg(null);

      const res = await fetch("/api/admin/rooms/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          roomId: room.id,
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
        console.error("Room update failed:", { status: res.status, payload });
        throw new Error(payload?.error ?? `Update failed (${res.status})`);
      }

      onSaved();
      onClose();
    } catch (e: any) {
      setErrorMsg(e?.message ?? "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  // === Rules actions ===

  async function saveBufferMinutes() {
    const v = Number(bufferMinutes);
    if (!Number.isFinite(v) || v < 0 || v > 240) {
      setRulesMsg("Buffer minutes must be between 0 and 240.");
      return;
    }

    try {
      setRulesBusy(true);
      setRulesMsg(null);

      const res = await fetch("/api/admin/rooms/buffer/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roomId: room.id, bufferMinutes: v }),
      });

      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload?.error ?? "Failed to update buffer minutes.");

      setRulesMsg("Buffer minutes saved.");
      onSaved();
    } catch (e: any) {
      setRulesMsg(e?.message ?? "Failed to update buffer minutes.");
    } finally {
      setRulesBusy(false);
    }
  }

  async function saveOpeningHours() {
    // Basic client validation
    for (const h of hours) {
      if (h.is_closed) continue;
      if (h.open_minute < 0 || h.open_minute > 1439) {
        setRulesMsg("Invalid opening time.");
        return;
      }
      if (h.close_minute < 1 || h.close_minute > 1440) {
        setRulesMsg("Invalid closing time.");
        return;
      }
      if (h.close_minute <= h.open_minute) {
        setRulesMsg("Closing time must be after opening time.");
        return;
      }
    }

    try {
      setRulesBusy(true);
      setRulesMsg(null);

      const res = await fetch("/api/admin/rooms/opening-hours/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roomId: room.id, hours }),
      });

      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload?.error ?? "Failed to update opening hours.");

      setRulesMsg("Opening hours saved.");
      onSaved();
    } catch (e: any) {
      setRulesMsg(e?.message ?? "Failed to update opening hours.");
    } finally {
      setRulesBusy(false);
    }
  }

  async function addBlackout() {
    if (!blkStart || !blkEnd) {
      setRulesMsg("Please select both a blackout start and end time.");
      return;
    }

    const startISO = new Date(blkStart).toISOString();
    const endISO = new Date(blkEnd).toISOString();

    if (Date.parse(endISO) <= Date.parse(startISO)) {
      setRulesMsg("Blackout end time must be after start time.");
      return;
    }

    try {
      setRulesBusy(true);
      setRulesMsg(null);

      const res = await fetch("/api/admin/rooms/blackouts/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          roomId: room.id,
          start: startISO,
          end: endISO,
          reason: blkReason.trim() ? blkReason.trim() : null,
        }),
      });

      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload?.error ?? "Failed to create blackout.");

      // refresh blackout list quickly
      const blkRes = await fetch(`/api/admin/rooms/blackouts/list?roomId=${room.id}`);
      const blkPayload = await blkRes.json().catch(() => ({}));
      if (blkRes.ok) setBlackouts(Array.isArray(blkPayload?.blackouts) ? blkPayload.blackouts : []);

      setBlkStart("");
      setBlkEnd("");
      setBlkReason("");
      setRulesMsg("Blackout added.");
      onSaved();
    } catch (e: any) {
      setRulesMsg(e?.message ?? "Failed to create blackout.");
    } finally {
      setRulesBusy(false);
    }
  }

  async function deleteBlackout(blackoutId: number) {
    try {
      setRulesBusy(true);
      setRulesMsg(null);

      const res = await fetch("/api/admin/rooms/blackouts/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roomId: room.id, blackoutId }),
      });

      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload?.error ?? "Failed to delete blackout.");

      setBlackouts((prev) => prev.filter((b) => b.id !== blackoutId));
      setRulesMsg("Blackout deleted.");
      onSaved();
    } catch (e: any) {
      setRulesMsg(e?.message ?? "Failed to delete blackout.");
    } finally {
      setRulesBusy(false);
    }
  }



    // If closed, render nothing
  if (!open) return null;

  return (
  <div className="fixed inset-0 z-50">
    {/* The overlay is the scroll container */}
    <div className="fixed inset-0 overflow-y-auto">
      {/* Backdrop */}
      <button
        type="button"
        aria-label="Close"
        className="fixed inset-0 bg-black/30"
        onClick={() => !busy && !rulesBusy && !uploadBusy && onClose()}
      />

      {/* Layout wrapper: NO vertical centering (this is key). */}
      <div className="relative z-10 flex min-h-full items-start justify-center p-4">
        {/* Panel: allow it to be tall; overlay scrolls if needed */}
        <div className="w-[92vw] max-w-xl my-8 rounded-2xl bg-white shadow-xl ring-1 ring-slate-200">
          {/* Header */}
          <div className="p-6 border-b border-slate-100">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-base font-semibold text-slate-900">Edit Room</h2>
                <p className="mt-1 text-sm text-slate-600">
                  Update room details. Department changes are restricted to Super Admin.
                </p>
              </div>

              <button
                type="button"
                className="rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                disabled={busy || rulesBusy || uploadBusy}
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
          </div>

          {/* Body (no need for internal scrolling now, but it's fine to keep simple) */}
          <div className="px-6 py-5">
            <div className="grid grid-cols-1 gap-4">
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
                <p className="mt-1 text-xs text-slate-600">JPG, PNG, or WebP up to 5MB each.</p>

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
                      <div key={url} className="overflow-hidden rounded-xl border border-slate-200">
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

            {/* === Room Rules === */}
            <div className="mt-6 rounded-2xl border border-slate-200 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-sm font-semibold text-slate-900">Room Rules</h3>
                  <p className="mt-1 text-xs text-slate-600">
                    Configure opening hours, maintenance blackouts, and buffer time between bookings.
                  </p>
                </div>
                {rulesBusy && (
                  <span className="text-xs text-slate-500" aria-live="polite">
                    Working…
                  </span>
                )}
              </div>

              {rulesMsg && (
                <div className="mt-3 rounded-xl bg-slate-50 px-3 py-2 text-xs text-slate-700 ring-1 ring-slate-100">
                  {rulesMsg}
                </div>
              )}

              {/* Buffer minutes */}
              <div className="mt-4 rounded-xl border border-slate-200 p-3">
                <div className="text-sm font-medium text-slate-800">Buffer between bookings</div>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <input
                    className="w-28 rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900 outline-none focus:ring-2 focus:ring-slate-200"
                    value={bufferMinutes}
                    onChange={(e) => setBufferMinutes(e.target.value)}
                    disabled={rulesBusy}
                    inputMode="numeric"
                    placeholder="0"
                  />
                  <span className="text-xs text-slate-600">minutes</span>

                  <button
                    type="button"
                    className="ml-auto rounded-xl bg-slate-900 px-3 py-2 text-xs font-medium text-white hover:bg-slate-800 disabled:opacity-60"
                    disabled={rulesBusy}
                    onClick={saveBufferMinutes}
                  >
                    Save Buffer
                  </button>
                </div>
              </div>

              {/* Opening hours */}
              <div className="mt-4 rounded-xl border border-slate-200 p-3">
                <div className="text-sm font-medium text-slate-800">Opening hours (weekly)</div>
                <div className="mt-2 grid gap-2">
                  {hours.map((h) => {
                    const openHH = minutesToHHMM(h.open_minute);
                    const closeHH = minutesToHHMM(Math.min(h.close_minute, 1439));

                    return (
                      <div
                        key={h.day_of_week}
                        className="grid grid-cols-1 gap-2 rounded-xl bg-white p-2 ring-1 ring-slate-100 sm:grid-cols-12 sm:items-center"
                      >
                        <div className="text-sm font-medium text-slate-700 sm:col-span-2">
                          {DOW_LABELS[h.day_of_week]}
                        </div>

                        <label className="flex items-center gap-2 sm:col-span-2">
                          <input
                            type="checkbox"
                            checked={h.is_closed}
                            disabled={rulesBusy}
                            onChange={(e) => {
                              const checked = e.target.checked;
                              setHours((prev) =>
                                prev.map((x) =>
                                  x.day_of_week === h.day_of_week
                                    ? { ...x, is_closed: checked }
                                    : x,
                                ),
                              );
                            }}
                          />
                          <span className="text-xs text-slate-600">Closed</span>
                        </label>

                        <div className="sm:col-span-4">
                          <span className="text-xs text-slate-600">Open</span>
                          <input
                            type="time"
                            className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-200 disabled:opacity-60"
                            disabled={rulesBusy || h.is_closed}
                            value={openHH}
                            onChange={(e) => {
                              const mins = hhmmToMinutes(e.target.value);
                              if (mins == null) return;
                              setHours((prev) =>
                                prev.map((x) =>
                                  x.day_of_week === h.day_of_week
                                    ? { ...x, open_minute: mins }
                                    : x,
                                ),
                              );
                            }}
                          />
                        </div>

                        <div className="sm:col-span-4">
                          <span className="text-xs text-slate-600">Close</span>
                          <input
                            type="time"
                            className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-200 disabled:opacity-60"
                            disabled={rulesBusy || h.is_closed}
                            value={closeHH}
                            onChange={(e) => {
                              const mins = hhmmToMinutes(e.target.value);
                              if (mins == null) return;
                              setHours((prev) =>
                                prev.map((x) =>
                                  x.day_of_week === h.day_of_week
                                    ? { ...x, close_minute: mins }
                                    : x,
                                ),
                              );
                            }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="mt-3 flex justify-end">
                  <button
                    type="button"
                    className="rounded-xl bg-slate-900 px-3 py-2 text-xs font-medium text-white hover:bg-slate-800 disabled:opacity-60"
                    disabled={rulesBusy}
                    onClick={saveOpeningHours}
                  >
                    Save Opening Hours
                  </button>
                </div>

                <p className="mt-2 text-xs text-slate-500">
                  Note: This is a weekly schedule. If the library changes hours mid-semester, update these
                  values at that time.
                </p>
              </div>

              {/* Blackouts */}
              <div className="mt-4 rounded-xl border border-slate-200 p-3">
                <div className="text-sm font-medium text-slate-800">Maintenance / blackouts</div>
                <p className="mt-1 text-xs text-slate-600">
                  Block a room for repairs or events. These will show as unavailable slots on the booking page.
                </p>

                <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <label className="grid gap-1">
                    <span className="text-xs font-medium text-slate-700">Start</span>
                    <input
                      type="datetime-local"
                      className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-200 disabled:opacity-60"
                      disabled={rulesBusy}
                      value={blkStart}
                      onChange={(e) => setBlkStart(e.target.value)}
                    />
                  </label>

                  <label className="grid gap-1">
                    <span className="text-xs font-medium text-slate-700">End</span>
                    <input
                      type="datetime-local"
                      className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-200 disabled:opacity-60"
                      disabled={rulesBusy}
                      value={blkEnd}
                      onChange={(e) => setBlkEnd(e.target.value)}
                    />
                  </label>

                  <label className="grid gap-1 sm:col-span-2">
                    <span className="text-xs font-medium text-slate-700">Reason (optional)</span>
                    <input
                      className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-200 disabled:opacity-60"
                      disabled={rulesBusy}
                      value={blkReason}
                      onChange={(e) => setBlkReason(e.target.value)}
                      placeholder="e.g., Repairs, Deep cleaning, Reserved event"
                    />
                  </label>
                </div>

                <div className="mt-3 flex justify-end">
                  <button
                    type="button"
                    className="rounded-xl bg-slate-900 px-3 py-2 text-xs font-medium text-white hover:bg-slate-800 disabled:opacity-60"
                    disabled={rulesBusy}
                    onClick={addBlackout}
                  >
                    Add Blackout
                  </button>
                </div>

                <div className="mt-4 grid gap-2">
                  {blackouts.length === 0 ? (
                    <div className="text-xs text-slate-600">No blackouts set for this room.</div>
                  ) : (
                    blackouts.map((b) => (
                      <div
                        key={b.id}
                        className="flex flex-col gap-2 rounded-xl bg-white p-3 ring-1 ring-slate-100 sm:flex-row sm:items-center sm:justify-between"
                      >
                        <div className="text-xs text-slate-700">
                          <div>
                            <span className="font-medium">Start:</span>{" "}
                            {new Date(b.start_time).toLocaleString()}
                          </div>
                          <div className="mt-1">
                            <span className="font-medium">End:</span> {new Date(b.end_time).toLocaleString()}
                          </div>
                          {b.reason ? <div className="mt-1 text-slate-600">{b.reason}</div> : null}
                        </div>

                        <button
                          type="button"
                          className="rounded-xl border border-rose-200 px-3 py-2 text-xs font-medium text-rose-700 hover:bg-rose-50 disabled:opacity-60"
                          disabled={rulesBusy}
                          onClick={() => deleteBlackout(b.id)}
                        >
                          Delete
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="p-6 border-t border-slate-100 flex items-center justify-end gap-2">
            <button
              type="button"
              className="rounded-xl border border-slate-200 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-60"
              disabled={busy || rulesBusy || uploadBusy}
              onClick={onClose}
            >
              Cancel
            </button>

            <button
              type="button"
              className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60"
              disabled={busy || rulesBusy || uploadBusy || !parsed.ok}
              onClick={onSave}
            >
              {busy ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
);
}