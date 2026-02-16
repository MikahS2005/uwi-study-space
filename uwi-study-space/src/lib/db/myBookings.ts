// src/lib/db/myBookings.ts
import { createSupabaseServer } from "@/lib/supabase/server";

export type WhenFilter = "upcoming" | "past" | "all";
export type StatusFilter = "all" | "active" | "cancelled" | "completed" | "no_show";

type GetBookingsOpts = {
  when?: WhenFilter;
  status?: StatusFilter;
  page?: number;      // 1-based
  pageSize?: number;  // e.g. 10
};

function applyWhenFilter(q: any, when: WhenFilter) {
  const nowIso = new Date().toISOString();
  if (when === "upcoming") return q.gte("end_time", nowIso);
  if (when === "past") return q.lt("end_time", nowIso);
  return q;
}

function applyStatusFilter(q: any, status: StatusFilter) {
  if (status === "all") return q;
  return q.eq("status", status);
}

/**
 * Paged bookings for list view.
 * Returns rows + total count (for pagination).
 */
export async function getMyBookingsPaged(userId: string, opts: GetBookingsOpts) {
  const supabase = await createSupabaseServer();

  const when = opts.when ?? "upcoming";
  const status = opts.status ?? "all";
  const page = Math.max(1, Number(opts.page ?? 1));
  const pageSize = Math.min(50, Math.max(5, Number(opts.pageSize ?? 10)));

  let q = supabase
    .from("bookings")
    .select(
      `
      id,
      room_id,
      start_time,
      end_time,
      status,
      purpose,
      created_at,
      rooms ( id, name, building, floor )
    `,
      { count: "exact" },
    )
    .eq("booked_for_user_id", userId);

  q = applyWhenFilter(q, when);
  q = applyStatusFilter(q, status);

  // Order: upcoming first; past also ok
  q = q.order("start_time", { ascending: true });

  // Pagination range is 0-based inclusive indices
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  const { data, error, count } = await q.range(from, to);

  if (error) return { rows: [], total: 0, page, pageSize };

  return {
    rows: data ?? [],
    total: count ?? 0,
    page,
    pageSize,
  };
}

/**
 * Calendar view fetch (no pagination):
 * pulls bookings within a window (e.g. next 30 days) so the calendar is meaningful.
 */
export async function getMyBookingsForCalendar(userId: string, daysAhead = 30) {
  const supabase = await createSupabaseServer();

  const now = new Date();
  const end = new Date(now.getTime() + daysAhead * 24 * 60 * 60 * 1000);

  const { data, error } = await supabase
    .from("bookings")
    .select(
      `
      id,
      room_id,
      start_time,
      end_time,
      status,
      purpose,
      rooms ( id, name, building, floor )
    `,
    )
    .eq("booked_for_user_id", userId)
    .gte("start_time", now.toISOString())
    .lte("start_time", end.toISOString())
    .order("start_time", { ascending: true });

  if (error) return [];
  return data ?? [];
}

/**
 * Count badges (Active/Cancelled/Completed/No-show/Total) respecting the "when" filter.
 * Uses HEAD+count queries (fast enough, simple, no RPC).
 */
export async function getMyBookingCounts(userId: string, when: WhenFilter) {
  const supabase = await createSupabaseServer();

  async function countForStatus(status?: Exclude<StatusFilter, "all">) {
    let q = supabase
      .from("bookings")
      .select("id", { count: "exact", head: true })
      .eq("booked_for_user_id", userId);

    q = applyWhenFilter(q, when);
    if (status) q = q.eq("status", status);

    const { count } = await q;
    return count ?? 0;
  }

  const [total, active, cancelled, completed, no_show] = await Promise.all([
    countForStatus(undefined),
    countForStatus("active"),
    countForStatus("cancelled"),
    countForStatus("completed"),
    countForStatus("no_show"),
  ]);

  return { total, active, cancelled, completed, no_show };
}
