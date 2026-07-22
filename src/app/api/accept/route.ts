import { NextRequest } from "next/server";
import {
  getAcceptToken,
  markTokenClicked,
  getStudent,
  upsertStudent,
  addOutreachEntry,
} from "@/lib/db/store";

function htmlPage(title: string, body: string): Response {
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>${title} — Golden West College</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      background: #f8f9fa;
      color: #1a1a1a;
    }
    .card {
      background: white;
      border-radius: 12px;
      box-shadow: 0 4px 24px rgba(0,0,0,0.1);
      padding: 3rem 2.5rem;
      max-width: 480px;
      width: 90%;
      text-align: center;
    }
    .card h1 {
      color: #0F603D;
      font-size: 1.5rem;
      margin-bottom: 1rem;
    }
    .card p {
      font-size: 1.1rem;
      line-height: 1.6;
      color: #333;
    }
    .banner {
      height: 6px;
      background: linear-gradient(90deg, #0F603D, #FFC522);
      border-radius: 12px 12px 0 0;
      margin: -3rem -2.5rem 2rem -2.5rem;
    }
    .success-icon {
      font-size: 3rem;
      margin-bottom: 1rem;
    }
  </style>
</head>
<body>
  <div class="card">
    <div class="banner"></div>
    ${body}
  </div>
</body>
</html>`;

  return new Response(html, {
    status: 200,
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const token = searchParams.get("token");

  if (!token) {
    return htmlPage(
      "Invalid Link",
      `<h1>Invalid Link</h1>
       <p>No token was provided. Please use the link from your email.</p>`
    );
  }

  const acceptToken = await getAcceptToken(token);

  // Token not found or expired
  if (!acceptToken || (acceptToken.expiresAt && new Date(acceptToken.expiresAt) < new Date())) {
    return htmlPage(
      "Link Expired",
      `<h1>This link has expired</h1>
       <p>The acceptance link you clicked is no longer valid. Please contact your counselor or program coordinator for assistance.</p>`
    );
  }

  // Already clicked
  if (acceptToken.clickedAt) {
    return htmlPage(
      "Already Accepted",
      `<h1>You already accepted</h1>
       <p>You've already confirmed your spot. No further action is needed. If you have questions, please contact your program coordinator.</p>`
    );
  }

  // Valid token — process acceptance
  await markTokenClicked(token);

  const student = await getStudent(acceptToken.cwid);
  const program = acceptToken.program;
  const now = new Date().toISOString();

  if (student) {
    await upsertStudent({
      ...student,
      [`ep_${program}_email_clicked`]: now,
      [`ep_${program}_accepted_date`]: now,
      [`ep_${program}_outreach_status`]: "not_needed",
    });
  }

  await addOutreachEntry({
    cwid: acceptToken.cwid,
    program,
    action: "accepted",
    timestamp: now,
  });

  const programDisplay = program.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

  return htmlPage(
    "Confirmed!",
    `<div class="success-icon">🎉</div>
     <h1>You're confirmed for ${programDisplay}!</h1>
     <p>A confirmation email has been sent to your GWC address.</p>`
  );
}
