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
import { BookOpen, Clock, Timer, Users, XCircle, AlertTriangle, BarChart3, TrendingUp } from "lucide-react";

const StatCard = ({ label, value, subtext, icon, color, bgColor, borderColor }: any) => (
  <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm relative overflow-hidden group">
    {/* Colored Accent Bar */}
    <div className={`absolute top-0 left-0 w-full h-1 ${borderColor}`} />

    <div className="flex justify-between items-start">
      <div>
        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{label}</p>
        <p className="text-3xl font-black text-slate-900 mt-1">{value}</p>
      </div>
      {/* Icon with soft background */}
      <div className={`p-3 rounded-2xl ${bgColor} ${color}`}>
        {icon}
      </div>
    </div>
    
    <p className="mt-4 text-[11px] text-slate-500 font-medium italic">
      {subtext}
    </p>
  </div>
);
const UWI_COLORS = {
  navy: "#003595",    // Primary / Active
  amber: "#f59e0b",   // Demand / Offered / No-Show
  emerald: "#10b981", // Fulfilled / Success
  rose: "#ef4444",    // Cancelled
  slate: "#64748b"    // Secondary / Axis
};
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
  utilization: {
    overallPercentage: number;
    totalAvailableHours: number;
  };
  compliance: {
    activeBans: number;
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
          <div className="mt-5 space-y-6">
            
           <div className="mt-5 space-y-6">
  {/* PRIMARY KPI GRID */}
  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
    <StatCard 
      label="Bookings (Total)" value={data.bookings.total} icon={<BookOpen size={20}/>}
      subtext={`Scope rooms: ${data.scope.allowedRoomCount ?? 'All'}`}
      borderColor="bg-blue-600" color="text-blue-600" bgColor="bg-blue-50"
    />
    <StatCard 
      label="Waitlist (Total)" value={data.waitlist.total} icon={<Clock size={20}/>}
      subtext={`Range: ${data.range.from} → ${data.range.to}`}
      borderColor="bg-indigo-500" color="text-indigo-600" bgColor="bg-indigo-50"
    />
    <StatCard 
      label="Booked Hours" value={`${data.bookings.totalHours}h`} icon={<Timer size={20}/>}
      subtext="Total duration in range"
      borderColor="bg-emerald-500" color="text-emerald-600" bgColor="bg-emerald-50"
    />
    <StatCard 
      label="Unique Users" value={data.bookings.uniqueUsers} icon={<Users size={20}/>}
      subtext="Distinct bookers in range"
      borderColor="bg-sky-500" color="text-sky-600" bgColor="bg-sky-50"
    />
    <StatCard 
      label="Cancellation Rate" value={pct(data.bookings.cancellationRate)} icon={<XCircle size={20}/>}
      subtext="Cancelled / total bookings"
      borderColor="bg-blue-600" color="text-blue-600" bgColor="bg-blue-50"
    />
    <StatCard 
      label="No-Show Rate" value={pct(data.bookings.noShowRate)} icon={<AlertTriangle size={20}/>}
      subtext="No-shows / total bookings"
      borderColor="bg-sky-500" color="text-sky-600" bgColor="bg-sky-50"
    />
    <StatCard 
      label="Active Bookings" value={data.bookings.byStatus.active ?? 0} icon={<BarChart3 size={20}/>}
      subtext="Current active count in range"
      borderColor="bg-blue-600" color="text-blue-600" bgColor="bg-blue-50"
    />
    <StatCard 
      label="Pending Waitlist" value={(data.waitlist.byStatus.waiting ?? 0) + (data.waitlist.byStatus.offered ?? 0)} icon={<Clock size={20}/>}
      subtext="Waiting + offered entries"
      borderColor="bg-sky-500" color="text-sky-600" bgColor="bg-sky-50"
    />
  </div>
            </div>

            <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
              <div className={chartCardClass()}>
                <div className="mb-6 text-sm font-black text-slate-900 uppercase tracking-widest">Bookings by Status</div>
                {bookingStatusData.length === 0 ? (
                  <EmptyChart label="Bookings" />
                ) : (
                  <div className="h-[280px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={bookingStatusData}
                          innerRadius={75}  /* Thinner look */
                          outerRadius={100}
                          paddingAngle={5}   /* The gap between segments */
                          dataKey="value"
                          stroke="none"
                        >
                          {bookingStatusData.map((entry, index) => (
                            <Cell 
                              key={`cell-${index}`} 
                              fill={
                                entry.name.includes("Active") ? UWI_COLORS.navy : 
                                entry.name.includes("Cancelled") ? UWI_COLORS.rose : 
                                UWI_COLORS.amber
                              } 
                            />
                          ))}
                        </Pie>
                        <Tooltip 
                          contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }} 
                        />
                        <Legend iconType="circle" verticalAlign="bottom" height={36}/>
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </div>

              <div className={chartCardClass()}>
                <div className="mb-6 text-sm font-black text-slate-900 uppercase tracking-widest">Waitlist by Status</div>
                {waitlistStatusData.length === 0 ? (
                  <EmptyChart label="Waitlist" />
                ) : (
                  <div className="h-[280px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={waitlistStatusData}
                          innerRadius={75}
                          outerRadius={100}
                          paddingAngle={5}
                          dataKey="value"
                          stroke="none"
                        >
                          {waitlistStatusData.map((entry: any, index: number) => {
                            let color = UWI_COLORS.slate;
                            if (entry.name.includes("Offered")) color = UWI_COLORS.navy;
                            if (entry.name.includes("Waiting")) color = UWI_COLORS.emerald;
                            if (entry.name.includes("Expired")) color = UWI_COLORS.rose;
                            
                            return <Cell key={`cell-${index}`} fill={color} />;
                          })}
                        </Pie>
                        <Tooltip 
                          contentStyle={{ 
                            borderRadius: '16px', 
                            border: 'none', 
                            boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)',
                            fontSize: '12px',
                            fontWeight: '700',
                            padding: '12px'
                          }}
                          formatter={((value: any, name: any) => {
                            let color = UWI_COLORS.slate;
                            if (name.includes("Offered")) color = UWI_COLORS.navy;
                            if (name.includes("Waiting")) color = UWI_COLORS.emerald;
                            if (name.includes("Expired")) color = UWI_COLORS.rose;

                            return [
                              <span style={{ color }}>{value} students</span>,
                              <span style={{ color }}>{name}</span>
                            ];
                          }) as any}
                        />
                        <Legend 
                          iconType="circle" 
                          verticalAlign="bottom" 
                          height={36}
                          wrapperStyle={{ paddingTop: '20px' }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
              <div className={chartCardClass()}>
                <div className="mb-6 text-sm font-black text-slate-900 uppercase tracking-widest">Bookings vs Waitlist Totals</div>
                <div className="h-[280px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={totalsData} margin={{ top: 10, right: 30, left: 0, bottom: 20 }}>
                      
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={true} horizontal={true} />
                      
  
                      <XAxis 
                        dataKey="name" 
                        axisLine={{ stroke: '#94a3b8' }} 
                        tickLine={{ stroke: '#94a3b8' }} 
                        tick={{ fill: UWI_COLORS.slate, fontSize: 12, fontWeight: 700 }} 
                        dy={10} /* Moves labels down away from the line */
                      />
                      
                    
                      <YAxis 
                        axisLine={{ stroke: '#94a3b8' }} 
                        tickLine={{ stroke: '#94a3b8' }} 
                        tick={{ fill: UWI_COLORS.slate, fontSize: 12 }} 
                        allowDecimals={false} 
                      />

                      <Tooltip 
                        cursor={{ fill: 'rgba(241, 245, 249, 0.5)' }}
                        contentStyle={{ 
                          borderRadius: '16px', 
                          border: 'none', 
                          boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)',
                          fontSize: '12px',
                          fontWeight: '700',
                          padding: '12px'
                        }}
                        formatter={((value: any, name: any, props: any) => {
                          const label = props.payload.name === "Bookings" ? "Total Bookings" : "Waitlist Entries";
                          const barColor = props.payload.name === "Bookings" ? UWI_COLORS.navy : UWI_COLORS.amber;

                          return [
                            <span style={{ color: barColor }}>Total: {value}</span>,
                            <span style={{ color: barColor }}>{label}</span>
                          ];
                        }) as any}
                      />
                      <Bar dataKey="value" radius={[6, 6, 0, 0]} barSize={40}>
                        {totalsData.map((entry: any, index: number) => (
                          <Cell key={`cell-${index}`} fill={entry.name === "Bookings" ? UWI_COLORS.navy : UWI_COLORS.amber} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className={chartCardClass()}>
                <div className="mb-6 text-sm font-black text-slate-900 uppercase tracking-widest">Status Comparison</div>
                {comparisonData.length === 0 ? (
                  <EmptyChart label="Status comparison" />
                ) : (
                  <div className="h-[280px]">
                    <ResponsiveContainer width="100%" height="100%">
                 <BarChart data={comparisonData} margin={{ top: 10, right: 10, left: 0, bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={true} horizontal={true} />
                  <XAxis 
                    dataKey="status" 
                    axisLine={{ stroke: '#94a3b8' }} 
                    tickLine={{ stroke: '#94a3b8' }} 
                    tick={{ fill: UWI_COLORS.slate, fontSize: 11, fontWeight: 700 }} 
                    dy={10}
                  />
                  <YAxis 
                    axisLine={{ stroke: '#94a3b8' }} 
                    tickLine={{ stroke: '#94a3b8' }} 
                    tick={{ fill: UWI_COLORS.slate, fontSize: 11 }} 
                    allowDecimals={false}
                  />
                  <Tooltip 
                    cursor={{ fill: 'rgba(241, 245, 249, 0.5)' }}
                    contentStyle={{ 
                      borderRadius: '16px', 
                      border: 'none', 
                      boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)',
                      fontSize: '12px',
                      fontWeight: '700',
                      padding: '12px'
                    }}
                    formatter={((value: any, name: any) => {
                      const color = name === "bookings" ? UWI_COLORS.navy : UWI_COLORS.emerald;
                      const label = name === "bookings" ? "Confirmed Bookings" : "Waitlist Entries";
                      return [
                        <span style={{ color }}>{value} sessions</span>,
                        <span style={{ color }}>{label}</span>
                      ];
                    }) as any}
                  />
                  <Legend 
                    iconType="circle" 
                    verticalAlign="top" 
                    align="right" 
                    height={36}
                    wrapperStyle={{ paddingBottom: '20px' }}
                  />
                  <Bar 
                    name="Bookings" 
                    dataKey="bookings" 
                    fill={UWI_COLORS.navy} 
                    radius={[4, 4, 0, 0]} 
                    barSize={16} 
                  />
                  <Bar 
                    name="Waitlist" 
                    dataKey="waitlist" 
                    fill={UWI_COLORS.emerald} 
                    radius={[4, 4, 0, 0]} 
                    barSize={16} 
                  />
                </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </div>
            </div>

            <div className="bg-white p-6 rounded-[32px] border border-slate-200 shadow-sm">
            <div className="mb-6 text-sm font-black text-slate-900 uppercase tracking-widest">Quick Breakdown</div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
              {[
                { label: "Booking · Active", val: data.bookings.byStatus.active ?? 0, color: "bg-blue-800" },
                { label: "Booking · No Show", val: data.bookings.byStatus.no_show ?? 0, color: "bg-emerald-500" },
                { label: "Booking · Cancelled", val: data.bookings.byStatus.cancelled ?? 0, color: "bg-amber-500" },
                { label: "Waitlist · Offered", val: data.waitlist.byStatus.offered ?? 0, color: "bg-indigo-500" },
                { label: "Waitlist · Waiting", val: data.waitlist.byStatus.waiting ?? 0, color: "bg-teal-600" },
              ].map((item) => (
                <div key={item.label} className="bg-white p-4 rounded-2xl border border-slate-50 shadow-sm relative overflow-hidden">
                  <div className={`absolute top-0 left-0 w-full h-1.5 ${item.color}`} />
                  <p className="text-[10px] font-bold text-slate-400">{item.label}</p>
                  <p className="text-2xl font-black text-slate-900 mt-1">{item.val}</p>
                </div>
              ))}
            </div>
          </div>
            <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
              <div className={chartCardClass()}>
                <div className="mb-6 text-sm font-black text-slate-900 uppercase tracking-widest">
                  Top Booked Rooms (Count)
                </div>
                {topRoomsByCountData.length === 0 ? (
                  <EmptyChart label="Top rooms" />
                ) : (
                  <div className="h-[320px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={topRoomsByCountData} layout="vertical" margin={{ left: 40, right: 40, bottom: 20 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                      
                        <XAxis 
                          type="number" 
                          axisLine={{ stroke: '#94a3b8' }} 
                          tickLine={{ stroke: '#94a3b8' }} 
                          tick={{ fill: UWI_COLORS.slate, fontSize: 12 }}
                          allowDecimals={false}
                        />
                        
                        <YAxis 
                          type="category" 
                          dataKey="roomName" 
                          width={120} 
                          axisLine={{ stroke: '#94a3b8' }} 
                          tickLine={{ stroke: '#94a3b8' }} 
                          tick={{ fill: UWI_COLORS.slate, fontSize: 12, fontWeight: 700 }} 
                        />

                        <Tooltip 
                          cursor={{ fill: 'rgba(241, 245, 249, 0.5)' }}
                          contentStyle={{ 
                            borderRadius: '16px', border: 'none', 
                            boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)',
                            fontSize: '12px', fontWeight: '700'
                          }}
                          formatter={((value: any) => [`${value} bookings`, "Activity"]) as any} 
                        />
                        <Bar 
                          dataKey="bookingCount" 
                          fill={UWI_COLORS.navy} 
                          radius={[0, 6, 6, 0]} 
                          barSize={20} 
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </div>
              <div className={chartCardClass()}>
                <div className="mb-6 text-sm font-black text-slate-900 uppercase tracking-widest">
                  Top Booked Rooms (Hours)
                </div>
                {topRoomsByHoursData.length === 0 ? (
                  <EmptyChart label="Top rooms by hours" />
                ) : (
                  <div className="h-[320px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={topRoomsByHoursData} layout="vertical" margin={{ left: 0, right: 40, bottom: 20 }}>
                        {/* Add a full grid for precise tracking */}
                        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={true} horizontal={true} />
                        
                        {/* Restore the X-Axis (The Hours Scale) */}
                        <XAxis 
                          type="number" 
                          axisLine={{ stroke: '#94a3b8' }} 
                          tickLine={{ stroke: '#94a3b8' }} 
                          tick={{ fill: UWI_COLORS.slate, fontSize: 12 }}
                          dy={10}
                        />
                        
                        {/* Restore the Y-Axis (Room Names) */}
                        <YAxis 
                          type="category" 
                          dataKey="roomName" 
                          width={120} 
                          axisLine={{ stroke: '#94a3b8' }} 
                          tickLine={{ stroke: '#94a3b8' }} 
                          tick={{ fill: UWI_COLORS.slate, fontSize: 12, fontWeight: 700 }} 
                        />
                        
                        <Tooltip 
                          cursor={{ fill: 'rgba(241, 245, 249, 0.5)' }}
                          contentStyle={{ 
                            borderRadius: '16px', border: 'none', 
                            boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)',
                            fontSize: '12px', fontWeight: '700'
                          }}
                          formatter={((value: any) => [`${value.toFixed(1)} hours`, "Time Spent"]) as any} 
                        />
                        
                        <Bar 
                          dataKey="bookedHours" 
                          name="Hours" 
                          fill={UWI_COLORS.emerald} 
                          radius={[0, 6, 6, 0]} 
                          barSize={20} 
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
              <div className={chartCardClass()}>
                <div className="mb-6 text-sm font-black text-slate-900 uppercase tracking-widest">
                  Top Users / Repeat Bookers
                </div>
                {topUsersData.length === 0 ? (
                  <EmptyChart label="Top users" />
                ) : (
                  <div className="h-[320px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={topUsersData} layout="vertical" margin={{ left: 0, right: 40, bottom: 20 }}>
                        {/* Full grid background */}
                        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={true} horizontal={true} />
                        
                        {/* Restore the X-Axis (Booking Count Scale) */}
                        <XAxis 
                          type="number" 
                          axisLine={{ stroke: '#94a3b8' }} 
                          tickLine={{ stroke: '#94a3b8' }} 
                          tick={{ fill: UWI_COLORS.slate, fontSize: 12 }}
                          allowDecimals={false}
                          dy={10}
                        />
                        
                        {/* Restore the Y-Axis (Student Names) */}
                        <YAxis 
                          type="category" 
                          dataKey="fullName" 
                          width={140} 
                          axisLine={{ stroke: '#94a3b8' }} 
                          tickLine={{ stroke: '#94a3b8' }} 
                          tick={{ fill: UWI_COLORS.slate, fontSize: 12, fontWeight: 700 }} 
                        />
                        
                        <Tooltip 
                          cursor={{ fill: 'rgba(241, 245, 249, 0.5)' }}
                          contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                        />
                        
                        <Bar 
                          dataKey="bookingCount" 
                          name="Bookings" 
                          fill={UWI_COLORS.navy} 
                          radius={[0, 6, 6, 0]} 
                          barSize={18} 
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </div>

              <div className={chartCardClass()}>
                <div className="mb-6 text-sm font-black text-slate-900 uppercase tracking-widest">Usage by Department</div>
                {usageByDepartmentData.length === 0 ? (
                  <EmptyChart label="Department usage" />
                ) : (
                  <div className="h-[320px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={usageByDepartmentData} margin={{ top: 20, right: 10, left: 0, bottom: 20 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                      
                      <XAxis 
                        dataKey="department" 
                        axisLine={{ stroke: '#94a3b8' }} 
                        tickLine={{ stroke: '#94a3b8' }} 
                        tick={{ fill: UWI_COLORS.slate, fontSize: 11, fontWeight: 700 }} 
                        dy={10}
                      />
                      
                      <YAxis 
                        axisLine={{ stroke: '#94a3b8' }} 
                        tickLine={{ stroke: '#94a3b8' }} 
                        tick={{ fill: UWI_COLORS.slate, fontSize: 11 }} 
                      />
                      <Tooltip 
                      cursor={{ fill: 'rgba(241, 245, 249, 0.5)' }} // Subtle highlight on hover
                      contentStyle={{ 
                        borderRadius: '16px', 
                        border: 'none', 
                        boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)',
                        fontSize: '12px',
                        fontWeight: '700',
                        color: '#1e293b'
                      }}
                      formatter={(value: any, name: any) => {
                        if (name === "Bookings") return [`${value} sessions`, "Total Bookings"];
                        if (name === "Hours") {
                          // We check if it's a number before calling toFixed to be safe
                          const val = typeof value === 'number' ? value.toFixed(1) : value;
                          return [`${val} hours`, "Time Occupied"];
                        }
                        return [value, name];
                      }}
                    />
                      <Legend verticalAlign="top" align="right" height={36} iconType="circle" />
                      <Bar name="Bookings" dataKey="bookingCount" fill={UWI_COLORS.navy} radius={[4, 4, 0, 0]} barSize={24} />
                      <Bar name="Hours" dataKey="bookedHours" fill={UWI_COLORS.amber} radius={[4, 4, 0, 0]} barSize={24} />
                    </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
              <div className={chartCardClass()}>
                <div className="mb-6 text-sm font-black text-slate-900 uppercase tracking-widest">Busiest Days</div>
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
                <div className="mb-6 text-sm font-black text-slate-900 uppercase tracking-widest">Busiest Hours</div>
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