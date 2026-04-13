// src/middleware.ts
import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

type AppRole = "student" | "staff" | "admin" | "super_admin" | null;

function withNext(req: NextRequest, pathname = req.nextUrl.pathname) {
  const url = req.nextUrl.clone();
  url.pathname = "/login";

  const nextValue = `${pathname}${req.nextUrl.search || ""}`;
  url.searchParams.set("next", nextValue);

  return url;
}

export async function middleware(req: NextRequest) {
  let res = NextResponse.next();

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return req.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            res.cookies.set(name, value, options);
          });
        },
      },
    },
  );

  const pathname = req.nextUrl.pathname;
  const isLoginPage = pathname.startsWith("/login");

  // Pages that require a logged-in user
  const isProtected =
    pathname.startsWith("/dashboard") ||
    pathname.startsWith("/rooms") ||
    pathname.startsWith("/schedule") ||
    pathname.startsWith("/bookings") ||
    pathname.startsWith("/admin") ||
    pathname.startsWith("/super-admin") ||
    pathname.startsWith("/complete-profile");

  // Pages that should only be used before login
  const isGuestOnly =
    pathname.startsWith("/login") ||
    pathname.startsWith("/signup");

  // Public auth flow pages that must remain reachable
  const isAuthFlowPage =
    pathname.startsWith("/verify") ||
    pathname.startsWith("/forgot-password") ||
    pathname.startsWith("/reset-password") ||
    pathname.startsWith("/auth/callback") ||
    pathname.startsWith("/auth/continue");

const {
  data: { user },
} = await supabase.auth.getUser();

const emailVerified = !!user?.email_confirmed_at;

let accountStatus: "pending_verification" | "active" | "suspended" | null = null;
if (user) {
  const { data: profileRow } = await supabase
    .from("profiles")
    .select("account_status")
    .eq("id", user.id)
    .maybeSingle();

  accountStatus = (profileRow?.account_status ?? null) as
    | "pending_verification"
    | "active"
    | "suspended"
    | null;
}

  // Logged in but email not verified
if (user && !emailVerified && !isAuthFlowPage && !isLoginPage) {
  const url = req.nextUrl.clone();
  url.pathname = "/verify";
  url.searchParams.set("mode", "login");
  if (user.email) {
    url.searchParams.set("email", user.email);
  }
  return NextResponse.redirect(url);
}

  // Logged in but profile is marked pending verification (enforce every-login verification)
if (user && accountStatus === "pending_verification" && !isAuthFlowPage && !isLoginPage) {
  const url = req.nextUrl.clone();
  url.pathname = "/verify";
  url.searchParams.set("mode", "login");
  if (user.email) {
    url.searchParams.set("email", user.email);
  }
  return NextResponse.redirect(url);
}
  // Not logged in + trying to open a protected page
if (isProtected && !user) {
  return NextResponse.redirect(withNext(req));
}

  // Logged in users should not go back to login/signup
  // but they must still be allowed to use verify/reset/auth flow pages
  if (isGuestOnly && user) {
    if (isLoginPage && (accountStatus === "pending_verification" || !emailVerified)) {
      return res;
    }

    const url = req.nextUrl.clone();
    url.pathname = "/auth/continue";
    return NextResponse.redirect(url);
  }

  const isAdminArea = pathname.startsWith("/admin");
  const isSuperAdminArea = pathname.startsWith("/super-admin");

  if (user && (isAdminArea || isSuperAdminArea)) {
    const { data: rows, error } = await supabase.rpc("get_my_profile");

    if (error) {
      const url = req.nextUrl.clone();
      url.pathname = "/dashboard";
      return NextResponse.redirect(url);
    }

    const me = Array.isArray(rows) ? rows[0] : null;
    const role = (me?.role ?? null) as AppRole;

    // /super-admin is super admin only
    if (isSuperAdminArea && role !== "super_admin") {
      const url = req.nextUrl.clone();
      url.pathname = role === "admin" ? "/admin" : "/dashboard";
      return NextResponse.redirect(url);
    }

    // /admin is admin or super admin only
    if (isAdminArea && role !== "admin" && role !== "super_admin") {
      const url = req.nextUrl.clone();
      url.pathname = "/dashboard";
      return NextResponse.redirect(url);
    }

    // Super admins who manually visit /admin get routed to /super-admin
    if (pathname === "/admin" && role === "super_admin") {
      const url = req.nextUrl.clone();
      url.pathname = "/super-admin";
      return NextResponse.redirect(url);
    }
  }

  return res;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};