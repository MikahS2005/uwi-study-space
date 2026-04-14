// src/app/(app)/bookings/page.tsx
import { redirect } from "next/navigation";
import { createSupabaseServer } from "@/lib/supabase/server";
import BookingsFilterBar from "@/components/bookings/BookingsFilterBar";
import MyBookingsList from "@/components/bookings/MyBookingsList";

import {
  getMyBookingsPaged,
  getMyBookingCounts,
  type WhenFilter,
  type StatusFilter,
} from "@/lib/db/myBookings";
import { FiCalendar } from "react-icons/fi";

export default async function MyBookingsPage(props: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const supabase = await createSupabaseServer();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const sp = await props.searchParams;

  const when: WhenFilter =
    typeof sp.when === "string" && (["upcoming", "past", "all"] as const).includes(sp.when as any)
      ? (sp.when as WhenFilter)
      : "upcoming";

  const status: StatusFilter =
    typeof sp.status === "string" &&
    (["all", "active", "cancelled", "completed", "no_show"] as const).includes(sp.status as any)
      ? (sp.status as StatusFilter)
      : "all";

  const page =
    typeof sp.page === "string" && /^\d+$/.test(sp.page) ? Math.max(1, Number(sp.page)) : 1;

  const counts = await getMyBookingCounts(user.id, when);

  // ── shared header ─────────────────────────────────────────────────────────
  const PageHeader = (
    <div className="mb-6 space-y-3">
      <div className="overflow-hidden rounded-2xl border border-[#E5E7EB] bg-white shadow-sm">
        <div className="px-6 py-5">
          <div>
            <p className="mb-1 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.12em] text-[#003595]/70">
              Alma Jordan Library
            </p>
            <h1 className="text-4xl font-extrabold tracking-tight text-[#1F2937]">My Bookings</h1>
            <p className="mt-1.5 flex items-center gap-2 text-sm font-medium text-[#4B5563]">
              Manage your room reservations and upcoming sessions.
            </p>
          </div>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="flex min-h-[116px] flex-col justify-between rounded-[28px] border border-[#C7D5E6] bg-[#EAF2FC] px-6 py-4">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#2F5AA7]">Total Bookings</p>
          <p className="mt-3 font-serif text-5xl font-bold leading-none text-[#0B2A5B]">{counts.total}</p>
        </div>
        <div className="flex min-h-[116px] flex-col justify-between rounded-[28px] border border-[#D8E0EA] bg-white px-6 py-4">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#7C8CA0]">Active</p>
          <p className="mt-3 font-serif text-5xl font-bold leading-none text-[#0B2A5B]">{counts.active}</p>
        </div>
        <div className="flex min-h-[116px] flex-col justify-between rounded-[28px] border border-[#D8E0EA] bg-white px-6 py-4">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#7C8CA0]">Cancelled</p>
          <p className="mt-3 font-serif text-5xl font-bold leading-none text-[#0B2A5B]">{counts.cancelled}</p>
        </div>
        <div className="flex min-h-[116px] flex-col justify-between rounded-[28px] border border-[#D8E0EA] bg-white px-6 py-4">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#7C8CA0]">Completed</p>
          <p className="mt-3 font-serif text-5xl font-bold leading-none text-[#0B2A5B]">{counts.completed}</p>
        </div>
      </div>

    </div>
  );

  // ── list view ─────────────────────────────────────────────────────────────
  const { rows, total, pageSize } = await getMyBookingsPaged(user.id, {
    when,
    status,
    page,
    pageSize: 10,
  });

  return (
    <div className="min-h-screen bg-[#F9FAFB] px-4 py-8 font-sans">
      <div className="mx-auto max-w-7xl">
        {PageHeader}

        {/* Filter bar */}
        <BookingsFilterBar counts={counts} />

        <div className="mt-6 min-w-0 rounded-2xl border border-[#E5E7EB] bg-white p-4 shadow-sm md:p-5">
          <div className="mb-3 flex items-center gap-2">
            <span className="h-4 w-0.5 rounded-full bg-[#003595]" />
            <h2 className="text-xs font-bold uppercase tracking-widest text-[#003595]">
              {when === "past" ? "Past Bookings" : when === "all" ? "All Bookings" : "Upcoming Bookings"}
            </h2>
          </div>
          <MyBookingsList
            bookings={rows as any}
            pagination={{ total, page, pageSize }}
          />
        </div>
      </div>
    </div>
  );
}
