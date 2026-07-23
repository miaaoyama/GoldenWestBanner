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

    let status = "not_eligible";
    if (s.ep_eops_status === "confirmed" || s.ep_care_status === "confirmed" || s.ep_calworks_status === "confirmed") status = "confirmed";
    else if (s.ep_eops_status === "conditional" || s.ep_care_status === "conditional" || s.ep_calworks_status === "conditional") status = "conditional";

    let outreachStatus = "not_needed";
    if (s.ep_eops_outreach_status === "needed" || s.ep_care_outreach_status === "needed" || s.ep_calworks_outreach_status === "needed") outreachStatus = "needed";

    const acceptedDate = s.ep_eops_accepted_date || s.ep_care_accepted_date || s.ep_calworks_accepted_date;

    return { id: s.cwid, name: `${s.first_name} ${s.last_name}`, email: s.email_gwc, program: programs.join(", ") || "None", outreach_status: outreachStatus, status, email_sent_date: emailSent, days_since_contact: daysSince, pending_items: pendingItems, staff_notes: s.ep_staff_notes, accepted_date: acceptedDate, tier: s.ep_eops_tier || "", last_click_days: lastClickDays };
  }

  const allMapped = all.map(mapStudent);

  return NextResponse.json({
    students: allMapped,
    stats: { total: all.length, needs_outreach: outreach.length, conditional: conditional.length, accepted_last_30: accepted.length },
  });
}
