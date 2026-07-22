// src/app/api/cron/check-outreach/route.ts
// GET /api/cron/check-outreach
// Nightly job: flags students who haven't clicked after 3 days.
// In production, trigger via AWS EventBridge or Vercel Cron.
//
// Uses the outreach-status-index GSI to efficiently find candidates
// without scanning the entire table.

import { NextResponse } from "next/server";
import { getAllStudents, upsertStudent } from "@/lib/db/store";

export const dynamic = "force-dynamic";

const THREE_DAYS_MS = 3 * 24 * 60 * 60 * 1000;
const PROGRAMS = ["eops", "care", "calworks"] as const;

export async function GET() {
  const students = await getAllStudents();
  const now = Date.now();
  let flagged = 0;

  for (const student of students) {
    let updated = false;

    for (const program of PROGRAMS) {
      const emailSentKey     = `ep_${program}_email_sent` as keyof typeof student;
      const emailClickedKey  = `ep_${program}_email_clicked` as keyof typeof student;
      const outreachKey      = `ep_${program}_outreach_status` as keyof typeof student;
      const statusKey        = `ep_${program}_status` as keyof typeof student;

      const emailSent      = student[emailSentKey] as string | null;
      const emailClicked   = student[emailClickedKey] as string | null;
      const outreachStatus = student[outreachKey] as string;
      const programStatus  = student[statusKey] as string;

      // Rule 1: Email sent > 3 days ago, not clicked → flag for outreach
      if (emailSent && !emailClicked && (now - new Date(emailSent).getTime() > THREE_DAYS_MS)) {
        if (outreachStatus !== "needed") {
          (student as unknown as Record<string, unknown>)[outreachKey] = "needed";
          updated = true;
          flagged++;
        }
      }

      // Rule 2: Conditional but not yet flagged
      if (programStatus === "conditional" && outreachStatus === "not_needed") {
        (student as unknown as Record<string, unknown>)[outreachKey] = "needed";
        updated = true;
        flagged++;
      }
    }

    if (updated) await upsertStudent(student);
  }

  return NextResponse.json({ checked: students.length, flagged });
}
