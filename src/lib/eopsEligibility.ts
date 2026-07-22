// src/lib/eopsEligibility.ts
// EOPS eligibility engine with priority scoring and tier assignment.
//
// California Title 5, §56220 eligibility rules are unchanged.
// New: every eligible student receives a priority score and a tier
// so the API can make a capacity-aware enrollment decision.
//
// ── TIER SYSTEM ──────────────────────────────────────────────────────────
//
//  TIER 1 — Immediate enrollment
//    Highest-need students. Confirmed on the spot.
//    Criteria: income < $19k, OR homeless, OR foster youth, OR GPA < 2.0
//    Priority score: 3+
//
//  TIER 2 — Priority waitlist
//    Eligible but lower urgency. Held in a managed queue.
//    EOPS processes in batches as capacity opens.
//    Priority score: 1–2
//
//  TIER 3 — Referred to alternative programs
//    Eligible but program is at capacity. Shown related services
//    (CARE, CalWORKs, NextUp, Financial Aid, Basic Needs).
//    Priority score: 0 (or capacity full for Tier 1/2)

export type EopsTier = "tier1" | "tier2" | "tier3" | null;

export interface EopsResult {
  eligible:       boolean;
  tier:           EopsTier;
  priorityScore:  number;
  reasonsMet:     string[];
  reasonsFailed:  string[];
  missingInfo:    string[];
  // Set by the API route after capacity check — not by this function
  bannerMessage:  string;
  alternativePrograms: AlternativeProgram[];
}

export interface AlternativeProgram {
  name:        string;
  description: string;
  url:         string;
}

// ── Thresholds ────────────────────────────────────────────────────────────
const UNIT_CEILING        = 70;
const MIN_UNITS_FULL_TIME = 12;
const MIN_UNITS_DSPS      = 6;
const GPA_QUALIFIER_MAX   = 2.5;
const GPA_HIGH_RISK       = 2.0;   // below this → Tier 1 priority

const LOW_INCOME_BRACKETS = new Set([
  "< $19,000",
  "$19,001 - $36,000",
  "$19,001 \u2013 $36,000",
]);

const VERY_LOW_INCOME = "< $19,000";

const UNDERREPRESENTED_ETHNICITIES = new Set([
  "Hispanic or Latino",
  "Black or African American",
  "American Indian or Alaska Native",
  "Pacific Islander",
  "Filipino",
]);

const ELIGIBLE_RESIDENCIES = new Set([
  "Resident",
  "AB540 (Undocumented)",
]);

// ── Alternative programs shown to Tier 3 students ────────────────────────
const ALL_ALTERNATIVE_PROGRAMS: AlternativeProgram[] = [
  {
    name:        "CARE — Cooperative Agencies Resources for Education",
    description: "Additional support for single parents receiving public assistance who are also EOPS-eligible.",
    url:         "https://www.goldenwestcollege.edu/care/",
  },
  {
    name:        "CalWORKs",
    description: "Employment training, work-study, and support services for students receiving CalWORKs cash aid.",
    url:         "https://www.goldenwestcollege.edu/calworks/",
  },
  {
    name:        "NextUp — Foster Youth Success Initiative",
    description: "Priority services for current and former foster youth including housing support and counseling.",
    url:         "https://www.goldenwestcollege.edu/nextup/",
  },
  {
    name:        "Financial Aid Office",
    description: "Grants, fee waivers, work-study and emergency funds. You may qualify for additional aid.",
    url:         "https://www.goldenwestcollege.edu/financial-aid/",
  },
  {
    name:        "Basic Needs Center",
    description: "Food pantry, emergency housing assistance, and emergency funds for enrolled students.",
    url:         "https://www.goldenwestcollege.edu/basic-needs/",
  },
];

// ── Main eligibility function ─────────────────────────────────────────────

export function checkEopsEligibility(profile: Record<string, unknown>): EopsResult {
  const sis   = (profile.banner_sis   ?? {}) as Record<string, unknown>;
  const fafsa = (profile.fafsa_cadaa  ?? {}) as Record<string, unknown>;
  const ccc   = (profile.cccapply     ?? {}) as Record<string, unknown>;

  const met:     string[] = [];
  const failed:  string[] = [];
  const missing: string[] = [];

  // ── 1. Residency ──────────────────────────────────────────────────────
  const residency = ((sis.residency_status as string) ?? "").trim();
  if (!residency) {
    missing.push("residency_status");
  } else if (ELIGIBLE_RESIDENCIES.has(residency)) {
    met.push(`Residency: ${residency}`);
  } else {
    failed.push(`Residency: '${residency}' is not CA Resident or AB540`);
  }

  // ── 2. Enrollment ─────────────────────────────────────────────────────
  const unitsIP = sis.units_in_progress as number | null ?? null;
  const isDsps  = Array.isArray(sis.special_populations) &&
                  (sis.special_populations as string[]).includes("DSPS");

  if (unitsIP === null || unitsIP === undefined) {
    missing.push("units_in_progress");
  } else {
    const floor    = isDsps ? MIN_UNITS_DSPS : MIN_UNITS_FULL_TIME;
    const dspsNote = isDsps ? " (DSPS reduced load)" : "";
    if (unitsIP >= floor) {
      met.push(`Enrollment: ${unitsIP} units in progress${dspsNote}`);
    } else {
      failed.push(`Enrollment: ${unitsIP} units (need ${floor}+${dspsNote})`);
    }
  }

  // ── 3. Unit ceiling ───────────────────────────────────────────────────
  const unitsEarned = sis.units_earned_total as number | null ?? null;
  if (unitsEarned === null || unitsEarned === undefined) {
    missing.push("units_earned_total");
  } else if (unitsEarned < UNIT_CEILING) {
    met.push(`Units completed: ${unitsEarned} (under ${UNIT_CEILING} ceiling)`);
  } else {
    failed.push(`Units completed: ${unitsEarned} — meets or exceeds ${UNIT_CEILING}-unit ceiling`);
  }

  // ── 4. Financial need ─────────────────────────────────────────────────
  const bogWaiver    = !!(fafsa.bog_fee_waiver);
  const ccpgEligible = !!(fafsa.ccpg_eligible);
  const income       = ((fafsa.income_bracket as string) ?? "").trim();
  const sai          = fafsa.student_aid_index_sai as number | null ?? null;
  const pell         = (fafsa.pell_grant_amount as number) || 0;
  const homeless     = !!(ccc.homeless_youth);

  const financiallyEligible =
    bogWaiver || ccpgEligible || LOW_INCOME_BRACKETS.has(income) ||
    sai === 0 || pell > 0 || homeless;

  if (financiallyEligible) {
    const indicators: string[] = [];
    if (bogWaiver)                       indicators.push("BOG Fee Waiver");
    if (ccpgEligible)                    indicators.push("CCPG eligible");
    if (LOW_INCOME_BRACKETS.has(income)) indicators.push(`income: ${income}`);
    if (sai === 0)                       indicators.push("SAI = 0");
    if (pell > 0)                        indicators.push(`Pell $${pell}`);
    if (homeless)                        indicators.push("Homeless Youth");
    met.push("Financial need: " + indicators.join(", "));
  } else {
    failed.push(`Financial need: no qualifying indicator (income: ${income || "unknown"}, SAI: ${sai})`);
  }

  // ── 5. Educational qualifier ──────────────────────────────────────────
  const hsDiploma   = (ccc.hs_diploma_or_ged as boolean) !== false;
  const gpa         = sis.cumulative_gpa as number | null ?? null;
  const fosterYouth = !!(ccc.foster_youth);
  const ethnicity   = ((sis.ethnicity as string) ?? "").trim();
  const prevCollege = ccc.college_previously_attended as boolean | null ?? null;
  const firstGen    = prevCollege === false;

  const edQualifiers: string[] = [];
  if (!hsDiploma)                                  edQualifiers.push("No HS diploma / GED");
  if (gpa !== null && gpa <= GPA_QUALIFIER_MAX)    edQualifiers.push(`GPA ${gpa.toFixed(2)} ≤ ${GPA_QUALIFIER_MAX}`);
  if (firstGen)                                    edQualifiers.push("First-generation college student");
  if (UNDERREPRESENTED_ETHNICITIES.has(ethnicity)) edQualifiers.push(`Underrepresented (${ethnicity})`);
  if (fosterYouth)                                 edQualifiers.push("Foster youth");

  if (edQualifiers.length > 0) {
    met.push("Educational qualifier(s): " + edQualifiers.join("; "));
  } else {
    failed.push("Educational qualifier: none met");
  }

  // ── Eligibility decision ──────────────────────────────────────────────
  const eligible = failed.length === 0 && missing.length === 0;

  // ── Priority score (only meaningful if eligible) ──────────────────────
  // Each high-need indicator adds 1 point.
  // Score 3+ → Tier 1 candidate
  // Score 1–2 → Tier 2 candidate
  // Score 0   → Tier 2 candidate (tier resolved to 3 by API if at capacity)
  let priorityScore = 0;
  if (eligible) {
    if (income === VERY_LOW_INCOME)                 priorityScore += 1;
    if (homeless)                                   priorityScore += 1;
    if (fosterYouth)                                priorityScore += 1;
    if (gpa !== null && gpa < GPA_HIGH_RISK)        priorityScore += 1;
    if (residency === "AB540 (Undocumented)")        priorityScore += 1;
  }

  // ── Preliminary tier (finalised by API after capacity check) ─────────
  let tier: EopsTier = null;
  if (eligible) {
    tier = priorityScore >= 3 ? "tier1" : "tier2";
  }

  // ── Alternative programs for Tier 3 ──────────────────────────────────
  // Filtered to what's relevant for this student — shown when redirected
  const alternativePrograms: AlternativeProgram[] = eligible
    ? buildAlternativePrograms(ccc, fafsa)
    : [];

  return {
    eligible,
    tier,
    priorityScore,
    reasonsMet:          met,
    reasonsFailed:       failed,
    missingInfo:         missing,
    bannerMessage:       "",   // filled in by the API route
    alternativePrograms,
  };
}

// ── Build a relevant subset of alternative programs ───────────────────────

function buildAlternativePrograms(
  ccc:   Record<string, unknown>,
  fafsa: Record<string, unknown>,
): AlternativeProgram[] {
  const programs: AlternativeProgram[] = [];
  const fosterYouth  = !!(ccc.foster_youth);
  const calworks     = !!(ccc.interested_in_calworks) || !!(fafsa.snap_benefits);
  const homeless     = !!(ccc.homeless_youth);

  // Always include Financial Aid and Basic Needs
  programs.push(ALL_ALTERNATIVE_PROGRAMS[3]); // Financial Aid
  programs.push(ALL_ALTERNATIVE_PROGRAMS[4]); // Basic Needs

  if (fosterYouth)          programs.unshift(ALL_ALTERNATIVE_PROGRAMS[2]); // NextUp first
  if (calworks)             programs.unshift(ALL_ALTERNATIVE_PROGRAMS[1]); // CalWORKs
  if (homeless || calworks) programs.unshift(ALL_ALTERNATIVE_PROGRAMS[0]); // CARE

  // Deduplicate
  return programs.filter((p, i, arr) => arr.findIndex(x => x.name === p.name) === i);
}
