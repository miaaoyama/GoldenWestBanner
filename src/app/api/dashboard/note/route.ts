import { NextRequest, NextResponse } from "next/server";
import { getStudent, upsertStudent, addOutreachEntry } from "@/lib/db/store";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { cwid, note, staffName } = body as {
      cwid: string;
      note: string;
      staffName: string;
    };

    if (!cwid || !note || !staffName) {
      return NextResponse.json(
        { error: "Missing required fields: cwid, note, staffName" },
        { status: 400 }
      );
    }

    const student = getStudent(cwid);
    if (!student) {
      return NextResponse.json(
        { error: `Student not found: ${cwid}` },
        { status: 404 }
      );
    }

    const now = new Date().toISOString();

    // Append note to ep_staff_notes
    const existingNotes = student.ep_staff_notes || "";
    const formattedNote = `[${now}] ${staffName}: ${note}`;
    const updatedNotes = existingNotes
      ? `${existingNotes}\n${formattedNote}`
      : formattedNote;

    // Increment outreach attempts and update last outreach date
    const updatedStudent = {
      ...student,
      ep_staff_notes: updatedNotes,
      ep_outreach_attempts: (student.ep_outreach_attempts || 0) + 1,
      ep_last_outreach_date: now,
    };

    upsertStudent(updatedStudent);

    // Log the outreach entry
    addOutreachEntry({
      cwid,
      staffName,
      note,
      date: now,
    });

    return NextResponse.json({ success: true, student: updatedStudent });
  } catch (error) {
    console.error("[POST /api/dashboard/note] Error:", error);
    return NextResponse.json(
      { error: "Failed to add note" },
      { status: 500 }
    );
  }
}
