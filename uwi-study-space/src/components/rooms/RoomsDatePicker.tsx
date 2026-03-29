//roomDatePicker
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

  const todayISO = getTodayISO();
  const todayDate = parseISO(todayISO);

  const maxDateISO = addDays(todayDate, props.maxDaysAhead);

  const selectedDateISO =
    sp.get("date") && /^\d{4}-\d{2}-\d{2}$/.test(sp.get("date") as string)
      ? (sp.get("date") as string)
      : todayISO;

  const [viewStartISO, setViewStartISO] = useState(selectedDateISO);

  useEffect(() => {
    const selected = parseISO(selectedDateISO);
    const view = parseISO(viewStartISO);
    const diff = (selected.getTime() - view.getTime()) / (1000 * 3600 * 24);
    if (diff < 0 || diff > 6) {
      setViewStartISO(selectedDateISO);
    }
  }, [selectedDateISO, viewStartISO]);

  const visibleDates = useMemo(() => {
    const start = parseISO(viewStartISO);
    const days = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(start);
      d.setDate(start.getDate() + i);

      const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
        d.getDate()
      ).padStart(2, "0")}`;

      const dayName = d.toLocaleDateString("en-US", { weekday: "short" }).toUpperCase();
      const dayNum = d.getDate();
      const monthName = d.toLocaleDateString("en-US", { month: "short" }).toUpperCase();

      const isWeekend = d.getDay() === 0 || d.getDay() === 6;
      const isDisabled = iso > maxDateISO || isWeekend;

      days.push({ iso, dayName, dayNum, monthName, isWeekend, isDisabled });
    }
    return days;
  }, [viewStartISO, maxDateISO]);

  function handleDateClick(iso: string, isDisabled: boolean) {
    if (isDisabled) return;

    const next = new URLSearchParams(sp.toString());
    next.set("date", iso);
    next.delete("bookRoomId");
    router.push(`/rooms?${next.toString()}`);
  }

  function shiftView(days: number) {
    const currentStart = parseISO(viewStartISO);
    const newStart = new Date(currentStart);
    newStart.setDate(currentStart.getDate() + days);

    const newStartISO = `${newStart.getFullYear()}-${String(newStart.getMonth() + 1).padStart(
      2,
      "0"
    )}-${String(newStart.getDate()).padStart(2, "0")}`;

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
    <div className="w-full space-y-3">
      {/* Header */}
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <h3 className="text-base font-semibold tracking-tight text-[var(--color-text-light)]">
            Booking date
          </h3>
        </div>

        <div className="inline-flex items-center rounded-xl border border-[var(--color-border-light)] bg-white px-3 py-2 text-sm shadow-sm">
          <span className="text-[var(--color-text-light)]/65">Booking Window:  </span>
          <span className="ml-2 font-semibold text-[var(--color-primary)]">
             {props.maxDaysAhead} days
          </span>
        </div>
      </div>

      {/* Date Rail */}
      <div className="rounded-2xl border border-[var(--color-border-light)] bg-white p-3 shadow-sm">
        <div className="flex items-center gap-2 select-none">
          {/* Left Arrow */}
          <button
            onClick={() => shiftView(-2)}
            disabled={viewStartISO <= todayISO}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[var(--color-border-light)] bg-[var(--color-surface-light)] text-[var(--color-text-light)] transition-colors hover:bg-[var(--color-secondary)] disabled:cursor-not-allowed disabled:opacity-35"
          >
            <svg
              viewBox="0 0 24 24"
              className="h-4 w-4"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="m15 18-6-6 6-6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>

          {/* Dates Grid */}
          <div className="grid flex-1 grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
            {visibleDates.map((item) => {
              const isSelected = item.iso === selectedDateISO;

              return (
                <button
                  key={item.iso}
                  onClick={() => handleDateClick(item.iso, item.isDisabled)}
                  disabled={item.isDisabled}
                  className={[
                    "flex min-h-[84px] flex-col items-center justify-center rounded-2xl border px-2 py-3 text-center transition-all duration-200",
                    item.isDisabled
                      ? "cursor-not-allowed border-[var(--color-border-light)] bg-[var(--color-surface-light)] text-[var(--color-text-light)]/30 opacity-80"
                      : "cursor-pointer border-[var(--color-border-light)] bg-white text-[var(--color-text-light)] hover:border-[var(--color-primary)] hover:bg-[var(--color-primary-soft)]/40",
                    isSelected
                      ? "!border-[var(--color-primary)] !bg-[var(--color-primary)] !text-white shadow-sm"
                      : "",
                  ].join(" ")}
                >
                  <span
                    className={`text-[10px] font-semibold uppercase tracking-[0.16em] ${
                      isSelected ? "text-white/80" : "text-[var(--color-text-light)]/50"
                    }`}
                  >
                    {item.dayName}
                  </span>

                  <span className="mt-1 text-2xl font-bold leading-none">{item.dayNum}</span>

                  <span
                    className={`mt-1 text-[10px] font-semibold uppercase tracking-[0.16em] ${
                      isSelected ? "text-white/80" : "text-[var(--color-text-light)]/50"
                    }`}
                  >
                    {item.monthName}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Right Arrow */}
          <button
            onClick={() => shiftView(2)}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[var(--color-border-light)] bg-[var(--color-surface-light)] text-[var(--color-text-light)] transition-colors hover:bg-[var(--color-secondary)]"
          >
            <svg
              viewBox="0 0 24 24"
              className="h-4 w-4"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="m9 18 6-6-6-6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>
      </div>

      {/* Selected Summary */}
      <div className="flex items-center gap-2 text-sm text-[var(--color-text-light)]">
        <span className="font-medium text-[var(--color-text-light)]/55">Selected:</span>
        <span className="font-semibold text-[var(--color-primary)]">{selectedDateText}</span>
      </div>
    </div>
  );
}