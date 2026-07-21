// src/app/api/notification/route.ts
// Next.js App Router API route — thin proxy to the AWS Lambda endpoint.
// The Lambda URL is kept server-side only (no NEXT_PUBLIC_ prefix) so it
// is never exposed to the browser.

import { NextRequest, NextResponse } from "next/server";
import { StudentProfile } from "@/types/student";

// Set in .env.local (and in your Vercel / hosting env vars):
//   LAMBDA_NOTIFICATION_URL=https://<id>.lambda-url.<region>.on.aws/
const LAMBDA_URL = process.env.LAMBDA_NOTIFICATION_URL;

export async function POST(req: NextRequest) {
  // ── 1. Validate the request body ──────────────────────────────────────
  let profile: StudentProfile;

  try {
    profile = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!profile.major || !profile.year || !profile.status) {
    return NextResponse.json(
      { error: "Missing required fields: major, year, status" },
      { status: 400 }
    );
  }

  // ── 2. Guard: Lambda URL must be configured ────────────────────────────
  if (!LAMBDA_URL) {
    console.error("LAMBDA_NOTIFICATION_URL env var is not set");
    return NextResponse.json(
      { error: "Notification service is not configured" },
      { status: 503 }
    );
  }

  // ── 3. Forward to Lambda ──────────────────────────────────────────────
  try {
    const lambdaRes = await fetch(LAMBDA_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(profile),
    });

    if (!lambdaRes.ok) {
      const text = await lambdaRes.text();
      console.error(`Lambda returned ${lambdaRes.status}: ${text}`);
      return NextResponse.json(
        { error: "Upstream notification service error" },
        { status: 502 }
      );
    }

    const data = await lambdaRes.json();
    return NextResponse.json(data);
  } catch (err) {
    console.error("Error calling Lambda:", err);
    return NextResponse.json(
      { error: "Failed to reach notification service" },
      { status: 502 }
    );
  }
}
