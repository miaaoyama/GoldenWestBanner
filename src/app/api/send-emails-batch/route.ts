// src/app/api/send-emails-batch/route.ts
// ──────────────────────────────────────────────────────────────────────────
// POST /api/send-emails-batch
// Sends eligibility notification emails with anti-spam rules:
//
//   1. BUSINESS HOURS ONLY — Mon-Fri, 8AM-5PM Pacific
//   2. MAX 3 ATTEMPTS — after 3 ignored emails, stop permanently
//   3. STOP AFTER CLICK — if student clicked (accept or opt-out), never email again
//   4. IDEMPOTENT — safe to re-run, won't double-send
//
// Schedule (for production via EventBridge):
//   Runs daily at 9:00 AM Pacific (Mon-Fri only)
//   First email: day student is identified as eligible
//   Second email: 3 days after first (if no response)
//   Third email: 3 days after second (if no response)
//   After 3rd: stop emailing, flag for staff phone outreach
// ──────────────────────────────────────────────────────────────────────────

import { NextResponse } from "next/server";
import { SESv2Client, SendEmailCommand } from "@aws-sdk/client-sesv2";
import {
  getAllStudents,
  upsertStudent,
  createAcceptToken,
  addOutreachEntry,
} from "@/lib/db/store";
import type { StudentRecord } from "@/lib/db/schema";

export const dynamic = "force-dynamic";

const ses = new SESv2Client({ region: process.env.APP_AWS_REGION || process.env.AWS_REGION || "us-west-2" });
const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || "https://3mag8ec9a2.execute-api.us-west-2.amazonaws.com/prod";
const FROM_EMAIL = process.env.SES_FROM_EMAIL || "dankim2022@gmail.com";
const OVERRIDE_TO_EMAIL = process.env.SES_OVERRIDE_TO || null;

const MAX_EMAIL_ATTEMPTS = 3;
const DAYS_BETWEEN_EMAILS = 3;

// ── Business hours check (Pacific Time) ───────────────────────────────────

function isBusinessHours(): boolean {
  // Get current time in Pacific
  const now = new Date();
  const pacific = new Date(now.toLocaleString("en-US", { timeZone: "America/Los_Angeles" }));
  const day = pacific.getDay();   // 0=Sun, 1=Mon, ..., 6=Sat
  const hour = pacific.getHours();

  // Mon-Fri (1-5), 8AM-5PM
  const isWeekday = day >= 1 && day <= 5;
  const isWorkHours = hour >= 8 && hour < 17;

  return isWeekday && isWorkHours;
}

// ── Check if enough time has passed since last email ──────────────────────

function daysSince(dateStr: string | null): number {
  if (!dateStr) return Infinity;
  return Math.floor((Date.now() - new Date(dateStr).getTime()) / 86400000);
}

// ── Should we email this student for this program? ────────────────────────

function shouldEmail(student: StudentRecord, program: string): boolean {
  const s = student as unknown as Record<string, unknown>;
  const status = s[`ep_${program}_status`] as string;
  const emailClicked = s[`ep_${program}_email_clicked`] as string | null;
  const emailSent = s[`ep_${program}_email_sent`] as string | null;
  const attempts = (s[`ep_${program}_email_attempts`] as number) || 0;

  // Rule 1: only email confirmed students
  if (status !== "confirmed") return false;

  // Rule 2: stop if student already clicked (accepted or opted out)
  if (emailClicked) return false;

  // Rule 3: stop after max attempts
  if (attempts >= MAX_EMAIL_ATTEMPTS) return false;

  // Rule 4: if never sent, send now
  if (!emailSent) return true;

  // Rule 5: if sent before, wait DAYS_BETWEEN_EMAILS days
  if (daysSince(emailSent) >= DAYS_BETWEEN_EMAILS) return true;

  return false;
}

// ── Main handler ──────────────────────────────────────────────────────────

export async function POST() {
  // Check business hours (skip in test mode)
  const forceMode = process.env.FORCE_SEND === "true";
  if (!forceMode && !isBusinessHours()) {
    const now = new Date().toLocaleString("en-US", { timeZone: "America/Los_Angeles" });
    return NextResponse.json({
      sent: 0,
      message: `Outside business hours (Mon-Fri 8AM-5PM Pacific). Current time: ${now}. Set FORCE_SEND=true to override.`,
      skipped_reason: "outside_business_hours",
    });
  }

  const allStudents = await getAllStudents();
  const now = new Date().toISOString();
  const results: { cwid: string; name: string; programs: string[]; attempt: number; links: Record<string, string> }[] = [];
  let skippedMaxAttempts = 0;
  let skippedAlreadyClicked = 0;
  let skippedTooSoon = 0;

  for (const student of allStudents) {
    const programs: string[] = [];
    const links: Record<string, string> = {};
    const s = student as unknown as Record<string, unknown>;

    for (const prog of ["eops", "care", "calworks"]) {
      if (!shouldEmail(student, prog)) {
        // Track skip reasons
        const status = s[`ep_${prog}_status`] as string;
        const clicked = s[`ep_${prog}_email_clicked`] as string | null;
        const attempts = (s[`ep_${prog}_email_attempts`] as number) || 0;
        if (status === "confirmed" && clicked) skippedAlreadyClicked++;
        else if (status === "confirmed" && attempts >= MAX_EMAIL_ATTEMPTS) skippedMaxAttempts++;
        else if (status === "confirmed") skippedTooSoon++;
        continue;
      }

      // Create accept + optout tokens
      const acceptToken = await createAcceptToken(student.cwid, prog);
      const optoutToken = await createAcceptToken(student.cwid, prog + "_optout");
      links[prog] = `${BASE_URL}/api/accept?token=${acceptToken.token}`;

      // Update email sent timestamp and increment attempts
      s[`ep_${prog}_email_sent`] = now;
      s[`ep_${prog}_email_attempts`] = ((s[`ep_${prog}_email_attempts`] as number) || 0) + 1;
      programs.push(prog.toUpperCase());
    }

    if (programs.length === 0) continue;

    const attempts = (s.ep_eops_email_attempts as number) || (s.ep_care_email_attempts as number) || (s.ep_calworks_email_attempts as number) || 1;

    // Build email HTML
    // Build program rows (just name + checkmark, no per-row buttons)
    const programList = programs.map((p) => {
      return `<tr><td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;font-weight:600;">${p}</td><td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;"><span style="background:#0F603D;color:#fff;padding:2px 8px;border-radius:4px;font-size:11px;font-weight:700;">100% Qualified</span></td><td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;">✓</td></tr>`;
    }).join("");

    // Use the first program's token for the single accept link
    const firstLink = links[programs[0].toLowerCase()];
    const firstOptoutToken = Object.values(links)[0]?.split("token=")[1] || "";

    const attemptNote = attempts > 1 ? `<p style="font-size:12px;color:#92400e;margin-top:12px;background:#fffbeb;padding:8px 12px;border-radius:6px;">This is reminder ${attempts} of ${MAX_EMAIL_ATTEMPTS}. Click Accept or Opt Out to stop receiving these.</p>` : "";

    const emailHtml = `
      <div style="font-family:'Segoe UI',sans-serif;max-width:560px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;border:1px solid #e5e7eb;">
        <div style="background:#0F603D;padding:20px 24px;"><h1 style="color:#FFC522;margin:0;font-size:20px;">Golden West College</h1><p style="color:rgba(255,255,255,0.7);margin:4px 0 0;font-size:12px;">Student Services Eligibility Notification</p></div>
        <div style="padding:24px;">
          <p style="font-size:15px;color:#1a2a20;">Hi ${student.first_name},</p>
          <p style="font-size:15px;color:#374151;margin-top:12px;">Based on your enrollment records, you qualify for the following support programs at GWC:</p>
          <table style="width:100%;border-collapse:collapse;margin:16px 0;font-size:14px;"><thead><tr style="background:#f2f8f5;"><th style="padding:8px 12px;text-align:left;">Program</th><th style="padding:8px 12px;text-align:left;">Status</th><th style="padding:8px 12px;text-align:left;"></th></tr></thead><tbody>${programList}</tbody></table>
          ${attemptNote}
          <div style="text-align:center;margin:24px 0 16px;"><a href="${firstLink}" style="background:#0F603D;color:#fff;padding:12px 32px;border-radius:10px;font-size:15px;font-weight:700;text-decoration:none;display:inline-block;">Accept All Programs →</a></div>
          <p style="text-align:center;"><a href="${BASE_URL}/api/optout?token=${firstOptoutToken}" style="color:#9ca3af;font-size:12px;text-decoration:underline;">No thanks — opt out of all</a></p>
          <p style="font-size:11px;color:#9ca3af;margin-top:20px;border-top:1px solid #e5e7eb;padding-top:12px;">Golden West College | 15744 Goldenwest St, Huntington Beach, CA 92647</p>
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
            Subject: { Data: attempts > 1 ? `Reminder: ${student.first_name}, you qualify for ${programs.join(" & ")} at GWC` : `${student.first_name}, you qualify for ${programs.join(" & ")} at GWC!` },
            Body: { Html: { Data: emailHtml } },
          },
        },
      }));
      console.log(`[SES] Sent to ${toEmail} for ${programs.join(", ")} (attempt ${attempts})`);
    } catch (err) {
      console.error(`[SES ERROR] Failed to send to ${toEmail}:`, err);
    }

    // Save updated student
    await upsertStudent(student);

    // Log
    for (const prog of programs) {
      await addOutreachEntry({
        cwid: student.cwid,
        program: prog.toLowerCase(),
        action: "email_sent",
        timestamp: now,
        details: `Email attempt ${attempts}/${MAX_EMAIL_ATTEMPTS} sent to ${toEmail}`,
        staff_name: null,
      });
    }

    results.push({ cwid: student.cwid, name: `${student.first_name} ${student.last_name}`, programs, attempt: attempts, links });
  }

  // Flag students who hit max attempts for staff phone outreach
  for (const student of allStudents) {
    const s = student as unknown as Record<string, unknown>;
    let needsUpdate = false;
    for (const prog of ["eops", "care", "calworks"]) {
      const attempts = (s[`ep_${prog}_email_attempts`] as number) || 0;
      const clicked = s[`ep_${prog}_email_clicked`] as string | null;
      const outreach = s[`ep_${prog}_outreach_status`] as string;
      if (attempts >= MAX_EMAIL_ATTEMPTS && !clicked && outreach !== "needed") {
        s[`ep_${prog}_outreach_status`] = "needed";
        needsUpdate = true;
      }
    }
    if (needsUpdate) await upsertStudent(student);
  }

  return NextResponse.json({
    sent: results.length,
    message: `Sent emails to ${results.length} students`,
    schedule: {
      business_hours: "Mon-Fri 8AM-5PM Pacific",
      max_attempts: MAX_EMAIL_ATTEMPTS,
      days_between: DAYS_BETWEEN_EMAILS,
      stop_after_click: true,
    },
    skipped: {
      already_clicked: skippedAlreadyClicked,
      max_attempts_reached: skippedMaxAttempts,
      too_soon: skippedTooSoon,
    },
    students: results,
  });
}
