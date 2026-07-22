// src/lib/db/schema.ts
// Database schema — Slate-ready field naming convention.
// Every field uses the ep_ prefix and maps 1:1 to a Slate custom field.
//
// Storage: DynamoDB (now) → Slate custom fields (later)
// This file is the single source of truth for the data model.

// ── Student record (one per student) ──────────────────────────────────────

export interface StudentRecord {
  // ── Identity (matches existing Slate/Banner fields) ──
  cwid:              string;    // Primary key — e.g. "@30302410"
  first_name:        string;
  last_name:         string;
  email_gwc:         string;    // GWC student email
  phone:             string | null;
  program_of_study:  string;
  year_in_college:   string;
  enrollment_status: string;

  // ── Eligibility status per program ──
  // Slate field type: Dropdown
  // Options: "confirmed" | "conditional" | "not_eligible" | "opted_out"
  ep_eops_status:     EligibilityStatus;
  ep_care_status:     EligibilityStatus;
  ep_calworks_status: EligibilityStatus;

  // ── EOPS tier (only applies to EOPS) ──
  // Slate field type: Dropdown
  ep_eops_tier:       "tier1" | "tier2" | "tier3" | null;

  // ── Priority score (0–5, higher = more urgent need) ──
  // Slate field type: Number
  ep_priority_score:  number;

  // ── Pending items (what docs the student needs) ──
  // Slate field type: Text (long)
  ep_pending_items:   string | null;  // e.g. "Proof of public assistance"

  // ── Email tracking ──
  // Slate field type: DateTime (blank = not sent/not clicked)
  ep_eops_email_sent:     string | null;  // ISO datetime
  ep_eops_email_clicked:  string | null;
  ep_care_email_sent:     string | null;
  ep_care_email_clicked:  string | null;
  ep_calworks_email_sent:     string | null;
  ep_calworks_email_clicked:  string | null;

  // ── Acceptance ──
  // Slate field type: DateTime
  ep_eops_accepted_date:     string | null;
  ep_care_accepted_date:     string | null;
  ep_calworks_accepted_date: string | null;

  // ── Staff outreach tracking ──
  // Slate field type: Dropdown
  ep_eops_outreach_status:     OutreachStatus;
  ep_care_outreach_status:     OutreachStatus;
  ep_calworks_outreach_status: OutreachStatus;

  // Slate field type: Text (long)
  ep_staff_notes:        string;
  // Slate field type: Number
  ep_outreach_attempts:  number;
  // Slate field type: DateTime
  ep_last_outreach_date: string | null;

  // ── System ──
  ep_last_eligibility_check: string;  // ISO datetime
  created_at:                string;  // ISO datetime
  updated_at:                string;  // ISO datetime
}

export type EligibilityStatus = "confirmed" | "conditional" | "not_eligible" | "opted_out";
export type OutreachStatus = "needed" | "in_progress" | "completed" | "not_needed";

// ── Email tracking token (stored separately, keyed by token) ──────────────

export interface AcceptToken {
  token:      string;     // UUID — the unique link ID
  cwid:       string;     // Which student this belongs to
  program:    string;     // "eops" | "care" | "calworks"
  created_at: string;     // When the email was sent
  clicked_at: string | null;  // When the link was clicked (null = not clicked)
  expired:    boolean;    // True after 30 days
}

// ── Outreach log entry (append-only history) ──────────────────────────────

export interface OutreachLogEntry {
  id:         string;     // UUID
  cwid:       string;
  program:    string;
  action:     "email_sent" | "link_clicked" | "accepted" | "opted_out" | "staff_call" | "staff_note" | "document_received";
  timestamp:  string;     // ISO datetime
  details:    string;     // Free text — e.g. "Left voicemail, will try again Thursday"
  staff_name: string | null;  // Who performed the action (null = automated)
}

// ── DynamoDB table definitions ────────────────────────────────────────────
// For the person setting up AWS:

export const DYNAMO_TABLES = {
  students: {
    tableName:    "ep_students",
    partitionKey: "cwid",         // e.g. "@30302410"
    description:  "One record per student. Stores eligibility + email + outreach status.",
  },
  tokens: {
    tableName:    "ep_accept_tokens",
    partitionKey: "token",        // UUID from the email link
    gsi: {
      name:         "cwid-index",
      partitionKey: "cwid",       // Look up all tokens for a student
    },
    description: "One record per trackable email link sent.",
  },
  outreachLog: {
    tableName:    "ep_outreach_log",
    partitionKey: "cwid",
    sortKey:      "timestamp",   // Latest entries first
    description:  "Append-only history of every action taken on a student.",
  },
} as const;

// ── CSV export header (matches Slate import exactly) ──────────────────────
// Use this when exporting to CSV for Slate migration.

export const SLATE_CSV_HEADERS = [
  "cwid",
  "first_name",
  "last_name",
  "email_gwc",
  "phone",
  "program_of_study",
  "year_in_college",
  "ep_eops_status",
  "ep_eops_tier",
  "ep_eops_email_sent",
  "ep_eops_email_clicked",
  "ep_eops_accepted_date",
  "ep_eops_outreach_status",
  "ep_care_status",
  "ep_care_email_sent",
  "ep_care_email_clicked",
  "ep_care_accepted_date",
  "ep_care_outreach_status",
  "ep_calworks_status",
  "ep_calworks_email_sent",
  "ep_calworks_email_clicked",
  "ep_calworks_accepted_date",
  "ep_calworks_outreach_status",
  "ep_priority_score",
  "ep_pending_items",
  "ep_staff_notes",
  "ep_outreach_attempts",
  "ep_last_outreach_date",
  "ep_last_eligibility_check",
] as const;
