"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

type Mode = "admin" | "super_admin";

type ReportResponse = {
  range: { from: string; to: string };
  scope: { mode: Mode; allowedRoomCount: number | null };

  bookings: {
    total: number;
    byStatus: Record<string, number>;
    totalHours: number;
    averageDurationHours: number;
    uniqueUsers: number;
    cancellationRate: number;
    noShowRate: number;
  };

  waitlist: {
    total: number;
    byStatus: Record<string, number>;
    conversionRate: number;
  };

  topRoomsByCount: Array<{
    roomId: number;
    roomName: string;
    building: string | null;
    department: string | null;
    bookingCount: number;
  }>;

  topRoomsByHours: Array<{
    roomId: number;
    roomName: string;
    building: string | null;
    department: string | null;
    bookedHours: number;
  }>;

  topUsers: Array<{
    userId: string;
    fullName: string;
    email: string;
    faculty: string | null;
    bookingCount: number;
    bookedHours: number;
  }>;

  usageByDepartment: Array<{
    department: string;
    bookingCount: number;
    bookedHours: number;
  }>;

  busiestDays: Array<{
    day: string;
    bookingCount: number;
  }>;

  busiestHours: Array<{
    hour: string;
    bookingCount: number;
  }>;
};

type ChartDatum = {
  name: string;
  value: number;
};

type StatusComparisonDatum = {
  status: string;
  bookings: number;
  waitlist: number;
};

const CAMPUS_TZ = "America/Port_of_Spain";
const CHART_COLORS = [
  "#2563eb",
  "#16a34a",
  "#f59e0b",
  "#dc2626",
  "#7c3aed",
  "#0891b2",
  "#ea580c",
  "#4f46e5",
];

function pct(value: number) {
  return `${(value * 100).toFixed(1)}%`;
}

function hours(value: number) {
  return `${value.toFixed(1)}h`;
}

function ymdTodayTT() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: CAMPUS_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());

  const yyyy = parts.find((p) => p.type === "year")?.value ?? "1970";
  const mm = parts.find((p) => p.type === "month")?.value ?? "01";
  const dd = parts.find((p) => p.type === "day")?.value ?? "01";
  return `${yyyy}-${mm}-${dd}`;
}

function sectionCardClass() {
  return "rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200";
}

function chartCardClass() {
  return "rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-200";
}

function titleCaseStatus(value: string) {
  return value
    .replaceAll("_", " ")
    .replaceAll("-", " ")
    .replace(/\b\w/g, (m) => m.toUpperCase());
}

function toChartData(byStatus: Record<string, number>): ChartDatum[] {
  return Object.entries(byStatus)
    .map(([name, value]) => ({
      name: titleCaseStatus(name),
      value,
    }))
    .sort((a, b) => b.value - a.value);
}

function toComparisonData(
  bookingsByStatus: Record<string, number>,
  waitlistByStatus: Record<string, number>
): StatusComparisonDatum[] {
  const allStatuses = Array.from(
    new Set([...Object.keys(bookingsByStatus), ...Object.keys(waitlistByStatus)])
  );

  return allStatuses.map((status) => ({
    status: titleCaseStatus(status),
    bookings: bookingsByStatus[status] ?? 0,
    waitlist: waitlistByStatus[status] ?? 0,
  }));
}

function EmptyChart({ label }: { label: string }) {
  return (
    <div className="flex h-[280px] items-center justify-center rounded-xl border border-dashed border-slate-300 bg-white text-sm text-slate-500">
      No {label.toLowerCase()} data in this range
    </div>
  );
}

function pieLabel({ name, percent }: { name?: string; percent?: number }) {
  const p = typeof percent === "number" ? percent : 0;
  return `${name ?? ""} ${(p * 100).toFixed(0)}%`;
}

export default function ReportsClient({ mode }: { mode: Mode }) {
  const today = useMemo(() => ymdTodayTT(), []);
  const [from, setFrom] = useState(today);
  const [to, setTo] = useState(today);

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [data, setData] = useState<ReportResponse | null>(null);

  const fetchReports = useCallback(async () => {
    setLoading(true);
    setErr("");

    const sp = new URLSearchParams();
    sp.set("from", from);
    sp.set("to", to);

    try {
      const res = await fetch(`/api/admin/reports?${sp.toString()}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error ?? "Failed to load reports");
      setData(json as ReportResponse);
    } catch (e: any) {
      setErr(e?.message ?? "Failed to load reports");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [from, to]);

  useEffect(() => {
    fetchReports();
  }, [fetchReports]);

  const title = mode === "super_admin" ? "Reports (Super Admin)" : "Reports";

  const bookingStatusData = useMemo(
    () => toChartData(data?.bookings.byStatus ?? {}),
    [data]
  );

  const waitlistStatusData = useMemo(
    () => toChartData(data?.waitlist.byStatus ?? {}),
    [data]
  );

  const totalsData = useMemo(
    () =>
      data
        ? [
            { name: "Bookings", value: data.bookings.total },
            { name: "Waitlist", value: data.waitlist.total },
          ]
        : [],
    [data]
  );

  const comparisonData = useMemo(
    () =>
      data
        ? toComparisonData(data.bookings.byStatus, data.waitlist.byStatus)
        : [],
    [data]
  );

  const topRoomsByCountData = useMemo(() => data?.topRoomsByCount ?? [], [data]);
  const topRoomsByHoursData = useMemo(() => data?.topRoomsByHours ?? [], [data]);
  const topUsersData = useMemo(() => data?.topUsers ?? [], [data]);
  const usageByDepartmentData = useMemo(() => data?.usageByDepartment ?? [], [data]);
  const busiestDaysData = useMemo(() => data?.busiestDays ?? [], [data]);
  const busiestHoursData = useMemo(() => data?.busiestHours ?? [], [data]);

  return (
    <div className="space-y-4">
      <div className={sectionCardClass()}>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-lg font-semibold text-slate-900">{title}</h1>
            <p className="text-sm text-slate-600">
              Visual summary for bookings and waitlist activity across the selected report window.
            </p>
          </div>

          <div className="flex flex-wrap items-end gap-2">
            <div>
              <label className="block text-xs font-medium text-slate-600">From</label>
              <input
                type="date"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
                className="mt-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none ring-blue-200 focus:ring-2"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-600">To</label>
              <input
                type="date"
                value={to}
                onChange={(e) => setTo(e.target.value)}
                className="mt-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none ring-blue-200 focus:ring-2"
              />
            </div>

            <button
              onClick={fetchReports}
              className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
            >
              Apply
            </button>
          </div>
        </div>

        {err ? (
          <div className="mt-4 rounded-xl bg-rose-50 p-4 text-sm text-rose-700 ring-1 ring-rose-200">
            {err}
          </div>
        ) : loading ? (
          <div className="mt-4 rounded-xl bg-slate-50 p-4 text-sm text-slate-600 ring-1 ring-slate-200">
            Loading…
          </div>
        ) : data ? (
          <div className="mt-5 space-y-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-6">
              <div className={chartCardClass()}>
                <div className="text-xs font-medium text-slate-600">Bookings (Total)</div>
                <div className="mt-1 text-3xl font-semibold text-slate-900">{data.bookings.total}</div>
                <div className="mt-2 text-xs text-slate-500">
                  Scope rooms: {data.scope.allowedRoomCount === null ? "All" : data.scope.allowedRoomCount}
                </div>
              </div>

              <div className={chartCardClass()}>
                <div className="text-xs font-medium text-slate-600">Waitlist (Total)</div>
                <div className="mt-1 text-3xl font-semibold text-slate-900">{data.waitlist.total}</div>
                <div className="mt-2 text-xs text-slate-500">
                  Range: {data.range.from} → {data.range.to}
                </div>
              </div>

              <div className={chartCardClass()}>
                <div className="text-xs font-medium text-slate-600">Booked Hours</div>
                <div className="mt-1 text-3xl font-semibold text-slate-900">
                  {hours(data.bookings.totalHours)}
                </div>
                <div className="mt-2 text-xs text-slate-500">Total duration in range</div>
              </div>

              <div className={chartCardClass()}>
                <div className="text-xs font-medium text-slate-600">Unique Users</div>
                <div className="mt-1 text-3xl font-semibold text-slate-900">
                  {data.bookings.uniqueUsers}
                </div>
                <div className="mt-2 text-xs text-slate-500">Distinct bookers in range</div>
              </div>

              <div className={chartCardClass()}>
                <div className="text-xs font-medium text-slate-600">Cancellation Rate</div>
                <div className="mt-1 text-3xl font-semibold text-slate-900">
                  {pct(data.bookings.cancellationRate)}
                </div>
                <div className="mt-2 text-xs text-slate-500">Cancelled / total bookings</div>
              </div>

              <div className={chartCardClass()}>
                <div className="text-xs font-medium text-slate-600">No-Show Rate</div>
                <div className="mt-1 text-3xl font-semibold text-slate-900">
                  {pct(data.bookings.noShowRate)}
                </div>
                <div className="mt-2 text-xs text-slate-500">No-shows / total bookings</div>
              </div>

              <div className={chartCardClass()}>
                <div className="text-xs font-medium text-slate-600">Avg Booking Duration</div>
                <div className="mt-1 text-3xl font-semibold text-slate-900">
                  {hours(data.bookings.averageDurationHours)}
                </div>
                <div className="mt-2 text-xs text-slate-500">Average booking length</div>
              </div>

              <div className={chartCardClass()}>
                <div className="text-xs font-medium text-slate-600">Waitlist Conversion</div>
                <div className="mt-1 text-3xl font-semibold text-slate-900">
                  {pct(data.waitlist.conversionRate)}
                </div>
                <div className="mt-2 text-xs text-slate-500">Fulfilled / total waitlist</div>
              </div>

              <div className={chartCardClass()}>
                <div className="text-xs font-medium text-slate-600">Active Bookings</div>
                <div className="mt-1 text-3xl font-semibold text-slate-900">
                  {data.bookings.byStatus.active ?? 0}
                </div>
                <div className="mt-2 text-xs text-slate-500">Current active count in range</div>
              </div>

              <div className={chartCardClass()}>
                <div className="text-xs font-medium text-slate-600">Pending Waitlist</div>
                <div className="mt-1 text-3xl font-semibold text-slate-900">
                  {(data.waitlist.byStatus.waiting ?? 0) + (data.waitlist.byStatus.offered ?? 0)}
                </div>
                <div className="mt-2 text-xs text-slate-500">Waiting + offered entries</div>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
              <div className={chartCardClass()}>
                <div className="mb-3 text-sm font-medium text-slate-700">Bookings by Status</div>
                {bookingStatusData.length === 0 ? (
                  <EmptyChart label="Bookings" />
                ) : (
                  <div className="h-[280px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={bookingStatusData}
                          dataKey="value"
                          nameKey="name"
                          cx="50%"
                          cy="50%"
                          outerRadius={90}
                          innerRadius={45}
                          paddingAngle={2}
                          label={pieLabel}
                        >
                          {bookingStatusData.map((entry, index) => (
                            <Cell
                              key={`booking-cell-${entry.name}`}
                              fill={CHART_COLORS[index % CHART_COLORS.length]}
                            />
                          ))}
                        </Pie>
                        <Tooltip />
                        <Legend />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </div>

              <div className={chartCardClass()}>
                <div className="mb-3 text-sm font-medium text-slate-700">Waitlist by Status</div>
                {waitlistStatusData.length === 0 ? (
                  <EmptyChart label="Waitlist" />
                ) : (
                  <div className="h-[280px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={waitlistStatusData}
                          dataKey="value"
                          nameKey="name"
                          cx="50%"
                          cy="50%"
                          outerRadius={90}
                          innerRadius={45}
                          paddingAngle={2}
                          label={pieLabel}
                        >
                          {waitlistStatusData.map((entry, index) => (
                            <Cell
                              key={`waitlist-cell-${entry.name}`}
                              fill={CHART_COLORS[index % CHART_COLORS.length]}
                            />
                          ))}
                        </Pie>
                        <Tooltip />
                        <Legend />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
              <div className={chartCardClass()}>
                <div className="mb-3 text-sm font-medium text-slate-700">Bookings vs Waitlist Totals</div>
                <div className="h-[280px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={totalsData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" />
                      <YAxis allowDecimals={false} />
                      <Tooltip />
                      <Bar dataKey="value" radius={[10, 10, 0, 0]}>
                        {totalsData.map((entry, index) => (
                          <Cell
                            key={`totals-cell-${entry.name}`}
                            fill={CHART_COLORS[index % CHART_COLORS.length]}
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className={chartCardClass()}>
                <div className="mb-3 text-sm font-medium text-slate-700">Status Comparison</div>
                {comparisonData.length === 0 ? (
                  <EmptyChart label="Status comparison" />
                ) : (
                  <div className="h-[280px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={comparisonData}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="status" />
                        <YAxis allowDecimals={false} />
                        <Tooltip />
                        <Legend />
                        <Bar dataKey="bookings" name="Bookings" fill="#2563eb" radius={[8, 8, 0, 0]} />
                        <Bar dataKey="waitlist" name="Waitlist" fill="#16a34a" radius={[8, 8, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </div>
            </div>

            <div className={chartCardClass()}>
              <div className="mb-3 text-sm font-medium text-slate-700">Quick Breakdown</div>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
                {Object.entries(data.bookings.byStatus).map(([k, v], index) => (
                  <div key={`booking-status-${k}`} className="rounded-xl bg-white px-3 py-3 ring-1 ring-slate-200">
                    <div
                      className="mb-2 h-2 w-full rounded-full"
                      style={{ backgroundColor: CHART_COLORS[index % CHART_COLORS.length] }}
                    />
                    <div className="text-xs text-slate-500">Booking · {titleCaseStatus(k)}</div>
                    <div className="text-lg font-semibold text-slate-900">{v}</div>
                  </div>
                ))}

                {Object.entries(data.waitlist.byStatus).map(([k, v], index) => (
                  <div key={`waitlist-status-${k}`} className="rounded-xl bg-white px-3 py-3 ring-1 ring-slate-200">
                    <div
                      className="mb-2 h-2 w-full rounded-full"
                      style={{
                        backgroundColor:
                          CHART_COLORS[(index + data.bookings.byStatus.length) % CHART_COLORS.length],
                      }}
                    />
                    <div className="text-xs text-slate-500">Waitlist · {titleCaseStatus(k)}</div>
                    <div className="text-lg font-semibold text-slate-900">{v}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
              <div className={chartCardClass()}>
                <div className="mb-3 text-sm font-medium text-slate-700">Top Booked Rooms (Count)</div>
                {topRoomsByCountData.length === 0 ? (
                  <EmptyChart label="Top rooms" />
                ) : (
                  <div className="h-[320px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={topRoomsByCountData} layout="vertical" margin={{ left: 30 }}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis type="number" allowDecimals={false} />
                        <YAxis type="category" dataKey="roomName" width={120} />
                        <Tooltip />
                        <Bar dataKey="bookingCount" name="Bookings" fill="#2563eb" radius={[0, 8, 8, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </div>

              <div className={chartCardClass()}>
                <div className="mb-3 text-sm font-medium text-slate-700">Top Booked Rooms (Hours)</div>
                {topRoomsByHoursData.length === 0 ? (
                  <EmptyChart label="Top rooms by hours" />
                ) : (
                  <div className="h-[320px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={topRoomsByHoursData} layout="vertical" margin={{ left: 30 }}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis type="number" />
                        <YAxis type="category" dataKey="roomName" width={120} />
                        <Tooltip />
                        <Bar dataKey="bookedHours" name="Hours" fill="#16a34a" radius={[0, 8, 8, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
              <div className={chartCardClass()}>
                <div className="mb-3 text-sm font-medium text-slate-700">Top Users / Repeat Bookers</div>
                {topUsersData.length === 0 ? (
                  <EmptyChart label="Top users" />
                ) : (
                  <div className="h-[320px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={topUsersData} layout="vertical" margin={{ left: 30 }}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis type="number" allowDecimals={false} />
                        <YAxis type="category" dataKey="fullName" width={140} />
                        <Tooltip />
                        <Legend />
                        <Bar dataKey="bookingCount" name="Bookings" fill="#7c3aed" radius={[0, 8, 8, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </div>

              <div className={chartCardClass()}>
                <div className="mb-3 text-sm font-medium text-slate-700">Usage by Department</div>
                {usageByDepartmentData.length === 0 ? (
                  <EmptyChart label="Department usage" />
                ) : (
                  <div className="h-[320px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={usageByDepartmentData}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="department" />
                        <YAxis allowDecimals={false} />
                        <Tooltip />
                        <Legend />
                        <Bar dataKey="bookingCount" name="Bookings" fill="#2563eb" radius={[8, 8, 0, 0]} />
                        <Bar dataKey="bookedHours" name="Hours" fill="#16a34a" radius={[8, 8, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
              <div className={chartCardClass()}>
                <div className="mb-3 text-sm font-medium text-slate-700">Busiest Days</div>
                {busiestDaysData.length === 0 ? (
                  <EmptyChart label="Busiest days" />
                ) : (
                  <div className="h-[300px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={busiestDaysData}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="day" />
                        <YAxis allowDecimals={false} />
                        <Tooltip />
                        <Bar dataKey="bookingCount" name="Bookings" fill="#0891b2" radius={[8, 8, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </div>

              <div className={chartCardClass()}>
                <div className="mb-3 text-sm font-medium text-slate-700">Busiest Hours</div>
                {busiestHoursData.length === 0 ? (
                  <EmptyChart label="Busiest hours" />
                ) : (
                  <div className="h-[300px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={busiestHoursData}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="hour" />
                        <YAxis allowDecimals={false} />
                        <Tooltip />
                        <Bar dataKey="bookingCount" name="Bookings" fill="#ea580c" radius={[8, 8, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}