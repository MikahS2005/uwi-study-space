// src/app/(app)/bookings/page.tsx
// src/app/(app)/bookings/page.tsx
import { redirect } from "next/navigation";
import { createSupabaseServer } from "@/lib/supabase/server";
import BookingsFilterBar from "@/components/bookings/BookingsFilterBar";
import MyBookingsList from "@/components/bookings/MyBookingsList";
import MyBookingsCalendar from "@/components/bookings/MyBookingsCalendar";
import MyBookingsMonthCalendar from "@/components/bookings/MyBookingsMonthCalendar";
import MyOffersPanel from "@/components/bookings/MyOffersPanel";


import {
  getMyBookingsPaged,
  getMyBookingsForCalendar,
  getMyBookingCounts,
  type WhenFilter,
  type StatusFilter,
} from "@/lib/db/myBookings";

type ViewMode = "list" | "calendar";

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

  const view: ViewMode =
    typeof sp.view === "string" && (["list", "calendar"] as const).includes(sp.view as any)
      ? (sp.view as ViewMode)
      : "list";

  const page =
    typeof sp.page === "string" && /^\d+$/.test(sp.page) ? Math.max(1, Number(sp.page)) : 1;

  // Count badges should match the current "when" filter
  const counts = await getMyBookingCounts(user.id, when);
  // inside view === "calendar" branch
const initialMonth = new Date().toISOString().slice(0, 7); // "YYYY-MM" stable on server

  if (view === "calendar") {
    const calRows = await getMyBookingsForCalendar(user.id, 30);

    return (
      <div>
        <h1 className="text-2xl font-semibold">My Bookings</h1>
        <p className="mt-1 text-sm text-gray-600">View and cancel your bookings.</p>

        <BookingsFilterBar counts={counts} />

        <MyBookingsMonthCalendar initialMonth={initialMonth} bookings={calRows as any} />
      </div>
    );
  }

  const { rows, total, pageSize } = await getMyBookingsPaged(user.id, {
    when,
    status,
    page,
    pageSize: 10,
  });

  return (
    <div>
      <h1 className="text-2xl font-semibold">My Bookings</h1>
      <p className="mt-1 text-sm text-gray-600">View and cancel your bookings.</p>

      <BookingsFilterBar counts={counts} />
      <MyOffersPanel />
      <MyBookingsList
        bookings={rows as any}
        pagination={{ total, page, pageSize }}
      />
    </div>
  );
}
