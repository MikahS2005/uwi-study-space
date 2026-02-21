import { NextResponse } from "next/server";
import { acceptWaitlistOffer } from "@/lib/db/waitlist";

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const waitlistId = Number(body?.waitlistId);
  const purpose = typeof body?.purpose === "string" ? body.purpose : null;

  if (!Number.isFinite(waitlistId)) {
    return NextResponse.json({ error: "Missing waitlistId" }, { status: 400 });
  }

  const r = await acceptWaitlistOffer({ waitlistId, purpose });
  if (!r.ok) return NextResponse.json({ error: r.message }, { status: 400 });

  return NextResponse.json({ ok: true, bookingId: r.bookingId });
}