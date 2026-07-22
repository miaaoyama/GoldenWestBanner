// src/app/api/eops/route.ts
// Multi-program eligibility API.
// Returns confirmed programs, conditional programs, and the summary message.
//
// POST /api/eops
// Body: full student profile (banner_sis + fafsa_cadaa + cccapply)
//
// Response 200: EligibilitySummary + top-level bannerIntro

import { NextRequest, NextResponse } from "next/server";
import { summarizeEligibility } from "@/lib/programsEligibility";

export async function POST(req: NextRequest) {
  let profile: Record<string, unknown>;
  try {
    profile = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!profile.banner_sis) {
    return NextResponse.json({ error: "Missing required field: banner_sis" }, { status: 400 });
  }

  const summary = summarizeEligibility(profile);

  // Build the top-level intro message shown at the top of the banner
  const sis       = (profile.banner_sis ?? {}) as Record<string, unknown>;
  const firstName = (sis.preferred_name as string) || (sis.first_name as string) || "Student";

  let bannerIntro = "";

  if (summary.confirmed.length > 0 && summary.conditional.length > 0) {
    const confirmedNames   = summary.confirmed.map(p => p.shortName).join(", ");
    const conditionalNames = summary.conditional.map(p => p.shortName).join(", ");
    bannerIntro = `Congratulations ${firstName} — you're 100% qualified for ${confirmedNames}; and once we receive a few items, you may also qualify for ${conditionalNames}.`;
  } else if (summary.confirmed.length > 0) {
    const names = summary.confirmed.map(p => p.shortName).join(", ");
    bannerIntro = `Congratulations ${firstName} — you're 100% qualified for ${names}!`;
  } else if (summary.conditional.length > 0) {
    const names = summary.conditional.map(p => p.shortName).join(", ");
    bannerIntro = `${firstName}, you're close to qualifying for ${names}. See what's needed below.`;
  }

  return NextResponse.json({
    ...summary,
    bannerIntro,
    hasMatches: summary.all.length > 0,
  });
}
