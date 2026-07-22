// src/lib/db/store.ts
// ──────────────────────────────────────────────────────────────────────────
// DynamoDB data store — production implementation.
//
// Tables:
//   ep_students       (PK: cwid) + GSI: outreach-status-index
//   ep_accept_tokens  (PK: token) + GSI: cwid-index
//   ep_outreach_log   (PK: cwid, SK: timestamp)
//
// Region: us-west-2
// Auth: uses default credential chain (env vars, SSO, instance role)
// ──────────────────────────────────────────────────────────────────────────

import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  ScanCommand,
  QueryCommand,
  BatchWriteCommand,
} from "@aws-sdk/lib-dynamodb";
import {
  StudentRecord,
  AcceptToken,
  OutreachLogEntry,
  SLATE_CSV_HEADERS,
} from "./schema";

// ── Client setup ──────────────────────────────────────────────────────────
const client = new DynamoDBClient({ region: process.env.AWS_REGION || "us-west-2" });
const docClient = DynamoDBDocumentClient.from(client, {
  marshallOptions: { removeUndefinedValues: true },
});

const STUDENTS_TABLE = "ep_students";
const TOKENS_TABLE   = "ep_accept_tokens";
const LOG_TABLE      = "ep_outreach_log";

// ── UUID helper ───────────────────────────────────────────────────────────
function generateToken(): string {
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

export async function getStudent(cwid: string): Promise<StudentRecord | null> {
  const { Item } = await docClient.send(
    new GetCommand({ TableName: STUDENTS_TABLE, Key: { cwid } })
  );
  return (Item as StudentRecord) ?? null;
}

export async function getAllStudents(): Promise<StudentRecord[]> {
  const items: StudentRecord[] = [];
  let lastKey: Record<string, unknown> | undefined;
  do {
    const result = await docClient.send(
      new ScanCommand({ TableName: STUDENTS_TABLE, ExclusiveStartKey: lastKey })
    );
    items.push(...((result.Items as StudentRecord[]) ?? []));
    lastKey = result.LastEvaluatedKey;
  } while (lastKey);
  return items;
}

export async function upsertStudent(record: StudentRecord): Promise<void> {
  record.updated_at = new Date().toISOString();
  // DynamoDB GSI keys cannot be null — remove null GSI attributes
  const item = cleanForDynamo(record);
  await docClient.send(
    new PutCommand({ TableName: STUDENTS_TABLE, Item: item })
  );
}

export async function upsertStudentBatch(records: StudentRecord[]): Promise<void> {
  const now = new Date().toISOString();
  for (let i = 0; i < records.length; i += 25) {
    const batch = records.slice(i, i + 25);
    const requests = batch.map((record) => {
      record.updated_at = now;
      return { PutRequest: { Item: cleanForDynamo(record) } };
    });
    await docClient.send(
      new BatchWriteCommand({ RequestItems: { [STUDENTS_TABLE]: requests } })
    );
  }
}

// Remove null/undefined values — DynamoDB doesn't accept null for GSI keys
function cleanForDynamo(record: StudentRecord): Record<string, unknown> {
  const cleaned: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(record)) {
    if (value !== null && value !== undefined) {
      cleaned[key] = value;
    }
  }
  return cleaned;
}

// ── GSI-powered queries (no full table scans) ─────────────────────────────

export async function getStudentsNeedingOutreach(): Promise<StudentRecord[]> {
  // Uses outreach-status-index GSI: PK=ep_eops_outreach_status, SK=ep_eops_email_sent
  const { Items } = await docClient.send(
    new QueryCommand({
      TableName: STUDENTS_TABLE,
      IndexName: "outreach-status-index",
      KeyConditionExpression: "ep_eops_outreach_status = :status",
      ExpressionAttributeValues: { ":status": "needed" },
    })
  );
  return (Items as StudentRecord[]) ?? [];
}

export async function getConditionalStudents(): Promise<StudentRecord[]> {
  // For conditional across all programs, we need a scan with filter
  // (or separate GSIs per program — overkill for <10k students)
  const { Items } = await docClient.send(
    new ScanCommand({
      TableName: STUDENTS_TABLE,
      FilterExpression:
        "ep_eops_status = :c OR ep_care_status = :c OR ep_calworks_status = :c",
      ExpressionAttributeValues: { ":c": "conditional" },
    })
  );
  return (Items as StudentRecord[]) ?? [];
}

export async function getRecentlyAccepted(daysBack: number = 30): Promise<StudentRecord[]> {
  const cutoff = new Date(Date.now() - daysBack * 86400000).toISOString();
  const { Items } = await docClient.send(
    new ScanCommand({
      TableName: STUDENTS_TABLE,
      FilterExpression:
        "(ep_eops_accepted_date > :cutoff) OR (ep_care_accepted_date > :cutoff) OR (ep_calworks_accepted_date > :cutoff)",
      ExpressionAttributeValues: { ":cutoff": cutoff },
    })
  );
  return (Items as StudentRecord[]) ?? [];
}

export async function getEligibleUnsentStudents(): Promise<StudentRecord[]> {
  // Students who qualify but haven't been emailed yet — idempotency check
  const { Items } = await docClient.send(
    new ScanCommand({
      TableName: STUDENTS_TABLE,
      FilterExpression:
        "((ep_eops_status = :conf OR ep_eops_status = :cond) AND attribute_not_exists(ep_eops_email_sent)) OR " +
        "((ep_care_status = :conf OR ep_care_status = :cond) AND attribute_not_exists(ep_care_email_sent)) OR " +
        "((ep_calworks_status = :conf OR ep_calworks_status = :cond) AND attribute_not_exists(ep_calworks_email_sent))",
      ExpressionAttributeValues: {
        ":conf": "confirmed",
        ":cond": "conditional",
      },
    })
  );
  return (Items as StudentRecord[]) ?? [];
}

// ═══════════════════════════════════════════════════════════════════════════
// ACCEPT TOKENS
// ═══════════════════════════════════════════════════════════════════════════

export async function createAcceptToken(cwid: string, program: string): Promise<AcceptToken> {
  const token: AcceptToken = {
    token:      generateToken(),
    cwid,
    program,
    created_at: new Date().toISOString(),
    clicked_at: null,
    expired:    false,
  };
  await docClient.send(
    new PutCommand({ TableName: TOKENS_TABLE, Item: token })
  );
  return token;
}

export async function getAcceptToken(token: string): Promise<AcceptToken | null> {
  const { Item } = await docClient.send(
    new GetCommand({ TableName: TOKENS_TABLE, Key: { token } })
  );
  return (Item as AcceptToken) ?? null;
}

export async function markTokenClicked(token: string): Promise<AcceptToken | null> {
  const t = await getAcceptToken(token);
  if (!t || t.expired || t.clicked_at) return null;
  t.clicked_at = new Date().toISOString();
  await docClient.send(
    new PutCommand({ TableName: TOKENS_TABLE, Item: t })
  );
  return t;
}

// ═══════════════════════════════════════════════════════════════════════════
// OUTREACH LOG
// ═══════════════════════════════════════════════════════════════════════════

export async function addOutreachEntry(
  entry: Omit<OutreachLogEntry, "id">
): Promise<OutreachLogEntry> {
  const full: OutreachLogEntry = { id: generateToken(), ...entry };
  await docClient.send(
    new PutCommand({ TableName: LOG_TABLE, Item: full })
  );
  return full;
}

export async function getOutreachLog(cwid: string): Promise<OutreachLogEntry[]> {
  const { Items } = await docClient.send(
    new QueryCommand({
      TableName: LOG_TABLE,
      KeyConditionExpression: "cwid = :cwid",
      ExpressionAttributeValues: { ":cwid": cwid },
      ScanIndexForward: false, // newest first
    })
  );
  return (Items as OutreachLogEntry[]) ?? [];
}

export async function getFullLog(): Promise<OutreachLogEntry[]> {
  const { Items } = await docClient.send(
    new ScanCommand({ TableName: LOG_TABLE })
  );
  return ((Items as OutreachLogEntry[]) ?? []).sort(
    (a, b) => b.timestamp.localeCompare(a.timestamp)
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// CSV EXPORT (for Slate migration)
// ═══════════════════════════════════════════════════════════════════════════

export async function exportToCSV(): Promise<string> {
  const rows = await getAllStudents();
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
// RESET (for testing — deletes all items from all tables)
// ═══════════════════════════════════════════════════════════════════════════

export async function resetDB(): Promise<void> {
  // Delete all students
  const students = await getAllStudents();
  for (let i = 0; i < students.length; i += 25) {
    const batch = students.slice(i, i + 25);
    const requests = batch.map((s) => ({
      DeleteRequest: { Key: { cwid: s.cwid } },
    }));
    await docClient.send(
      new BatchWriteCommand({ RequestItems: { [STUDENTS_TABLE]: requests } })
    );
  }
}
