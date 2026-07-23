// src/app/api/send-emails-batch/route.ts
// POST /api/send-emails-batch
// Sends eligibility notification emails to all students who qualify but
// haven't been emailed yet. IDEMPOTENT — safe to re-run; checks
// ep_[program]_email_sent before sending to prevent duplicate emails.

import { NextResponse } from "next/server";
import { SESv2Client, SendEmailCommand } from "@aws-sdk/client-sesv2";
import {
  getEligibleUnsentStudents,
  upsertStudent,
  createAcceptToken,
  addOutreachEntry,
} from "@/lib/db/store";

export const dynamic = "force-dynamic";

const ses = new SESv2Client({ region: process.env.APP_AWS_REGION || process.env.AWS_REGION || "us-west-2" });
const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
const FROM_EMAIL = process.env.SES_FROM_EMAIL || "dankim2022@gmail.com";

// SES sandbox mode: can only send to verified addresses.
// Set this to a verified email for testing, or null to use student's real email.
const OVERRIDE_TO_EMAIL = process.env.SES_OVERRIDE_TO || null;

export async function POST() {
  const students = await getEligibleUnsentStudents();

  if (students.length === 0) {
    return NextResponse.json({
      sent: 0,
      message: "No students need emails — all eligible students have already been emailed.",
    });
  }

  const now = new Date().toISOString();
  const results: { cwid: string; name: string; programs: string[]; links: Record<string, string> }[] = [];

  for (const student of students) {
    const programs: string[] = [];
    const links: Record<string, string> = {};

    // EOPS — idempotency: only send if not already sent
    if ((student.ep_eops_status === "confirmed" || student.ep_eops_status === "conditional") && !student.ep_eops_email_sent) {
      const token = await createAcceptToken(student.cwid, "eops");
      student.ep_eops_email_sent = now;
      programs.push("EOPS");
      links.eops = `${BASE_URL}/api/accept?token=${token.token}`;
    }

    // CARE
    if ((student.ep_care_status === "confirmed" || student.ep_care_status === "conditional") && !student.ep_care_email_sent) {
      const token = await createAcceptToken(student.cwid, "care");
      student.ep_care_email_sent = now;
      programs.push("CARE");
      links.care = `${BASE_URL}/api/accept?token=${token.token}`;
    }

    // CalWORKs
    if ((student.ep_calworks_status === "confirmed" || student.ep_calworks_status === "conditional") && !student.ep_calworks_email_sent) {
      const token = await createAcceptToken(student.cwid, "calworks");
      student.ep_calworks_email_sent = now;
      programs.push("CalWORKs");
      links.calworks = `${BASE_URL}/api/accept?token=${token.token}`;
    }

    if (programs.length === 0) continue;

    // Create opt-out tokens for each program too
    const optoutLinks: Record<string, string> = {};
    for (const p of programs) {
      const key = p.toLowerCase().replace("calworks", "calworks");
      const optoutToken = await createAcceptToken(student.cwid, key + "_optout");
      optoutLinks[key] = `${BASE_URL}/api/optout?token=${optoutToken.token}`;
    }

    // Build email HTML
    const programList = programs.map((p) => {
      const key = p.toLowerCase().replace("calworks", "calworks");
      const link = links[key] || links[p.toLowerCase()];
      const optout = optoutLinks[key];
      const status = (student as unknown as Record<string, unknown>)[`ep_${key}_status`] as string;
      const statusLabel = status === "confirmed" ? "100% Qualified" : "Conditionally Qualified";
      return `<tr><td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;font-weight:600;">${p}</td><td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;">${statusLabel}</td><td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;"><a href="${link}" style="background:#0F603D;color:#fff;padding:6px 14px;border-radius:6px;text-decoration:none;font-size:13px;font-weight:600;">Accept →</a> <a href="${optout}" style="color:#9ca3af;font-size:11px;margin-left:8px;text-decoration:underline;">Opt out</a></td></tr>`;
    }).join("");

    // General opt-out link (uses first program's token)
    const firstOptout = optoutLinks[programs[0].toLowerCase().replace("calworks", "calworks")];

    const emailHtml = `
      <div style="font-family:'Segoe UI',sans-serif;max-width:560px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;border:1px solid #e5e7eb;">
        <div style="background:#0F603D;padding:20px 24px;"><h1 style="color:#FFC522;margin:0;font-size:20px;">Golden West College</h1><p style="color:rgba(255,255,255,0.7);margin:4px 0 0;font-size:12px;">Student Services Eligibility Notification</p></div>
        <div style="padding:24px;">
          <p style="font-size:15px;color:#1a2a20;">Hi ${student.first_name},</p>
          <p style="font-size:15px;color:#374151;margin-top:12px;">Based on your enrollment records, you qualify for the following support programs at GWC:</p>
          <table style="width:100%;border-collapse:collapse;margin:16px 0;font-size:14px;"><thead><tr style="background:#f2f8f5;"><th style="padding:8px 12px;text-align:left;">Program</th><th style="padding:8px 12px;text-align:left;">Status</th><th style="padding:8px 12px;text-align:left;">Action</th></tr></thead><tbody>${programList}</tbody></table>
          ${student.ep_pending_items ? `<div style="background:#fffbeb;border:1px solid #fde68a;border-radius:8px;padding:12px 16px;margin:16px 0;"><p style="font-size:12px;font-weight:700;color:#92400e;text-transform:uppercase;margin:0 0 4px;">Documents needed:</p><p style="font-size:13px;color:#374151;margin:0;">${student.ep_pending_items}</p></div>` : ""}
          <p style="font-size:13px;color:#6b7280;margin-top:20px;">Click "Accept" to confirm your spot. Each link is personal to you — no application needed.</p>
          <p style="font-size:11px;color:#9ca3af;margin-top:20px;border-top:1px solid #e5e7eb;padding-top:12px;">Golden West College | 15744 Goldenwest St, Huntington Beach, CA 92647<br><a href="${firstOptout}" style="color:#9ca3af;">Opt out of all program notifications</a></p>
        </div>
      </div>`;

    // Send via SES
    const toEmail = OVERRIDE_TO_EMAIL || student.email_gwc;
    try {
      await ses.send(new SendEmailCommand({
        FromEmailAddress: FROM_EMAIL,
        Destination: { ToAddresses: [toEmail] },
        Content: {
          Simple: {
            Subject: { Data: `${student.first_name}, you qualify for ${programs.join(" & ")} at GWC!` },
            Body: { Html: { Data: emailHtml } },
          },
        },
      }));
      console.log(`[SES] Sent to ${toEmail} for ${programs.join(", ")}`);
    } catch (err) {
      console.error(`[SES ERROR] Failed to send to ${toEmail}:`, err);
      // Don't block the batch — continue with next student
    }

    // Save updated student (email_sent timestamps now set)
    await upsertStudent(student);

    // Log entries
    for (const program of programs) {
      await addOutreachEntry({
        cwid:       student.cwid,
        program:    program.toLowerCase(),
        action:     "email_sent",
        timestamp:  now,
        details:    `Email sent to ${toEmail} with accept link`,
        staff_name: null,
      });
    }

    results.push({ cwid: student.cwid, name: `${student.first_name} ${student.last_name}`, programs, links });
  }

  return NextResponse.json({
    sent: results.length,
    message: `Sent emails to ${results.length} students via SES (${OVERRIDE_TO_EMAIL ? "sandbox: all redirected to " + OVERRIDE_TO_EMAIL : "production mode"})`,
    students: results,
  });
}
