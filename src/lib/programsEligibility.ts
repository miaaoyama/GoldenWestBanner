// src/lib/programsEligibility.ts
// ──────────────────────────────────────────────────────────────────────────
// GWC Automated Eligibility-Matching Pipeline
//
// Given a student profile (Banner SIS + FAFSA/CADAA + CCCApply), returns
// every program the student qualifies for, split into two buckets:
//
//   CONFIRMED  — 100% qualified right now. No action required to be eligible.
//   CONDITIONAL — Meets core criteria but one or more supplemental items
//                 are needed before full enrollment (document, form, etc.)
//
// Designed to scale: add a new program by writing one checkXxx() function.
// No rewrites to the banner, API route, or page needed.
//
// Current programs: EOPS, CARE, CalWORKs
// Extension path:   add NextUp, DSPS, Financial Aid, Golden Promise, etc.

export type QualificationStatus = "confirmed" | "conditional" | "not_eligible";
export type EopsTier = "tier1" | "tier2" | "tier3";

export interface PendingItem {
  label:       string;   // e.g. "High school transcript"
  description: string;   // plain-language explanation
}

export interface ProgramResult {
  programId:        string;
  programName:      string;
  shortName:        string;
  status:           QualificationStatus;
  // EOPS only — capacity-based tier
  tier:             EopsTier | null;
  priorityScore:    number;
  // What the student sees
  headline:         string;
  body:             string;
  // Why they qualify / don't qualify
  reasonsMet:       string[];
  reasonsFailed:    string[];
  // Supplemental items needed for CONDITIONAL status
  pendingItems:     PendingItem[];
  // CTA
  applyUrl:         string;
  learnMoreUrl:     string;
  // Tier 3 only — other programs to try
  alternatives:     AlternativeRef[];
}

export interface AlternativeRef {
  name:        string;
  description: string;
  url:         string;
}

// ── Shared constants ──────────────────────────────────────────────────────
const UNIT_CEILING        = 70;
const MIN_UNITS_FULL_TIME = 12;
const MIN_UNITS_DSPS      = 6;
const GPA_QUALIFIER_MAX   = 2.5;
const GPA_HIGH_RISK       = 2.0;

const LOW_INCOME_BRACKETS = new Set([
  "< $19,000",
  "$19,001 - $36,000",
  "$19,001 \u2013 $36,000",
]);
const VERY_LOW_INCOME = "< $19,000";

const UNDERREPRESENTED = new Set([
  "Hispanic or Latino", "Black or African American",
  "American Indian or Alaska Native", "Pacific Islander", "Filipino",
]);

const CA_RESIDENCIES = new Set(["Resident", "AB540 (Undocumented)"]);

// ── Capacity (replace with real DB read in production) ────────────────────
const CAPACITY = {
  eops_tier1_cap:    150,  eops_tier1_filled: 120,
  eops_tier2_cap:    450,  eops_tier2_filled: 310,
};

// ── Convenience helpers ───────────────────────────────────────────────────
function sis(p: Record<string, unknown>)   { return (p.banner_sis   ?? {}) as Record<string, unknown>; }
function fafsa(p: Record<string, unknown>) { return (p.fafsa_cadaa  ?? {}) as Record<string, unknown>; }
function ccc(p: Record<string, unknown>)   { return (p.cccapply     ?? {}) as Record<string, unknown>; }
function firstName(p: Record<string, unknown>): string {
  return (sis(p).preferred_name as string) || (sis(p).first_name as string) || "Student";
}

// ═════════════════════════════════════════════════════════════════════════
// PUBLIC API — check all programs for one student
// ═════════════════════════════════════════════════════════════════════════

export function checkAllPrograms(profile: Record<string, unknown>): ProgramResult[] {
  return [
    checkEops(profile),
    checkCare(profile),
    checkCalworks(profile),
  ].filter(p => p.status !== "not_eligible");
}

// ─── Summary helper used by the banner ───────────────────────────────────

export interface EligibilitySummary {
  confirmed:   ProgramResult[];
  conditional: ProgramResult[];
  all:         ProgramResult[];
}

export function summarizeEligibility(profile: Record<string, unknown>): EligibilitySummary {
  const all         = checkAllPrograms(profile);
  const confirmed   = all.filter(p => p.status === "confirmed");
  const conditional = all.filter(p => p.status === "conditional");
  return { confirmed, conditional, all };
}

// ═════════════════════════════════════════════════════════════════════════
// EOPS — Extended Opportunity Programs & Services
// California Title 5, §56220
// ═════════════════════════════════════════════════════════════════════════

function checkEops(profile: Record<string, unknown>): ProgramResult {
  const s = sis(profile);
  const f = fafsa(profile);
  const c = ccc(profile);

  const met:     string[]      = [];
  const failed:  string[]      = [];
  const pending: PendingItem[] = [];

  // 1. Residency
  const residency = ((s.residency_status as string) ?? "").trim();
  if (CA_RESIDENCIES.has(residency)) met.push(`CA Residency: ${residency}`);
  else failed.push(`Residency '${residency}' — must be CA Resident or AB540`);

  // 2. Full-time enrollment
  const unitsIP = (s.units_in_progress as number) ?? 0;
  const isDsps  = Array.isArray(s.special_populations) &&
                  (s.special_populations as string[]).includes("DSPS");
  const floor   = isDsps ? MIN_UNITS_DSPS : MIN_UNITS_FULL_TIME;
  if (unitsIP >= floor) met.push(`Enrolled ${unitsIP} units${isDsps ? " (DSPS)" : ""}`);
  else failed.push(`Only ${unitsIP} units enrolled (need ${floor}+)`);

  // 3. Unit ceiling
  const unitsEarned = (s.units_earned_total as number) ?? 0;
  if (unitsEarned < UNIT_CEILING) met.push(`${unitsEarned} units completed (under ${UNIT_CEILING} limit)`);
  else failed.push(`${unitsEarned} units completed — over ${UNIT_CEILING}-unit ceiling`);

  // 4. Financial need
  const bogWaiver = !!(f.bog_fee_waiver);
  const ccpg      = !!(f.ccpg_eligible);
  const income    = ((f.income_bracket as string) ?? "").trim();
  const sai       = (f.student_aid_index_sai as number) ?? null;
  const pell      = (f.pell_grant_amount as number) || 0;
  const homeless  = !!(c.homeless_youth);
  const finElig   = bogWaiver || ccpg || LOW_INCOME_BRACKETS.has(income) || sai === 0 || pell > 0 || homeless;

  if (finElig) {
    const tags: string[] = [];
    if (bogWaiver)                       tags.push("BOG Fee Waiver");
    if (ccpg)                            tags.push("CCPG eligible");
    if (LOW_INCOME_BRACKETS.has(income)) tags.push(`income: ${income}`);
    if (sai === 0)                       tags.push("SAI = 0");
    if (pell > 0)                        tags.push(`Pell Grant $${pell}`);
    if (homeless)                        tags.push("Homeless Youth");
    met.push("Financial need: " + tags.join(", "));
  } else {
    failed.push("Financial need: no BOG waiver, CCPG, Pell, or low-income indicator found");
  }

  // 5. Educational qualifier
  const hsDiploma = (c.hs_diploma_or_ged as boolean) !== false;
  const gpa       = (s.cumulative_gpa as number) ?? null;
  const foster    = !!(c.foster_youth);
  const ethnicity = ((s.ethnicity as string) ?? "").trim();
  const firstGen  = (c.college_previously_attended as boolean) === false;
  const edTags: string[] = [];
  if (!hsDiploma)                               edTags.push("No HS diploma/GED");
  if (gpa !== null && gpa <= GPA_QUALIFIER_MAX) edTags.push(`GPA ${gpa.toFixed(2)} ≤ ${GPA_QUALIFIER_MAX}`);
  if (firstGen)                                 edTags.push("First-generation college student");
  if (UNDERREPRESENTED.has(ethnicity))          edTags.push(`Underrepresented (${ethnicity})`);
  if (foster)                                   edTags.push("Foster youth");

  if (edTags.length > 0) met.push("Educational qualifier: " + edTags.join("; "));
  else failed.push("Educational qualifier: no qualifying factor found");

  // Supplemental: transcripts required if no GPA on record (new student)
  if (gpa === null || unitsEarned === 0) {
    pending.push({
      label:       "High school transcript",
      description: "Submit your HS or GED transcript to Admissions & Records so EOPS can verify your educational background.",
    });
  }

  const coreEligible = failed.length === 0;
  const status: QualificationStatus = !coreEligible ? "not_eligible"
    : pending.length > 0 ? "conditional"
    : "confirmed";

  // Priority score (Tier 1 = highest need)
  let score = 0;
  if (coreEligible) {
    if (income === VERY_LOW_INCOME)           score++;
    if (homeless)                             score++;
    if (foster)                               score++;
    if (gpa !== null && gpa < GPA_HIGH_RISK)  score++;
    if (residency === "AB540 (Undocumented)") score++;
  }

  // Capacity-aware tier
  let tier: EopsTier | null = null;
  if (coreEligible) {
    const prelim = score >= 3 ? "tier1" : "tier2";
    const t1ok   = CAPACITY.eops_tier1_filled < CAPACITY.eops_tier1_cap;
    const t2ok   = CAPACITY.eops_tier2_filled < CAPACITY.eops_tier2_cap;
    tier = prelim === "tier1"
      ? (t1ok ? "tier1" : (t2ok ? "tier2" : "tier3"))
      : (t2ok ? "tier2" : "tier3");
  }

  const name = firstName(profile);
  const HEADLINES: Record<string, string> = {
    confirmed_tier1:   `🎉 Congratulations ${name} — you're 100% qualified for EOPS!`,
    confirmed_tier2:   `⭐ Great news ${name} — you qualify for EOPS!`,
    confirmed_tier3:   `${name}, you qualify for EOPS — but it's currently at capacity.`,
    conditional_tier1: `${name}, you're almost qualified for EOPS — one item needed.`,
    conditional_tier2: `${name}, you're nearly qualified for EOPS — one item needed.`,
    conditional_tier3: `${name}, you meet EOPS criteria — program at capacity.`,
  };
  const tierKey = tier ? `${status === "not_eligible" ? "not_eligible" : status}_${tier}` : "";

  const BODIES: Record<string, string> = {
    confirmed_tier1:   "You've been immediately enrolled. A confirmation email is on its way to your GWC address. Book your orientation to get started.",
    confirmed_tier2:   "Due to high demand you've been added to our priority waitlist. EOPS will reach out within 2 weeks as spots open.",
    confirmed_tier3:   "You're on the waitlist. In the meantime, these programs can help you right now:",
    conditional_tier1: "Once we receive the item below, you'll be immediately confirmed.",
    conditional_tier2: "Once we receive the item below, you'll be added to the priority waitlist.",
    conditional_tier3: "Once the item below is received, you'll be added to the waitlist.",
  };

  // Tier 3 alternatives
  const alts: AlternativeRef[] = tier === "tier3" ? [
    { name: "CARE", description: "Extra support for single parents on public assistance.", url: "https://www.goldenwestcollege.edu/eops/care/index.html" },
    { name: "NextUp", description: "Priority services for foster youth.", url: "https://www.goldenwestcollege.edu/eops/next-up-guardian/index.html" },
    { name: "Financial Aid", description: "Grants, fee waivers, and emergency funds.", url: "https://www.goldenwestcollege.edu/gwcfao/index.html" },
    { name: "Basic Needs / The Stand", description: "Food pantry and emergency housing support.", url: "https://www.goldenwestcollege.edu/basic-needs/index.html" },
  ] : [];

  return {
    programId:     "eops",
    programName:   "Extended Opportunity Programs & Services",
    shortName:     "EOPS",
    status,
    tier,
    priorityScore: score,
    headline:      tierKey ? (HEADLINES[tierKey] ?? "") : "",
    body:          tierKey ? (BODIES[tierKey]    ?? "") : "",
    reasonsMet:    met,
    reasonsFailed: failed,
    pendingItems:  pending,
    applyUrl:      "https://www.goldenwestcollege.edu/eops/index.html",
    learnMoreUrl:  "https://www.goldenwestcollege.edu/eops/index.html",
    alternatives:  alts,
  };
}

// ═════════════════════════════════════════════════════════════════════════
// CARE — Cooperative Agencies Resources for Education
// Must be EOPS-eligible + single parent + dependent child + public assistance
// ═════════════════════════════════════════════════════════════════════════

function checkCare(profile: Record<string, unknown>): ProgramResult {
  const s = sis(profile);
  const f = fafsa(profile);
  const c = ccc(profile);

  const met:     string[]      = [];
  const failed:  string[]      = [];
  const pending: PendingItem[] = [];

  // Must meet EOPS criteria first
  const eopsResult = checkEops(profile);
  if (eopsResult.status !== "not_eligible") {
    met.push("Meets EOPS eligibility criteria");
  } else {
    failed.push("Must meet EOPS eligibility criteria first");
  }

  // Single parent / head of household
  const marital     = ((c.marital_status as string) ?? "").trim();
  const taxStatus   = ((f.tax_filing_status as string) ?? "").trim();
  const singleParent = ["Single","Divorced","Widowed"].includes(marital) ||
                       taxStatus === "Head of Household";
  if (singleParent) met.push(`Single parent / head of household`);
  else failed.push("Must be a single parent or head of household");

  // Dependent child
  const householdSize = (f.household_size as number) ?? 1;
  const numInCollege  = (f.number_in_college as number) ?? 1;
  if (householdSize > numInCollege) met.push(`Has dependent child(ren) (household size: ${householdSize})`);
  else failed.push("Must have at least one dependent child");

  // Public assistance
  const snap        = !!(f.snap_benefits);
  const calworksFlg = !!(c.interested_in_calworks);
  const income      = ((f.income_bracket as string) ?? "").trim();
  const publicAid   = snap || calworksFlg || income === VERY_LOW_INCOME;
  if (publicAid) {
    const tags: string[] = [];
    if (snap)             tags.push("SNAP benefits");
    if (calworksFlg)      tags.push("CalWORKs");
    if (income === VERY_LOW_INCOME) tags.push(`income ${income}`);
    met.push("Receiving public assistance: " + tags.join(", "));
  } else {
    failed.push("Must receive public assistance (SNAP, CalWORKs, or income < $19k)");
  }

  // CARE requires proof of public assistance if not already verified
  if (publicAid && !snap) {
    pending.push({
      label:       "Proof of public assistance",
      description: "Bring a current benefit letter (CalWORKs, Medi-Cal, or SNAP) to the EOPS/CARE office to confirm eligibility.",
    });
  }

  const coreEligible = failed.length === 0;
  const status: QualificationStatus = !coreEligible ? "not_eligible"
    : pending.length > 0 ? "conditional"
    : "confirmed";

  const name = firstName(profile);

  return {
    programId:     "care",
    programName:   "Cooperative Agencies Resources for Education",
    shortName:     "CARE",
    status,
    tier:          null,
    priorityScore: 0,
    headline: status === "confirmed"
      ? `🌟 ${name}, you qualify for CARE!`
      : status === "conditional"
      ? `${name}, you're close to qualifying for CARE — one item needed.`
      : "",
    body: status === "confirmed"
      ? "CARE provides additional financial grants, emergency funds, childcare referrals, and personalised counseling for single parents. Visit the EOPS/CARE office in Student Services to enroll."
      : status === "conditional"
      ? "Once we receive the item below, your CARE application can be processed."
      : "",
    reasonsMet:    met,
    reasonsFailed: failed,
    pendingItems:  pending,
    applyUrl:      "https://www.goldenwestcollege.edu/eops/care/index.html",
    learnMoreUrl:  "https://www.goldenwestcollege.edu/eops/care/index.html",
    alternatives:  [],
  };
}

// ═════════════════════════════════════════════════════════════════════════
// CalWORKs — California Work Opportunity and Responsibility to Kids
// Must be actively receiving CalWORKs county cash aid
// ═════════════════════════════════════════════════════════════════════════

function checkCalworks(profile: Record<string, unknown>): ProgramResult {
  const s = sis(profile);
  const f = fafsa(profile);
  const c = ccc(profile);

  const met:     string[]      = [];
  const failed:  string[]      = [];
  const pending: PendingItem[] = [];

  // 1. CA residency
  const residency = ((s.residency_status as string) ?? "").trim();
  if (CA_RESIDENCIES.has(residency)) met.push(`CA Residency: ${residency}`);
  else failed.push("Must be a CA Resident or AB540");

  // 2. Enrolled in credit courses
  const unitsIP  = (s.units_in_progress as number) ?? 0;
  const appType  = ((c.app_type as string) ?? "Credit").trim();
  const isCredit = appType !== "Non-Credit";
  if (unitsIP >= 1 && isCredit) met.push(`Enrolled: ${unitsIP} credit unit(s)`);
  else failed.push("Must be enrolled in at least 1 credit unit");

  // 3. Receiving CalWORKs county cash aid
  // Proxy: CCCApply CalWORKs checkbox or SNAP benefits or very low income.
  // In production, replace with direct county welfare system verification.
  const calworksFlg = !!(c.interested_in_calworks);
  const snap        = !!(f.snap_benefits);
  const income      = ((f.income_bracket as string) ?? "").trim();
  const receivingAid = calworksFlg || snap;

  if (receivingAid) {
    const tags: string[] = [];
    if (calworksFlg) tags.push("CalWORKs indicated on application");
    if (snap)        tags.push("SNAP benefits");
    met.push("Public assistance: " + tags.join(", "));
  } else if (income === VERY_LOW_INCOME) {
    // Income bracket suggests possible eligibility — flag as conditional
    met.push(`Income bracket suggests possible eligibility (${income})`);
    pending.push({
      label:       "CalWORKs cash aid verification",
      description: "Bring your current CalWORKs approval letter from the county to the GWC CalWORKs office to confirm cash aid status.",
    });
  } else {
    failed.push("Must be actively receiving CalWORKs county cash aid");
  }

  const coreEligible = failed.length === 0;
  const status: QualificationStatus = !coreEligible ? "not_eligible"
    : pending.length > 0 ? "conditional"
    : "confirmed";

  const name = firstName(profile);

  return {
    programId:     "calworks",
    programName:   "California Work Opportunity & Responsibility to Kids",
    shortName:     "CalWORKs",
    status,
    tier:          null,
    priorityScore: 0,
    headline: status === "confirmed"
      ? `💼 ${name}, you qualify for GWC CalWORKs support!`
      : status === "conditional"
      ? `${name}, you may qualify for CalWORKs — one item needed.`
      : "",
    body: status === "confirmed"
      ? "GWC CalWORKs offers work-study placements, childcare assistance, transportation support, and dedicated counseling for students receiving county cash aid. Visit the CalWORKs office to enroll."
      : status === "conditional"
      ? "Once we verify your county cash aid status, you can be enrolled in CalWORKs support services."
      : "",
    reasonsMet:    met,
    reasonsFailed: failed,
    pendingItems:  pending,
    applyUrl:      "https://www.goldenwestcollege.edu/calworks/index.html",
    learnMoreUrl:  "https://www.goldenwestcollege.edu/calworks/index.html",
    alternatives:  [],
  };
}
