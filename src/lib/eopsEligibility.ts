// src/lib/eopsEligibility.ts
// TypeScript port of eops/eligibility.py — same rules, runs in the Next.js
// API route without needing a Python process.
//
// EOPS eligibility criteria (California Title 5, §56220):
//   1. CA residency (Resident or AB540)
//   2. Full-time enrollment (12+ units; 6+ for DSPS students)
//   3. Under 70 degree-applicable units completed
//   4. Financial need (BOG/CCPG/low-income/Pell/SAI=0/homeless)
//   5. At least one educational qualifier (no diploma, low GPA,
//      first-gen, underrepresented, foster youth)

export interface EopsResult {
  eligible: boolean;
  reasonsMet: string[];
  reasonsFailed: string[];
  bannerMessage: string;
  missingInfo: string[];
}

// ── Thresholds (mirrors Python constants) ─────────────────────────────────
const UNIT_CEILING         = 70;
const MIN_UNITS_FULL_TIME  = 12;
const MIN_UNITS_DSPS       = 6;
const GPA_QUALIFIER_MAX    = 2.5;

const LOW_INCOME_BRACKETS = new Set([
  "< $19,000",
  "$19,001 - $36,000",
  "$19,001 \u2013 $36,000",   // en-dash variant
]);

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

// ── Main function ─────────────────────────────────────────────────────────

export function checkEopsEligibility(profile: Record<string, unknown>): EopsResult {
  const sis   = (profile.banner_sis   ?? {}) as Record<string, unknown>;
  const fafsa = (profile.fafsa_cadaa  ?? {}) as Record<string, unknown>;
  const ccc   = (profile.cccapply     ?? {}) as Record<string, unknown>;

  const met: string[]     = [];
  const failed: string[]  = [];
  const missing: string[] = [];

  // ── 1. Residency ─────────────────────────────────────────────────────
  const residency = ((sis.residency_status as string) ?? "").trim();
  if (!residency) {
    missing.push("residency_status");
  } else if (ELIGIBLE_RESIDENCIES.has(residency)) {
    met.push(`Residency: ${residency}`);
  } else {
    failed.push(`Residency: '${residency}' is not CA Resident or AB540`);
  }

  // ── 2. Enrollment ─────────────────────────────────────────────────────
  const unitsIP  = sis.units_in_progress as number | null ?? null;
  const isDsps   = Array.isArray(sis.special_populations) &&
                   (sis.special_populations as string[]).includes("DSPS");

  if (unitsIP === null || unitsIP === undefined) {
    missing.push("units_in_progress");
  } else {
    const floor     = isDsps ? MIN_UNITS_DSPS : MIN_UNITS_FULL_TIME;
    const dspsNote  = isDsps ? " (DSPS reduced load)" : "";
    if (unitsIP >= floor) {
      met.push(`Enrollment: ${unitsIP} units in progress${dspsNote}`);
    } else {
      failed.push(`Enrollment: ${unitsIP} units in progress (need ${floor}+${dspsNote})`);
    }
  }

  // ── 3. Unit ceiling ───────────────────────────────────────────────────
  const unitsEarned = sis.units_earned_total as number | null ?? null;
  if (unitsEarned === null || unitsEarned === undefined) {
    missing.push("units_earned_total");
  } else if (unitsEarned < UNIT_CEILING) {
    met.push(`Units completed: ${unitsEarned} (under ${UNIT_CEILING} ceiling)`);
  } else {
    failed.push(`Units completed: ${unitsEarned} meets or exceeds ${UNIT_CEILING}-unit ceiling`);
  }

  // ── 4. Financial need ─────────────────────────────────────────────────
  const bogWaiver    = !!(fafsa.bog_fee_waiver);
  const ccpgEligible = !!(fafsa.ccpg_eligible);
  const income       = ((fafsa.income_bracket as string) ?? "").trim();
  const sai          = fafsa.student_aid_index_sai as number | null ?? null;
  const pell         = (fafsa.pell_grant_amount as number) || 0;
  const homeless     = !!(ccc.homeless_youth);

  const financiallyEligible =
    bogWaiver ||
    ccpgEligible ||
    LOW_INCOME_BRACKETS.has(income) ||
    sai === 0 ||
    pell > 0 ||
    homeless;

  if (financiallyEligible) {
    const indicators: string[] = [];
    if (bogWaiver)                      indicators.push("BOG Fee Waiver");
    if (ccpgEligible)                   indicators.push("CCPG eligible");
    if (LOW_INCOME_BRACKETS.has(income)) indicators.push(`income bracket: ${income}`);
    if (sai === 0)                      indicators.push("SAI = 0");
    if (pell > 0)                       indicators.push(`Pell Grant $${pell}`);
    if (homeless)                       indicators.push("Homeless Youth");
    met.push("Financial need: " + indicators.join(", "));
  } else {
    failed.push(
      `Financial need: no BOG waiver, CCPG, or low-income indicator ` +
      `(income bracket: ${income || "unknown"}, SAI: ${sai})`
    );
  }

  // ── 5. Educational qualifier ─────────────────────────────────────────
  const hsDiploma   = (ccc.hs_diploma_or_ged as boolean) !== false; // default true
  const gpa         = sis.cumulative_gpa as number | null ?? null;
  const fosterYouth = !!(ccc.foster_youth);
  const ethnicity   = ((sis.ethnicity as string) ?? "").trim();
  const prevCollege = ccc.college_previously_attended as boolean | null ?? null;
  const firstGen    = prevCollege === false;

  const edQualifiers: string[] = [];
  if (!hsDiploma)                                       edQualifiers.push("No HS diploma / GED");
  if (gpa !== null && gpa <= GPA_QUALIFIER_MAX)         edQualifiers.push(`GPA ${gpa.toFixed(2)} ≤ ${GPA_QUALIFIER_MAX}`);
  if (firstGen)                                         edQualifiers.push("First-generation college student");
  if (UNDERREPRESENTED_ETHNICITIES.has(ethnicity))      edQualifiers.push(`Underrepresented population (${ethnicity})`);
  if (fosterYouth)                                      edQualifiers.push("Current or former foster youth");

  if (edQualifiers.length > 0) {
    met.push("Educational qualifier(s): " + edQualifiers.join("; "));
  } else {
    failed.push(
      "Educational qualifier: none met " +
      "(needs no HS diploma, low GPA, first-gen, underrepresented, or foster youth)"
    );
  }

  // ── Decision ─────────────────────────────────────────────────────────
  const eligible = failed.length === 0 && missing.length === 0;

  const firstName =
    (sis.preferred_name as string) ||
    (sis.first_name as string) ||
    "Student";

  const bannerMessage = eligible
    ? `Hi ${firstName}! You may qualify for EOPS — Golden West College's free ` +
      `program offering priority registration, personal counseling, book awards, ` +
      `and more. Apply today at the Student Services Center, room SS-116.`
    : "";

  return { eligible, reasonsMet: met, reasonsFailed: failed, bannerMessage, missingInfo: missing };
}
