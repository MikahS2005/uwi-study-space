// src/app/auth/continue/route.ts
import { NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabase/server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";

type AppRole = "student" | "staff" | "admin" | "super_admin";
type AcademicStatus = "UG" | "PG" | "Other";
type AccountStatus = "pending_verification" | "active" | "suspended";

function getPublicOrigin(req: Request) {
  const url = new URL(req.url);
  const xfHost = req.headers.get("x-forwarded-host");
  const xfProto = req.headers.get("x-forwarded-proto") ?? url.protocol.replace(":", "");

  if (xfHost) {
    return `${xfProto}://${xfHost}`;
  }

  return url.origin.replace(/:\d+$/, "");
}

function inferRole(email: string): AppRole {
  const normalized = email.trim().toLowerCase();
  return normalized.endsWith("@uwi.edu") && !normalized.endsWith("@my.uwi.edu")
    ? "staff"
    : "student";
}

function pickSafeNext(next: string | null) {
  if (!next || !next.startsWith("/")) return null;
  if (next.startsWith("//")) return null;
  if (
    next.startsWith("/login") ||
    next.startsWith("/signup") ||
    next.startsWith("/auth/callback") ||
    next.startsWith("/auth/continue")
  ) {
    return null;
  }
  return next;
}

function cleanOptional(value: string | null | undefined) {
  const s = String(value ?? "").trim().replace(/\s+/g, " ");
  return s || null;
}

function isProfileComplete(profile: {
  full_name: string | null;
  uwi_id: string | null;
  phone: string | null;
  faculty: string | null;
  academic_status: AcademicStatus | null;
}) {
  return Boolean(
    profile.full_name?.trim() &&
      profile.uwi_id?.trim() &&
      profile.phone?.trim() &&
      profile.faculty?.trim() &&
      profile.academic_status
  );
}

export async function GET(req: Request) {
  const requestUrl = new URL(req.url);
  const origin = getPublicOrigin(req);
  const next = pickSafeNext(requestUrl.searchParams.get("next"));

  const supabase = await createSupabaseServer();
  const admin = createSupabaseAdmin();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.redirect(new URL("/login", origin));
  }

  const email = (user.email ?? "").trim().toLowerCase();
  if (!email) {
    const loginUrl = new URL("/login", origin);
    loginUrl.searchParams.set("error", "Missing account email");
    return NextResponse.redirect(loginUrl);
  }

  const meta = (user.user_metadata ?? {}) as {
    full_name?: string | null;
    uwi_id?: string | null;
    phone?: string | null;
    faculty?: string | null;
    academic_status?: AcademicStatus | null;
  };

  const emailConfirmedAt =
    (user as { email_confirmed_at?: string | null }).email_confirmed_at ?? null;

  const { data: existing, error: existingErr } = await admin
    .from("profiles")
    .select(
      "id, email, full_name, uwi_id, phone, role, faculty, academic_status, account_status, email_verified_at"
    )
    .eq("id", user.id)
    .maybeSingle();

  if (existingErr) {
    const loginUrl = new URL("/login", origin);
    loginUrl.searchParams.set("error", "Profile lookup failed");
    return NextResponse.redirect(loginUrl);
  }

  const role: AppRole = (existing?.role as AppRole | null) ?? inferRole(email);

  const accountStatus: AccountStatus =
    existing?.account_status === "suspended"
      ? "suspended"
      : emailConfirmedAt
      ? "active"
      : (existing?.account_status as AccountStatus | null) ?? "pending_verification";

  const profileToSave = {
    id: user.id,
    email,
    full_name: cleanOptional(existing?.full_name ?? meta.full_name ?? null),
    uwi_id: cleanOptional(existing?.uwi_id ?? meta.uwi_id ?? null),
    phone: cleanOptional(existing?.phone ?? meta.phone ?? null),
    role,
    faculty: cleanOptional(existing?.faculty ?? meta.faculty ?? null),
    academic_status:
      (existing?.academic_status as AcademicStatus | null) ??
      (meta.academic_status ?? null),
    account_status: accountStatus,
    email_verified_at: existing?.email_verified_at ?? emailConfirmedAt ?? null,
  };

  const { error: upsertErr } = await admin
    .from("profiles")
    .upsert(profileToSave, { onConflict: "id" });

  if (upsertErr) {
    const loginUrl = new URL("/login", origin);
    loginUrl.searchParams.set("error", "Profile sync failed");
    return NextResponse.redirect(loginUrl);
  }

  if (!emailConfirmedAt) {
    return NextResponse.redirect(new URL("/verify", origin));
  }

  if (profileToSave.account_status === "suspended") {
    const loginUrl = new URL("/login", origin);
    loginUrl.searchParams.set("error", "Account suspended");
    return NextResponse.redirect(loginUrl);
  }

  if (!isProfileComplete(profileToSave)) {
    return NextResponse.redirect(new URL("/complete-profile", origin));
  }

  if (next) {
    if (next.startsWith("/super-admin")) {
      if (profileToSave.role === "super_admin") {
        return NextResponse.redirect(new URL(next, origin));
      }
    } else if (next.startsWith("/admin")) {
      if (profileToSave.role === "admin" || profileToSave.role === "super_admin") {
        return NextResponse.redirect(new URL(next, origin));
      }
    } else {
      return NextResponse.redirect(new URL(next, origin));
    }
  }

  if (profileToSave.role === "super_admin") {
    return NextResponse.redirect(new URL("/super-admin", origin));
  }

  if (profileToSave.role === "admin") {
    return NextResponse.redirect(new URL("/admin", origin));
  }

  return NextResponse.redirect(new URL("/dashboard", origin));
}