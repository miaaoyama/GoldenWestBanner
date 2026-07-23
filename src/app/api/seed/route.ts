// src/app/api/seed/route.ts
// GET /api/seed — seeds DynamoDB with students using the SAME eligibility
// rules as students.js (pre-computed in data/eligibility_from_ui.json).

import { NextResponse } from "next/server";
import { readFileSync } from "fs";
import { join } from "path";
import { resetDB, upsertStudentBatch } from "@/lib/db/store";
import type { StudentRecord, EligibilityStatus, OutreachStatus } from "@/lib/db/schema";

export const dynamic = "force-dynamic";

export async function GET() {
  // Read pre-computed eligibility (generated from students.js rules)
  const filePath = join(process.cwd(), "data", "eligibility_from_ui.json");
  let students: any[];
  try {
    students = JSON.parse(readFileSync(filePath, "utf-8"));
  } catch {
    return NextResponse.json({ error: "eligibility_from_ui.json not found. Run: node -e to generate it." }, { status: 500 });
  }

  await resetDB();

  const now = new Date().toISOString();
  const records: StudentRecord[] = [];
  let confirmed = 0, conditional = 0;

  for (const s of students) {
    const [firstName, ...lastParts] = s.name.split(" ");
    const lastName = lastParts.join(" ");

    // Use the UI's rules directly — no recalculation
    const eopsStatus = s.eops as EligibilityStatus;
    const careStatus = s.care as EligibilityStatus;
    const calworksStatus = s.calworks_status as EligibilityStatus;

    const hasConfirmed = eopsStatus === "confirmed" || careStatus === "confirmed" || calworksStatus === "confirmed";
    const hasConditional = eopsStatus === "conditional" || careStatus === "conditional" || calworksStatus === "conditional";
    if (hasConfirmed) confirmed++;
    else if (hasConditional) conditional++;

    // Priority score from UI
    const score = Math.round((s.priority || 0) / 200); // normalize to 0-5 range

    const record: StudentRecord = {
      cwid: s.id,
      first_name: firstName,
      last_name: lastName,
      email_gwc: `${firstName[0].toLowerCase()}${lastName.toLowerCase().replace(/[^a-z]/g,'')}@student.goldenwestcollege.edu`,
      phone: null,
      program_of_study: s.major,
      year_in_college: s.unitsEarned > 30 ? "Sophomore" : "Freshman",
      enrollment_status: s.units >= 12 ? "Full-Time" : "Part-Time",

      ep_eops_status: eopsStatus,
      ep_care_status: careStatus,
      ep_calworks_status: calworksStatus,
      ep_eops_tier: eopsStatus === "confirmed" ? (score >= 3 ? "tier1" : "tier2") : null,
      ep_priority_score: score,
      ep_pending_items: null,

      ep_eops_email_sent: null, ep_eops_email_clicked: null,
      ep_care_email_sent: null, ep_care_email_clicked: null,
      ep_calworks_email_sent: null, ep_calworks_email_clicked: null,

      ep_eops_accepted_date: null, ep_care_accepted_date: null, ep_calworks_accepted_date: null,

      // Only flag outreach for students who are ONLY conditional (no confirmed programs)
      ep_eops_outreach_status: (!hasConfirmed && eopsStatus === "conditional" ? "needed" : "not_needed") as OutreachStatus,
      ep_care_outreach_status: (!hasConfirmed && careStatus === "conditional" ? "needed" : "not_needed") as OutreachStatus,
      ep_calworks_outreach_status: (!hasConfirmed && calworksStatus === "conditional" ? "needed" : "not_needed") as OutreachStatus,

      ep_staff_notes: "", ep_outreach_attempts: 0, ep_last_outreach_date: null,
      ep_last_eligibility_check: now, created_at: now, updated_at: now,
    };
    records.push(record);
  }

  await upsertStudentBatch(records);

  return NextResponse.json({
    success: true,
    message: `Seeded ${records.length} students (eligibility matches UI rules exactly)`,
    stats: { total: records.length, confirmed, conditional, not_eligible: records.length - confirmed - conditional },
  });
}
