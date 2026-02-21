import { NextResponse } from "next/server";
import { joinWaitlist } from "@/lib/db/waitlist";

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);

  const roomId = Number(body?.roomId);
  const startISO = String(body?.startISO ?? "");
  const endISO = String(body?.endISO ?? "");

  if (!Number.isFinite(roomId) || !startISO || !endISO) {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  }

  const r = await joinWaitlist({ roomId, startISO, endISO });
  if (!r.ok) return NextResponse.json({ error: r.message }, { status: 400 });

  return NextResponse.json({ ok: true, id: r.id });
}