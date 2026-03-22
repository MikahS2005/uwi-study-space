// src/lib/api/routeParams.ts
import { NextResponse } from "next/server";

type IdParams = { id: string };
type MaybePromiseParams = IdParams | Promise<IdParams>;

/**
 * Resolves a dynamic route param object and returns a positive integer id.
 * Supports both:
 * - { params }: { params: Promise<{ id: string }> }
 * - { params }: { params: { id: string } }
 *
 * This makes the helper tolerant while you standardize route handlers.
 */
export async function getPositiveRouteId(params: MaybePromiseParams): Promise<number | null> {
  const resolved = await Promise.resolve(params);
  const raw = resolved?.id;

  if (typeof raw !== "string" || raw.trim() === "") return null;

  const id = Number(raw);
  if (!Number.isFinite(id) || id <= 0 || !Number.isInteger(id)) return null;

  return id;
}

/**
 * Consistent JSON error response for invalid ids.
 */
export function invalidIdResponse(label = "id") {
  return NextResponse.json({ error: `Invalid ${label}` }, { status: 400 });
}