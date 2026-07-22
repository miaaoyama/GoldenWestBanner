// src/lib/db/store.ts
// In-memory data store — simulates DynamoDB for the demo.
// In production: replace this file with real DynamoDB SDK calls.
// The interface stays the same, so nothing else changes.

import { StudentRecord, AcceptToken, OutreachLogEntry, EligibilityStatus, OutreachStatus } from "./schema";
import { v4 as uuidv4 } from "crypto";

// ── In-memory tables ──────────────────────────────────────────────────────
const students:    Map<string, StudentRecord>    = new Map();
const tokens:      Map<string, AcceptToken>      = new Map();
const outreachLog: OutreachLogEntry[]            = [];

// ── UUID helper (no external dep needed) ──────────────────────────────────
function generateToken(): string {
  return crypto.randomUUID();
}

// ═══════════════════════════════════════════════════════════════════════════
// STUDENTS
// ═══════════════════════════════════════════════════════════════════════════

export function getStudent(cwid: string): StudentRecord | null {
  return students.get(cwid) ?? null;
}

export function getAllStudents(): StudentRecord[] {
  return Array.from(students.values());
}

export function upsertStudent(record: StudentRecord): void {
  record.updated_at = new Date().toISOString();
  students.set(record.cwid, record);
}

export function getStudentsNeedingOutreach(): StudentRecord[] {
  return getAllStudents().filter(s =>
    s.ep_eops_outreach_status === "needed" ||
    s.ep_care_outreach_status === "needed" ||
    s.ep_calworks_outreach_status === "needed"
  );
}

export function getConditionalStudents(): StudentRecord[] {
  return getAllStudents().filter(s =>
    s.ep_eops_status === "conditional" ||
    s.ep_care_status === "conditional" ||
    s.ep_calworks_status === "conditional"
  );
}

export function getRecentlyAccepted(daysBack: number = 30): StudentRecord[] {
  const cutoff = new Date(Date.now() - daysBack * 86400000).toISOString();
  return getAllStudents().filter(s =>
    (s.ep_eops_accepted_date && s.ep_eops_accepted_date > cutoff) ||
    (s.ep_care_accepted_date && s.ep_care_accepted_date > cutoff) ||
    (s.ep_calworks_accepted_date && s.ep_calworks_accepted_date > cutoff)
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// ACCEPT TOKENS
// ═══════════════════════════════════════════════════════════════════════════

export function createAcceptToken(cwid: string, program: string): AcceptToken {
  const token: AcceptToken = {
    token:      generateToken(),
    cwid,
    program,
    created_at: new Date().toISOString(),
    clicked_at: null,
    expired:    false,
  };
  tokens.set(token.token, token);
  return token;
}

export function getAcceptToken(token: string): AcceptToken | null {
  return tokens.get(token) ?? null;
}

export function markTokenClicked(token: string): AcceptToken | null {
  const t = tokens.get(token);
  if (!t || t.expired || t.clicked_at) return null;
  t.clicked_at = new Date().toISOString();
  tokens.set(token, t);
  return t;
}

// ═══════════════════════════════════════════════════════════════════════════
// OUTREACH LOG
// ═══════════════════════════════════════════════════════════════════════════

export function addOutreachEntry(entry: Omit<OutreachLogEntry, "id">): OutreachLogEntry {
  const full: OutreachLogEntry = { id: generateToken(), ...entry };
  outreachLog.push(full);
  return full;
}

export function getOutreachLog(cwid: string): OutreachLogEntry[] {
  return outreachLog
    .filter(e => e.cwid === cwid)
    .sort((a, b) => b.timestamp.localeCompare(a.timestamp));
}

export function getFullLog(): OutreachLogEntry[] {
  return outreachLog.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
}

// ═══════════════════════════════════════════════════════════════════════════
// CSV EXPORT (for Slate migration)
// ═══════════════════════════════════════════════════════════════════════════

import { SLATE_CSV_HEADERS } from "./schema";

export function exportToCSV(): string {
  const rows = getAllStudents();
  const header = SLATE_CSV_HEADERS.join(",");
  const lines = rows.map(s => {
    return SLATE_CSV_HEADERS.map(col => {
      const val = (s as Record<string, unknown>)[col];
      if (val === null || val === undefined) return "";
      const str = String(val);
      // Escape commas and quotes for CSV
      if (str.includes(",") || str.includes('"') || str.includes("\n")) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    }).join(",");
  });
  return [header, ...lines].join("\n");
}

// ═══════════════════════════════════════════════════════════════════════════
// SEED DATA (for demo — loads the 100 fake students on first access)
// ═══════════════════════════════════════════════════════════════════════════

let seeded = false;

export function ensureSeeded(profiles: Record<string, unknown>[]): void {
  if (seeded) return;
  seeded = true;

  const { checkAllPrograms } = require("@/lib/programsEligibility");
  const now = new Date().toISOString();

  for (const profile of profiles) {
    const sis = (profile.banner_sis ?? {}) as Record<string, unknown>;
    const results = checkAllPrograms(profile);

    const eops = results.find((r: { programId: string }) => r.programId === "eops");
    const care = results.find((r: { programId: string }) => r.programId === "care");
    const calworks = results.find((r: { programId: string }) => r.programId === "calworks");

    const record: StudentRecord = {
      cwid:              (sis.cwid as string) ?? "",
      first_name:        (sis.first_name as string) ?? "",
      last_name:         (sis.last_name as string) ?? "",
      email_gwc:         (sis.email_gwc as string) ?? "",
      phone:             (sis.phone_primary as string) ?? null,
      program_of_study:  (sis.program_of_study as string) ?? "",
      year_in_college:   (sis.year_in_college as string) ?? "",
      enrollment_status: (sis.enrollment_status as string) ?? "",

      ep_eops_status:     eops?.status ?? "not_eligible",
      ep_care_status:     care?.status ?? "not_eligible",
      ep_calworks_status: calworks?.status ?? "not_eligible",
      ep_eops_tier:       eops?.tier ?? null,
      ep_priority_score:  eops?.priorityScore ?? 0,
      ep_pending_items:   [...(eops?.pendingItems ?? []), ...(care?.pendingItems ?? []), ...(calworks?.pendingItems ?? [])]
                            .map((p: { label: string }) => p.label).join("; ") || null,

      ep_eops_email_sent:    null,
      ep_eops_email_clicked: null,
      ep_care_email_sent:    null,
      ep_care_email_clicked: null,
      ep_calworks_email_sent:    null,
      ep_calworks_email_clicked: null,

      ep_eops_accepted_date:     null,
      ep_care_accepted_date:     null,
      ep_calworks_accepted_date: null,

      ep_eops_outreach_status:     eops?.status === "conditional" ? "needed" : "not_needed",
      ep_care_outreach_status:     care?.status === "conditional" ? "needed" : "not_needed",
      ep_calworks_outreach_status: calworks?.status === "conditional" ? "needed" : "not_needed",

      ep_staff_notes:        "",
      ep_outreach_attempts:  0,
      ep_last_outreach_date: null,

      ep_last_eligibility_check: now,
      created_at:                now,
      updated_at:                now,
    };

    students.set(record.cwid, record);
  }
}
