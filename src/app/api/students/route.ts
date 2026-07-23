// src/app/api/students/route.ts
// GET /api/students — returns all students from DynamoDB for the UI to display.
// This replaces the local students.js mock data.

import { NextResponse } from "next/server";
import { getAllStudents } from "@/lib/db/store";

export const dynamic = "force-dynamic";

export async function GET() {
  const students = await getAllStudents();

  // Map to the format the UI expects
  const mapped = students.map(s => ({
    id: s.cwid,
    name: `${s.first_name} ${s.last_name}`,
    firstName: s.first_name,
    lastName: s.last_name,
    email: s.email_gwc,
    major: s.program_of_study,
    year: s.year_in_college,
    enrollment: s.enrollment_status,
    priorityScore: s.ep_priority_score,
    programs: {
      eops: s.ep_eops_status,
      care: s.ep_care_status,
      calworks: s.ep_calworks_status,
    },
    tier: s.ep_eops_tier,
    emailSent: {
      eops: s.ep_eops_email_sent,
      care: s.ep_care_email_sent,
      calworks: s.ep_calworks_email_sent,
    },
    emailClicked: {
      eops: s.ep_eops_email_clicked,
      care: s.ep_care_email_clicked,
      calworks: s.ep_calworks_email_clicked,
    },
    accepted: {
      eops: s.ep_eops_accepted_date,
      care: s.ep_care_accepted_date,
      calworks: s.ep_calworks_accepted_date,
    },
    outreachStatus: {
      eops: s.ep_eops_outreach_status,
      care: s.ep_care_outreach_status,
      calworks: s.ep_calworks_outreach_status,
    },
    staffNotes: s.ep_staff_notes,
    outreachAttempts: s.ep_outreach_attempts,
    lastOutreachDate: s.ep_last_outreach_date,
    pendingItems: s.ep_pending_items,
  }));

  return NextResponse.json({ students: mapped, total: mapped.length });
}
