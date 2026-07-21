"""
data/generate_students.py
──────────────────────────────────────────────────────────────────────────────
Generates 100 fake student profiles that mirror the fields populated from
CCCApply into Banner (SIS) and FAFSA/CADAA.

Each profile is written as an individual JSON file:
    data/students/student_<CWID>.json

Run:
    python data/generate_students.py

No external dependencies — uses only the Python standard library.
"""

import json
import os
import random
import uuid
from datetime import date, timedelta

# ── Output directory ──────────────────────────────────────────────────────
OUTPUT_DIR = os.path.join(os.path.dirname(__file__), "students")
os.makedirs(OUTPUT_DIR, exist_ok=True)

# ── Seed for reproducibility ──────────────────────────────────────────────
random.seed(42)

# ═══════════════════════════════════════════════════════════════════════════
# Reference data pools
# ═══════════════════════════════════════════════════════════════════════════

FIRST_NAMES = [
    "Aaliyah","Aaron","Abigail","Alejandro","Alyssa","Amara","Amelia","Ana",
    "Andrea","Angel","Anthony","Antonio","Ariana","Ashley","Bella","Benjamin",
    "Brianna","Bryan","Carlos","Carmen","Christian","Christina","Christopher",
    "Cynthia","Daniel","David","Destiny","Diana","Diego","Dylan","Elizabeth",
    "Emily","Emma","Eric","Ethan","Eva","Evelyn","Faith","Fernando","Gabriel",
    "Genesis","George","Gloria","Grace","Hannah","Henry","Isabella","Isaiah",
    "Ivan","Jacob","Jasmine","Jason","Jennifer","Jessica","Joanna","Jonathan",
    "Jordan","Jose","Juan","Julia","Karen","Katherine","Kevin","Kimberly",
    "Kylie","Laura","Lauren","Leila","Liam","Lily","Linda","Lisa","Luis",
    "Manuel","Maria","Mark","Martha","Mason","Matthew","Maya","Michael",
    "Michelle","Miguel","Mia","Monica","Natalie","Nathan","Nicole","Noah",
    "Nora","Olivia","Oscar","Patricia","Paul","Rachel","Rebecca","Ricardo",
    "Robert","Rosa","Ryan","Samantha","Sandra","Santiago","Sara","Sarah",
    "Sebastian","Serena","Sofia","Sophia","Stephanie","Steven","Susan","Taylor",
    "Thomas","Tiffany","Tyler","Valentina","Vanessa","Victoria","William","Yesenia",
]

LAST_NAMES = [
    "Aguilar","Alvarez","Anderson","Arellano","Avila","Barajas","Brown","Campos",
    "Castillo","Castro","Chavez","Chen","Clark","Contreras","Cruz","Davis",
    "Delgado","Diaz","Espinoza","Estrada","Flores","Fuentes","Garcia","Gomez",
    "Gonzalez","Guerrero","Gutierrez","Guzman","Hernandez","Herrera","Hill",
    "Jimenez","Johnson","Jones","Kim","Lee","Leon","Lopez","Lozano","Luna",
    "Martinez","Medina","Mendez","Mendoza","Morales","Moreno","Munoz","Navarro",
    "Nguyen","Ochoa","Ortega","Ortiz","Perez","Ponce","Ramirez","Ramos","Reyes",
    "Rios","Rivera","Rodriguez","Romero","Ruiz","Salazar","Sanchez","Sandoval",
    "Santiago","Santos","Smith","Soto","Taylor","Thomas","Torres","Trujillo",
    "Vargas","Vasquez","Vega","Velazquez","White","Williams","Wilson","Zamora",
]

STATES = [
    "CA","CA","CA","CA","CA","CA","CA","CA",  # Heavy CA weighting (community college)
    "AZ","NV","TX","OR","WA","NM","FL","NY","IL","CO",
]

CA_CITIES = [
    "Huntington Beach","Fountain Valley","Costa Mesa","Newport Beach","Santa Ana",
    "Anaheim","Irvine","Garden Grove","Westminster","Seal Beach","Laguna Beach",
    "Los Angeles","Long Beach","San Diego","Riverside","San Bernardino",
]

NATIONS = ["US"] * 88 + [
    "MX","PH","VN","KR","CN","IN","EL","GU","PR","JP","IR","AF","UK",
]

ETHNICITIES = [
    "Hispanic or Latino",
    "White Non-Hispanic",
    "Asian",
    "Black or African American",
    "Two or More Races",
    "Filipino",
    "Pacific Islander",
    "American Indian or Alaska Native",
    "Unknown/Decline to State",
]
ETHNICITY_WEIGHTS = [38, 22, 15, 5, 8, 6, 2, 1, 3]

LANGUAGES = ["English","Spanish","Vietnamese","Korean","Chinese (Mandarin)",
             "Tagalog","Arabic","Persian","Armenian","Japanese","Hindi",]

PROGRAMS = [
    ("Computer Science","A.S.","Transfer","CIS"),
    ("Business Administration","A.A.","Transfer","BUS"),
    ("Nursing","A.D.N.","Vocational","NUR"),
    ("Liberal Arts","A.A.","Transfer","LBA"),
    ("Early Childhood Education","A.A.","Vocational","ECE"),
    ("Graphic Design","A.A.","Vocational","ART"),
    ("Automotive Technology","A.S.","Vocational","AUT"),
    ("Psychology","A.A.","Transfer","PSY"),
    ("Mathematics","A.S.","Transfer","MATH"),
    ("English","A.A.","Transfer","ENG"),
    ("Kinesiology","A.A.","Transfer","KIN"),
    ("Accounting","A.S.","Transfer","ACC"),
    ("Administration of Justice","A.S.","Transfer","AJ"),
    ("Undecided","N/A","Transfer","UNDEC"),
]

TERMS = ["Fall 2024","Spring 2025","Fall 2025","Spring 2026"]

HS_NAMES = [
    "Edison High School","Marina High School","Fountain Valley High School",
    "Ocean View High School","Huntington Beach High School","Westminster High School",
    "Bolsa Grande High School","Garden Grove High School","Rancho Alamitos High School",
    "Santa Ana High School","Saddleback High School","Valley High School",
]

RESIDENCY_STATUSES = ["Resident","Non-Resident","AB540 (Undocumented)","International F-1"]
VISA_TYPES        = [None, None, None, None, None, None, None, None, None,
                     "F-1","J-1","B-2","TN","DACA",]

AID_TYPES = [
    ["Cal Grant A","BOG Fee Waiver"],
    ["Cal Grant B","BOG Fee Waiver","CCPG"],
    ["BOG Fee Waiver"],
    ["Pell Grant","Cal Grant A","BOG Fee Waiver"],
    ["Pell Grant","Cal Grant B","BOG Fee Waiver"],
    ["CADAA","BOG Fee Waiver"],
    ["None"],
    ["Pell Grant","SEOG","BOG Fee Waiver"],
]

DISABILITIES = [None, None, None, None, None, None, None,
                "Learning Disability","Physical Disability","Visual Impairment",
                "Deaf/Hard of Hearing","Psychological Disability",]

VETERAN_STATUSES = [
    "Not a Veteran","Not a Veteran","Not a Veteran","Not a Veteran","Not a Veteran",
    "Veteran","Active Duty","Dependent of Veteran",
]

HOUSING_SITUATIONS = [
    "Permanent","Permanent","Permanent","Permanent",
    "Temporary","Homeless","Couch Surfing",
]

ENROLLMENT_STATUSES = ["Full-Time","Part-Time","Full-Time","Full-Time","Part-Time"]

YEARS_IN_COLLEGE = ["Freshman","Sophomore","Freshman","Sophomore","Continuing"]

STUDENT_GOALS = [
    "Obtain Associate Degree and Transfer to 4-Year University",
    "Obtain Associate Degree Only",
    "Transfer Without Associate Degree",
    "Obtain a Vocational Certificate",
    "Improve Job Skills",
    "Discover Career Interests",
    "Prepare for a New Career",
    "Maintain Certification/License",
    "Personal Interest",
]

# ═══════════════════════════════════════════════════════════════════════════
# Helper utilities
# ═══════════════════════════════════════════════════════════════════════════

def rand_date(start_year: int, end_year: int) -> str:
    start = date(start_year, 1, 1)
    end   = date(end_year, 12, 31)
    return (start + timedelta(days=random.randint(0, (end - start).days))).isoformat()

def rand_ssn() -> str:
    """Returns a clearly-fake SSN using the 900-999 range (never issued by SSA)."""
    return f"9{random.randint(0,9)}{random.randint(0,9)}-{random.randint(10,99)}-{random.randint(1000,9999)}"

def rand_phone() -> str:
    return f"({random.randint(200,999)}) {random.randint(200,999)}-{random.randint(1000,9999)}"

def rand_email(first: str, last: str) -> str:
    domains = ["student.goldenwestcollege.edu","gmail.com","yahoo.com","outlook.com","icloud.com"]
    tag = f"{first.lower()}.{last.lower()}{random.randint(1,999)}"
    return f"{tag}@{random.choice(domains)}"

def rand_address() -> dict:
    city = random.choice(CA_CITIES)
    return {
        "street": f"{random.randint(100,9999)} {random.choice(['Main','Oak','Maple','Cedar','Pine','Elm','Washington','Lincoln','Harbor','Beach'])} {random.choice(['St','Ave','Blvd','Dr','Ln','Way','Ct'])}",
        "city":   city,
        "state":  "CA",
        "zip":    f"9{random.randint(0,9)}{random.randint(100,999)}",
        "county": "Orange",
    }

def rand_cwid() -> str:
    return f"@{random.randint(10000000, 99999999)}"

def rand_gpa() -> float:
    return round(random.uniform(1.5, 4.0), 2)

def weighted_choice(options, weights):
    total = sum(weights)
    r = random.uniform(0, total)
    cumulative = 0
    for opt, w in zip(options, weights):
        cumulative += w
        if r <= cumulative:
            return opt
    return options[-1]


# ═══════════════════════════════════════════════════════════════════════════
# Profile builder
# ═══════════════════════════════════════════════════════════════════════════

def build_profile(index: int) -> dict:
    first = random.choice(FIRST_NAMES)
    last  = random.choice(LAST_NAMES)
    mi    = random.choice(list("ABCDEFGHIJKLMNOPQRSTUVWXYZ") + [None, None, None])

    dob = rand_date(1985, 2006)
    age = date.today().year - int(dob[:4])

    state_of_origin   = random.choice(STATES)
    nation_of_origin  = random.choice(NATIONS)
    ethnicity         = weighted_choice(ETHNICITIES, ETHNICITY_WEIGHTS)
    primary_language  = random.choice(LANGUAGES)
    gender            = random.choice(["Male","Female","Non-binary","Prefer not to say"])
    program           = random.choice(PROGRAMS)
    enrollment_status = random.choice(ENROLLMENT_STATUSES)
    residency         = random.choice(RESIDENCY_STATUSES)
    visa_type         = random.choice(VISA_TYPES)
    address           = rand_address()
    term_start        = random.choice(TERMS)
    high_school       = random.choice(HS_NAMES)
    hs_grad_year      = random.randint(2010, 2025)
    year_in_college   = random.choice(YEARS_IN_COLLEGE)
    aid_package       = random.choice(AID_TYPES)
    disability        = random.choice(DISABILITIES)
    veteran_status    = random.choice(VETERAN_STATUSES)
    housing           = random.choice(HOUSING_SITUATIONS)
    goal              = random.choice(STUDENT_GOALS)
    units_earned      = random.randint(0, 60)
    units_in_progress = random.choice([3, 6, 9, 12, 15, 18])
    gpa               = rand_gpa() if units_earned > 0 else None
    cwid              = rand_cwid()
    cccapply_id       = str(uuid.uuid4()).upper()[:12]

    # Dependent/independent status (FAFSA)
    dependency_status = "Independent" if age >= 24 else random.choice(
        ["Dependent","Dependent","Dependent","Independent"]
    )

    # Family income bracket for FAFSA/CADAA
    income_bracket = random.choice([
        "< $19,000",
        "$19,001 – $36,000",
        "$36,001 – $60,000",
        "$60,001 – $80,000",
        "$80,001 – $110,000",
        "> $110,000",
    ])

    household_size = random.randint(1, 8)

    # EFC / SAI (Student Aid Index, renamed post-2024)
    sai = random.randint(0, 20000) if dependency_status == "Dependent" else random.randint(0, 8000)

    profile = {

        # ── Metadata ──────────────────────────────────────────────────────
        "_meta": {
            "source_system": "CCCApply",
            "generated_for": "GoldenWestCollege",
            "profile_index": index,
            "created_at":    date.today().isoformat(),
            "data_classification": "FAKE — For Testing Only",
        },

        # ── Banner SIS — Personal Information ─────────────────────────────
        "banner_sis": {
            "cwid":                  cwid,
            "pidm":                  random.randint(1000000, 9999999),
            "last_name":             last,
            "first_name":            first,
            "middle_initial":        mi,
            "preferred_name":        random.choice([first, first, first, f"{first[0]}."]),
            "date_of_birth":         dob,
            "age":                   age,
            "gender":                gender,
            "ssn_last4":             rand_ssn()[-4:],   # Only last 4 stored in Banner
            "email_primary":         rand_email(first, last),
            "email_gwc":             f"{first.lower()[0]}{last.lower()}{random.randint(10,99)}@student.goldenwestcollege.edu",
            "phone_primary":         rand_phone(),
            "phone_alternate":       rand_phone() if random.random() > 0.5 else None,
            "address_permanent":     address,
            "address_mailing":       address if random.random() > 0.3 else rand_address(),
            "ethnicity":             ethnicity,
            "race": {
                "hispanic_latino":        ethnicity == "Hispanic or Latino",
                "american_indian":        ethnicity == "American Indian or Alaska Native",
                "asian":                  ethnicity == "Asian",
                "black_african_american": ethnicity == "Black or African American",
                "pacific_islander":       ethnicity == "Pacific Islander",
                "white":                  ethnicity == "White Non-Hispanic",
                "two_or_more":            ethnicity == "Two or More Races",
                "unknown":                ethnicity == "Unknown/Decline to State",
            },
            "citizenship_status":    "US Citizen" if nation_of_origin == "US" else random.choice(
                ["Permanent Resident","Eligible Non-Citizen","Non-Resident Alien","DACA","Undocumented"]
            ),
            "nation_of_birth":       nation_of_origin,
            "state_of_birth":        state_of_origin if nation_of_origin == "US" else None,
            "primary_language":      primary_language,
            "english_proficiency":   random.choice(["Native","Fluent","Intermediate","Beginner"]),

            # Academic
            "student_type":          random.choice(["New","Continuing","Returning","Transfer"]),
            "enrollment_status":     enrollment_status,
            "student_goal":          goal,
            "year_in_college":       year_in_college,
            "units_earned_total":    units_earned,
            "units_in_progress":     units_in_progress,
            "cumulative_gpa":        gpa,
            "academic_standing":     (
                "Good Standing" if (gpa or 0) >= 2.0
                else "Academic Probation" if (gpa or 0) >= 1.0
                else "Disqualification"
            ),
            "program_of_study":      program[0],
            "degree_type":           program[1],
            "program_goal":          program[2],
            "department_code":       program[3],
            "catalog_year":          f"20{random.randint(22,26)}-20{random.randint(23,27)}",
            "first_term_enrolled":   term_start,
            "current_term":          "Spring 2026",
            "expected_graduation":   f"Spring 20{random.randint(26,28)}",
            "transfer_target":       random.choice([
                "UC Berkeley","UCLA","UC Irvine","UC San Diego","CSU Long Beach",
                "CSU Fullerton","Cal Poly Pomona","Cal Poly SLO","Not Applicable",
            ]),

            # Registration & Holds
            "registration_status":   random.choice(["Eligible","Hold","Not Eligible"]),
            "holds": random.sample(
                ["Financial Hold","Library Hold","Advising Hold","Academic Hold","None"],
                k=random.randint(0, 2)
            ),
            "priority_registration": random.choice([True, False]),
            "special_populations": [
                pop for pop in [
                    "DSPS" if disability else None,
                    "Veterans" if "Veteran" in veteran_status else None,
                    "EOPS" if (gpa or 4.0) < 2.5 and income_bracket in ["< $19,000","$19,001 – $36,000"] else None,
                    "CalWORKs" if random.random() < 0.07 else None,
                    "Foster Youth" if random.random() < 0.05 else None,
                    "CARE" if random.random() < 0.06 else None,
                    "Homeless" if housing == "Homeless" else None,
                    "AB540" if residency == "AB540 (Undocumented)" else None,
                ] if pop
            ],

            # Residency
            "residency_status":      residency,
            "visa_type":             visa_type,
            "residency_reclassification_pending": random.random() < 0.05,
        },

        # ── FAFSA / CADAA ─────────────────────────────────────────────────
        "fafsa_cadaa": {
            "aid_year":                   "2025-2026",
            "application_type":           "CADAA" if residency == "AB540 (Undocumented)" else "FAFSA",
            "fafsa_submission_date":      rand_date(2024, 2025) if random.random() > 0.2 else None,
            "isir_received":              random.random() > 0.15,
            "dependency_status":          dependency_status,
            "household_size":             household_size,
            "number_in_college":          random.randint(1, min(3, household_size)),
            "adjusted_gross_income":      random.randint(8000, 200000),
            "income_bracket":             income_bracket,
            "student_aid_index_sai":      sai,
            "efc_legacy":                 sai,   # Pre-2024 terminology still in some systems
            "tax_filing_status":          random.choice(
                ["Single","Married Filing Jointly","Head of Household","Not Required to File"]
            ),
            "snap_benefits":              random.random() < 0.12,
            "free_reduced_lunch":         random.random() < 0.25,
            "unusual_circumstances":      random.random() < 0.08,
            "professional_judgment_flag": random.random() < 0.05,
            "c_flag":                     random.random() < 0.10,   # Conflicting info
            "verification_selected":      random.random() < 0.30,
            "verification_group":         random.choice(["V1","V4","V5",None,None,None]),
            "verification_complete":      random.random() > 0.4,
            "satisfactory_academic_progress": random.choice(["Met","Not Met","Warning","Appeal Pending"]),
            "aid_package":                aid_package,
            "pell_grant_amount":          random.randint(600, 7395) if "Pell Grant" in aid_package else 0,
            "cal_grant_type":             next((a for a in aid_package if "Cal Grant" in a), None),
            "cal_grant_amount":           random.randint(1000, 3000) if any("Cal Grant" in a for a in aid_package) else 0,
            "bog_fee_waiver":             "BOG Fee Waiver" in aid_package,
            "bog_waiver_type":            random.choice(["A","B","C"]) if "BOG Fee Waiver" in aid_package else None,
            "ccpg_eligible":              "CCPG" in aid_package,
            "seog_amount":                random.randint(100, 1000) if "SEOG" in aid_package else 0,
            "total_aid_awarded":          random.randint(0, 15000),
            "loans_offered":              random.random() < 0.30,
            "work_study_offered":         random.random() < 0.20,
            "satisfactory_ap_appeal":     random.random() < 0.05,
        },

        # ── CCCApply Application Data ──────────────────────────────────────
        "cccapply": {
            "application_id":           cccapply_id,
            "college_id":               "071",            # Golden West College CCC College Code
            "college_name":             "Golden West College",
            "application_status":       random.choice(["Submitted","Accepted","In Review","Waitlisted"]),
            "application_date":         rand_date(2023, 2025),
            "term_applying_for":        term_start,
            "app_type":                 random.choice(["Credit","Non-Credit","Dual Enrollment"]),

            # Personal (mirrors Banner, sourced from CCCApply intake)
            "legal_last_name":          last,
            "legal_first_name":         first,
            "legal_middle_name":        mi,
            "ssn_provided":             random.random() > 0.05,
            "date_of_birth":            dob,
            "gender_identity":          gender,
            "pronoun":                  random.choice(["He/Him","She/Her","They/Them","Prefer not to say",None]),
            "marital_status":           random.choice(["Single","Married","Domestic Partner","Divorced","Widowed"]),

            # Contact
            "email":                    rand_email(first, last),
            "phone_cell":               rand_phone(),
            "address":                  address,

            # Background
            "us_armed_forces":          veteran_status != "Not a Veteran",
            "veteran_status":           veteran_status,
            "foster_youth":             random.random() < 0.05,
            "homeless_youth":           housing in ["Homeless","Couch Surfing"],
            "disability_status":        disability is not None,
            "disability_type":          disability,

            # Citizenship & Residency
            "us_citizen":               nation_of_origin == "US",
            "california_resident":      residency == "Resident",
            "residency_status":         residency,
            "ab540_affidavit_signed":   residency == "AB540 (Undocumented)",
            "visa_type":                visa_type,
            "country_of_birth":         nation_of_origin,
            "state_of_birth":           state_of_origin,
            "years_in_california":      random.randint(1, age - 5) if age > 6 else 1,
            "primary_language":         primary_language,
            "english_learner":          primary_language != "English" and random.random() > 0.3,

            # Education History
            "highest_education_level":  random.choice([
                "Some High School","High School Diploma","GED","Some College (No Degree)",
                "Associate Degree","Bachelor's Degree","Master's Degree","Doctorate",
            ]),
            "high_school_name":         high_school,
            "high_school_city":         random.choice(CA_CITIES),
            "high_school_state":        "CA",
            "high_school_grad_year":    hs_grad_year,
            "hs_diploma_or_ged":        True,
            "college_previously_attended": random.random() > 0.5,
            "previous_colleges":        [],
            "caaspp_test_taken":        random.random() > 0.3,
            "ap_courses_completed":     random.randint(0, 6),

            # Intent & Goals
            "student_goal":             goal,
            "intended_major":           program[0],
            "intended_degree":          program[1],
            "enrollment_intent":        enrollment_status,
            "daytime_availability":     random.choice(["Morning","Afternoon","Evening","Flexible"]),
            "online_learning_interest": random.random() > 0.3,

            # Special Programs Interest (from CCCApply checkboxes)
            "interested_in_dsps":       disability is not None,
            "interested_in_eops":       income_bracket in ["< $19,000","$19,001 – $36,000"],
            "interested_in_calworks":   random.random() < 0.08,
            "interested_in_care":       random.random() < 0.07,
            "interested_in_financial_aid": True,
            "interested_in_tutoring":   random.random() > 0.4,
            "interested_in_transfer_services": "Transfer" in goal,

            # Consent & Declarations
            "ferpa_consent":            True,
            "terms_accepted":           True,
            "signature_date":           rand_date(2023, 2025),
            "ip_address":               f"192.168.{random.randint(0,255)}.{random.randint(1,254)}",
        },
    }

    return profile


# ═══════════════════════════════════════════════════════════════════════════
# Main
# ═══════════════════════════════════════════════════════════════════════════

def main():
    generated = []
    for i in range(1, 101):
        profile = build_profile(i)
        cwid_clean = profile["banner_sis"]["cwid"].replace("@", "")
        filename = f"student_{cwid_clean}.json"
        filepath = os.path.join(OUTPUT_DIR, filename)
        with open(filepath, "w", encoding="utf-8") as f:
            json.dump(profile, f, indent=2, ensure_ascii=False)
        generated.append(filename)
        if i % 10 == 0:
            print(f"  ✓ {i}/100 profiles written")

    print(f"\n✅ Done — {len(generated)} profiles written to: {OUTPUT_DIR}/")
    print("\nSample file names:")
    for name in generated[:5]:
        print(f"  {name}")
    print("  ...")


if __name__ == "__main__":
    main()
