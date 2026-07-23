// src/app/api/optout/route.ts
// GET /api/optout?token=<uuid>
// Student clicks the opt-out link in their email.

import { NextRequest } from "next/server";
import { getAcceptToken, getStudent, upsertStudent, addOutreachEntry } from "@/lib/db/store";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token");
  if (!token) {
    return htmlPage("Invalid Link", "<h1>Invalid link</h1><p>No token provided.</p>");
  }

  const acceptToken = await getAcceptToken(token);
  if (!acceptToken || acceptToken.expired) {
    return htmlPage("Link Expired", "<h1>This link has expired</h1><p>Please contact Student Services if you need assistance.</p>");
  }

  const now = new Date().toISOString();
  const program = acceptToken.program.replace("_optout", "");
  const student = await getStudent(acceptToken.cwid);

  if (student) {
    (student as unknown as Record<string, unknown>)[`ep_${program}_status`] = "opted_out";
    (student as unknown as Record<string, unknown>)[`ep_${program}_email_clicked`] = now;
    (student as unknown as Record<string, unknown>)[`ep_${program}_outreach_status`] = "not_needed";
    await upsertStudent(student);
  }

  await addOutreachEntry({
    cwid:       acceptToken.cwid,
    program,
    action:     "opted_out",
    timestamp:  now,
    details:    `Student opted out of ${program.toUpperCase()} via email link`,
    staff_name: null,
  });

  return htmlPage(
    "Opted Out",
    `<div style="font-size:2rem;margin-bottom:12px;">✓</div>
     <h1>You've opted out of ${program.toUpperCase()}</h1>
     <p>You won't receive further notifications about this program. If you change your mind, visit Student Services.</p>`
  );
}

function htmlPage(title: string, body: string): Response {
  return new Response(
    `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title>
    <style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:'Segoe UI',sans-serif;background:#f2f8f5;display:flex;align-items:center;justify-content:center;min-height:100vh;padding:20px}
    .card{background:#fff;border-radius:16px;padding:40px;max-width:480px;text-align:center;box-shadow:0 4px 24px rgba(0,0,0,0.1);border-top:5px solid #6b7280}
    h1{color:#374151;font-size:22px;margin-bottom:12px}p{color:#6b7280;font-size:15px;line-height:1.6}</style></head>
    <body><div class="card">${body}</div></body></html>`,
    { headers: { "Content-Type": "text/html" } }
  );
}
