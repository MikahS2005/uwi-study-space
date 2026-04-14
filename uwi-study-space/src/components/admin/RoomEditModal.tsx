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
  closed?: boolean;
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

function hhmmToMinutes(hhmm: string) {
  const [h, m] = hhmm.split(":").map((x) => Number(x));
  if (!Number.isFinite(h) || !Number.isFinite(m)) return null;
  if (h < 0 || h > 23) return null;
  if (m < 0 || m > 59) return null;
  return h * 60 + m;
}

function minutesToHHMM(mins: number) {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function normalizeHours(hours: DayHours[]) {
  return Array.from({ length: 7 }).map((_, i) => {
    const match = hours.find((x) => x.day_of_week === i);
    if (!match) return { day_of_week: i, open_minute: 480, close_minute: 1200, is_closed: false };

    return {
      day_of_week: match.day_of_week,
      open_minute: match.open_minute,
      close_minute: match.close_minute,
      is_closed: Boolean(match.is_closed ?? match.closed ?? false),
    };
  });
}

// ─── Shared style constants (mirrors NewRoomModal) ───────────────────────────

const labelClass =
  "mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--color-text-light)]/55";

const inputClass =
  "h-11 w-full rounded-xl border border-[var(--color-border-light)] bg-[var(--color-surface-light)] px-3 text-sm text-[var(--color-text-light)] outline-none transition-colors placeholder:text-[var(--color-text-light)]/35 focus:border-[var(--color-primary)] focus:bg-white disabled:opacity-60";

const sectionClass =
  "rounded-2xl border border-[var(--color-border-light)] bg-[var(--color-surface-light)]/55 p-4";

// ─────────────────────────────────────────────────────────────────────────────

export function RoomEditModal(props: {
  open: boolean;
  onClose: () => void;
  room: EditableRoom;
  onSaved: () => void;
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

  // Room Rules state
  const [rulesBusy, setRulesBusy] = useState(false);
  const [rulesMsg, setRulesMsg] = useState<string | null>(null);
  const [bufferMinutes, setBufferMinutes] = useState<string>("0");
  const [hours, setHours] = useState<DayHours[]>(
    Array.from({ length: 7 }).map((_, i) => ({
      day_of_week: i,
      open_minute: 480,
      close_minute: 1200,
      is_closed: false,
    })),
  );
  const [blackouts, setBlackouts] = useState<BlackoutRow[]>([]);
  const [blkStart, setBlkStart] = useState<string>("");
  const [blkEnd, setBlkEnd] = useState<string>("");
  const [blkReason, setBlkReason] = useState<string>("");

  // Re-initialise when the modal opens or room changes
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
    setRulesBusy(false);
    setRulesMsg(null);
    setBlkStart("");
    setBlkEnd("");
    setBlkReason("");

    void (async () => {
      try {
        setRulesBusy(true);

        const [hrsRes, blkRes, bufRes] = await Promise.all([
          fetch(`/api/admin/rooms/opening-hours/get?roomId=${room.id}`, { cache: "no-store" }),
          fetch(`/api/admin/rooms/blackouts/list?roomId=${room.id}`, { cache: "no-store" }),
          fetch(`/api/admin/rooms/buffer/get?roomId=${room.id}`, { cache: "no-store" }),
        ]);

        const [hrsPayload, blkPayload, bufPayload] = await Promise.all([
          hrsRes.json().catch(() => ({})),
          blkRes.json().catch(() => ({})),
          bufRes.json().catch(() => ({})),
        ]);

        if (!hrsRes.ok) throw new Error(hrsPayload?.error ?? "Failed to load opening hours.");
        if (!blkRes.ok) throw new Error(blkPayload?.error ?? "Failed to load blackouts.");
        if (!bufRes.ok) throw new Error(bufPayload?.error ?? "Failed to load buffer minutes.");

        const hrs = Array.isArray(hrsPayload?.hours) ? (hrsPayload.hours as DayHours[]) : [];
        setHours(normalizeHours(hrs));
        setBlackouts(Array.isArray(blkPayload?.blackouts) ? blkPayload.blackouts : []);
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
    if (!Number.isFinite(cap) || cap <= 0)
      return { ok: false as const, message: "Capacity must be a positive number." };

    const uniqueAmenities = Array.from(
      new Set(amenitiesText.split(",").map((s) => s.trim()).filter(Boolean)),
    );
    return { ok: true as const, name: n, building: b, floor: f, capacity: cap, amenities: uniqueAmenities };
  }, [name, building, floor, capacity, amenitiesText]);

  const amenityPreview = useMemo(
    () => Array.from(new Set(amenitiesText.split(",").map((s) => s.trim()).filter(Boolean))),
    [amenitiesText],
  );

  // ── Image actions ────────────────────────────────────────────────────────────

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
      if (!ALLOWED_TYPES.has(f.type)) { setUploadMsg("Only JPG, PNG, or WebP files are allowed."); return; }
      if (f.size > MAX_BYTES) { setUploadMsg("Each image must be 5MB or less."); return; }
    }
    try {
      setUploadBusy(true);
      setUploadMsg(null);
      const uploaded: string[] = [];
      for (const f of files) {
        const form = new FormData();
        form.append("file", f);
        const res = await fetch("/api/admin/rooms/upload-image", { method: "POST", body: form });
        const payload = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(payload?.error ?? "Upload failed");
        if (typeof payload?.url !== "string" || !payload.url) throw new Error("Upload failed to return a URL");
        uploaded.push(payload.url);
      }
      setImageUrls((prev) => [...prev, ...uploaded].slice(0, MAX_IMAGES));
      setPendingFiles(null);
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
      if (!res.ok) throw new Error(payload?.error ?? "Delete failed");
      setImageUrls((prev) => prev.filter((x) => x !== url));
      setUploadMsg("Image removed.");
    } catch (e: any) {
      setUploadMsg(e?.message ?? "Delete failed.");
    } finally {
      setUploadBusy(false);
    }
  }

  // ── Room detail save ─────────────────────────────────────────────────────────

  async function onSave() {
    if (!parsed.ok) { setErrorMsg(parsed.message); return; }
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
      if (!res.ok) throw new Error(payload?.error ?? `Update failed (${res.status})`);
      onSaved();
      onClose();
    } catch (e: any) {
      setErrorMsg(e?.message ?? "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  // ── Rules actions ────────────────────────────────────────────────────────────

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
    for (const h of hours) {
      if (h.is_closed) continue;
      if (h.open_minute < 0 || h.open_minute > 1439) { setRulesMsg("Invalid opening time."); return; }
      if (h.close_minute < 1 || h.close_minute > 1440) { setRulesMsg("Invalid closing time."); return; }
      if (h.close_minute <= h.open_minute) { setRulesMsg("Closing time must be after opening time."); return; }
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
    if (!blkStart || !blkEnd) { setRulesMsg("Please select both a blackout start and end time."); return; }
    const startISO = new Date(blkStart).toISOString();
    const endISO = new Date(blkEnd).toISOString();
    if (Date.parse(endISO) <= Date.parse(startISO)) { setRulesMsg("Blackout end time must be after start time."); return; }
    try {
      setRulesBusy(true);
      setRulesMsg(null);
      const res = await fetch("/api/admin/rooms/blackouts/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roomId: room.id, start: startISO, end: endISO, reason: blkReason.trim() || null }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload?.error ?? "Failed to create blackout.");
      const blkRes = await fetch(`/api/admin/rooms/blackouts/list?roomId=${room.id}`, {
        cache: "no-store",
      });
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

  // ─────────────────────────────────────────────────────────────────────────────

  if (!open) return null;

  const disableClose = busy || rulesBusy || uploadBusy;

  return (
    <div className="fixed inset-0 z-50 p-4 sm:p-6">
      {/* Backdrop */}
      <button
        type="button"
        aria-label="Close"
        className="absolute inset-0 bg-[rgba(15,23,42,0.45)] backdrop-blur-[2px]"
        onClick={() => !disableClose && onClose()}
      />

      {/* Panel */}
      <div className="relative mx-auto flex h-[min(92vh,900px)] w-full max-w-3xl flex-col overflow-hidden rounded-[28px] border border-[var(--color-border-light)] bg-[var(--color-background-light)] shadow-[0_30px_80px_rgba(0,0,0,0.18)]">

        {/* ── Header ── */}
        <div className="flex shrink-0 items-start justify-between gap-4 border-b border-[var(--color-border-light)] px-5 py-4 sm:px-6 sm:py-5">
          <div>
            <div className="inline-flex items-center rounded-full bg-[var(--color-primary-soft)] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--color-primary)]">
              Admin rooms
            </div>
            <h2 className="mt-3 text-lg font-semibold text-[var(--color-text-light)] sm:text-xl">
              Edit Room
            </h2>
            <p className="mt-1 max-w-2xl text-sm text-[var(--color-text-light)]/66">
              Update room details. Department changes are restricted to Super Admin.
            </p>
          </div>

          <button
            type="button"
            className="inline-flex h-10 shrink-0 items-center justify-center rounded-xl border border-[var(--color-border-light)] bg-white px-4 text-sm font-medium text-[var(--color-text-light)] transition-colors hover:bg-[var(--color-secondary)] disabled:opacity-60"
            disabled={disableClose}
            onClick={onClose}
          >
            Close
          </button>
        </div>

        {/* ── Body ── */}
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4 sm:px-6 sm:py-5">
          {errorMsg ? (
            <div className="mb-5 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {errorMsg}
            </div>
          ) : null}

          <div className="space-y-5">

            {/* ── Room Details ── */}
            <section className={sectionClass}>
              <div className="mb-4">
                <h3 className="text-sm font-semibold text-[var(--color-text-light)]">Room details</h3>
                <p className="mt-1 text-xs text-[var(--color-text-light)]/60">
                  Update the essential room information used for browsing and booking.
                </p>
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <label className="md:col-span-2">
                  <span className={labelClass}>Room name</span>
                  <input
                    className={inputClass}
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    disabled={busy}
                    placeholder="e.g. AJL-101"
                  />
                </label>

                <label className="md:col-span-2">
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

            {/* ── Amenities ── */}
            <section className={sectionClass}>
              <div className="mb-4">
                <h3 className="text-sm font-semibold text-[var(--color-text-light)]">Amenities</h3>
                <p className="mt-1 text-xs text-[var(--color-text-light)]/60">
                  Enter amenities as comma-separated values. They will be cleaned and saved as unique items.
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
                <div className="mt-4 text-xs text-[var(--color-text-light)]/52">No amenities added yet.</div>
              )}
            </section>

            {/* ── Room Image ── */}
            <section className={sectionClass}>
              <div className="mb-4">
                <h3 className="text-sm font-semibold text-[var(--color-text-light)]">Room image</h3>
                <p className="mt-1 text-xs text-[var(--color-text-light)]/60">
                  Upload one image in JPG, PNG, or WebP format, up to 5MB.
                </p>
              </div>

              <div className="rounded-2xl border border-dashed border-[var(--color-border-light)] bg-white p-4">
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
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        disabled={uploadBusy || imageUrls.length >= MAX_IMAGES}
                        onChange={(e) => setPendingFiles(e.target.files)}
                        className="inline-flex h-11 items-center rounded-xl border border-[var(--color-border-light)] bg-white px-4 text-sm font-medium text-[var(--color-text-light)] disabled:opacity-60"
                      />

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

            {/* ── Room Rules ── */}
            <section className={sectionClass}>
              <div className="mb-4 flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-sm font-semibold text-[var(--color-text-light)]">Room rules</h3>
                  <p className="mt-1 text-xs text-[var(--color-text-light)]/60">
                    Configure opening hours, maintenance blackouts, and buffer time between bookings.
                  </p>
                </div>
                {rulesBusy && (
                  <span className="text-xs text-[var(--color-text-light)]/52" aria-live="polite">
                    Working…
                  </span>
                )}
              </div>

              {rulesMsg ? (
                <div className="mb-4 rounded-xl bg-[var(--color-primary-soft)] px-3 py-2 text-xs text-[var(--color-primary)]">
                  {rulesMsg}
                </div>
              ) : null}

              {/* Buffer minutes */}
              <div className="rounded-2xl border border-[var(--color-border-light)] bg-white p-4">
                <h4 className="text-sm font-semibold text-[var(--color-text-light)]">
                  Buffer between bookings
                </h4>
                <p className="mt-1 text-xs text-[var(--color-text-light)]/60">
                  Gap enforced between consecutive bookings in this room.
                </p>

                <div className="mt-3 flex flex-wrap items-center gap-3">
                  <input
                    className="h-11 w-32 rounded-xl border border-[var(--color-border-light)] bg-[var(--color-surface-light)] px-3 text-sm text-[var(--color-text-light)] outline-none transition-colors focus:border-[var(--color-primary)] focus:bg-white disabled:opacity-60"
                    value={bufferMinutes}
                    onChange={(e) => setBufferMinutes(e.target.value)}
                    disabled={rulesBusy}
                    inputMode="numeric"
                    placeholder="0"
                  />
                  <span className="text-xs text-[var(--color-text-light)]/60">minutes</span>

                  <button
                    type="button"
                    className="ml-auto inline-flex h-11 items-center justify-center rounded-xl bg-[var(--color-primary)] px-4 text-sm font-semibold text-white transition-colors hover:bg-[var(--color-primary-dark)] disabled:cursor-not-allowed disabled:opacity-60"
                    disabled={rulesBusy}
                    onClick={saveBufferMinutes}
                  >
                    Save buffer
                  </button>
                </div>
              </div>

              {/* Opening hours */}
              <div className="mt-4 rounded-2xl border border-[var(--color-border-light)] bg-white p-4">
                <h4 className="text-sm font-semibold text-[var(--color-text-light)]">
                  Opening hours (weekly)
                </h4>
                <p className="mt-1 text-xs text-[var(--color-text-light)]/60">
                  This is a recurring weekly schedule. Update if hours change mid-semester.
                </p>

                <div className="mt-4 grid gap-2">
                  {hours.map((h) => {
                    const openHH = minutesToHHMM(h.open_minute);
                    const closeHH = minutesToHHMM(Math.min(h.close_minute, 1439));

                    return (
                      <div
                        key={h.day_of_week}
                        className="grid grid-cols-1 gap-3 rounded-xl border border-[var(--color-border-light)] bg-[var(--color-surface-light)]/50 p-3 sm:grid-cols-12 sm:items-end"
                      >
                        <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--color-text-light)]/55 sm:col-span-2 sm:pb-2">
                          {DOW_LABELS[h.day_of_week]}
                        </div>

                        <label className="flex cursor-pointer items-center gap-2 sm:col-span-2 sm:pb-2">
                          <input
                            type="checkbox"
                            checked={h.is_closed}
                            disabled={rulesBusy}
                            className="h-4 w-4 accent-[var(--color-primary)]"
                            onChange={(e) => {
                              const checked = e.target.checked;
                              setHours((prev) =>
                                prev.map((x) =>
                                  x.day_of_week === h.day_of_week ? { ...x, is_closed: checked } : x,
                                ),
                              );
                            }}
                          />
                          <span className="text-xs text-[var(--color-text-light)]/60">Closed</span>
                        </label>

                        <div className="sm:col-span-4">
                          <span className={labelClass}>Open</span>
                          <input
                            type="time"
                            className={inputClass}
                            disabled={rulesBusy || h.is_closed}
                            value={openHH}
                            onChange={(e) => {
                              const mins = hhmmToMinutes(e.target.value);
                              if (mins == null) return;
                              setHours((prev) =>
                                prev.map((x) =>
                                  x.day_of_week === h.day_of_week ? { ...x, open_minute: mins } : x,
                                ),
                              );
                            }}
                          />
                        </div>

                        <div className="sm:col-span-4">
                          <span className={labelClass}>Close</span>
                          <input
                            type="time"
                            className={inputClass}
                            disabled={rulesBusy || h.is_closed}
                            value={closeHH}
                            onChange={(e) => {
                              const mins = hhmmToMinutes(e.target.value);
                              if (mins == null) return;
                              setHours((prev) =>
                                prev.map((x) =>
                                  x.day_of_week === h.day_of_week ? { ...x, close_minute: mins } : x,
                                ),
                              );
                            }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="mt-4 flex justify-end">
                  <button
                    type="button"
                    className="inline-flex h-11 items-center justify-center rounded-xl bg-[var(--color-primary)] px-4 text-sm font-semibold text-white transition-colors hover:bg-[var(--color-primary-dark)] disabled:cursor-not-allowed disabled:opacity-60"
                    disabled={rulesBusy}
                    onClick={saveOpeningHours}
                  >
                    Save opening hours
                  </button>
                </div>
              </div>

              {/* Blackouts */}
              <div className="mt-4 rounded-2xl border border-[var(--color-border-light)] bg-white p-4">
                <h4 className="text-sm font-semibold text-[var(--color-text-light)]">
                  Maintenance / blackouts
                </h4>
                <p className="mt-1 text-xs text-[var(--color-text-light)]/60">
                  Block a room for repairs or events. These appear as unavailable slots on the booking page.
                </p>

                <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <label>
                    <span className={labelClass}>Start</span>
                    <input
                      type="datetime-local"
                      className={inputClass}
                      disabled={rulesBusy}
                      value={blkStart}
                      onChange={(e) => setBlkStart(e.target.value)}
                    />
                  </label>

                  <label>
                    <span className={labelClass}>End</span>
                    <input
                      type="datetime-local"
                      className={inputClass}
                      disabled={rulesBusy}
                      value={blkEnd}
                      onChange={(e) => setBlkEnd(e.target.value)}
                    />
                  </label>

                  <label className="sm:col-span-2">
                    <span className={labelClass}>Reason (optional)</span>
                    <input
                      className={inputClass}
                      disabled={rulesBusy}
                      value={blkReason}
                      onChange={(e) => setBlkReason(e.target.value)}
                      placeholder="e.g. Repairs, Deep cleaning, Reserved event"
                    />
                  </label>
                </div>

                <div className="mt-4 flex justify-end">
                  <button
                    type="button"
                    className="inline-flex h-11 items-center justify-center rounded-xl bg-[var(--color-primary)] px-4 text-sm font-semibold text-white transition-colors hover:bg-[var(--color-primary-dark)] disabled:cursor-not-allowed disabled:opacity-60"
                    disabled={rulesBusy}
                    onClick={addBlackout}
                  >
                    Add blackout
                  </button>
                </div>

                <div className="mt-4 grid gap-2">
                  {blackouts.length === 0 ? (
                    <div className="rounded-xl bg-[var(--color-surface-light)] px-4 py-4 text-center text-xs text-[var(--color-text-light)]/52">
                      No blackouts set for this room.
                    </div>
                  ) : (
                    blackouts.map((b) => (
                      <div
                        key={b.id}
                        className="flex flex-col gap-3 rounded-xl border border-[var(--color-border-light)] bg-[var(--color-surface-light)]/50 p-3 sm:flex-row sm:items-center sm:justify-between"
                      >
                        <div className="space-y-1 text-xs text-[var(--color-text-light)]">
                          <div>
                            <span className="font-semibold">Start:</span>{" "}
                            {new Date(b.start_time).toLocaleString()}
                          </div>
                          <div>
                            <span className="font-semibold">End:</span>{" "}
                            {new Date(b.end_time).toLocaleString()}
                          </div>
                          {b.reason ? (
                            <div className="text-[var(--color-text-light)]/60">{b.reason}</div>
                          ) : null}
                        </div>

                        <button
                          type="button"
                          className="inline-flex h-9 shrink-0 items-center justify-center rounded-xl border border-red-200 px-3 text-xs font-medium text-red-700 transition-colors hover:bg-red-50 disabled:opacity-60"
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
            </section>
          </div>
        </div>

        {/* ── Footer ── */}
        <div className="flex shrink-0 items-center justify-end gap-3 border-t border-[var(--color-border-light)] px-5 py-4 sm:px-6">
          <button
            type="button"
            className="inline-flex h-11 items-center justify-center rounded-xl border border-[var(--color-border-light)] bg-white px-5 text-sm font-medium text-[var(--color-text-light)] transition-colors hover:bg-[var(--color-secondary)] disabled:opacity-60"
            disabled={disableClose}
            onClick={onClose}
          >
            Cancel
          </button>

          <button
            type="button"
            className="inline-flex h-11 items-center justify-center rounded-xl bg-[var(--color-primary)] px-5 text-sm font-semibold text-white transition-colors hover:bg-[var(--color-primary-dark)] disabled:cursor-not-allowed disabled:opacity-60"
            disabled={busy || rulesBusy || uploadBusy || !parsed.ok}
            onClick={onSave}
          >
            {busy ? "Saving..." : "Save changes"}
          </button>
        </div>
      </div>
    </div>
  );
}