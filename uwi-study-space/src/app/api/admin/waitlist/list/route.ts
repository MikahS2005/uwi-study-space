// src/app/api/admin/waitlist/list/route.ts
import { NextResponse } from "next/server";
import { getWaitlistForAdminPanel } from "@/lib/db/adminPanel";

export async function GET() {
  const rows = await getWaitlistForAdminPanel();
  return NextResponse.json({ rows });
}