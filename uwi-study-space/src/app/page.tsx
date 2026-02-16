// src/app/page.tsx
import Link from "next/link";

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

      {/* Hero */}
      <section className="mx-auto grid w-full max-w-6xl grid-cols-1 gap-10 px-6 pb-16 pt-6 md:grid-cols-2 md:items-center">
        <div>
          <h1 className="text-4xl font-semibold tracking-tight text-neutral-900 md:text-5xl">
            Book a study room at Alma Jordan Library
          </h1>

          <p className="mt-4 text-base leading-relaxed text-neutral-700">
            Find a room by capacity and amenities, see real-time availability, and reserve up to{" "}
            <span className="font-medium">2 bookings per day</span> (or whatever the library sets).
          </p>

          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              href="/signup"
              className="rounded-lg bg-[#2B78FF] px-5 py-3 text-sm font-semibold text-white hover:bg-[#2467D9]"
            >
              Get started
            </Link>
            <Link
              href="/rooms"
              className="rounded-lg border border-neutral-200 bg-white px-5 py-3 text-sm font-semibold text-neutral-900 hover:bg-neutral-50"
            >
              Browse rooms
            </Link>
          </div>

          {/* Trust / rules row */}
          <div className="mt-8 grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl border border-neutral-200 bg-white p-4">
              <div className="text-sm font-semibold text-neutral-900">Real-time</div>
              <div className="mt-1 text-xs text-neutral-600">
                Live availability with overlap prevention.
              </div>
            </div>
            <div className="rounded-xl border border-neutral-200 bg-white p-4">
              <div className="text-sm font-semibold text-neutral-900">Fair use</div>
              <div className="mt-1 text-xs text-neutral-600">
                Daily limits + no-show rules (configurable).
              </div>
            </div>
            <div className="rounded-xl border border-neutral-200 bg-white p-4">
              <div className="text-sm font-semibold text-neutral-900">Mobile-ready</div>
              <div className="mt-1 text-xs text-neutral-600">
                Works cleanly on phones and laptops.
              </div>
            </div>
          </div>
        </div>

        {/* Right visual card stack */}
      </section>

      {/* Footer */}
      <footer className="border-t border-neutral-200 bg-white">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-2 px-6 py-6 text-xs text-neutral-600 sm:flex-row sm:items-center sm:justify-between">
          <div>© {new Date().getFullYear()} AJ Library Booking • UWI</div>
          <div className="flex gap-4">
            <Link className="hover:underline" href="/login">
              Login
            </Link>
            <Link className="hover:underline" href="/signup">
              Sign up
            </Link>
          </div>
        </div>
      </footer>
    </main>
  );
}
