// src/app/api/seed/route.ts
// GET /api/seed — loads 100 fake students, runs eligibility, populates DynamoDB.

import { NextResponse } from "next/server";
import { readdirSync, readFileSync } from "fs";
import { join } from "path";
import { resetDB, upsertStudentBatch } from "@/lib/db/store";
import { checkAllPrograms } from "@/lib/programsEligibility";
import type { StudentRecord, EligibilityStatus, OutreachStatus } from "@/lib/db/schema";

export const dynamic = "force-dynamic";

export async function GET() {
  const studentsDir = join(process.cwd(), "data", "students");

  let files: string[];
  try {
    files = readdirSync(studentsDir).filter((f) => f.endsWith(".json"));
  } catch {
    return NextResponse.json({ error: "No student files found in data/students/" }, { status: 404 });
  }

  // Reset tables
  await resetDB();

  const now = new Date().toISOString();
  const records: StudentRecord[] = [];
  let confirmedCount = 0;
  let conditionalCount = 0;

  for (const file of files) {
    const profile = JSON.parse(readFileSync(join(studentsDir, file), "utf-8"));
    const sis = (profile.banner_sis ?? {}) as Record<string, unknown>;

    const results = checkAllPrograms(profile);
    const eops = results.find((r) => r.programId === "eops");
    const care = results.find((r) => r.programId === "care");
    const calworks = results.find((r) => r.programId === "calworks");

    const eopsStatus: EligibilityStatus = (eops?.status as EligibilityStatus) ?? "not_eligible";
    const careStatus: EligibilityStatus = (care?.status as EligibilityStatus) ?? "not_eligible";
    const calworksStatus: EligibilityStatus = (calworks?.status as EligibilityStatus) ?? "not_eligible";

    const hasConfirmed = eopsStatus === "confirmed" || careStatus === "confirmed" || calworksStatus === "confirmed";
    const hasConditional = eopsStatus === "conditional" || careStatus === "conditional" || calworksStatus === "conditional";
    if (hasConfirmed) confirmedCount++;
    else if (hasConditional) conditionalCount++;

    const pendingItems = [
      ...(eops?.pendingItems ?? []),
      ...(care?.pendingItems ?? []),
      ...(calworks?.pendingItems ?? []),
    ].map((p: { label: string }) => p.label).join("; ") || null;

    const record: StudentRecord = {
      cwid:              (sis.cwid as string) ?? "",
      first_name:        (sis.first_name as string) ?? "",
      last_name:         (sis.last_name as string) ?? "",
      email_gwc:         (sis.email_gwc as string) ?? `${((sis.first_name as string) ?? "s")[0].toLowerCase()}${((sis.last_name as string) ?? "x").toLowerCase()}@student.goldenwestcollege.edu`,
      phone:             (sis.phone_primary as string) ?? null,
      program_of_study:  (sis.program_of_study as string) ?? "",
      year_in_college:   (sis.year_in_college as string) ?? "",
      enrollment_status: (sis.enrollment_status as string) ?? "",

      ep_eops_status:     eopsStatus,
      ep_care_status:     careStatus,
      ep_calworks_status: calworksStatus,
      ep_eops_tier:       eops?.tier ?? null,
      ep_priority_score:  eops?.priorityScore ?? 0,
      ep_pending_items:   pendingItems,

      ep_eops_email_sent: null, ep_eops_email_clicked: null,
      ep_care_email_sent: null, ep_care_email_clicked: null,
      ep_calworks_email_sent: null, ep_calworks_email_clicked: null,

      ep_eops_accepted_date: null, ep_care_accepted_date: null, ep_calworks_accepted_date: null,

      ep_eops_outreach_status:     (eopsStatus === "conditional" ? "needed" : "not_needed") as OutreachStatus,
      ep_care_outreach_status:     (careStatus === "conditional" ? "needed" : "not_needed") as OutreachStatus,
      ep_calworks_outreach_status: (calworksStatus === "conditional" ? "needed" : "not_needed") as OutreachStatus,

      ep_staff_notes: "", ep_outreach_attempts: 0, ep_last_outreach_date: null,
      ep_last_eligibility_check: now, created_at: now, updated_at: now,
    };
    records.push(record);
  }

  await upsertStudentBatch(records);

  return NextResponse.json({
    success: true,
    message: `Seeded ${records.length} students into DynamoDB (ep_students)`,
    stats: { total: records.length, confirmed: confirmedCount, conditional: conditionalCount, not_eligible: records.length - confirmedCount - conditionalCount },
  });
}
