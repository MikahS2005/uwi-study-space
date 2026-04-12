// src/app/api/admin/rooms/create/route.ts
//
// Create a new room (admin / super_admin).
//
// Authorization:
// - Must be authenticated
// - Role must be admin or super_admin
// - Admin must be allowed to create under the provided department_id
//     -> enforced via SECURITY DEFINER function admin_can_access_department(department_id)
// - Insert uses service role (bypasses RLS), so authorization MUST be enforced here.
//
// Data rules:
// - name/building required
// - capacity > 0
// - floor optional
// - amenities array (deduped)

import { NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabase/server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { writeAuditLog } from "@/lib/audit/write";

type CreateRoomBody = {
  departmentId?: unknown;
  name?: unknown;
  building?: unknown;
  floor?: unknown;
  capacity?: unknown;
  amenities?: unknown;
  imageUrls?: unknown;
  bufferMinutes?: unknown;
  hours?: unknown; // array of 7 DayHours
};

export async function POST(req: Request) {
  const supabase = await createSupabaseServer();
  const admin = createSupabaseAdmin();

  // 1) Auth
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // 2) Role via RPC
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

  // 3) Parse + validate body
  const body = (await req.json().catch(() => null)) as CreateRoomBody | null;

  const departmentId = Number(body?.departmentId);
  if (!Number.isFinite(departmentId) || departmentId <= 0) {
    return NextResponse.json({ error: "Invalid departmentId" }, { status: 400 });
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

  if (!name) return NextResponse.json({ error: "Name is required" }, { status: 400 });
  if (!building) return NextResponse.json({ error: "Building is required" }, { status: 400 });
  if (!Number.isFinite(capacity) || capacity <= 0) {
    return NextResponse.json({ error: "Capacity must be a positive number" }, { status: 400 });
  }

  const uniqueAmenities = Array.from(new Set(amenities));
  const uniqueImages = Array.from(new Set(imageUrls));

  // 4) Scope enforcement for admins (super_admin bypass)
  if (role !== "super_admin") {
    const { data: ok, error: scopeErr } = await supabase.rpc("admin_can_access_department", {
      p_department_id: departmentId,
    });

    if (scopeErr) {
      return NextResponse.json(
        { error: "Department scope check failed", detail: scopeErr.message },
        { status: 500 },
      );
    }

    if (ok !== true) {
      return NextResponse.json({ error: "Forbidden (no department scope)" }, { status: 403 });
    }
  }

  // 5) Insert using service role
  const { data: created, error: insErr } = await admin
    .from("rooms")
    .insert({
      department_id: departmentId,
      name,
      building,
      floor,
      capacity,
      amenities: uniqueAmenities,
      image_url: uniqueImages.length ? uniqueImages : null,
      is_active: true,
    })
    .select("id")
    .maybeSingle();

  if (insErr || !created) {
    return NextResponse.json({ error: insErr?.message ?? "Insert failed" }, { status: 400 });
  }

  // 6) Audit (best effort)
  writeAuditLog({
    actorUserId: user.id,
    action: "admin.room.create",
    targetType: "room",
    targetId: String(created.id),
    meta: {
      via: role,
      departmentId,
      name,
      building,
      floor,
      capacity,
      amenities: uniqueAmenities,
      imageUrls: uniqueImages,
    },
  }).catch(() => {});

  await admin.from("room_opening_hours").insert(
  Array.from({ length: 7 }).map((_, i) => ({
    room_id: created.id,
    day_of_week: i,
    open_minute: 480,   // 08:00
    close_minute: 1200, // 20:00
    is_closed: false,
  })),
);

  return NextResponse.json({ ok: true, roomId: created.id });
}
