"use client";
// src/app/page.tsx — Golden West College Student Portal
// Switch ACTIVE_PROFILE below to test each tier visually.

import EopsBanner from "@/components/EopsBanner";
import StudentDashboard from "@/components/StudentDashboard";

// ── TIER 1 — Immediate enrollment (high need: income < $19k + homeless + low GPA) ──
const PROFILE_TIER1 = {
  banner_sis: {
    cwid: "@30302410", first_name: "Kylie", last_name: "Sanchez",
    preferred_name: "Kylie",
    email_gwc: "ksanchez12@student.goldenwestcollege.edu",
    enrollment_status: "Full-Time", units_in_progress: 12,
    units_earned_total: 20, cumulative_gpa: 1.85,
    residency_status: "Resident", special_populations: ["DSPS"],
    ethnicity: "Hispanic or Latino",
  },
  fafsa_cadaa: {
    bog_fee_waiver: true, ccpg_eligible: true,
    income_bracket: "< $19,000", student_aid_index_sai: 0, pell_grant_amount: 3829,
  },
  cccapply: {
    hs_diploma_or_ged: true, foster_youth: false,
    homeless_youth: true, college_previously_attended: false,
  },
};

// ── TIER 2 — Priority waitlist (eligible but lower priority score) ──
const PROFILE_TIER2 = {
  banner_sis: {
    cwid: "@84059354", first_name: "Michael", last_name: "Diaz",
    preferred_name: "Michael",
    email_gwc: "mdiaz44@student.goldenwestcollege.edu",
    enrollment_status: "Full-Time", units_in_progress: 15,
    units_earned_total: 28, cumulative_gpa: 2.4,
    residency_status: "Resident", special_populations: [],
    ethnicity: "Hispanic or Latino",
  },
  fafsa_cadaa: {
    bog_fee_waiver: true, ccpg_eligible: false,
    income_bracket: "$36,001 – $60,000", student_aid_index_sai: 800, pell_grant_amount: 1200,
  },
  cccapply: {
    hs_diploma_or_ged: true, foster_youth: false,
    homeless_youth: false, college_previously_attended: false,
  },
};

// ── TIER 3 — Referral (eligible but program at capacity) ──
// To demo Tier 3, temporarily set tier2_filled = tier2_cap in the API route.
const PROFILE_TIER3 = {
  banner_sis: {
    cwid: "@91286864", first_name: "Isabella", last_name: "Avila",
    preferred_name: "Isabella",
    email_gwc: "iavila99@student.goldenwestcollege.edu",
    enrollment_status: "Full-Time", units_in_progress: 15,
    units_earned_total: 42, cumulative_gpa: 2.17,
    residency_status: "Resident", special_populations: [],
    ethnicity: "Hispanic or Latino",
  },
  fafsa_cadaa: {
    bog_fee_waiver: true, ccpg_eligible: false,
    income_bracket: "$60,001 – $80,000", student_aid_index_sai: 1500, pell_grant_amount: 0,
  },
  cccapply: {
    hs_diploma_or_ged: true, foster_youth: false,
    homeless_youth: false, college_previously_attended: true,
    interested_in_calworks: false,
  },
};

// ── Switch this to PROFILE_TIER2 or PROFILE_TIER3 to test other states ──
const ACTIVE_PROFILE = PROFILE_TIER1;

export default function StudentPortalPage() {
  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#f5f5f5", display: "flex", flexDirection: "column" }}>

      <EopsBanner profile={ACTIVE_PROFILE} />

      {/* Header */}
      <header style={{ backgroundColor: "#003366", padding: "14px 24px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <span style={{ color: "#FFCC00", fontWeight: "800", fontSize: "20px" }}>GWC</span>
          <span style={{ color: "#FFFFFF", fontSize: "16px", fontWeight: "500" }}>Student Portal</span>
        </div>
        <nav style={{ display: "flex", gap: "20px" }}>
          {["My Courses", "Schedule", "Financial Aid", "Resources"].map((item) => (
            <span key={item} style={{ color: "rgba(255,255,255,0.85)", fontSize: "13px" }}>{item}</span>
          ))}
        </nav>
      </header>

      {/* Main */}
      <main style={{ flex: 1, maxWidth: "1200px", margin: "0 auto", padding: "32px 24px", width: "100%" }}>
        <StudentDashboard />
      </main>

      {/* Footer */}
      <footer style={{ backgroundColor: "#003366", borderTop: "3px solid #FFCC00", color: "rgba(255,255,255,0.7)", textAlign: "center", padding: "14px", fontSize: "12px" }}>
        © {new Date().getFullYear()} Golden West College — 15744 Goldenwest St, Huntington Beach, CA 92647
      </footer>

    </div>
  );
}
