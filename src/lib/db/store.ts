// src/lib/db/store.ts
// ──────────────────────────────────────────────────────────────────────────
// Persistent JSON file database.
// Reads/writes to data/db.json — survives server restarts.
//
// In production: swap this file for DynamoDB or Supabase calls.
// The exported function signatures stay identical — nothing else changes.
// ──────────────────────────────────────────────────────────────────────────

import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { join } from "path";
import {
  StudentRecord,
  AcceptToken,
  OutreachLogEntry,
  EligibilityStatus,
  OutreachStatus,
  SLATE_CSV_HEADERS,
} from "./schema";

// ── File paths ────────────────────────────────────────────────────────────
const DATA_DIR = join(process.cwd(), "data");
const DB_FILE  = join(DATA_DIR, "db.json");

// ── Database shape ────────────────────────────────────────────────────────
interface Database {
  students:    Record<string, StudentRecord>;   // keyed by cwid
  tokens:      Record<string, AcceptToken>;     // keyed by token UUID
  outreachLog: OutreachLogEntry[];
}

// ── Read / Write ──────────────────────────────────────────────────────────

function readDB(): Database {
  if (!existsSync(DB_FILE)) {
    return { students: {}, tokens: {}, outreachLog: [] };
  }
  try {
    const raw = readFileSync(DB_FILE, "utf-8");
    return JSON.parse(raw) as Database;
  } catch {
    return { students: {}, tokens: {}, outreachLog: [] };
  }
}

function writeDB(db: Database): void {
  if (!existsSync(DATA_DIR)) {
    mkdirSync(DATA_DIR, { recursive: true });
  }
  writeFileSync(DB_FILE, JSON.stringify(db, null, 2), "utf-8");
}

// ── UUID helper ───────────────────────────────────────────────────────────
function generateToken(): string {
  // crypto.randomUUID() available in Node 19+; fallback for older
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// STUDENTS
// ═══════════════════════════════════════════════════════════════════════════

export function getStudent(cwid: string): StudentRecord | null {
  const db = readDB();
  return db.students[cwid] ?? null;
}

export function getAllStudents(): StudentRecord[] {
  const db = readDB();
  return Object.values(db.students);
}

export function upsertStudent(record: StudentRecord): void {
  const db = readDB();
  record.updated_at = new Date().toISOString();
  db.students[record.cwid] = record;
  writeDB(db);
}

export function upsertStudentBatch(records: StudentRecord[]): void {
  const db = readDB();
  const now = new Date().toISOString();
  for (const record of records) {
    record.updated_at = now;
    db.students[record.cwid] = record;
  }
  writeDB(db);
}

export function getStudentsNeedingOutreach(): StudentRecord[] {
  return getAllStudents().filter(
    (s) =>
      s.ep_eops_outreach_status === "needed" ||
      s.ep_care_outreach_status === "needed" ||
      s.ep_calworks_outreach_status === "needed"
  );
}

export function getConditionalStudents(): StudentRecord[] {
  return getAllStudents().filter(
    (s) =>
      s.ep_eops_status === "conditional" ||
      s.ep_care_status === "conditional" ||
      s.ep_calworks_status === "conditional"
  );
}

export function getRecentlyAccepted(daysBack: number = 30): StudentRecord[] {
  const cutoff = new Date(Date.now() - daysBack * 86400000).toISOString();
  return getAllStudents().filter(
    (s) =>
      (s.ep_eops_accepted_date && s.ep_eops_accepted_date > cutoff) ||
      (s.ep_care_accepted_date && s.ep_care_accepted_date > cutoff) ||
      (s.ep_calworks_accepted_date && s.ep_calworks_accepted_date > cutoff)
  );
}

export function getEligibleUnsentStudents(): StudentRecord[] {
  return getAllStudents().filter((s) => {
    const eopsNeedsEmail = (s.ep_eops_status === "confirmed" || s.ep_eops_status === "conditional") && !s.ep_eops_email_sent;
    const careNeedsEmail = (s.ep_care_status === "confirmed" || s.ep_care_status === "conditional") && !s.ep_care_email_sent;
    const calworksNeedsEmail = (s.ep_calworks_status === "confirmed" || s.ep_calworks_status === "conditional") && !s.ep_calworks_email_sent;
    return eopsNeedsEmail || careNeedsEmail || calworksNeedsEmail;
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// ACCEPT TOKENS
// ═══════════════════════════════════════════════════════════════════════════

export function createAcceptToken(cwid: string, program: string): AcceptToken {
  const db = readDB();
  const token: AcceptToken = {
    token:      generateToken(),
    cwid,
    program,
    created_at: new Date().toISOString(),
    clicked_at: null,
    expired:    false,
  };
  db.tokens[token.token] = token;
  writeDB(db);
  return token;
}

export function getAcceptToken(token: string): AcceptToken | null {
  const db = readDB();
  return db.tokens[token] ?? null;
}

export function markTokenClicked(token: string): AcceptToken | null {
  const db = readDB();
  const t = db.tokens[token];
  if (!t || t.expired || t.clicked_at) return null;
  t.clicked_at = new Date().toISOString();
  db.tokens[token] = t;
  writeDB(db);
  return t;
}

// ═══════════════════════════════════════════════════════════════════════════
// OUTREACH LOG
// ═══════════════════════════════════════════════════════════════════════════

export function addOutreachEntry(
  entry: Omit<OutreachLogEntry, "id">
): OutreachLogEntry {
  const db = readDB();
  const full: OutreachLogEntry = { id: generateToken(), ...entry };
  db.outreachLog.push(full);
  writeDB(db);
  return full;
}

export function getOutreachLog(cwid: string): OutreachLogEntry[] {
  const db = readDB();
  return db.outreachLog
    .filter((e) => e.cwid === cwid)
    .sort((a, b) => b.timestamp.localeCompare(a.timestamp));
}

export function getFullLog(): OutreachLogEntry[] {
  const db = readDB();
  return db.outreachLog.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
}

// ═══════════════════════════════════════════════════════════════════════════
// CSV EXPORT (for Slate migration)
// ═══════════════════════════════════════════════════════════════════════════

export function exportToCSV(): string {
  const rows = getAllStudents();
  const header = SLATE_CSV_HEADERS.join(",");
  const lines = rows.map((s) => {
    return SLATE_CSV_HEADERS.map((col) => {
      const val = (s as unknown as Record<string, unknown>)[col];
      if (val === null || val === undefined) return "";
      const str = String(val);
      if (str.includes(",") || str.includes('"') || str.includes("\n")) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    }).join(",");
  });
  return [header, ...lines].join("\n");
}

// ═══════════════════════════════════════════════════════════════════════════
// RESET (for testing — wipe the database)
// ═══════════════════════════════════════════════════════════════════════════

export function resetDB(): void {
  writeDB({ students: {}, tokens: {}, outreachLog: [] });
}
