"use client";
// src/components/EopsBanner.tsx
// Golden West College — EOPS eligibility notification banner.
//
// Shows automatically when the page loads if the student qualifies for EOPS.
// Disappears permanently (per session) when the student clicks Dismiss.
//
// Usage in a page or layout:
//   import EopsBanner from "@/components/EopsBanner";
//   <EopsBanner profile={studentProfile} />
//
// Props:
//   profile — the student's full profile object (banner_sis + fafsa_cadaa + cccapply)
//   If omitted, the banner fetches nothing and stays hidden.

import { useEffect, useState } from "react";

// ── Types ─────────────────────────────────────────────────────────────────

interface StudentProfile {
  banner_sis?:   Record<string, unknown>;
  fafsa_cadaa?:  Record<string, unknown>;
  cccapply?:     Record<string, unknown>;
}

interface EopsResult {
  eligible:       boolean;
  bannerMessage:  string;
  reasonsMet:     string[];
  reasonsFailed:  string[];
  missingInfo:    string[];
}

interface EopsBannerProps {
  profile: StudentProfile;
}

// ── GWC brand colours (from Golden West College identity guide) ────────────
// Primary navy:  #003366
// Primary gold:  #FFCC00
// These are referenced inline so they work without Tailwind custom config.

// ── Component ─────────────────────────────────────────────────────────────

export default function EopsBanner({ profile }: EopsBannerProps) {
  const [result,    setResult]    = useState<EopsResult | null>(null);
  const [loading,   setLoading]   = useState(true);
  const [dismissed, setDismissed] = useState(false);

  // Check eligibility on mount
  useEffect(() => {
    if (!profile?.banner_sis) {
      setLoading(false);
      return;
    }

    // Skip if already dismissed this session
    if (sessionStorage.getItem("eops-banner-dismissed") === "1") {
      setDismissed(true);
      setLoading(false);
      return;
    }

    fetch("/api/eops", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify(profile),
    })
      .then((res) => res.json())
      .then((data: EopsResult) => setResult(data))
      .catch((err) => console.error("EOPS eligibility check failed:", err))
      .finally(() => setLoading(false));
  }, [profile]);

  function handleDismiss() {
    sessionStorage.setItem("eops-banner-dismissed", "1");
    setDismissed(true);
  }

  // Don't render if loading, dismissed, or student is not eligible
  if (loading || dismissed || !result?.eligible || !result.bannerMessage) {
    return null;
  }

  return (
    <div
      role="alert"
      aria-live="polite"
      aria-label="EOPS eligibility notification"
      style={{
        backgroundColor: "#003366",   // GWC navy
        borderBottom:    "4px solid #FFCC00",  // GWC gold accent line
        color:           "#FFFFFF",
        width:           "100%",
        padding:         "0",
      }}
    >
      <div
        style={{
          maxWidth:       "1200px",
          margin:         "0 auto",
          padding:        "12px 20px",
          display:        "flex",
          alignItems:     "center",
          gap:            "14px",
          flexWrap:       "wrap",
        }}
      >
        {/* GWC Gold star / badge icon */}
        <span
          aria-hidden="true"
          style={{
            flexShrink:     0,
            backgroundColor: "#FFCC00",
            color:           "#003366",
            borderRadius:   "50%",
            width:          "36px",
            height:         "36px",
            display:        "flex",
            alignItems:     "center",
            justifyContent: "center",
            fontWeight:     "bold",
            fontSize:       "18px",
          }}
        >
          ★
        </span>

        {/* Message block */}
        <div style={{ flex: 1, minWidth: "260px" }}>
          <p
            style={{
              margin:     0,
              fontSize:   "14px",
              fontWeight: "600",
              lineHeight: "1.4",
            }}
          >
            {result.bannerMessage}
          </p>
        </div>

        {/* CTA button */}
        <a
          href="https://www.goldenwestcollege.edu/eops/"
          target="_blank"
          rel="noopener noreferrer"
          style={{
            flexShrink:      0,
            backgroundColor: "#FFCC00",
            color:           "#003366",
            border:          "none",
            borderRadius:    "6px",
            padding:         "8px 18px",
            fontWeight:      "700",
            fontSize:        "13px",
            textDecoration:  "none",
            whiteSpace:      "nowrap",
            cursor:          "pointer",
          }}
        >
          Learn More & Apply
        </a>

        {/* Dismiss button */}
        <button
          onClick={handleDismiss}
          aria-label="Dismiss EOPS notification"
          style={{
            flexShrink:      0,
            background:      "transparent",
            border:          "1px solid rgba(255,255,255,0.5)",
            borderRadius:    "4px",
            color:           "rgba(255,255,255,0.8)",
            fontSize:        "12px",
            padding:         "5px 10px",
            cursor:          "pointer",
            whiteSpace:      "nowrap",
          }}
        >
          Dismiss
        </button>
      </div>
    </div>
  );
}
