// src/app/(app)/super-admin/rooms/page.tsx
import { RoomsManagementPage } from "@/components/admin/rooms/RoomsManagementPage";

export default async function SuperAdminRoomsPage() {
  return (
    <div className="min-h-screen bg-[#F9FAFB]">

      {/* ── Page Banner ── */}
      <div className="bg-white border-b-2 border-[#003595]">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">

          {/* Thin accent bar */}
          <div className="h-1 w-16 bg-[#003595] -mb-px" />

          <div className="py-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              {/* Eyebrow */}
              <p className="text-[10px] font-semibold tracking-[0.2em] uppercase text-[#003595] mb-1.5">
                Super Admin — Room Management
              </p>
              {/* Title */}
              <h1
                style={{ fontFamily: "Georgia, serif" }}
                className="text-3xl sm:text-4xl font-bold text-[#1F2937] leading-tight"
              >
                Study Rooms
              </h1>
              <p className="mt-1.5 text-sm text-[#6B7280] max-w-lg">
                View, create, and configure all study rooms across every faculty and department.
              </p>
            </div>

            {/* Breadcrumb */}
            <nav
              aria-label="Breadcrumb"
              className="flex items-center gap-1.5 text-xs text-[#9CA3AF] shrink-0 pb-1"
            >
              <span className="hover:text-[#003595] cursor-default transition-colors">
                Super Admin
              </span>
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="m9 18 6-6-6-6" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              <span className="font-semibold text-[#003595]">Rooms</span>
            </nav>
          </div>
        </div>
      </div>

      {/* ── Content ── */}
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
        <RoomsManagementPage mode="super_admin" />
      </div>
    </div>
  );
}