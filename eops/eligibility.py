"""
eops/eligibility.py
──────────────────────────────────────────────────────────────────────────────
EOPS eligibility rules engine.

Based on California Title 5, Section 56220 and published eligibility criteria
from California Community Colleges (Fullerton College, Golden West, LAVC, etc.)

Official criteria (all must be met):
  1. California residency  — CA Resident OR AB540/Undocumented
  2. Full-time enrollment  — 12+ units in progress
     (exception: DSPS students may have a reduced load)
  3. Unit ceiling          — fewer than 70 degree-applicable units completed
                             (some colleges use 55; we use 70 as the more common
                             statewide standard — adjust UNIT_CEILING below)
  4. Financial need        — qualifies for CA College Promise Grant (CCPG/BOG
                             Fee Waiver), OR income bracket is low-income
  5. Educational qualifier — at least ONE of:
       a. No HS diploma / GED
       b. HS GPA 2.5 or below  (we use cumulative college GPA as proxy when
                                 HS GPA is not separately stored)
       c. First-generation college student
       d. Underrepresented population
       e. Current or former foster youth

Returns a structured result dict — never raises.
"""

from __future__ import annotations
from dataclasses import dataclass, field
from typing import Optional

# ── Tunable thresholds ────────────────────────────────────────────────────
UNIT_CEILING        = 70     # max degree-applicable units completed
MIN_UNITS_FULL_TIME = 12     # units required for full-time status
MIN_UNITS_DSPS      = 6      # reduced-load floor for DSPS students
GPA_QUALIFIER_MAX   = 2.5    # GPA at or below this qualifies as educational qualifier

# Income brackets considered low-income for CCPG eligibility proxy
LOW_INCOME_BRACKETS = {"< $19,000", "$19,001 - $36,000", "$19,001 – $36,000"}

# Underrepresented populations (maps to CCCApply ethnicity field)
UNDERREPRESENTED_ETHNICITIES = {
    "Hispanic or Latino",
    "Black or African American",
    "American Indian or Alaska Native",
    "Pacific Islander",
    "Filipino",
}

# Residency values that satisfy the CA-residency requirement
ELIGIBLE_RESIDENCIES = {"Resident", "AB540 (Undocumented)"}


# ── Result dataclass ──────────────────────────────────────────────────────

@dataclass
class EopsResult:
    eligible: bool
    reasons_met: list[str]      = field(default_factory=list)
    reasons_failed: list[str]   = field(default_factory=list)
    banner_message: str         = ""
    missing_info: list[str]     = field(default_factory=list)

    def to_dict(self) -> dict:
        return {
            "eligible":       self.eligible,
            "reasons_met":    self.reasons_met,
            "reasons_failed": self.reasons_failed,
            "banner_message": self.banner_message,
            "missing_info":   self.missing_info,
        }


# ── Main eligibility function ─────────────────────────────────────────────

def check_eops_eligibility(profile: dict) -> EopsResult:
    """
    Evaluate EOPS eligibility for one student profile JSON.

    Args:
        profile: Full student profile dict with keys banner_sis,
                 fafsa_cadaa, and cccapply.

    Returns:
        EopsResult with eligible flag, reasons, and a ready-to-display
        banner message.
    """
    sis   = profile.get("banner_sis", {})
    fafsa = profile.get("fafsa_cadaa", {})
    ccc   = profile.get("cccapply", {})

    met    = []
    failed = []
    missing = []

    # ── 1. California residency ───────────────────────────────────────────
    residency = (sis.get("residency_status") or "").strip()
    if not residency:
        missing.append("residency_status")
    elif residency in ELIGIBLE_RESIDENCIES:
        met.append(f"Residency: {residency}")
    else:
        failed.append(f"Residency: '{residency}' is not CA Resident or AB540")

    # ── 2. Enrollment (full-time or DSPS reduced load) ────────────────────
    units_ip   = sis.get("units_in_progress")
    is_dsps    = "DSPS" in (sis.get("special_populations") or [])
    enrollment = (sis.get("enrollment_status") or "").strip()
    app_type   = (ccc.get("app_type") or "").strip()

    if units_ip is None:
        missing.append("units_in_progress")
    else:
        floor = MIN_UNITS_DSPS if is_dsps else MIN_UNITS_FULL_TIME
        dsps_note = " (DSPS reduced load)" if is_dsps else ""
        if units_ip >= floor:
            met.append(f"Enrollment: {units_ip} units in progress{dsps_note}")
        else:
            failed.append(
                f"Enrollment: {units_ip} units in progress "
                f"(need {floor}+{dsps_note})"
            )

    # ── 3. Unit ceiling — fewer than UNIT_CEILING completed ───────────────
    units_earned = sis.get("units_earned_total")
    if units_earned is None:
        missing.append("units_earned_total")
    elif units_earned < UNIT_CEILING:
        met.append(f"Units completed: {units_earned} (under {UNIT_CEILING} ceiling)")
    else:
        failed.append(
            f"Units completed: {units_earned} meets or exceeds "
            f"{UNIT_CEILING}-unit ceiling"
        )

    # ── 4. Financial need / CCPG eligibility ──────────────────────────────
    bog_waiver     = fafsa.get("bog_fee_waiver", False)
    ccpg_eligible  = fafsa.get("ccpg_eligible", False)
    income_bracket = (fafsa.get("income_bracket") or "").strip()
    sai            = fafsa.get("student_aid_index_sai")
    pell           = fafsa.get("pell_grant_amount", 0) or 0
    homeless       = ccc.get("homeless_youth", False)

    financially_eligible = (
        bog_waiver
        or ccpg_eligible
        or (income_bracket in LOW_INCOME_BRACKETS)
        or (sai is not None and sai == 0)
        or (pell > 0)
        or homeless
    )

    if financially_eligible:
        indicators = []
        if bog_waiver:      indicators.append("BOG Fee Waiver")
        if ccpg_eligible:   indicators.append("CCPG eligible")
        if income_bracket in LOW_INCOME_BRACKETS:
            indicators.append(f"income bracket: {income_bracket}")
        if sai == 0:        indicators.append("SAI = 0")
        if pell > 0:        indicators.append(f"Pell Grant ${pell}")
        if homeless:        indicators.append("Homeless Youth")
        met.append("Financial need: " + ", ".join(indicators))
    else:
        failed.append(
            f"Financial need: no BOG waiver, CCPG, or low-income indicator "
            f"(income bracket: {income_bracket or 'unknown'}, SAI: {sai})"
        )

    # ── 5. Educational qualifier (at least one required) ──────────────────
    hs_diploma     = ccc.get("hs_diploma_or_ged", True)
    gpa            = sis.get("cumulative_gpa")
    foster_youth   = ccc.get("foster_youth", False)
    ethnicity      = (sis.get("ethnicity") or "").strip()
    prev_college   = ccc.get("college_previously_attended")
    hs_grad_year   = ccc.get("high_school_grad_year")

    # First-gen proxy: no prior college attendance on record
    first_gen = (prev_college is False)

    ed_qualifiers = []

    if not hs_diploma:
        ed_qualifiers.append("No HS diploma / GED")
    if gpa is not None and gpa <= GPA_QUALIFIER_MAX:
        ed_qualifiers.append(f"GPA {gpa:.2f} <= {GPA_QUALIFIER_MAX}")
    if first_gen:
        ed_qualifiers.append("First-generation college student")
    if ethnicity in UNDERREPRESENTED_ETHNICITIES:
        ed_qualifiers.append(f"Underrepresented population ({ethnicity})")
    if foster_youth:
        ed_qualifiers.append("Current or former foster youth")

    if ed_qualifiers:
        met.append("Educational qualifier(s): " + "; ".join(ed_qualifiers))
    else:
        failed.append(
            "Educational qualifier: none met "
            "(needs no HS diploma, low GPA, first-gen, underrepresented, or foster youth)"
        )

    # ── Final decision ────────────────────────────────────────────────────
    # All 5 criteria must be met; missing data counts as not met
    eligible = len(failed) == 0 and len(missing) == 0

    # Banner message
    name = (
        f"{sis.get('preferred_name') or sis.get('first_name', 'Student')}"
    )

    if eligible:
        banner_message = (
            f"Hi {name}! You may qualify for EOPS — a free program offering "
            "priority registration, counseling, book awards, and more. "
            "Visit the EOPS office or click here to apply."
        )
    elif missing:
        banner_message = ""   # not enough info to show anything
    else:
        banner_message = ""   # does not qualify — no banner shown

    return EopsResult(
        eligible=eligible,
        reasons_met=met,
        reasons_failed=failed,
        banner_message=banner_message,
        missing_info=missing,
    )
