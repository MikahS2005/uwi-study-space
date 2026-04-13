import { NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabase/server";

function getPublicOrigin(req: Request) {
  const url = new URL(req.url);
  const xfHost = req.headers.get("x-forwarded-host");
  const xfProto = req.headers.get("x-forwarded-proto") ?? url.protocol.replace(":", "");

  if (xfHost) return `${xfProto}://${xfHost}`;
  return url.origin.replace(/:\d+$/, "");
}

export async function GET(req: Request) {
  const requestUrl = new URL(req.url);
  const origin = getPublicOrigin(req);

  const code = requestUrl.searchParams.get("code");
  const next = requestUrl.searchParams.get("next") ?? "/auth/continue";

  if (!code) {
    const loginUrl = new URL("/login", origin);
    loginUrl.searchParams.set("error", "Missing auth code");
    return NextResponse.redirect(loginUrl);
  }

  const supabase = await createSupabaseServer();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    const loginUrl = new URL("/login", origin);
    loginUrl.searchParams.set("error", error.message);
    return NextResponse.redirect(loginUrl);
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    const loginUrl = new URL("/login", origin);
    loginUrl.searchParams.set("error", "Unable to load authenticated user");
    return NextResponse.redirect(loginUrl);
  }

  if (!user.email_confirmed_at) {
    const verifyUrl = new URL("/verify", origin);
    if (user.email) verifyUrl.searchParams.set("email", user.email);
    return NextResponse.redirect(verifyUrl);
  }

  // Optional profile sync
  await supabase
    .from("profiles")
    .update({
      email_verified_at: user.email_confirmed_at,
      account_status: "active",
    })
    .eq("id", user.id);

  return NextResponse.redirect(new URL(next, origin));
}