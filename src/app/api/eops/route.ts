// src/app/api/eops/route.ts
// Next.js App Router API route — runs the EOPS eligibility rules engine
// entirely server-side. No external services, no agents, no network calls.
//
// POST /api/eops
// Body: the student's full profile JSON (banner_sis + fafsa_cadaa + cccapply)
//
// Response 200:
//   { eligible: boolean, bannerMessage: string, reasonsMet: string[],
//     reasonsFailed: string[], missingInfo: string[] }

import { NextRequest, NextResponse } from "next/server";
import { checkEopsEligibility } from "@/lib/eopsEligibility";

export async function POST(req: NextRequest) {
  // ── Parse body ────────────────────────────────────────────────────────
  let profile: Record<string, unknown>;
  try {
    profile = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  // Require at least the banner_sis section
  if (!profile.banner_sis) {
    return NextResponse.json(
      { error: "Missing required field: banner_sis" },
      { status: 400 }
    );
  }

  // ── Run eligibility rules ─────────────────────────────────────────────
  const result = checkEopsEligibility(profile);

  return NextResponse.json(result);
}
