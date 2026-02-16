import Link from "next/link";

export default function Hero() {
  return (
    <section className="mx-auto grid w-full max-w-6xl grid-cols-1 gap-10 px-6 pb-16 pt-6 md:grid-cols-2 md:items-center">
      {/* Left side */}
      <div>
        <h1 className="text-4xl font-semibold tracking-tight text-neutral-900 md:text-5xl">
          Book a study room at Alma Jordan Library
        </h1>

        <p className="mt-4 text-base leading-relaxed text-neutral-700">
          Find a room by capacity and amenities, see real-time availability, and
          reserve up to{" "}
          <span className="font-medium">2 bookings per day</span>.
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

        {/* Trust row */}
        <div className="mt-8 grid gap-3 sm:grid-cols-3">
          {[
            ["Real-time", "Live availability with overlap prevention."],
            ["Fair use", "Daily limits + no-show rules."],
            ["Mobile-ready", "Works cleanly on phones and laptops."],
          ].map(([title, desc]) => (
            <div
              key={title}
              className="rounded-xl border border-neutral-200 bg-white p-4"
            >
              <div className="text-sm font-semibold text-neutral-900">
                {title}
              </div>
              <div className="mt-1 text-xs text-neutral-600">{desc}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Right side (card stack you added earlier) */}
      <div className="relative mx-auto w-full max-w-md md:max-w-lg">
        <div className="absolute -top-10 -left-10 h-72 w-72 rounded-full bg-[#2B78FF]/20 blur-3xl" />

        <div className="absolute left-8 top-8 h-full w-full rounded-2xl bg-white shadow-md" />
        <div className="absolute left-4 top-4 h-full w-full rounded-2xl bg-white shadow-lg" />

        <div className="relative rounded-2xl border border-neutral-200 bg-white p-6 shadow-xl">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-semibold text-neutral-900">
                Study Room A
              </div>
              <div className="text-xs text-neutral-500">
                Alma Jordan Library
              </div>
            </div>
            <span className="rounded-full bg-green-100 px-3 py-1 text-xs font-medium text-green-700">
              Available
            </span>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
            <div className="rounded-lg bg-neutral-100 p-3">
              <div className="text-xs text-neutral-500">Capacity</div>
              <div className="font-semibold text-neutral-900">6 people</div>
            </div>
            <div className="rounded-lg bg-neutral-100 p-3">
              <div className="text-xs text-neutral-500">Equipment</div>
              <div className="font-semibold text-neutral-900">Whiteboard</div>
            </div>
            <div className="rounded-lg bg-neutral-100 p-3">
              <div className="text-xs text-neutral-500">Time</div>
              <div className="font-semibold text-neutral-900">2–4 PM</div>
            </div>
            <div className="rounded-lg bg-neutral-100 p-3">
              <div className="text-xs text-neutral-500">Status</div>
              <div className="font-semibold text-neutral-900">Free now</div>
            </div>
          </div>

          <button className="mt-6 w-full rounded-lg bg-[#2B78FF] py-3 text-sm font-semibold text-white hover:bg-[#2467D9]">
            Reserve room
          </button>
        </div>
      </div>
    </section>
  );
}
