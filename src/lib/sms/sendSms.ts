// src/lib/sms/sendSms.ts
// ──────────────────────────────────────────────────────────────────────────
// SMS Module — Ready for production, disabled in demo.
//
// This module is built and tested but CANNOT send in the demo because
// AWS SNS requires a registered sender number ($2/month toll-free).
//
// WHEN THE SCHOOL IS READY TO ENABLE SMS:
//
//   Option A — Slate (recommended):
//     Slate has built-in SMS via Twilio. Once this system migrates to Slate,
//     text messages are sent natively through Slate's campaign tools.
//     No code changes needed — Slate reads the ep_* fields and triggers texts.
//
//   Option B — AWS Pinpoint:
//     1. Go to AWS Console → Pinpoint → Settings → SMS → Request toll-free number
//     2. Wait for approval (1–3 days)
//     3. Set SMS_SENDER_NUMBER in .env to the approved number
//     4. Set SMS_ENABLED=true in .env
//     5. Texts will start sending immediately
//
//   Option C — Twilio:
//     1. Create Twilio account → get a sender number
//     2. Set TWILIO_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM_NUMBER in .env
//     3. Set SMS_PROVIDER=twilio and SMS_ENABLED=true in .env
//     4. Texts will start sending immediately
//
// ──────────────────────────────────────────────────────────────────────────

export interface SmsMessage {
  to:       string;   // Student's phone number (E.164 format: +17145551234)
  body:     string;   // The text message content
  studentCwid: string;
  program:  string;
}

export interface SmsResult {
  sent:     boolean;
  provider: string;
  messageId: string | null;
  error:    string | null;
}

// ── Configuration ─────────────────────────────────────────────────────────

const SMS_ENABLED   = process.env.SMS_ENABLED === "true";
const SMS_PROVIDER  = process.env.SMS_PROVIDER || "aws";  // "aws" | "twilio" | "slate"

// ── Main send function ────────────────────────────────────────────────────

export async function sendSms(message: SmsMessage): Promise<SmsResult> {
  // DISABLED in demo — logs the message but doesn't send
  if (!SMS_ENABLED) {
    console.log(`[SMS DEMO - NOT SENT] To: ${message.to} | Body: ${message.body}`);
    return {
      sent:      false,
      provider:  "demo (disabled)",
      messageId: null,
      error:     "SMS_ENABLED is not set to true. Set SMS_ENABLED=true in .env when a sender number is registered.",
    };
  }

  switch (SMS_PROVIDER) {
    case "aws":
      return sendViaSns(message);
    case "twilio":
      return sendViaTwilio(message);
    case "slate":
      return { sent: false, provider: "slate", messageId: null, error: "Slate handles SMS natively — this function should not be called when using Slate." };
    default:
      return { sent: false, provider: "unknown", messageId: null, error: `Unknown SMS_PROVIDER: ${SMS_PROVIDER}` };
  }
}

// ── AWS SNS implementation ────────────────────────────────────────────────
// Requires: SMS_SENDER_NUMBER env var (registered toll-free or 10DLC number)

async function sendViaSns(message: SmsMessage): Promise<SmsResult> {
  const { SNSClient, PublishCommand } = await import("@aws-sdk/client-sns");
  const sns = new SNSClient({ region: process.env.AWS_REGION || "us-west-2" });

  try {
    const result = await sns.send(new PublishCommand({
      PhoneNumber: message.to,
      Message: message.body,
      MessageAttributes: {
        "AWS.SNS.SMS.SenderID": {
          DataType: "String",
          StringValue: "GWC",
        },
        "AWS.SNS.SMS.SMSType": {
          DataType: "String",
          StringValue: "Transactional",
        },
      },
    }));

    return { sent: true, provider: "aws-sns", messageId: result.MessageId ?? null, error: null };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : "Unknown SNS error";
    console.error("[SMS SNS ERROR]", errorMsg);
    return { sent: false, provider: "aws-sns", messageId: null, error: errorMsg };
  }
}

// ── Twilio implementation ─────────────────────────────────────────────────
// Requires: TWILIO_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM_NUMBER env vars

async function sendViaTwilio(message: SmsMessage): Promise<SmsResult> {
  const sid   = process.env.TWILIO_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const from  = process.env.TWILIO_FROM_NUMBER;

  if (!sid || !token || !from) {
    return { sent: false, provider: "twilio", messageId: null, error: "Missing TWILIO_SID, TWILIO_AUTH_TOKEN, or TWILIO_FROM_NUMBER in .env" };
  }

  try {
    const url = `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`;
    const auth = Buffer.from(`${sid}:${token}`).toString("base64");

    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Authorization": `Basic ${auth}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({ To: message.to, From: from, Body: message.body }),
    });

    const data = await res.json();
    if (data.sid) {
      return { sent: true, provider: "twilio", messageId: data.sid, error: null };
    } else {
      return { sent: false, provider: "twilio", messageId: null, error: data.message || "Twilio error" };
    }
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : "Unknown Twilio error";
    return { sent: false, provider: "twilio", messageId: null, error: errorMsg };
  }
}

// ── Build the text message content ────────────────────────────────────────

export function buildSmsBody(
  firstName: string,
  programs: string[],
  acceptLink: string,
): string {
  const programList = programs.join(" & ");
  return (
    `Hi ${firstName}! You qualify for ${programList} at Golden West College. ` +
    `Accept your spot: ${acceptLink} ` +
    `Reply STOP to opt out.`
  );
}

// ── Batch send (mirrors the email batch logic) ────────────────────────────

export async function sendSmsBatch(
  students: { cwid: string; firstName: string; phone: string; programs: string[]; acceptLink: string }[]
): Promise<{ sent: number; failed: number; results: SmsResult[] }> {
  const results: SmsResult[] = [];
  let sent = 0;
  let failed = 0;

  for (const student of students) {
    const body = buildSmsBody(student.firstName, student.programs, student.acceptLink);
    const result = await sendSms({
      to:          student.phone,
      body,
      studentCwid: student.cwid,
      program:     student.programs[0],
    });

    results.push(result);
    if (result.sent) sent++;
    else failed++;
  }

  return { sent, failed, results };
}
