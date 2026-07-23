// src/app/api/sms-reply/route.ts
// Handles Y/N SMS replies from the phone mockup page (/phone).
// Calls sms-accept or sms-optout to update DynamoDB.

import { NextRequest, NextResponse } from "next/server";
import { getAllStudents, getStudent, upsertStudent, addOutreachEntry } from "@/lib/db/store";

export async function POST(req: NextRequest) {
  const { action, studentName } = await req.json();

  if (!action || !studentName) {
    return NextResponse.json({ error: "Missing action or studentName" }, { status: 400 });
  }

  // Find student by first name match
  const students = await getAllStudents();
  const firstName = studentName.split(" ")[0].toLowerCase();
  const student = students.find(s => s.first_name.toLowerCase() === firstName);

  if (!student) {
    return NextResponse.json({ success: false, error: `Student "${studentName}" not found` });
  }

  const now = new Date().toISOString();
  const programs = ["eops", "care", "calworks"].filter(prog => {
    const status = (student as unknown as Record<string, unknown>)[`ep_${prog}_status`] as string;
    return status === "confirmed" || status === "conditional";
  });

  for (const prog of programs) {
    if (action === "accept") {
      (student as unknown as Record<string, unknown>)[`ep_${prog}_accepted_date`] = now;
      (student as unknown as Record<string, unknown>)[`ep_${prog}_email_clicked`] = now;
      (student as unknown as Record<string, unknown>)[`ep_${prog}_outreach_status`] = "not_needed";
    } else {
      (student as unknown as Record<string, unknown>)[`ep_${prog}_status`] = "opted_out";
      (student as unknown as Record<string, unknown>)[`ep_${prog}_email_clicked`] = now;
      (student as unknown as Record<string, unknown>)[`ep_${prog}_outreach_status`] = "not_needed";
    }

    await addOutreachEntry({
      cwid: student.cwid,
      program: prog,
      action: action === "accept" ? "accepted" : "opted_out",
      timestamp: now,
      details: `Student ${action === "accept" ? "opted in" : "opted out"} via SMS reply`,
      staff_name: null,
    });
  }

  await upsertStudent(student);

  return NextResponse.json({
    success: true,
    action,
    student: `${student.first_name} ${student.last_name}`,
    programs,
  });
}
