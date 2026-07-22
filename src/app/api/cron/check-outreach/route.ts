/**
 * Nightly Outreach Eligibility Check
 *
 * In production, this route would be triggered by a scheduled cron job
 * (e.g., AWS EventBridge rule, Vercel Cron, GitHub Actions schedule, etc.)
 * running once per night to flag students who need follow-up outreach.
 *
 * GET /api/cron/check-outreach
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAllStudents, upsertStudent } from '@/lib/db/store';

const PROGRAMS = ['eops', 'care', 'calworks'] as const;
const THREE_DAYS_MS = 3 * 24 * 60 * 60 * 1000;

export async function GET(_request: NextRequest) {
  const students = getAllStudents();
  const now = Date.now();
  let flagged = 0;

  for (const student of students) {
    let updated = false;

    for (const program of PROGRAMS) {
      const emailSentKey = `ep_${program}_email_sent` as keyof typeof student;
      const emailClickedKey = `ep_${program}_email_clicked` as keyof typeof student;
      const outreachStatusKey = `ep_${program}_outreach_status` as keyof typeof student;
      const statusKey = `ep_${program}_status` as keyof typeof student;

      const emailSent = student[emailSentKey] as string | null;
      const emailClicked = student[emailClickedKey] as string | null;
      const outreachStatus = student[outreachStatusKey] as string | null;
      const programStatus = student[statusKey] as string | null;

      // Rule 1: Email sent, not clicked, and more than 3 days ago
      if (
        emailSent !== null &&
        emailClicked === null &&
        now - new Date(emailSent).getTime() > THREE_DAYS_MS
      ) {
        if (outreachStatus !== 'needed') {
          (student as unknown as Record<string, unknown>)[outreachStatusKey] = 'needed';
          updated = true;
          flagged++;
        }
      }

      // Rule 2: Conditional students who haven't been contacted yet
      if (
        programStatus === 'conditional' &&
        outreachStatus === 'not_needed'
      ) {
        (student as unknown as Record<string, unknown>)[outreachStatusKey] = 'needed';
        updated = true;
        flagged++;
      }
    }

    if (updated) {
      upsertStudent(student);
    }
  }

  return NextResponse.json({
    checked: students.length,
    flagged,
  });
}
