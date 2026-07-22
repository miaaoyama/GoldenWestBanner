// src/app/api/send-emails-batch/route.ts
// ──────────────────────────────────────────────────────────────────────────
// POST /api/send-emails-batch
// Sends personalized eligibility notification emails to ALL students who:
//   - Are confirmed or conditional for at least one program
//   - Haven't been emailed yet for that program
//
// In demo mode: doesn't actually send via SES — logs the emails and
// records them in the database so the dashboard shows the tracking data.
//
// Returns: { sent: number, students: [...cwids] }
// ──────────────────────────────────────────────────────────────────────────

import { NextResponse } from "next/server";
import {
  getEligibleUnsentStudents,
  upsertStudent,
  createAcceptToken,
  addOutreachEntry,
} from "@/lib/db/store";

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

export async function POST() {
  const students = getEligibleUnsentStudents();

  if (students.length === 0) {
    return NextResponse.json({
      sent: 0,
      message: "No students need emails — all eligible students have already been sent.",
      students: [],
    });
  }

  const now = new Date().toISOString();
  const sentCwids: string[] = [];
  const emailPreviews: { cwid: string; name: string; programs: string[]; links: Record<string, string> }[] = [];

  for (const student of students) {
    const programs: string[] = [];
    const links: Record<string, string> = {};

    // EOPS
    if (
      (student.ep_eops_status === "confirmed" || student.ep_eops_status === "conditional") &&
      !student.ep_eops_email_sent
    ) {
      const token = createAcceptToken(student.cwid, "eops");
      student.ep_eops_email_sent = now;
      programs.push("EOPS");
      links.eops = `${BASE_URL}/api/accept?token=${token.token}`;
      addOutreachEntry({
        cwid:       student.cwid,
        program:    "eops",
        action:     "email_sent",
        timestamp:  now,
        details:    `Email sent with trackable link: ${links.eops}`,
        staff_name: null,
      });
    }

    // CARE
    if (
      (student.ep_care_status === "confirmed" || student.ep_care_status === "conditional") &&
      !student.ep_care_email_sent
    ) {
      const token = createAcceptToken(student.cwid, "care");
      student.ep_care_email_sent = now;
      programs.push("CARE");
      links.care = `${BASE_URL}/api/accept?token=${token.token}`;
      addOutreachEntry({
        cwid:       student.cwid,
        program:    "care",
        action:     "email_sent",
        timestamp:  now,
        details:    `Email sent with trackable link: ${links.care}`,
        staff_name: null,
      });
    }

    // CalWORKs
    if (
      (student.ep_calworks_status === "confirmed" || student.ep_calworks_status === "conditional") &&
      !student.ep_calworks_email_sent
    ) {
      const token = createAcceptToken(student.cwid, "calworks");
      student.ep_calworks_email_sent = now;
      programs.push("CalWORKs");
      links.calworks = `${BASE_URL}/api/accept?token=${token.token}`;
      addOutreachEntry({
        cwid:       student.cwid,
        program:    "calworks",
        action:     "email_sent",
        timestamp:  now,
        details:    `Email sent with trackable link: ${links.calworks}`,
        staff_name: null,
      });
    }

    if (programs.length > 0) {
      upsertStudent(student);
      sentCwids.push(student.cwid);
      emailPreviews.push({
        cwid:     student.cwid,
        name:     `${student.first_name} ${student.last_name}`,
        programs,
        links,
      });

      // In production: call AWS SES here with the student's email + HTML template
      console.log(
        `[EMAIL DEMO] Would send to ${student.email_gwc}: ` +
        `Qualified for ${programs.join(", ")} — links: ${JSON.stringify(links)}`
      );
    }
  }

  return NextResponse.json({
    sent:     sentCwids.length,
    message:  `Sent emails to ${sentCwids.length} students (demo mode — logged, not actually delivered via SES)`,
    students: emailPreviews,
  });
}
