// src/app/api/tracking/route.ts
// GET /api/tracking
// Returns full tracking + eligibility status for all students.
// Merges DynamoDB tracking data with the complete eligibility from students.js rules.

import { NextResponse } from "next/server";
import { getAllStudents } from "@/lib/db/store";
import { readFileSync } from "fs";
import { join } from "path";

export const dynamic = "force-dynamic";

// Load full eligibility (all 8 programs) from pre-computed file
let fullEligibility: Record<string, Record<string, string>> = {};
try {
  const data = JSON.parse(readFileSync(join(process.cwd(), "data", "eligibility_from_ui.json"), "utf-8"));
  for (const s of data) {
    fullEligibility[s.id] = {
      eops: s.eops,
      care: s.care,
      calworks: s.calworks_status,
      promise: s.promise,
      nextup: s.nextup,
      basicneeds: s.basicneeds,
      dsps: s.dsps,
      vrc: s.vrc,
    };
  }
} catch {}

// Program display names + what docs are needed for conditional
const PROGRAM_INFO: Record<string, { name: string; missing: string }> = {
  eops:      { name: "EOPS", missing: "Enroll in at least 12 units this term." },
  care:      { name: "CARE", missing: "Upload proof of public assistance (CalWORKs/CalFresh) and dependent verification." },
  calworks:  { name: "CalWORKs", missing: "Provide your county CalWORKs case number." },
  promise:   { name: "Golden Promise", missing: "Confirm first-time student status and full-time enrollment." },
  nextup:    { name: "NextUp", missing: "Verify foster youth status with NextUp coordinator." },
  basicneeds:{ name: "Basic Needs", missing: "Meet with a Basic Needs coordinator to review resources." },
  dsps:      { name: "DSPS", missing: "Submit disability documentation for accommodations intake." },
  vrc:       { name: "Veterans", missing: "Bring DD-214 or current service orders to the VRC." },
};

export async function GET() {
  const students = await getAllStudents();
  const now = Date.now();

  const tracking = students.map(s => {
    const allPrograms = ["eops", "care", "calworks", "promise", "nextup", "basicneeds", "dsps", "vrc"];
    const eligibility = fullEligibility[s.cwid] || {};

    const statuses: Record<string, {
      status: string;
      eligibility: string;   // "confirmed" | "conditional" | "not_eligible"
      displayName: string;
      missingDocs: string;
      daysSince: number | null;
      hoursSince: number | null;
      urgent: boolean;
    }> = {};

    for (const prog of allPrograms) {
      const elig = eligibility[prog] || "not_eligible";
      if (elig === "not_eligible") continue; // skip programs they don't qualify for at all

      // For tracked programs (eops, care, calworks) — check DynamoDB status
      const emailSent = (s as unknown as Record<string, unknown>)[`ep_${prog}_email_sent`] as string | null;
      const clicked = (s as unknown as Record<string, unknown>)[`ep_${prog}_email_clicked`] as string | null;
      const accepted = (s as unknown as Record<string, unknown>)[`ep_${prog}_accepted_date`] as string | null;
      const dbStatus = (s as unknown as Record<string, unknown>)[`ep_${prog}_status`] as string | undefined;

      let trackingStatus = "not_sent";
      let daysSince: number | null = null;
      let hoursSince: number | null = null;
      let urgent = false;

      if (dbStatus === "opted_out") {
        trackingStatus = "opted_out";
      } else if (accepted) {
        trackingStatus = "opted_in";
      } else if (emailSent && !clicked) {
        const ms = now - new Date(emailSent).getTime();
        hoursSince = Math.floor(ms / 3600000);
        daysSince = Math.floor(ms / 86400000);
        urgent = hoursSince >= 48;
        trackingStatus = "pending";
      }

      statuses[prog] = {
        status: trackingStatus,
        eligibility: elig,
        displayName: PROGRAM_INFO[prog]?.name || prog.toUpperCase(),
        missingDocs: elig === "conditional" ? (PROGRAM_INFO[prog]?.missing || "") : "",
        daysSince,
        hoursSince,
        urgent,
      };
    }

    return {
      cwid: s.cwid,
      name: `${s.first_name} ${s.last_name}`,
      programs: statuses,
    };
  });

  return NextResponse.json({ tracking }, {
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
}
