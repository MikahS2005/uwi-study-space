import { NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabase/server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";

type Role = "student" | "staff" | "admin" | "super_admin";

type RawDepartmentJoin = { name: string } | { name: string }[] | null;

type NormalizedRoom = {
  id: number;
  name: string;
  building: string | null;
  department_id: number | null;
  department?: { name: string } | { name: string }[] | null;
};

const EMPTY_UTILIZATION = {
  overallPercentage: 0,
  totalAvailableHours: 0,
};

const EMPTY_COMPLIANCE = {
  activeBans: 0,
};

type RawRoomJoin = NormalizedRoom | NormalizedRoom[] | null;

type BookingRow = {
  id: number;
  status: string | null;
  room_id: number;
  booked_for_user_id: string | null;
  start_time: string;
  end_time: string;
  room: NormalizedRoom | null;
};

type WaitlistRow = {
  id: number;
  status: string | null;
  room_id: number;
  user_id: string | null;
  start_time: string;
  end_time: string;
  room: NormalizedRoom | null;
};

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
    const { data: deptRooms } = await admin
      .from("rooms")
      .select("id")
      .in("department_id", deptIds);

    deptRoomIds = (deptRooms ?? [])
      .map((r) => Number(r.id))
      .filter(Number.isFinite);
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

function normalizeRoom(room: RawRoomJoin): NormalizedRoom | null {
  if (!room) return null;
  return Array.isArray(room) ? (room[0] ?? null) : room;
}

function normalizeDepartmentName(room: NormalizedRoom | null): string {
  if (!room?.department) return "Unknown";
  if (Array.isArray(room.department)) return room.department[0]?.name ?? "Unknown";
  return room.department.name ?? "Unknown";
}

function durationHours(startIso: string, endIso: string) {
  const start = new Date(startIso).getTime();
  const end = new Date(endIso).getTime();
  if (Number.isNaN(start) || Number.isNaN(end) || end <= start) return 0;
  return (end - start) / 36e5;
}

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

const TT_TZ = "America/Port_of_Spain";

function ttWeekday(iso: string) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: TT_TZ,
    weekday: "short",
  }).format(new Date(iso));
}

function ttHourLabel(iso: string) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: TT_TZ,
    hour: "numeric",
    hour12: true,
  }).format(new Date(iso));
}

function emptyResponse(from: string, to: string, mode: "admin" | "super_admin", allowedRoomCount: number | null) {
  return {
    range: { from, to },
    scope: { mode, allowedRoomCount },
    bookings: {
      total: 0,
      byStatus: {},
      totalHours: 0,
      averageDurationHours: 0,
      uniqueUsers: 0,
      cancellationRate: 0,
      noShowRate: 0,
    },
    waitlist: {
      total: 0,
      byStatus: {},
      conversionRate: 0,
    },
    topRoomsByCount: [],
    topRoomsByHours: [],
    topUsers: [],
    usageByDepartment: [],
    busiestDays: [],
    busiestHours: [],
  };
}

export async function GET(req: Request) {
  const supabase = await createSupabaseServer();
  const admin = createSupabaseAdmin();
  

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

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

  const url = new URL(req.url);
  const from = String(url.searchParams.get("from") ?? "");
  const to = String(url.searchParams.get("to") ?? "");

  if (!from || !to) {
    return NextResponse.json({ error: "Missing from/to (YYYY-MM-DD)" }, { status: 400 });
  }

  const fromIso = new Date(`${from}T00:00:00.000Z`).toISOString();
  const toIso = new Date(`${to}T23:59:59.999Z`).toISOString();

  let allowedRoomIds: number[] | null = null;
  if (role === "admin") {
    allowedRoomIds = await getAllowedRoomIdsForAdmin({
      supabase,
      admin,
      userId: user.id,
    });

    if (allowedRoomIds.length === 0) {
      return NextResponse.json(emptyResponse(from, to, "admin", 0));
    }
  }

  let bookingsQuery = admin
    .from("bookings")
    .select(`
      id,
      status,
      room_id,
      booked_for_user_id,
      start_time,
      end_time,
      room:rooms (
        id,
        name,
        building,
        department_id,
        department:departments!rooms_department_id_fkey ( name )
      )
    `)
    .gte("start_time", fromIso)
    .lte("start_time", toIso);

  let waitlistQuery = admin
    .from("waitlist")
    .select(`
      id,
      status,
      room_id,
      user_id,
      start_time,
      end_time,
      room:rooms (
        id,
        name,
        building,
        department_id,
        department:departments!rooms_department_id_fkey ( name )
      )
    `)
    .gte("start_time", fromIso)
    .lte("start_time", toIso);

    

  const bansQuery = admin
  .from("profiles")
  .select("id", { count: "exact", head: true })
  .eq("is_banned", true);

  if (Array.isArray(allowedRoomIds)) {
    bookingsQuery = bookingsQuery.in("room_id", allowedRoomIds);
    waitlistQuery = waitlistQuery.in("room_id", allowedRoomIds);
  }

  
  // We add a third item to the array to catch the response from bansQuery
const [
  { data: bookings, error: bookingsErr }, 
  { data: waitlist, error: waitlistErr }, 
  banRes 
] = await Promise.all([bookingsQuery, waitlistQuery, bansQuery]);

// Now your existing error checks below this line still work perfectly:
if (bookingsErr) {
  return NextResponse.json({ error: "Failed to load bookings", detail: bookingsErr.message }, { status: 500 });
}

  if (waitlistErr) {
    return NextResponse.json(
      { error: "Failed to load waitlist", detail: waitlistErr.message },
      { status: 500 },
    );
  }

const bookingRows: BookingRow[] = (bookings ?? []).map((b: any) => ({
  id: Number(b.id),
  status: b.status ?? null,
  room_id: Number(b.room_id),
  booked_for_user_id: b.booked_for_user_id ?? null,
  start_time: String(b.start_time),
  end_time: String(b.end_time),
  room: normalizeRoom(b.room),
}));

const waitlistRows: WaitlistRow[] = (waitlist ?? []).map((w: any) => ({
  id: Number(w.id),
  status: w.status ?? null,
  room_id: Number(w.room_id),
  user_id: w.user_id ?? null,
  start_time: String(w.start_time),
  end_time: String(w.end_time),
  room: normalizeRoom(w.room),
}));

  const bookingsByStatus = countByStatus(bookingRows);
  const waitlistByStatus = countByStatus(waitlistRows);

  const bookingTotal = bookingRows.length;
  const waitlistTotal = waitlistRows.length;

  const totalHours = bookingRows.reduce(
    (sum, b) => sum + durationHours(b.start_time, b.end_time),
    0,
  );

  const uniqueUsers = new Set(
    bookingRows
      .map((b) => b.booked_for_user_id)
      .filter((v): v is string => Boolean(v)),
  ).size;

  const cancelledCount = bookingsByStatus.cancelled ?? 0;
  const noShowCount = bookingsByStatus.no_show ?? 0;
  const fulfilledWaitlistCount = waitlistByStatus.fulfilled ?? 0;

  const averageDurationHours = bookingTotal > 0 ? totalHours / bookingTotal : 0;
  const cancellationRate = bookingTotal > 0 ? cancelledCount / bookingTotal : 0;
  const noShowRate = bookingTotal > 0 ? noShowCount / bookingTotal : 0;
  const conversionRate = waitlistTotal > 0 ? fulfilledWaitlistCount / waitlistTotal : 0;

  const roomCountMap = new Map<
    number,
    {
      roomId: number;
      roomName: string;
      building: string | null;
      department: string | null;
      bookingCount: number;
      bookedHours: number;
    }
  >();

  const userAggMap = new Map<
    string,
    {
      userId: string;
      bookingCount: number;
      bookedHours: number;
    }
  >();

  const deptAggMap = new Map<
    string,
    {
      department: string;
      bookingCount: number;
      bookedHours: number;
    }
  >();

  const weekdayMap = new Map<string, number>();
  const hourMap = new Map<string, number>();

  for (const b of bookingRows) {
    const hours = durationHours(b.start_time, b.end_time);

    if (b.room) {
      const departmentName = normalizeDepartmentName(b.room);
      const roomExisting = roomCountMap.get(b.room_id);
      if (roomExisting) {
        roomExisting.bookingCount += 1;
        roomExisting.bookedHours += hours;
      } else {
        roomCountMap.set(b.room_id, {
          roomId: b.room.id,
          roomName: b.room.name,
          building: b.room.building,
          department: departmentName,
          bookingCount: 1,
          bookedHours: hours,
        });
      }

      const deptExisting = deptAggMap.get(departmentName);
      if (deptExisting) {
        deptExisting.bookingCount += 1;
        deptExisting.bookedHours += hours;
      } else {
        deptAggMap.set(departmentName, {
          department: departmentName,
          bookingCount: 1,
          bookedHours: hours,
        });
      }
    }

    if (b.booked_for_user_id) {
      const userExisting = userAggMap.get(b.booked_for_user_id);
      if (userExisting) {
        userExisting.bookingCount += 1;
        userExisting.bookedHours += hours;
      } else {
        userAggMap.set(b.booked_for_user_id, {
          userId: b.booked_for_user_id,
          bookingCount: 1,
          bookedHours: hours,
        });
      }
    }

    const day = ttWeekday(b.start_time);
    weekdayMap.set(day, (weekdayMap.get(day) ?? 0) + 1);

    const hour = ttHourLabel(b.start_time);
    hourMap.set(hour, (hourMap.get(hour) ?? 0) + 1);
  }

  const topRoomsBase = Array.from(roomCountMap.values());

  const topRoomsByCount = topRoomsBase
    .slice()
    .sort((a, b) => b.bookingCount - a.bookingCount)
    .slice(0, 8)
    .map((r) => ({
      roomId: r.roomId,
      roomName: r.roomName,
      building: r.building,
      department: r.department,
      bookingCount: r.bookingCount,
    }));

  const topRoomsByHours = topRoomsBase
    .slice()
    .sort((a, b) => b.bookedHours - a.bookedHours)
    .slice(0, 8)
    .map((r) => ({
      roomId: r.roomId,
      roomName: r.roomName,
      building: r.building,
      department: r.department,
      bookedHours: round2(r.bookedHours),
    }));

  const aggregatedUsers = Array.from(userAggMap.values()).sort(
    (a, b) => b.bookingCount - a.bookingCount || b.bookedHours - a.bookedHours,
  );

  const topUserIds = aggregatedUsers.slice(0, 8).map((u) => u.userId);

  let profileMap = new Map<
    string,
    { full_name: string | null; email: string; faculty: string | null }
  >();

  if (topUserIds.length > 0) {
    const { data: profiles } = await admin
      .from("profiles")
      .select("id, full_name, email, faculty")
      .in("id", topUserIds);

    profileMap = new Map(
      (profiles ?? []).map((p: any) => [
        p.id,
        {
          full_name: p.full_name ?? null,
          email: p.email,
          faculty: p.faculty ?? null,
        },
      ]),
    );
  }

  const topUsers = aggregatedUsers.slice(0, 8).map((u) => {
    const profile = profileMap.get(u.userId);
    return {
      userId: u.userId,
      fullName: profile?.full_name ?? "Unknown User",
      email: profile?.email ?? "",
      faculty: profile?.faculty ?? null,
      bookingCount: u.bookingCount,
      bookedHours: round2(u.bookedHours),
    };
  });

  const usageByDepartment = Array.from(deptAggMap.values())
    .sort((a, b) => b.bookingCount - a.bookingCount)
    .map((d) => ({
      department: d.department,
      bookingCount: d.bookingCount,
      bookedHours: round2(d.bookedHours),
    }));

  const weekdayOrder = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const busiestDays = weekdayOrder
    .map((day) => ({
      day,
      bookingCount: weekdayMap.get(day) ?? 0,
    }))
    .filter((d) => d.bookingCount > 0);

  const busiestHours = Array.from(hourMap.entries())
    .map(([hour, bookingCount]) => ({ hour, bookingCount }))
    .sort((a, b) => b.bookingCount - a.bookingCount);

  const dayDiff = (new Date(to).getTime() - new Date(from).getTime()) / 864e5 + 1;

  const normalizeWeekday = (value: unknown): string | null => {
    if (typeof value === "number" && Number.isInteger(value)) {
      const numericMap = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
      return numericMap[((value % 7) + 7) % 7] ?? null;
    }

    if (typeof value !== "string") return null;

    const normalized = value.trim().toLowerCase();
    const stringMap: Record<string, string> = {
      sun: "Sun",
      sunday: "Sun",
      mon: "Mon",
      monday: "Mon",
      tue: "Tue",
      tues: "Tue",
      tuesday: "Tue",
      wed: "Wed",
      weds: "Wed",
      wednesday: "Wed",
      thu: "Thu",
      thur: "Thu",
      thurs: "Thu",
      thursday: "Thu",
      fri: "Fri",
      friday: "Fri",
      sat: "Sat",
      saturday: "Sat",
    };

    return stringMap[normalized] ?? null;
  };

  const parseTimeToHours = (value: unknown): number | null => {
    if (typeof value !== "string") return null;

    const trimmed = value.trim();
    const amPmMatch = trimmed.match(/^(\d{1,2})(?::(\d{2}))?\s*(AM|PM)$/i);
    if (amPmMatch) {
      let hours = parseInt(amPmMatch[1], 10);
      const minutes = parseInt(amPmMatch[2] ?? "0", 10);
      const meridiem = amPmMatch[3].toUpperCase();

      if (meridiem === "PM" && hours !== 12) hours += 12;
      if (meridiem === "AM" && hours === 12) hours = 0;

      return hours + minutes / 60;
    }

    const twentyFourHourMatch = trimmed.match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
    if (twentyFourHourMatch) {
      const hours = parseInt(twentyFourHourMatch[1], 10);
      const minutes = parseInt(twentyFourHourMatch[2], 10);
      return hours + minutes / 60;
    }

    return null;
  };

  const scopedRoomIds = allowedRoomIds
    ? allowedRoomIds
    : ((await admin.from("rooms").select("id")).data ?? []).map((room) => room.id as number);

  const roomCountForMath = scopedRoomIds.length || 1;

  const openingHoursRows = scopedRoomIds.length > 0
    ? ((await admin.from("room_opening_hours").select("*").in("room_id", scopedRoomIds)).data ?? [])
    : [];

  const openingHoursByRoomAndDay = new Map<string, any>();
  for (const row of openingHoursRows) {
    const roomId = typeof row?.room_id === "number" ? row.room_id : Number(row?.room_id);
    const weekday = normalizeWeekday(row?.day_of_week ?? row?.weekday ?? row?.day);

    if (!Number.isFinite(roomId) || !weekday) continue;

    openingHoursByRoomAndDay.set(`${roomId}-${weekday}`, row);
  }

  let totalAvailableHours = 0;
  const rangeStart = new Date(from);
  const rangeEnd = new Date(to);

  for (let current = new Date(rangeStart); current <= rangeEnd; current.setDate(current.getDate() + 1)) {
    const weekday = weekdayOrder[(current.getDay() + 6) % 7];

    for (const roomId of scopedRoomIds) {
      const openingHours = openingHoursByRoomAndDay.get(`${roomId}-${weekday}`);

      if (!openingHours) {
        totalAvailableHours += 12;
        continue;
      }

      const isClosed = Boolean(openingHours.is_closed ?? openingHours.closed);
      if (isClosed) continue;

      const openTime = parseTimeToHours(
        openingHours.open_time ?? openingHours.opening_time ?? openingHours.opens_at
      );
      const closeTime = parseTimeToHours(
        openingHours.close_time ?? openingHours.closing_time ?? openingHours.closes_at
      );

      if (openTime === null || closeTime === null) {
        totalAvailableHours += 12;
        continue;
      }

      const duration = closeTime >= openTime
        ? closeTime - openTime
        : 24 - openTime + closeTime;

      totalAvailableHours += Math.max(duration, 0);
    }
  }

  const utilizationRate = totalAvailableHours > 0 ? (totalHours / totalAvailableHours) : 0;

  return NextResponse.json({
    range: { from, to },
    scope: {
      mode: role === "super_admin" ? "super_admin" : "admin",
      allowedRoomCount: allowedRoomIds === null ? null : allowedRoomIds.length,
    },
    bookings: {
      total: bookingTotal,
      byStatus: bookingsByStatus,
      totalHours: round2(totalHours),
      averageDurationHours: round2(averageDurationHours),
      uniqueUsers,
      cancellationRate: round2(cancellationRate),
      noShowRate: round2(noShowRate),
    },
    utilization: {
      ...EMPTY_UTILIZATION,
      overallPercentage: round2(utilizationRate),
      totalAvailableHours: Math.round(totalAvailableHours),
    },
    compliance: {
      ...EMPTY_COMPLIANCE,
      activeBans: banRes.count ?? 0,
    },
    waitlist: {
      total: waitlistTotal,
      byStatus: waitlistByStatus,
      conversionRate: round2(conversionRate),
    },
    topRoomsByCount,
    topRoomsByHours,
    topUsers,
    usageByDepartment,
    busiestDays,
    busiestHours,
  });
}