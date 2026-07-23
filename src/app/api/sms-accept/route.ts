// src/app/api/sms-accept/route.ts
// POST /api/sms-accept — records acceptance via SMS (no token needed, uses CWID directly)
// Called by the phone mockup when student texts Y.

import { NextRequest, NextResponse } from "next/server";
import { getStudent, upsertStudent, addOutreachEntry } from "@/lib/db/store";

export async function POST(req: NextRequest) {
  const { cwid, programs } = await req.json();
  if (!cwid) return NextResponse.json({ error: "Missing cwid" }, { status: 400 });

  const student = await getStudent(cwid);
  if (!student) return NextResponse.json({ error: "Student not found" }, { status: 404 });

  const now = new Date().toISOString();

  for (const prog of (programs || ["eops"])) {
    (student as unknown as Record<string, unknown>)[`ep_${prog}_accepted_date`] = now;
    (student as unknown as Record<string, unknown>)[`ep_${prog}_email_clicked`] = now;
    (student as unknown as Record<string, unknown>)[`ep_${prog}_outreach_status`] = "not_needed";

    await addOutreachEntry({
      cwid,
      program: prog,
      action: "accepted",
      timestamp: now,
      details: `Student opted in via SMS reply (Y)`,
      staff_name: null,
    });
  }

  await upsertStudent(student);

  return NextResponse.json({
    success: true,
    student: `${student.first_name} ${student.last_name}`,
    programs,
  }, {
    headers: { "Access-Control-Allow-Origin": "*" },
  });
}
