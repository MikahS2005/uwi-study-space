import Link from "next/link";

export default function Footer() {
  return (
    <footer className="border-t border-neutral-200 bg-white">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-2 px-6 py-6 text-xs text-neutral-600 sm:flex-row sm:items-center sm:justify-between">
        <div>© {new Date().getFullYear()} AUWI Study SPcae • UWI</div>
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
  );
}
