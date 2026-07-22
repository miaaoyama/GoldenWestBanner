import { NextRequest, NextResponse } from 'next/server';
import {
  getStudent,
  upsertStudent,
  createAcceptToken,
  addOutreachEntry,
} from '@/lib/db/store';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { cwid } = body;

    if (!cwid) {
      return NextResponse.json(
        { error: 'Missing required field: cwid' },
        { status: 400 }
      );
    }

    const student = getStudent(cwid);

    if (!student) {
      return NextResponse.json(
        { error: 'Student not found' },
        { status: 404 }
      );
    }

    const baseUrl =
      process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const programs = ['eops', 'calworks', 'nextup', 'care'];
    const emailsSent: string[] = [];
    const programDetails: Array<{
      program: string;
      status: 'confirmed' | 'conditional';
      acceptUrl: string;
      documentNeeded?: string;
    }> = [];

    const now = new Date().toISOString();

    for (const program of programs) {
      const statusKey = `ep_${program}_status` as keyof typeof student;
      const emailSentKey = `ep_${program}_email_sent` as keyof typeof student;
      const status = student[statusKey];

      // Only process programs with confirmed/conditional status that haven't been emailed
      if (
        (status === 'confirmed' || status === 'conditional') &&
        !student[emailSentKey]
      ) {
        // Create a trackable accept token
        const token = createAcceptToken(cwid, program);

        // Build the accept URL
        const acceptUrl = `${baseUrl}/api/accept?token=${token.token}`;

        // Mark email as sent
        (student as Record<string, unknown>)[`ep_${program}_email_sent`] = now;

        // Determine document needed for conditional programs
        let documentNeeded: string | undefined;
        if (status === 'conditional') {
          const docKey = `ep_${program}_document_needed` as keyof typeof student;
          documentNeeded = (student[docKey] as string) || 'Required documentation';
        }

        programDetails.push({
          program,
          status,
          acceptUrl,
          documentNeeded,
        });

        emailsSent.push(program);
      }
    }

    if (emailsSent.length === 0) {
      return NextResponse.json(
        { success: true, emailsSent: [], emailHtml: null, message: 'No eligible programs pending email' },
        { status: 200 }
      );
    }

    // Build the HTML email body with GWC branding
    const emailHtml = buildEmailHtml(student.first_name || 'Student', programDetails);

    // Save updated student record with email_sent timestamps
    upsertStudent(student);

    // Add outreach log entries for each program emailed
    for (const program of emailsSent) {
      addOutreachEntry({
        cwid,
        action: 'email_sent',
        program,
        timestamp: now,
      });
    }

    // In a real system, this would call AWS SES
    console.log(`[DEMO] Email sent to ${student.first_name} ${student.last_name} (${cwid})`);
    console.log(`[DEMO] Programs: ${emailsSent.join(', ')}`);
    console.log(`[DEMO] Email HTML length: ${emailHtml.length} chars`);

    return NextResponse.json({
      success: true,
      emailsSent,
      emailHtml,
    });
  } catch (error) {
    console.error('Error in send-email route:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

function buildEmailHtml(
  firstName: string,
  programDetails: Array<{
    program: string;
    status: 'confirmed' | 'conditional';
    acceptUrl: string;
    documentNeeded?: string;
  }>
): string {
  const programLabels: Record<string, string> = {
    eops: 'EOPS (Extended Opportunity Programs & Services)',
    calworks: 'CalWORKs',
    nextup: 'NextUp (Foster Youth)',
    care: 'CARE (Cooperative Agencies Resources for Education)',
  };

  const confirmedPrograms = programDetails.filter((p) => p.status === 'confirmed');
  const conditionalPrograms = programDetails.filter((p) => p.status === 'conditional');

  const programButtons = programDetails
    .map(
      (p) => `
        <tr>
          <td style="padding: 8px 0;">
            <table role="presentation" cellspacing="0" cellpadding="0" border="0">
              <tr>
                <td style="border-radius: 6px; background-color: #0F603D;">
                  <a href="${p.acceptUrl}"
                     target="_blank"
                     style="display: inline-block; padding: 12px 24px; font-size: 16px; color: #ffffff; text-decoration: none; font-weight: bold; border-radius: 6px;">
                    Accept ${programLabels[p.program] || p.program}${p.status === 'conditional' ? ' (Conditional)' : ''}
                  </a>
                </td>
              </tr>
            </table>
            ${
              p.status === 'conditional' && p.documentNeeded
                ? `<p style="margin: 4px 0 0 0; font-size: 13px; color: #666;">⚠️ Document needed: <strong>${p.documentNeeded}</strong></p>`
                : ''
            }
          </td>
        </tr>`
    )
    .join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Golden West College — You May Be Eligible!</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f4f4f4; font-family: Arial, Helvetica, sans-serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color: #f4f4f4;">
    <tr>
      <td align="center" style="padding: 24px 16px;">
        <table role="presentation" width="600" cellspacing="0" cellpadding="0" border="0" style="background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.08);">
          <!-- Header -->
          <tr>
            <td style="background-color: #0F603D; padding: 24px 32px; text-align: center;">
              <h1 style="margin: 0; color: #FFC522; font-size: 24px;">Golden West College</h1>
              <p style="margin: 4px 0 0; color: #ffffff; font-size: 14px;">Student Equity &amp; Success Programs</p>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding: 32px;">
              <p style="font-size: 16px; color: #333; margin: 0 0 16px;">Hi ${firstName},</p>

              <p style="font-size: 16px; color: #333; margin: 0 0 16px;">
                Great news! Based on your records, you may be eligible for the following support programs at Golden West College.
              </p>

              ${
                confirmedPrograms.length > 0
                  ? `
              <h2 style="font-size: 18px; color: #0F603D; margin: 24px 0 8px; border-bottom: 2px solid #FFC522; padding-bottom: 4px;">
                ✅ Confirmed Eligibility
              </h2>
              <ul style="margin: 0 0 16px; padding-left: 20px; color: #333;">
                ${confirmedPrograms.map((p) => `<li style="margin: 4px 0;">${programLabels[p.program] || p.program}</li>`).join('')}
              </ul>`
                  : ''
              }

              ${
                conditionalPrograms.length > 0
                  ? `
              <h2 style="font-size: 18px; color: #0F603D; margin: 24px 0 8px; border-bottom: 2px solid #FFC522; padding-bottom: 4px;">
                📋 Conditional Eligibility
              </h2>
              <ul style="margin: 0 0 8px; padding-left: 20px; color: #333;">
                ${conditionalPrograms.map((p) => `<li style="margin: 4px 0;">${programLabels[p.program] || p.program}</li>`).join('')}
              </ul>
              <p style="font-size: 14px; color: #666; margin: 0 0 16px;">
                Conditional programs require additional documentation. See details below each button.
              </p>`
                  : ''
              }

              <h2 style="font-size: 18px; color: #0F603D; margin: 24px 0 12px; border-bottom: 2px solid #FFC522; padding-bottom: 4px;">
                Accept Your Spot
              </h2>
              <p style="font-size: 14px; color: #333; margin: 0 0 16px;">
                Click the button(s) below to confirm your interest:
              </p>

              <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                ${programButtons}
              </table>

              <p style="font-size: 14px; color: #666; margin: 24px 0 0; border-top: 1px solid #eee; padding-top: 16px;">
                Questions? Visit the Student Equity Center or reply to this email.<br/>
                These links are unique to you — please do not share them.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #0F603D; padding: 16px 32px; text-align: center;">
              <p style="margin: 0; color: #FFC522; font-size: 12px;">
                Golden West College · 15744 Goldenwest St, Huntington Beach, CA 92647
              </p>
              <p style="margin: 4px 0 0; color: rgba(255,255,255,0.7); font-size: 11px;">
                This is an automated eligibility notification.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}
