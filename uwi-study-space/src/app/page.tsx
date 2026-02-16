// src/app/page.tsx
import Link from "next/link";
import Hero from "@/components/landing/Hero";
import Footer from "@/components/landing/Footer";

/**
 * Public landing page (no auth required).
 * Keep it simple + clean, match the blue/white brand.
 */
export default function HomePage() {
  return (
    <main className="min-h-screen bg-[#F6FAFF]">
      {/* Top bar */}
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-5">
        <div className="flex items-center gap-2">
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-[#2B78FF] text-white">
            {/* Simple icon placeholder */}
            <span className="text-lg font-bold">AJ</span>
          </div>
          <div className="leading-tight">
            <div className="text-sm font-semibold text-neutral-900">AJ Library Booking</div>
            <div className="text-xs text-neutral-600">UWI • Study rooms</div>
          </div>
        </div>

        <nav className="flex items-center gap-2">
          <Link
            href="/login"
            className="rounded-lg border border-neutral-200 bg-white px-4 py-2 text-sm font-medium text-neutral-900 hover:bg-neutral-50"
          >
            Login
          </Link>
          <Link
            href="/signup"
            className="rounded-lg bg-[#2B78FF] px-4 py-2 text-sm font-medium text-white hover:bg-[#2467D9]"
          >
            Sign up
          </Link>
        </nav>
      </header>

      <Hero />


      {/* Footer */}
      <Footer />
    </main>
  );
}
