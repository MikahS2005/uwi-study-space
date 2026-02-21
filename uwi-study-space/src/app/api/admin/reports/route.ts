import { NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabase/server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";

type Role = "student" | "admin" | "super_admin";

async function getAllowedRoomIdsForAdmin(opts: {
  supabase: Awaited<ReturnType<typeof createSupabaseServer>>;
  admin: ReturnType<typeof createSupabaseAdmin>;
  userId: string;
}) {
  const { supabase, admin, userId } = opts;

  const { data: scopes, error: scopeErr } = await supabase
    .from("admin_scopes")
    .select("room_id, department_id")
    .eq("admin_user_id", userId);

  if (scopeErr) return [];

  const roomIds = (scopes ?? [])
    .map((s) => s.room_id)
    .filter((x): x is number => Number.isFinite(Number(x)))
    .map(Number);

  const deptIds = (scopes ?? [])
    .map((s) => s.department_id)
    .filter((x): x is number => Number.isFinite(Number(x)))
    .map(Number);

  let deptRoomIds: number[] = [];
  if (deptIds.length > 0) {
    const { data: deptRooms } = await admin.from("rooms").select("id").in("department_id", deptIds);
    deptRoomIds = (deptRooms ?? []).map((r) => Number(r.id)).filter(Number.isFinite);
  }

  return Array.from(new Set([...roomIds, ...deptRoomIds]));
}

function countByStatus(rows: { status: string | null }[]) {
  const out: Record<string, number> = {};
  for (const r of rows) {
    const s = String(r.status ?? "unknown");
    out[s] = (out[s] ?? 0) + 1;
  }
  return out;
}

export async function GET(req: Request) {
  const supabase = await createSupabaseServer();
  const admin = createSupabaseAdmin();

  // 1) Auth
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // 2) Role via RPC
  const { data: meRows, error: meError } = await supabase.rpc("get_my_profile");
  if (meError) {
    return NextResponse.json(
      { error: "Profile lookup failed", detail: meError.message },
      { status: 500 },
    );
  }

  const me = Array.isArray(meRows) ? meRows[0] : null;
  const role = (me?.role ?? null) as Role | null;

  if (role !== "admin" && role !== "super_admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // 3) Params
  const url = new URL(req.url);
  const from = String(url.searchParams.get("from") ?? "");
  const to = String(url.searchParams.get("to") ?? "");
  if (!from || !to) return NextResponse.json({ error: "Missing from/to (YYYY-MM-DD)" }, { status: 400 });

  const fromIso = new Date(`${from}T00:00:00.000Z`).toISOString();
  const toIso = new Date(`${to}T23:59:59.999Z`).toISOString();

  // 4) Scope
  let allowedRoomIds: number[] | null = null;
  if (role === "admin") {
    allowedRoomIds = await getAllowedRoomIdsForAdmin({ supabase, admin, userId: user.id });
    if (allowedRoomIds.length === 0) {
      return NextResponse.json({
        range: { from, to },
        scope: { mode: "admin", allowedRoomCount: 0 },
        bookings: { total: 0, byStatus: {} },
        waitlist: { total: 0, byStatus: {} },
      });
    }
  }

  // 5) Bookings in range (overlap with [from,to])
  let bq = admin
    .from("bookings")
    .select("id, status, room_id")
    .lt("start_time", toIso)
    .gt("end_time", fromIso);

  if (allowedRoomIds) bq = bq.in("room_id", allowedRoomIds);

  const { data: bookings, error: bErr } = await bq;
  if (bErr) return NextResponse.json({ error: "Bookings query failed", detail: bErr.message }, { status: 500 });

  // 6) Waitlist in range (overlap with [from,to])
  let wq = admin
    .from("waitlist")
    .select("id, status, room_id")
    .lt("start_time", toIso)
    .gt("end_time", fromIso);

  if (allowedRoomIds) wq = wq.in("room_id", allowedRoomIds);

  const { data: waitlist, error: wErr } = await wq;
  if (wErr) return NextResponse.json({ error: "Waitlist query failed", detail: wErr.message }, { status: 500 });

  const bookingsByStatus = countByStatus(bookings ?? []);
  const waitlistByStatus = countByStatus(waitlist ?? []);

  return NextResponse.json({
    range: { from, to },
    scope: { mode: role === "super_admin" ? "super_admin" : "admin", allowedRoomCount: allowedRoomIds ? allowedRoomIds.length : null },
    bookings: { total: (bookings ?? []).length, byStatus: bookingsByStatus },
    waitlist: { total: (waitlist ?? []).length, byStatus: waitlistByStatus },
  });
}