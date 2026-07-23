// src/app/api/test-time/route.ts
// GET /api/test-time — backdates email_sent for two students to demo 24h/48h alerts.
// FOR TESTING ONLY — remove in production.

import { NextResponse } from "next/server";
import { getStudent, upsertStudent } from "@/lib/db/store";

export const dynamic = "force-dynamic";

export async function GET() {
  const now = Date.now();
  const h25ago = new Date(now - 25 * 3600000).toISOString();
  const h49ago = new Date(now - 49 * 3600000).toISOString();

  // Marcus Green — 25 hours ago (yellow: "1d waiting")
  const marcus = await getStudent("T00154792");
  if (marcus) {
    marcus.ep_eops_email_sent = h25ago;
    await upsertStudent(marcus);
  }

  // Jacob Torres — 49 hours ago (RED: "49h no response ⚠")
  const jacob = await getStudent("T00155162");
  if (jacob) {
    jacob.ep_eops_email_sent = h49ago;
    await upsertStudent(jacob);
  }

  return NextResponse.json({
    success: true,
    message: "Backdated emails for demo",
    marcus: { name: "Marcus Green", email_sent: h25ago, expected: "yellow — 1d waiting" },
    jacob: { name: "Jacob Torres", email_sent: h49ago, expected: "RED — 49h no response ⚠" },
  });
}
