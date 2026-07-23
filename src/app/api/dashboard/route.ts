// src/app/api/dashboard/route.ts
import { NextResponse } from "next/server";
import { getAllStudents, getStudentsNeedingOutreach, getConditionalStudents, getRecentlyAccepted } from "@/lib/db/store";

export const dynamic = "force-dynamic";

export async function GET() {
  const [all, outreach, conditional, accepted] = await Promise.all([
    getAllStudents(),
    getStudentsNeedingOutreach(),
    getConditionalStudents(),
    getRecentlyAccepted(30),
  ]);

  function mapStudent(s: typeof all[0]) {
    const programs: string[] = [];
    if (s.ep_eops_status === "confirmed" || s.ep_eops_status === "conditional") programs.push("EOPS");
    if (s.ep_care_status === "confirmed" || s.ep_care_status === "conditional") programs.push("CARE");
    if (s.ep_calworks_status === "confirmed" || s.ep_calworks_status === "conditional") programs.push("CalWORKs");

    const emailSent = s.ep_eops_email_sent || s.ep_care_email_sent || s.ep_calworks_email_sent;
    const daysSince = emailSent ? Math.floor((Date.now() - new Date(emailSent).getTime()) / 86400000) : null;
    const clicked = s.ep_eops_email_clicked || s.ep_care_email_clicked || s.ep_calworks_email_clicked;
    const lastClickDays = emailSent && !clicked ? daysSince : null;
    const pendingItems = s.ep_pending_items ? s.ep_pending_items.split("; ").filter(Boolean) : [];

    // A student is "confirmed" if they're 100% for ANY program
    const hasConfirmed = s.ep_eops_status === "confirmed" || s.ep_care_status === "confirmed" || s.ep_calworks_status === "confirmed";
    const hasConditional = s.ep_eops_status === "conditional" || s.ep_care_status === "conditional" || s.ep_calworks_status === "conditional";

    let status = "not_eligible";
    if (hasConfirmed) status = "confirmed";
    else if (hasConditional) status = "conditional";

    // Outreach needed if:
    // 1. Student is confirmed but hasn't been emailed yet, OR
    // 2. Student is only conditional (no confirmed programs)
    let outreachStatus = "not_needed";
    if (hasConfirmed && !emailSent) outreachStatus = "needed";
    else if (!hasConfirmed && hasConditional) outreachStatus = "needed";

    const acceptedDate = s.ep_eops_accepted_date || s.ep_care_accepted_date || s.ep_calworks_accepted_date;

    return { id: s.cwid, name: `${s.first_name} ${s.last_name}`, email: s.email_gwc, program: programs.join(", ") || "None", outreach_status: outreachStatus, status, email_sent_date: emailSent, days_since_contact: daysSince, pending_items: pendingItems, staff_notes: s.ep_staff_notes, accepted_date: acceptedDate, tier: s.ep_eops_tier || "", last_click_days: lastClickDays };
  }

  const allMapped = all.map(mapStudent);

  return NextResponse.json({
    students: allMapped,
    stats: {
      total: all.length,
      needs_outreach: allMapped.filter(s => s.outreach_status === "needed").length,
      conditional: allMapped.filter(s => s.status === "conditional").length,
      accepted_last_30: accepted.length,
    },
  });
}
