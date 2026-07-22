"use client";
// src/app/page.tsx — GWC Student Portal
// Five demo profiles that exercise every combination of EOPS/CARE/CalWORKs.

import { useState } from "react";
import EopsBanner from "@/components/EopsBanner";
import StudentDashboard from "@/components/StudentDashboard";

const DEMO_PROFILES = [
  {
    label:       "Kylie — EOPS + CARE + CalWORKs",
    description: "Single parent, SNAP benefits, homeless, income <$19k → all three programs confirmed",
    profile: {
      banner_sis: {
        cwid: "@30302410", first_name: "Kylie", last_name: "Sanchez",
        preferred_name: "Kylie",
        email_gwc: "ksanchez12@student.goldenwestcollege.edu",
        enrollment_status: "Full-Time", units_in_progress: 12,
        units_earned_total: 20, cumulative_gpa: 1.85,
        residency_status: "Resident", special_populations: ["DSPS"],
        ethnicity: "Hispanic or Latino", program_of_study: "Nursing", year_in_college: "Freshman",
      },
      fafsa_cadaa: {
        bog_fee_waiver: true, ccpg_eligible: true,
        income_bracket: "< $19,000", student_aid_index_sai: 0, pell_grant_amount: 3829,
        snap_benefits: true, tax_filing_status: "Head of Household",
        household_size: 3, number_in_college: 1,
      },
      cccapply: {
        hs_diploma_or_ged: true, foster_youth: false, homeless_youth: true,
        college_previously_attended: false, app_type: "Credit",
        marital_status: "Single", interested_in_calworks: true,
      },
    },
  },
  {
    label:       "Michael — EOPS only (Tier 2 waitlist)",
    description: "Eligible for EOPS, not a single parent → EOPS only, priority waitlist",
    profile: {
      banner_sis: {
        cwid: "@84059354", first_name: "Michael", last_name: "Diaz",
        preferred_name: "Michael",
        email_gwc: "mdiaz44@student.goldenwestcollege.edu",
        enrollment_status: "Full-Time", units_in_progress: 15,
        units_earned_total: 28, cumulative_gpa: 2.4,
        residency_status: "Resident", special_populations: [],
        ethnicity: "Hispanic or Latino", program_of_study: "Business Administration", year_in_college: "Sophomore",
      },
      fafsa_cadaa: {
        bog_fee_waiver: true, ccpg_eligible: false,
        income_bracket: "$36,001 – $60,000", student_aid_index_sai: 800, pell_grant_amount: 1200,
        snap_benefits: false, tax_filing_status: "Single",
        household_size: 1, number_in_college: 1,
      },
      cccapply: {
        hs_diploma_or_ged: true, foster_youth: false, homeless_youth: false,
        college_previously_attended: false, app_type: "Credit",
        marital_status: "Single", interested_in_calworks: false,
      },
    },
  },
  {
    label:       "Rosa — EOPS + CARE conditional",
    description: "Single parent, low income → EOPS confirmed, CARE conditional (needs proof of assistance)",
    profile: {
      banner_sis: {
        cwid: "@77700001", first_name: "Rosa", last_name: "Flores",
        preferred_name: "Rosa",
        email_gwc: "rflores01@student.goldenwestcollege.edu",
        enrollment_status: "Full-Time", units_in_progress: 12,
        units_earned_total: 10, cumulative_gpa: 2.2,
        residency_status: "Resident", special_populations: [],
        ethnicity: "Hispanic or Latino", program_of_study: "Early Childhood Education", year_in_college: "Freshman",
      },
      fafsa_cadaa: {
        bog_fee_waiver: true, ccpg_eligible: false,
        income_bracket: "< $19,000", student_aid_index_sai: 0, pell_grant_amount: 2500,
        snap_benefits: false, tax_filing_status: "Head of Household",
        household_size: 3, number_in_college: 1,
      },
      cccapply: {
        hs_diploma_or_ged: true, foster_youth: false, homeless_youth: false,
        college_previously_attended: false, app_type: "Credit",
        marital_status: "Single", interested_in_calworks: false,
      },
    },
  },
  {
    label:       "Isabella — EOPS Tier 3 (at capacity)",
    description: "Eligible for EOPS but program at capacity → referral to alternative programs",
    profile: {
      banner_sis: {
        cwid: "@91286864", first_name: "Isabella", last_name: "Avila",
        preferred_name: "Isabella",
        email_gwc: "iavila99@student.goldenwestcollege.edu",
        enrollment_status: "Full-Time", units_in_progress: 15,
        units_earned_total: 42, cumulative_gpa: 2.17,
        residency_status: "Resident", special_populations: [],
        ethnicity: "Hispanic or Latino", program_of_study: "Kinesiology", year_in_college: "Sophomore",
      },
      fafsa_cadaa: {
        bog_fee_waiver: true, ccpg_eligible: false,
        income_bracket: "$60,001 – $80,000", student_aid_index_sai: 1500, pell_grant_amount: 0,
        snap_benefits: false, tax_filing_status: "Single",
        household_size: 2, number_in_college: 1,
      },
      cccapply: {
        hs_diploma_or_ged: true, foster_youth: false, homeless_youth: false,
        college_previously_attended: true, app_type: "Credit",
        marital_status: "Single", interested_in_calworks: false,
      },
    },
  },
  {
    label:       "David — Not eligible",
    description: "Non-Resident, no financial need → no programs matched, no banner shown",
    profile: {
      banner_sis: {
        cwid: "@99900001", first_name: "David", last_name: "Park",
        preferred_name: "David",
        email_gwc: "dpark01@student.goldenwestcollege.edu",
        enrollment_status: "Full-Time", units_in_progress: 15,
        units_earned_total: 30, cumulative_gpa: 3.8,
        residency_status: "Non-Resident", special_populations: [],
        ethnicity: "Asian", program_of_study: "Computer Science", year_in_college: "Sophomore",
      },
      fafsa_cadaa: {
        bog_fee_waiver: false, ccpg_eligible: false,
        income_bracket: "> $110,000", student_aid_index_sai: 15000, pell_grant_amount: 0,
        snap_benefits: false, tax_filing_status: "Married Filing Jointly",
        household_size: 4, number_in_college: 1,
      },
      cccapply: {
        hs_diploma_or_ged: true, foster_youth: false, homeless_youth: false,
        college_previously_attended: true, app_type: "Credit",
        marital_status: "Single", interested_in_calworks: false,
      },
    },
  },
];

function StudentInfoCard({ profile }: { profile: typeof DEMO_PROFILES[0]["profile"] }) {
  const s = profile.banner_sis;
  const f = profile.fafsa_cadaa;
  const rows: [string, string][] = [
    ["CWID",           String(s.cwid)],
    ["Name",           `${s.first_name} ${s.last_name}`],
    ["GWC Email",      String(s.email_gwc)],
    ["Program",        String(s.program_of_study)],
    ["Year",           String(s.year_in_college)],
    ["Enrollment",     String(s.enrollment_status)],
    ["Units in prog.", String(s.units_in_progress)],
    ["Units earned",   String(s.units_earned_total)],
    ["GPA",            s.cumulative_gpa != null ? String(s.cumulative_gpa) : "—"],
    ["Residency",      String(s.residency_status)],
    ["Ethnicity",      String(s.ethnicity)],
    ["Income bracket", String(f.income_bracket)],
    ["BOG Waiver",     f.bog_fee_waiver ? "Yes" : "No"],
    ["Pell Grant",     f.pell_grant_amount ? `$${f.pell_grant_amount}` : "$0"],
    ["SAI",            String(f.student_aid_index_sai)],
    ["SNAP benefits",  f.snap_benefits ? "Yes" : "No"],
    ["Household size", String(f.household_size)],
  ];
  return (
    <div style={{ background:"#ffffff", borderRadius:"12px", border:"1px solid #e5e7eb", padding:"20px 24px", marginBottom:"24px" }}>
      <h2 style={{ fontSize:"15px", fontWeight:700, color:"#003366", margin:"0 0 14px" }}>Active Student Profile</h2>
      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(220px,1fr))", gap:"8px 24px" }}>
        {rows.map(([label, value]) => (
          <div key={label} style={{ display:"flex", gap:"6px", fontSize:"13px" }}>
            <span style={{ color:"#6b7280", minWidth:"110px", flexShrink:0 }}>{label}:</span>
            <span style={{ color:"#111827", fontWeight:500 }}>{value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function StudentPortalPage() {
  const [activeIndex, setActiveIndex] = useState(0);
  const active = DEMO_PROFILES[activeIndex];

  function switchProfile(index: number) {
    sessionStorage.removeItem("eops-banner-dismissed");
    setActiveIndex(index);
  }

  return (
    <div style={{ minHeight:"100vh", backgroundColor:"#f5f5f5", display:"flex", flexDirection:"column" }}>

      <EopsBanner key={activeIndex} profile={active.profile} />

      <header style={{ backgroundColor:"#003366", padding:"14px 24px", display:"flex", alignItems:"center", justifyContent:"space-between" }}>
        <div style={{ display:"flex", alignItems:"center", gap:"12px" }}>
          <span style={{ color:"#FFCC00", fontWeight:"800", fontSize:"20px" }}>GWC</span>
          <span style={{ color:"#FFFFFF", fontSize:"16px", fontWeight:"500" }}>Student Portal</span>
        </div>
        <nav style={{ display:"flex", gap:"20px" }}>
          {["My Courses","Schedule","Financial Aid","Resources"].map(item => (
            <span key={item} style={{ color:"rgba(255,255,255,0.85)", fontSize:"13px" }}>{item}</span>
          ))}
        </nav>
      </header>

      <main style={{ flex:1, maxWidth:"1200px", margin:"0 auto", padding:"32px 24px", width:"100%" }}>

        <div style={{ marginBottom:"24px" }}>
          <p style={{ fontSize:"13px", color:"#6b7280", marginBottom:"10px", fontWeight:500 }}>
            TEST MODE — Switch student to test different program combinations:
          </p>
          <div style={{ display:"flex", gap:"10px", flexWrap:"wrap" }}>
            {DEMO_PROFILES.map((demo, i) => (
              <button key={i} onClick={() => switchProfile(i)} style={{
                padding:"8px 14px", borderRadius:"8px", fontSize:"12px", fontWeight:600,
                cursor:"pointer", transition:"all 0.15s",
                border:      activeIndex===i ? "2px solid #003366" : "2px solid #d1d5db",
                background:  activeIndex===i ? "#003366" : "#ffffff",
                color:       activeIndex===i ? "#FFCC00" : "#374151",
              }}>
                {demo.label}
              </button>
            ))}
          </div>
          <p style={{ fontSize:"12px", color:"#9ca3af", marginTop:"6px" }}>{active.description}</p>
        </div>

        <StudentInfoCard profile={active.profile} />
        <StudentDashboard />
      </main>

      <footer style={{ backgroundColor:"#003366", borderTop:"3px solid #FFCC00", color:"rgba(255,255,255,0.7)", textAlign:"center", padding:"14px", fontSize:"12px" }}>
        © {new Date().getFullYear()} Golden West College — 15744 Goldenwest St, Huntington Beach, CA 92647
      </footer>
    </div>
  );
}
