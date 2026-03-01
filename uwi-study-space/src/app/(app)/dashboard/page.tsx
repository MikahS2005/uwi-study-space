// src/app/(app)/dashboard/page.tsx
import UserBar from "@/components/auth/UserBar";
import { getStudentDashboard } from "@/lib/db/studentDashboard";
import Link from "next/link";

export default async function DashboardPage() {
  const data = await getStudentDashboard();
  
  // Format current date for the header visual
  const today = new Date();
  const dayName = today.toLocaleDateString('en-US', { weekday: 'short' });
  const dayNum = today.getDate();
  const monthName = today.toLocaleDateString('en-US', { month: 'short' });

  return (
    <div className="p-8 bg-[#F9FAFB] min-h-screen font-sans">
      
      {/* HEADER SECTION */}
      <div className="max-w-7xl mx-auto mb-10 flex flex-col md:flex-row md:items-center md:justify-between gap-6">
        <div className="flex items-center gap-6">
          {/* Today's Date Visual */}
          <div className="hidden sm:flex flex-col items-center justify-center bg-white border border-[#E5E7EB] rounded-2xl p-3 shadow-sm min-w-[80px]">
            <span className="text-[10px] font-black uppercase tracking-widest text-[#003595]">{monthName}</span>
            <span className="text-2xl font-black text-[#1F2937] leading-tight">{dayNum}</span>
            <span className="text-[10px] font-bold text-[#4B5563] opacity-60">{dayName}</span>
          </div>
          
          <div>
            <h1 className="text-4xl font-extrabold text-[#1F2937] tracking-tight">Dashboard</h1>
            <p className="mt-1 text-sm text-[#4B5563] font-medium flex items-center gap-2">
              <span className="inline-block w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
              Quick view of your bookings and availability.
            </p>
          </div>
        </div>

        <div className="shrink-0">
          <UserBar />
        </div>
      </div>

      {/* Main Layout Container */}
      <div className="max-w-7xl mx-auto flex flex-col lg:flex-row gap-8">
        
        {/* LEFT SIDE: Quick Actions Sidebar */}
        <div className="w-full lg:w-80 shrink-0">
          <div className="sticky top-8 rounded-2xl border border-[#E5E7EB] bg-white p-6 shadow-sm">
            <div className="flex items-center gap-3 mb-6">
               <div className="bg-[#EAF6FF] p-2 rounded-lg">
                <span className="text-[#003595] text-lg">📖</span>
               </div>
               <h2 className="text-lg font-bold text-[#1F2937]">Book a Study Room</h2>
            </div>
            
            <div className="flex flex-col gap-3">
              <Link
                href="/rooms"
                className="w-full text-center rounded-xl bg-[#003595] py-3.5 text-sm font-bold text-white shadow-lg shadow-[#003595]/20 hover:bg-[#002366] hover:-translate-y-0.5 transition-all"
              >
                Book Now
              </Link>
              <Link
                href="/schedule"
                className="w-full text-center rounded-xl border border-[#E5E7EB] bg-white py-3 text-sm font-bold text-[#1F2937] hover:bg-[#F9FAFB] hover:border-[#D1D5DB] transition-all"
              >
                View Full Schedule
              </Link>
              <Link
                href="/bookings"
                className="w-full text-center rounded-xl border border-[#E5E7EB] bg-white py-3 text-sm font-bold text-[#1F2937] hover:bg-[#F9FAFB] hover:border-[#D1D5DB] transition-all"
              >
                My Bookings
              </Link>
            </div>
          </div>
        </div>

        {/* RIGHT SIDE: Stats & Upcoming */}
        <div className="flex-1 space-y-8">
          
          {/* Stat cards grid */}
          <div className="grid gap-6 sm:grid-cols-3">
            {/* Active Bookings */}
            <div className="rounded-2xl p-6 transition-transform hover:scale-[1.02] shadow-sm bg-[#003595] text-white">
              <div className="text-[10px] font-black uppercase tracking-[0.1em] text-[#EAF6FF] opacity-80">
                Active Bookings
              </div>
              <div className="mt-3 text-4xl font-black">{data.stats.activeBookings}</div>
            </div>

            {/* Upcoming Today */}
            <div className="rounded-2xl p-6 transition-transform hover:scale-[1.02] shadow-sm bg-[#003595] text-white">
              <div className="text-[10px] font-black uppercase tracking-[0.1em] text-[#EAF6FF] opacity-80">
                Upcoming Today
              </div>
              <div className="mt-3 text-4xl font-black">{data.stats.upcomingToday}</div>
            </div>

            {/* Bookings Left with Inverted Progress Ring */}
            <div className="rounded-2xl p-6 transition-transform hover:scale-[1.02] shadow-sm bg-[#EAF6FF] border border-[#003595]/10 text-[#003595]">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-[10px] font-black uppercase tracking-[0.1em] text-[#003595] opacity-80">
                    Bookings Left
                  </div>
                  <div className="mt-3 text-4xl font-black text-[#003595]">{data.stats.bookingsLeftToday}</div>
                </div>
                
                {/* Progress Circle - Showing Bookings Made */}
                {(() => {
                  const bookingsMade = data.stats.maxBookingsPerDay - data.stats.bookingsLeftToday;
                  const circumference = 150.8; 
                  
                  return (
                    <div className="relative flex items-center justify-center">
                      <svg className="w-14 h-14 transform -rotate-90">
                        <circle 
                          cx="28" cy="28" r="24" 
                          stroke="currentColor" strokeWidth="5" 
                          fill="transparent" className="text-[#003595]/10" 
                        />
                        <circle 
                          cx="28" cy="28" r="24" 
                          stroke="currentColor" strokeWidth="5" 
                          fill="transparent" 
                          strokeDasharray={circumference} 
                          strokeDashoffset={circumference - (circumference * (bookingsMade / data.stats.maxBookingsPerDay))} 
                          strokeLinecap="round"
                          className="text-[#003595] transition-all duration-1000 ease-in-out" 
                        />
                      </svg>
                      <span className="absolute text-[10px] font-bold">{bookingsMade}/{data.stats.maxBookingsPerDay}</span>
                    </div>
                  );
                })()}
              </div>
              <div className="mt-2 text-[10px] font-bold opacity-60 uppercase">
                Daily Limit: {data.stats.maxBookingsPerDay}
              </div>
            </div>
          </div>

          {/* Upcoming bookings List */}
          <div className="rounded-2xl border border-[#E5E7EB] bg-white overflow-hidden shadow-sm">
            <div className="px-6 py-5 border-b border-[#E5E7EB] flex items-center justify-between">
              <h2 className="text-lg font-bold text-[#1F2937]">Upcoming Bookings</h2>
              <span className="px-3 py-1 bg-[#F3F4F6] rounded-full text-[10px] font-bold text-[#4B5563] uppercase">
                {data.upcoming.length} Scheduled
              </span>
            </div>
            
            <div className="p-6">
              {data.upcoming.length === 0 ? (
                <div className="text-center py-12 border-2 border-dashed border-[#F3F4F6] rounded-2xl">
                  <p className="text-[#9CA3AF] font-medium mb-3 text-sm">No bookings found for today.</p>
                  <Link href="/rooms" className="text-[#003595] text-sm font-extrabold hover:underline">
                    Schedule your first room →
                  </Link>
                </div>
              ) : (
                <ul className="space-y-3">
                  {data.upcoming.map((b) => (
                    <li
                      key={b.id}
                      className="group flex items-center justify-between gap-4 rounded-xl border border-[#F3F4F6] bg-white px-5 py-4 hover:border-[#003595]/20 hover:bg-[#F9FAFB] transition-all"
                    >
                      <div className="flex items-center gap-4">
                        <div className="h-2 w-2 rounded-full bg-[#003595]" />
                        <div>
                          <div className="font-bold text-[#1F2937] group-hover:text-[#003595] transition-colors">{b.room.name}</div>
                          <div className="text-xs font-medium text-[#6B7280]">
                            {new Date(b.start_time).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} • {new Date(b.start_time).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                          </div>
                        </div>
                      </div>
                      <Link
                        href="/bookings"
                        className="text-xs font-black text-[#003595] uppercase tracking-wider bg-[#EAF6FF] px-4 py-2 rounded-lg hover:bg-[#003595] hover:text-white transition-all"
                      >
                        Manage
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}