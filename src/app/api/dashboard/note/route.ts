// src/app/api/dashboard/note/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getStudent, upsertStudent, addOutreachEntry } from "@/lib/db/store";

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { cwid, note, staff_name } = body as { cwid: string; note: string; staff_name: string };

  if (!cwid || !note || !staff_name) {
    return NextResponse.json({ error: "Missing required fields: cwid, note, staff_name" }, { status: 400 });
  }

  const student = await getStudent(cwid);
  if (!student) {
    return NextResponse.json({ error: `Student not found: ${cwid}` }, { status: 404 });
  }

  const now = new Date().toISOString();
  const formattedNote = `[${now}] ${staff_name}: ${note}`;
  student.ep_staff_notes = student.ep_staff_notes ? `${student.ep_staff_notes}\n${formattedNote}` : formattedNote;
  student.ep_outreach_attempts = (student.ep_outreach_attempts || 0) + 1;
  student.ep_last_outreach_date = now;

  await upsertStudent(student);
  await addOutreachEntry({ cwid, program: "general", action: "staff_note", timestamp: now, details: note, staff_name });

  return NextResponse.json({ success: true });
}
