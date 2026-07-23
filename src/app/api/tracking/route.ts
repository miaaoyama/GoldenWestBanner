// src/app/api/tracking/route.ts
// GET /api/tracking
// Returns tracking status for all students — used by the portal UI
// to show opted-in, opted-out, or days waiting per student/program.

import { NextResponse } from "next/server";
import { getAllStudents } from "@/lib/db/store";

export const dynamic = "force-dynamic";

export async function GET() {
  const students = await getAllStudents();
  const now = Date.now();

  const tracking = students.map(s => {
    const programs = ["eops", "care", "calworks"] as const;
    const statuses: Record<string, {
      status: string;      // "pending" | "opted_in" | "opted_out" | "not_sent"
      daysSince: number | null;
      hoursSince: number | null;
      urgent: boolean;     // true if > 48 hours without response
    }> = {};

    for (const prog of programs) {
      const emailSent = (s as unknown as Record<string, unknown>)[`ep_${prog}_email_sent`] as string | null;
      const clicked = (s as unknown as Record<string, unknown>)[`ep_${prog}_email_clicked`] as string | null;
      const accepted = (s as unknown as Record<string, unknown>)[`ep_${prog}_accepted_date`] as string | null;
      const progStatus = (s as unknown as Record<string, unknown>)[`ep_${prog}_status`] as string;

      if (progStatus === "opted_out") {
        statuses[prog] = { status: "opted_out", daysSince: null, hoursSince: null, urgent: false };
      } else if (accepted) {
        statuses[prog] = { status: "opted_in", daysSince: null, hoursSince: null, urgent: false };
      } else if (emailSent && !clicked) {
        const ms = now - new Date(emailSent).getTime();
        const hours = Math.floor(ms / 3600000);
        const days = Math.floor(ms / 86400000);
        const urgent = hours >= 48;
        statuses[prog] = { status: "pending", daysSince: days, hoursSince: hours, urgent };
      } else if (!emailSent && (progStatus === "confirmed" || progStatus === "conditional")) {
        statuses[prog] = { status: "not_sent", daysSince: null, hoursSince: null, urgent: false };
      } else {
        statuses[prog] = { status: "not_eligible", daysSince: null, hoursSince: null, urgent: false };
      }
    }

    return {
      cwid: s.cwid,
      name: `${s.first_name} ${s.last_name}`,
      programs: statuses,
    };
  });

  return NextResponse.json({ tracking });
}
