// src/app/page.tsx — Golden West College Student Portal
// Shows the EOPS eligibility banner automatically on page load
// if the student qualifies. No agents, no external AI calls —
// rules run server-side in /api/eops.

"use client";

import EopsBanner from "@/components/EopsBanner";
import StudentDashboard from "@/components/StudentDashboard";

// ---------------------------------------------------------------------------
// In production: replace this with your real auth session data.
// e.g. from NextAuth getSession(), Clerk currentUser(), or your LMS SSO.
// ---------------------------------------------------------------------------
const MOCK_STUDENT_PROFILE = {
  banner_sis: {
    cwid:                 "@30302410",
    first_name:           "Kylie",
    last_name:            "Sanchez",
    preferred_name:       "Kylie",
    enrollment_status:    "Full-Time",
    units_in_progress:    18,
    units_earned_total:   20,
    cumulative_gpa:       3.99,
    residency_status:     "Resident",
    special_populations:  ["DSPS"],
    ethnicity:            "Hispanic or Latino",
  },
  fafsa_cadaa: {
    bog_fee_waiver:           true,
    ccpg_eligible:            false,
    income_bracket:           "< $19,000",
    student_aid_index_sai:    0,
    pell_grant_amount:        3829,
  },
  cccapply: {
    hs_diploma_or_ged:            true,
    foster_youth:                 false,
    homeless_youth:               false,
    college_previously_attended:  false,   // first-gen
  },
};

export default function StudentPortalPage() {
  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#f5f5f5", display: "flex", flexDirection: "column" }}>

      {/* ── EOPS Eligibility Banner ───────────────────────────────────────
           Appears at the very top. Visible only if the student qualifies.
           Dismissed per-session via sessionStorage.                      */}
      <EopsBanner profile={MOCK_STUDENT_PROFILE} />

      {/* ── Site Header ──────────────────────────────────────────────────── */}
      <header
        style={{
          backgroundColor: "#003366",
          padding:         "14px 24px",
          display:         "flex",
          alignItems:      "center",
          justifyContent:  "space-between",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <span style={{ color: "#FFCC00", fontWeight: "800", fontSize: "20px" }}>
            GWC
          </span>
          <span style={{ color: "#FFFFFF", fontSize: "16px", fontWeight: "500" }}>
            Student Portal
          </span>
        </div>
        <nav style={{ display: "flex", gap: "20px" }}>
          {["My Courses", "Schedule", "Financial Aid", "Resources"].map((item) => (
            <a
              key={item}
              href="#"
              style={{ color: "rgba(255,255,255,0.85)", fontSize: "13px", textDecoration: "none" }}
            >
              {item}
            </a>
          ))}
        </nav>
      </header>

      {/* ── Main Content ─────────────────────────────────────────────────── */}
      <main style={{ flex: 1, maxWidth: "1200px", margin: "0 auto", padding: "32px 24px", width: "100%" }}>
        <StudentDashboard />
      </main>

      {/* ── Footer ───────────────────────────────────────────────────────── */}
      <footer
        style={{
          backgroundColor: "#003366",
          borderTop:       "3px solid #FFCC00",
          color:           "rgba(255,255,255,0.7)",
          textAlign:       "center",
          padding:         "14px",
          fontSize:        "12px",
        }}
      >
        © {new Date().getFullYear()} Golden West College — 15744 Goldenwest St, Huntington Beach, CA 92647
      </footer>

    </div>
  );
}
