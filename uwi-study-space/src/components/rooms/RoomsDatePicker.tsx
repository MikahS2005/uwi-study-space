"use client";

import { useMemo, useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";

// --- Helper Functions ---

function getTodayISO() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function parseISO(ymd: string) {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function addDays(baseDate: Date, days: number) {
  const d = new Date(baseDate);
  d.setDate(d.getDate() + days);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export default function RoomsDatePicker(props: { maxDaysAhead: number }) {
  const router = useRouter();
  const sp = useSearchParams();

  // 1. Base Dates
  const todayISO = getTodayISO();
  const todayDate = parseISO(todayISO);
  
  // Calculate the max allowed ISO string
  const maxDateISO = addDays(todayDate, props.maxDaysAhead);

  const selectedDateISO = 
    sp.get("date") && /^\d{4}-\d{2}-\d{2}$/.test(sp.get("date") as string)
      ? (sp.get("date") as string)
      : todayISO;

  // 2. View State
  const [viewStartISO, setViewStartISO] = useState(selectedDateISO);

  // Sync view if URL changes
  useEffect(() => {
    const selected = parseISO(selectedDateISO);
    const view = parseISO(viewStartISO);
    const diff = (selected.getTime() - view.getTime()) / (1000 * 3600 * 24);
    if (diff < 0 || diff > 6) {
      setViewStartISO(selectedDateISO);
    }
  }, [selectedDateISO, viewStartISO]);

  // 3. Generate 7 Days for Carousel
  const visibleDates = useMemo(() => {
    const start = parseISO(viewStartISO);
    const days = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      
      const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      
      const dayName = d.toLocaleDateString("en-US", { weekday: "short" }).toUpperCase();
      const dayNum = d.getDate();
      const monthName = d.toLocaleDateString("en-US", { month: "short" }).toUpperCase();
      
      // Determine if it is a weekend
      const isWeekend = d.getDay() === 0 || d.getDay() === 6;

      // Disable if:
      // 1. It's past the max days ahead
      // 2. OR It is a weekend
      const isDisabled = iso > maxDateISO || isWeekend;

      days.push({ iso, dayName, dayNum, monthName, isWeekend, isDisabled });
    }
    return days;
  }, [viewStartISO, maxDateISO]);

  // 4. Interaction Handlers
  function handleDateClick(iso: string, isDisabled: boolean) {
    if (isDisabled) return; // Strict Guard Clause
    
    const next = new URLSearchParams(sp.toString());
    next.set("date", iso);
    next.delete("bookRoomId");
    router.push(`/rooms?${next.toString()}`);
  }

  function shiftView(days: number) {
    const currentStart = parseISO(viewStartISO);
    const newStart = new Date(currentStart);
    newStart.setDate(currentStart.getDate() + days);
    
    // Convert to ISO to check bounds
    const newStartISO = `${newStart.getFullYear()}-${String(newStart.getMonth() + 1).padStart(2, "0")}-${String(newStart.getDate()).padStart(2, "0")}`;
    
    if (newStartISO < todayISO) {
      setViewStartISO(todayISO);
    } else {
      setViewStartISO(newStartISO);
    }
  }

  const selectedDateObj = parseISO(selectedDateISO);
  const selectedDateText = selectedDateObj.toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return (
    <div className="w-full">
      <div className="mb-4 flex items-center justify-between">
        <label className="text-xs font-bold text-black uppercase tracking-widest">
          Booking date
        </label>
        <span className="text-xs font-medium text-gray-500">
          Max booking window: {props.maxDaysAhead} days
        </span>
      </div>

      <div className="flex items-center gap-2 select-none">
        {/* Left Arrow */}
        <button 
          onClick={() => shiftView(-2)}
          disabled={viewStartISO <= todayISO}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-600 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6"></polyline>
          </svg>
        </button>

        {/* Dates Grid */}
        <div className="grid flex-1 grid-cols-7 gap-2">
          {visibleDates.map((item) => {
            const isSelected = item.iso === selectedDateISO;

            return (
              <button
                key={item.iso}
                onClick={() => handleDateClick(item.iso, item.isDisabled)}
                disabled={item.isDisabled}
                className={`
                  group flex flex-col items-center justify-center rounded-lg border py-2 transition-all duration-200
                  ${item.isDisabled 
                    ? "cursor-not-allowed opacity-40 border-gray-100 bg-gray-50 text-gray-400" 
                    : "hover:border-blue-500 hover:shadow-md cursor-pointer border-gray-200 bg-white text-gray-700"}
                  ${isSelected && !item.isDisabled
                    ? "!border-slate-900 !bg-slate-900 !text-white shadow-lg scale-105" 
                    : ""}
                `}
              >
                {/* Day Name */}
                <span className={`text-[10px] font-bold uppercase mb-0.5 ${!isSelected && !item.isDisabled && item.isWeekend ? "text-red-600" : ""}`}>
                  {item.dayName}
                </span>
                
                {/* Day Number */}
                <span className={`text-xl font-bold leading-none ${!isSelected && !item.isDisabled && item.isWeekend ? "text-red-600" : ""}`}>
                  {item.dayNum}
                </span>
                
                {/* Month Name */}
                <span className={`text-[10px] font-bold uppercase mt-0.5 ${!isSelected && !item.isDisabled && item.isWeekend ? "text-red-600" : ""}`}>
                  {item.monthName}
                </span>
              </button>
            );
          })}
        </div>

        {/* Right Arrow */}
        <button 
          onClick={() => shiftView(2)}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-600 hover:bg-gray-100 transition-colors"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="9 18 15 12 9 6"></polyline>
          </svg>
        </button>
      </div>

      <p className="mt-4 text-sm text-gray-600">
        Selected: <span className="font-bold text-black">{selectedDateText}</span>
      </p>
    </div>
  );
}