// src/middleware.ts
import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

export async function middleware(req: NextRequest) {
  let res = NextResponse.next();

  /**
   * Supabase SSR client:
   * - Reads auth cookies from the incoming request
   * - Writes refreshed cookies onto the outgoing response (res)
   */
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

  /**
   * Pages that require authentication.
   * NOTE: This is independent of role checks below.
   */
  const isProtected =
    pathname.startsWith("/dashboard") ||
    pathname.startsWith("/rooms") ||
    pathname.startsWith("/schedule") ||
    pathname.startsWith("/bookings") ||
    pathname.startsWith("/admin") ||
    pathname.startsWith("/super-admin");

  /**
   * Auth pages:
   * Logged-in users should not go back to login/signup/verify.
   */
  const isAuthPage =
    pathname.startsWith("/login") ||
    pathname.startsWith("/signup") ||
    pathname.startsWith("/verify");

  // 1) If not logged in and trying to access protected pages -> redirect to login
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (isProtected && !user) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  // 2) If logged in and trying to access auth pages -> send to dashboard
  if (isAuthPage && user) {
    const url = req.nextUrl.clone();
    url.pathname = "/dashboard";
    return NextResponse.redirect(url);
  }

  /**
   * 3) Role-based routing:
   * We ONLY do this if:
   * - user is logged in AND
   * - path is /admin or /super-admin
   *
   * Uses the SECURITY DEFINER RPC get_my_profile() to avoid RLS recursion.
   */
  const isAdminArea = pathname.startsWith("/admin");
  const isSuperAdminArea = pathname.startsWith("/super-admin");

  if (user && (isAdminArea || isSuperAdminArea)) {
    // RPC returns an array of rows; grab the first
    const { data: rows, error } = await supabase.rpc("get_my_profile");

    // If we cannot read role, fail closed (send to dashboard).
    if (error) {
      const url = req.nextUrl.clone();
      url.pathname = "/dashboard";
      return NextResponse.redirect(url);
    }

    const me = Array.isArray(rows) ? rows[0] : null;
    const role = (me?.role ?? null) as "student" | "admin" | "super_admin" | null;

    // /super-admin is SUPER ADMIN ONLY
    if (isSuperAdminArea) {
      if (role !== "super_admin") {
        const url = req.nextUrl.clone();
        url.pathname = role === "admin" ? "/admin" : "/dashboard";
        return NextResponse.redirect(url);
      }
    }

    // /admin is ADMIN OR SUPER ADMIN
    if (isAdminArea) {
      if (role !== "admin" && role !== "super_admin") {
        const url = req.nextUrl.clone();
        url.pathname = "/dashboard";
        return NextResponse.redirect(url);
      }

      /**
       * Optional UX improvement:
       * If a super admin manually visits /admin, push them to /super-admin.
       * (This matches your desired "super admins use super admin panel".)
       */
      if (role === "super_admin" && pathname === "/admin") {
        const url = req.nextUrl.clone();
        url.pathname = "/super-admin";
        return NextResponse.redirect(url);
      }
    }
  }

  return res;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
