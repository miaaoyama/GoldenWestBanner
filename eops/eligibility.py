"""
eops/eligibility.py
──────────────────────────────────────────────────────────────────────────────
EOPS eligibility engine with priority scoring and tier assignment.
Mirrors src/lib/eopsEligibility.ts exactly.

TIER SYSTEM
  Tier 1 — Immediate enrollment  (priority score >= 3)
  Tier 2 — Priority waitlist     (priority score 0-2)
  Tier 3 — Referral to other programs (assigned by API when capacity is full)

Run test_runner.py to check all 100 fake student profiles.
"""

from __future__ import annotations
from dataclasses import dataclass, field
from typing import Optional

# ── Thresholds ────────────────────────────────────────────────────────────
UNIT_CEILING        = 70
MIN_UNITS_FULL_TIME = 12
MIN_UNITS_DSPS      = 6
GPA_QUALIFIER_MAX   = 2.5
GPA_HIGH_RISK       = 2.0    # below this adds a priority point

LOW_INCOME_BRACKETS = {"< $19,000", "$19,001 - $36,000", "$19,001 \u2013 $36,000"}
VERY_LOW_INCOME     = "< $19,000"

UNDERREPRESENTED_ETHNICITIES = {
    "Hispanic or Latino", "Black or African American",
    "American Indian or Alaska Native", "Pacific Islander", "Filipino",
}

ELIGIBLE_RESIDENCIES = {"Resident", "AB540 (Undocumented)"}

# ── Alternative programs ──────────────────────────────────────────────────
ALTERNATIVE_PROGRAMS = [
    {"name": "CARE", "description": "Support for single parents on public assistance who are also EOPS-eligible.", "url": "https://www.goldenwestcollege.edu/care/"},
    {"name": "CalWORKs", "description": "Employment training and support for students receiving CalWORKs cash aid.", "url": "https://www.goldenwestcollege.edu/calworks/"},
    {"name": "NextUp — Foster Youth Success Initiative", "description": "Priority services for current and former foster youth.", "url": "https://www.goldenwestcollege.edu/nextup/"},
    {"name": "Financial Aid Office", "description": "Grants, fee waivers, work-study, and emergency funds.", "url": "https://www.goldenwestcollege.edu/financial-aid/"},
    {"name": "Basic Needs Center", "description": "Food pantry, emergency housing, and emergency funds.", "url": "https://www.goldenwestcollege.edu/basic-needs/"},
]


@dataclass
class EopsResult:
    eligible:             bool
    tier:                 Optional[str]    = None   # "tier1", "tier2", "tier3", or None
    priority_score:       int              = 0
    reasons_met:          list[str]        = field(default_factory=list)
    reasons_failed:       list[str]        = field(default_factory=list)
    missing_info:         list[str]        = field(default_factory=list)
    banner_message:       str              = ""
    alternative_programs: list[dict]       = field(default_factory=list)

    def to_dict(self) -> dict:
        return {
            "eligible":             self.eligible,
            "tier":                 self.tier,
            "priorityScore":        self.priority_score,
            "reasonsMet":           self.reasons_met,
            "reasonsFailed":        self.reasons_failed,
            "missingInfo":          self.missing_info,
            "bannerMessage":        self.banner_message,
            "alternativePrograms":  self.alternative_programs,
        }


def check_eops_eligibility(profile: dict) -> EopsResult:
    sis   = profile.get("banner_sis",   {})
    fafsa = profile.get("fafsa_cadaa",  {})
    ccc   = profile.get("cccapply",     {})

    met:     list[str] = []
    failed:  list[str] = []
    missing: list[str] = []

    # ── 1. Residency ──────────────────────────────────────────────────────
    residency = (sis.get("residency_status") or "").strip()
    if not residency:
        missing.append("residency_status")
    elif residency in ELIGIBLE_RESIDENCIES:
        met.append(f"Residency: {residency}")
    else:
        failed.append(f"Residency: '{residency}' is not CA Resident or AB540")

    # ── 2. Enrollment ─────────────────────────────────────────────────────
    units_ip = sis.get("units_in_progress")
    is_dsps  = "DSPS" in (sis.get("special_populations") or [])
    if units_ip is None:
        missing.append("units_in_progress")
    else:
        floor     = MIN_UNITS_DSPS if is_dsps else MIN_UNITS_FULL_TIME
        dsps_note = " (DSPS reduced load)" if is_dsps else ""
        if units_ip >= floor:
            met.append(f"Enrollment: {units_ip} units in progress{dsps_note}")
        else:
            failed.append(f"Enrollment: {units_ip} units (need {floor}+{dsps_note})")

    # ── 3. Unit ceiling ───────────────────────────────────────────────────
    units_earned = sis.get("units_earned_total")
    if units_earned is None:
        missing.append("units_earned_total")
    elif units_earned < UNIT_CEILING:
        met.append(f"Units completed: {units_earned} (under {UNIT_CEILING} ceiling)")
    else:
        failed.append(f"Units completed: {units_earned} — meets or exceeds {UNIT_CEILING}-unit ceiling")

    # ── 4. Financial need ─────────────────────────────────────────────────
    bog_waiver    = bool(fafsa.get("bog_fee_waiver"))
    ccpg_eligible = bool(fafsa.get("ccpg_eligible"))
    income        = (fafsa.get("income_bracket") or "").strip()
    sai           = fafsa.get("student_aid_index_sai")
    pell          = fafsa.get("pell_grant_amount") or 0
    homeless      = bool(ccc.get("homeless_youth"))

    financially_eligible = (
        bog_waiver or ccpg_eligible or (income in LOW_INCOME_BRACKETS)
        or sai == 0 or pell > 0 or homeless
    )

    if financially_eligible:
        indicators = []
        if bog_waiver:                    indicators.append("BOG Fee Waiver")
        if ccpg_eligible:                 indicators.append("CCPG eligible")
        if income in LOW_INCOME_BRACKETS: indicators.append(f"income: {income}")
        if sai == 0:                      indicators.append("SAI = 0")
        if pell > 0:                      indicators.append(f"Pell ${pell}")
        if homeless:                      indicators.append("Homeless Youth")
        met.append("Financial need: " + ", ".join(indicators))
    else:
        failed.append(f"Financial need: no qualifying indicator (income: {income or 'unknown'}, SAI: {sai})")

    # ── 5. Educational qualifier ──────────────────────────────────────────
    hs_diploma    = ccc.get("hs_diploma_or_ged", True) is not False
    gpa           = sis.get("cumulative_gpa")
    foster_youth  = bool(ccc.get("foster_youth"))
    ethnicity     = (sis.get("ethnicity") or "").strip()
    prev_college  = ccc.get("college_previously_attended")
    first_gen     = prev_college is False

    ed_qualifiers = []
    if not hs_diploma:                                    ed_qualifiers.append("No HS diploma / GED")
    if gpa is not None and gpa <= GPA_QUALIFIER_MAX:      ed_qualifiers.append(f"GPA {gpa:.2f} <= {GPA_QUALIFIER_MAX}")
    if first_gen:                                         ed_qualifiers.append("First-generation college student")
    if ethnicity in UNDERREPRESENTED_ETHNICITIES:         ed_qualifiers.append(f"Underrepresented ({ethnicity})")
    if foster_youth:                                      ed_qualifiers.append("Foster youth")

    if ed_qualifiers:
        met.append("Educational qualifier(s): " + "; ".join(ed_qualifiers))
    else:
        failed.append("Educational qualifier: none met")

    # ── Eligibility decision ──────────────────────────────────────────────
    eligible = len(failed) == 0 and len(missing) == 0

    # ── Priority score ────────────────────────────────────────────────────
    priority_score = 0
    if eligible:
        if income == VERY_LOW_INCOME:                  priority_score += 1
        if homeless:                                   priority_score += 1
        if foster_youth:                               priority_score += 1
        if gpa is not None and gpa < GPA_HIGH_RISK:   priority_score += 1
        if residency == "AB540 (Undocumented)":        priority_score += 1

    # ── Preliminary tier ──────────────────────────────────────────────────
    tier = None
    if eligible:
        tier = "tier1" if priority_score >= 3 else "tier2"

    # ── Alternative programs (for Tier 3) ─────────────────────────────────
    alt_programs = []
    if eligible:
        if foster_youth:
            alt_programs.append(ALTERNATIVE_PROGRAMS[2])  # NextUp
        if ccc.get("interested_in_calworks") or fafsa.get("snap_benefits"):
            alt_programs.append(ALTERNATIVE_PROGRAMS[0])  # CARE
            alt_programs.append(ALTERNATIVE_PROGRAMS[1])  # CalWORKs
        if homeless:
            if ALTERNATIVE_PROGRAMS[0] not in alt_programs:
                alt_programs.append(ALTERNATIVE_PROGRAMS[0])
        alt_programs.append(ALTERNATIVE_PROGRAMS[3])  # Financial Aid
        alt_programs.append(ALTERNATIVE_PROGRAMS[4])  # Basic Needs
        # Deduplicate
        seen = set()
        alt_programs = [p for p in alt_programs if not (p["name"] in seen or seen.add(p["name"]))]

    return EopsResult(
        eligible=eligible,
        tier=tier,
        priority_score=priority_score,
        reasons_met=met,
        reasons_failed=failed,
        missing_info=missing,
        alternative_programs=alt_programs,
    )
