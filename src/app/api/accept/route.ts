// src/app/api/accept/route.ts
// GET /api/accept?token=<uuid>
// Student clicks their email link → records the click, marks accepted.

import { NextRequest } from "next/server";
import { getAcceptToken, markTokenClicked, getStudent, upsertStudent, addOutreachEntry } from "@/lib/db/store";

export const dynamic = "force-dynamic";

function htmlPage(title: string, body: string): Response {
  return new Response(
    `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title>
    <style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:'Segoe UI',sans-serif;background:#f2f8f5;display:flex;align-items:center;justify-content:center;min-height:100vh;padding:20px}
    .card{background:#fff;border-radius:16px;padding:40px;max-width:480px;text-align:center;box-shadow:0 4px 24px rgba(0,0,0,0.1);border-top:5px solid #0F603D}
    h1{color:#0F603D;font-size:24px;margin-bottom:12px}p{color:#374151;font-size:15px;line-height:1.6}
    .gold{color:#FFC522;font-size:48px;margin-bottom:16px}</style></head>
    <body><div class="card">${body}</div></body></html>`,
    { headers: { "Content-Type": "text/html" } }
  );
}

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token");
  if (!token) {
    return htmlPage("Invalid Link", "<h1>Invalid Link</h1><p>No token provided.</p>");
  }

  const acceptToken = await getAcceptToken(token);
  if (!acceptToken || acceptToken.expired) {
    return htmlPage("Link Expired", "<h1>This link has expired</h1><p>Please contact your counselor for assistance.</p>");
  }

  if (acceptToken.clicked_at) {
    return htmlPage("Already Accepted", '<div class="gold">✅</div><h1>You already accepted</h1><p>No further action needed. If you have questions, contact your program coordinator.</p>');
  }

  // Mark token as clicked
  await markTokenClicked(token);

  // Update student record
  const now = new Date().toISOString();
  const program = acceptToken.program;
  const student = await getStudent(acceptToken.cwid);

  if (student) {
    (student as unknown as Record<string, unknown>)[`ep_${program}_email_clicked`] = now;
    (student as unknown as Record<string, unknown>)[`ep_${program}_accepted_date`] = now;
    (student as unknown as Record<string, unknown>)[`ep_${program}_outreach_status`] = "not_needed";
    await upsertStudent(student);
  }

  // Log the acceptance
  await addOutreachEntry({
    cwid:       acceptToken.cwid,
    program,
    action:     "accepted",
    timestamp:  now,
    details:    `Student clicked accept link for ${program.toUpperCase()}`,
    staff_name: null,
  });

  const programName = program.toUpperCase();
  return htmlPage(
    "Confirmed!",
    `<div class="gold">🎉</div>
     <h1>You're confirmed for ${programName}!</h1>
     <p>A confirmation email has been sent to your GWC student email. The ${programName} office will be in touch with next steps and orientation details.</p>
     <p style="margin-top:16px;font-size:13px;color:#6b7280;">You can close this page.</p>`
  );
}
