"""
eops/test_runner.py
──────────────────────────────────────────────────────────────────────────────
Runs the EOPS eligibility engine against all 100 fake student profiles and
prints a full report.

Run:
    python3 eops/test_runner.py
    python3 eops/test_runner.py --verbose     # show per-student breakdown
    python3 eops/test_runner.py --csv         # also write results.csv
"""

import argparse
import csv
import json
import sys
from pathlib import Path

# Allow imports from repo root
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from eops.eligibility import check_eops_eligibility

STUDENTS_DIR = Path(__file__).parent.parent / "data" / "students"
CSV_OUT      = Path(__file__).parent / "results.csv"

# ── ANSI colours (disabled on non-TTY) ───────────────────────────────────
USE_COLOR = sys.stdout.isatty()
GREEN  = "\033[92m" if USE_COLOR else ""
RED    = "\033[91m" if USE_COLOR else ""
YELLOW = "\033[93m" if USE_COLOR else ""
BOLD   = "\033[1m"  if USE_COLOR else ""
RESET  = "\033[0m"  if USE_COLOR else ""


def run(verbose: bool = False, write_csv: bool = False):
    files = sorted(STUDENTS_DIR.glob("student_*.json"))
    if not files:
        print(f"No student JSON files found in {STUDENTS_DIR}")
        sys.exit(1)

    results      = []
    eligible     = []
    not_eligible = []
    missing_data = []

    print(f"\n{BOLD}EOPS Eligibility Test Runner{RESET}")
    print(f"Checking {len(files)} student profiles...\n")
    print("-" * 72)

    for path in files:
        profile = json.load(open(path, encoding="utf-8"))
        result  = check_eops_eligibility(profile)

        sis  = profile.get("banner_sis", {})
        name = (
            f"{sis.get('first_name', '?')} {sis.get('last_name', '?')}"
        ).strip()
        cwid    = sis.get("cwid", "N/A")
        program = sis.get("program_of_study", "-")
        gpa     = sis.get("cumulative_gpa")
        units   = sis.get("units_earned_total", "-")
        income  = profile.get("fafsa_cadaa", {}).get("income_bracket", "-")

        row = {
            "file":       path.name,
            "cwid":       cwid,
            "name":       name,
            "program":    program,
            "gpa":        gpa,
            "units":      units,
            "income":     income,
            "eligible":   result.eligible,
            "reasons_met":    " | ".join(result.reasons_met),
            "reasons_failed": " | ".join(result.reasons_failed),
            "missing_info":   " | ".join(result.missing_info),
            "banner_message": result.banner_message,
        }
        results.append(row)

        if result.missing_info:
            missing_data.append(row)
        elif result.eligible:
            eligible.append(row)
        else:
            not_eligible.append(row)

        if verbose:
            status_str = (
                f"{GREEN}ELIGIBLE{RESET}"     if result.eligible
                else f"{YELLOW}MISSING DATA{RESET}" if result.missing_info
                else f"{RED}NOT ELIGIBLE{RESET}"
            )
            print(f"\n{BOLD}{name}{RESET} ({cwid})  —  {status_str}")
            print(f"  Program : {program}")
            print(f"  GPA     : {gpa}   Units earned: {units}   Income: {income}")
            if result.reasons_met:
                for r in result.reasons_met:
                    print(f"  {GREEN}✓{RESET} {r}")
            if result.reasons_failed:
                for r in result.reasons_failed:
                    print(f"  {RED}✗{RESET} {r}")
            if result.missing_info:
                for r in result.missing_info:
                    print(f"  {YELLOW}?{RESET} Missing: {r}")
            if result.banner_message:
                print(f"  Banner  : \"{result.banner_message}\"")

    # ── Summary ───────────────────────────────────────────────────────────
    total = len(results)
    print("\n" + "=" * 72)
    print(f"{BOLD}SUMMARY{RESET}")
    print("=" * 72)
    print(f"  Total students checked : {total}")
    print(f"  {GREEN}Eligible for EOPS      : {len(eligible)}{RESET}")
    print(f"  {RED}Not eligible           : {len(not_eligible)}{RESET}")
    print(f"  {YELLOW}Missing data           : {len(missing_data)}{RESET}")
    print(f"  Eligibility rate       : {len(eligible)/total*100:.1f}%")

    # ── Eligible students list ─────────────────────────────────────────────
    if eligible:
        print(f"\n{BOLD}ELIGIBLE STUDENTS ({len(eligible)}){RESET}")
        print("-" * 72)
        for r in eligible:
            gpa_str = f"{r['gpa']:.2f}" if r['gpa'] else "-"
            print(f"  {r['cwid']:<14} {r['name']:<28} GPA:{gpa_str:<6} Units:{r['units']:<5} {r['income']}")

    # ── Not eligible — top failure reasons ────────────────────────────────
    if not_eligible and verbose:
        print(f"\n{BOLD}NOT ELIGIBLE — failure breakdown{RESET}")
        print("-" * 72)
        from collections import Counter
        fail_counts = Counter()
        for r in not_eligible:
            for reason in r["reasons_failed"].split(" | "):
                if reason:
                    # Bucket by first keyword
                    key = reason.split(":")[0].strip()
                    fail_counts[key] += 1
        for reason, count in fail_counts.most_common():
            print(f"  {count:>3}x  {reason}")

    # ── CSV output ────────────────────────────────────────────────────────
    if write_csv:
        with open(CSV_OUT, "w", newline="", encoding="utf-8") as f:
            writer = csv.DictWriter(f, fieldnames=list(results[0].keys()))
            writer.writeheader()
            writer.writerows(results)
        print(f"\nCSV saved → {CSV_OUT}")

    print()
    return results


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="EOPS eligibility test runner")
    parser.add_argument("--verbose", "-v", action="store_true",
                        help="Show per-student breakdown")
    parser.add_argument("--csv", action="store_true",
                        help="Write results to eops/results.csv")
    args = parser.parse_args()
    run(verbose=args.verbose, write_csv=args.csv)
