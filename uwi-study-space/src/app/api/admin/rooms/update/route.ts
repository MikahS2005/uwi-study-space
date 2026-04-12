// src/app/api/admin/rooms/update/route.ts
//
// Update a room's editable fields.
//
// Authorization rules:
// - Must be authenticated
// - Role must be admin or super_admin
// - Admin must have scope access to the target room (admin_has_room_access)
// - Admin cannot change department_id (this endpoint does not accept it)
//
// Data rules:
// - Validates inputs (name/building required, capacity > 0)
// - Uses service role to update reliably (bypasses RLS), so we MUST enforce checks here.
//
// Auditing:
// - Best-effort audit log insert (never breaks primary flow).

import { NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabase/server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { writeAuditLog } from "@/lib/audit/write";

type UpdateRoomBody = {
  roomId?: unknown;
  name?: unknown;
  building?: unknown;
  floor?: unknown; // string | null
  capacity?: unknown;
  amenities?: unknown; // string[]
  imageUrls?: unknown; // string[]
};

export async function POST(req: Request) {
  const supabase = await createSupabaseServer();
  const admin = createSupabaseAdmin();

  // ---------------------------------------------------------------------------
  // 1) Auth
  // ---------------------------------------------------------------------------
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // ---------------------------------------------------------------------------
  // 2) Role via RPC (SECURITY DEFINER) to avoid RLS recursion
  // ---------------------------------------------------------------------------
  const { data: meRows, error: meError } = await supabase.rpc("get_my_profile");
  if (meError) {
    return NextResponse.json(
      { error: "Profile lookup failed", detail: meError.message },
      { status: 500 },
    );
  }

  const me = Array.isArray(meRows) ? meRows[0] : null;
  const role = me?.role ?? null;

  if (role !== "admin" && role !== "super_admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // ---------------------------------------------------------------------------
  // 3) Parse + validate body
  // ---------------------------------------------------------------------------
  const body = (await req.json().catch(() => null)) as UpdateRoomBody | null;

  const roomId = Number(body?.roomId);
  if (!Number.isFinite(roomId) || roomId <= 0) {
    return NextResponse.json({ error: "Invalid roomId" }, { status: 400 });
  }

  const name = typeof body?.name === "string" ? body.name.trim() : "";
  const building = typeof body?.building === "string" ? body.building.trim() : "";

  const floor =
    body?.floor === null
      ? null
      : typeof body?.floor === "string"
        ? body.floor.trim() || null
        : null;

  const capacity = Number(body?.capacity);

  const amenities = Array.isArray(body?.amenities)
    ? body!.amenities
        .filter((x) => typeof x === "string")
        .map((s: string) => s.trim())
        .filter(Boolean)
    : [];

  const imageUrls = Array.isArray(body?.imageUrls)
    ? body!.imageUrls
        .filter((x) => typeof x === "string")
        .map((s: string) => s.trim())
        .filter(Boolean)
        .slice(0, 1)
    : [];

  // Server-side required field guards
  if (!name) return NextResponse.json({ error: "Name is required" }, { status: 400 });
  if (!building) return NextResponse.json({ error: "Building is required" }, { status: 400 });
  if (!Number.isFinite(capacity) || capacity <= 0) {
    return NextResponse.json({ error: "Capacity must be a positive number" }, { status: 400 });
  }

  // De-dupe amenities (keeps DB consistent)
  const uniqueAmenities = Array.from(new Set(amenities));
  const uniqueImages = Array.from(new Set(imageUrls));

  // ---------------------------------------------------------------------------
  // 4) Scope check for admins (super_admin bypass)
  // ---------------------------------------------------------------------------
  if (role !== "super_admin") {
    const { data: canAccess, error: accessErr } = await supabase.rpc("admin_has_room_access", {
      target_room_id: roomId,
    });

    if (accessErr) {
      return NextResponse.json(
        { error: "Scope check failed", detail: accessErr.message },
        { status: 500 },
      );
    }

    if (canAccess !== true) {
      return NextResponse.json({ error: "Forbidden (no scope)" }, { status: 403 });
    }
  }

  // ---------------------------------------------------------------------------
  // 5) Update using service role
  // ---------------------------------------------------------------------------
  const { data: updated, error: updErr } = await admin
    .from("rooms")
    .update({
      name,
      building,
      floor,
      capacity,
      amenities: uniqueAmenities,
      image_url: uniqueImages.length ? uniqueImages : null,
    })
    .eq("id", roomId)
    .select("id")
    .maybeSingle();

  if (updErr || !updated) {
    return NextResponse.json(
      { error: updErr?.message ?? "Update failed" },
      { status: 400 },
    );
  }

  // ---------------------------------------------------------------------------
  // 6) Audit (best effort)
  // ---------------------------------------------------------------------------
  writeAuditLog({
    actorUserId: user.id,
    action: "admin.room.update",
    targetType: "room",
    targetId: roomId,
    meta: {
      via: role,
      fields: ["name", "building", "floor", "capacity", "amenities", "image_url"],
    },
  }).catch(() => {});

  return NextResponse.json({ ok: true, roomId });
}
