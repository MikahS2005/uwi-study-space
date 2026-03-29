// src/lib/utils/publicOrigin.ts
export function getPublicAppOrigin() {
  if (typeof window === "undefined") {
    return process.env.NEXT_PUBLIC_APP_URL ?? "";
  }

  const origin = window.location.origin;

  // GitHub forwarded ports already encode the port in the hostname.
  if (origin.includes(".app.github.dev:")) {
    return origin.replace(/:\d+$/, "");
  }

  return origin;
}