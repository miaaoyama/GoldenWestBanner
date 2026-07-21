"use client";
// src/components/EopsBanner.tsx
// Golden West College — EOPS eligibility notification banner.
// Design by DXHub (eops-notification.html) — converted to React.
//
// Shows as a floating card that slides in from the top with confetti
// when the student qualifies for EOPS. Dismissed per-session.
//
// Usage:  <EopsBanner profile={studentProfile} />

import { useEffect, useRef, useState } from "react";

interface StudentProfile {
  banner_sis?:  Record<string, unknown>;
  fafsa_cadaa?: Record<string, unknown>;
  cccapply?:    Record<string, unknown>;
}

interface EopsResult {
  eligible:      boolean;
  bannerMessage: string;
  reasonsMet:    string[];
}

interface EopsBannerProps {
  profile: StudentProfile;
}

// ── GWC EOPS eligibility criteria shown in the dropdown ─────────────────
const ELIGIBILITY_ITEMS = [
  "Be a California Resident or AB540 student",
  "Be enrolled in 12 units / full-time (exception: DSPS and NextUp students)",
  "Qualify for the CA College Promise Grant or Dream Act with 0 to -1,500 SAI",
  "Have fewer than 40 transferable units completed at all colleges attended",
  "Be considered educationally underserved (determined by EOPS)",
];

export default function EopsBanner({ profile }: EopsBannerProps) {
  const [result,      setResult]      = useState<EopsResult | null>(null);
  const [loading,     setLoading]     = useState(true);
  const [dismissed,   setDismissed]   = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const canvasRef   = useRef<HTMLCanvasElement>(null);
  const animIdRef   = useRef<number>(0);
  const piecesRef   = useRef<ConfettiPiece[]>([]);

  // ── Fetch eligibility on mount ────────────────────────────────────────
  useEffect(() => {
    if (!profile?.banner_sis) { setLoading(false); return; }
    if (sessionStorage.getItem("eops-banner-dismissed") === "1") {
      setDismissed(true); setLoading(false); return;
    }

    fetch("/api/eops", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify(profile),
    })
      .then((r) => r.json())
      .then((data: EopsResult) => setResult(data))
      .catch((e) => console.error("EOPS check failed:", e))
      .finally(() => setLoading(false));
  }, [profile]);

  // ── Start confetti once we know the student qualifies ─────────────────
  useEffect(() => {
    if (!result?.eligible) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d")!;

    function resize() {
      canvas!.width  = window.innerWidth;
      canvas!.height = window.innerHeight;
    }
    resize();
    window.addEventListener("resize", resize);

    // Spawn first burst after card slides in
    setTimeout(() => {
      spawnBurst(200, canvas, piecesRef.current);
      tick(ctx, canvas, piecesRef, animIdRef);
      setTimeout(() => spawnBurst(120, canvas, piecesRef.current), 600);
    }, 800);

    return () => {
      window.removeEventListener("resize", resize);
      cancelAnimationFrame(animIdRef.current);
    };
  }, [result]);

  function handleDismiss() {
    sessionStorage.setItem("eops-banner-dismissed", "1");
    setDismissed(true);
    cancelAnimationFrame(animIdRef.current);
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext("2d");
      setTimeout(() => ctx?.clearRect(0, 0, canvas.width, canvas.height), 420);
    }
  }

  function handleAccept() {
    window.open("https://www.goldenwestcollege.edu/eops/", "_blank", "noopener");
    handleDismiss();
  }

  if (loading || dismissed || !result?.eligible) return null;

  const firstName = (profile.banner_sis?.preferred_name as string) ||
                    (profile.banner_sis?.first_name as string) || "Student";

  return (
    <>
      {/* ── Confetti canvas (behind everything) ── */}
      <canvas
        ref={canvasRef}
        style={{
          position:      "fixed",
          inset:         0,
          pointerEvents: "none",
          zIndex:        99,
        }}
      />

      {/* ── Notification card ── */}
      <div
        role="dialog"
        aria-modal="false"
        aria-label="EOPS eligibility notification"
        style={{
          position:  "fixed",
          top:       "32px",
          left:      "50%",
          transform: "translateX(-50%)",
          zIndex:    100,
          animation: "gwc-slide-down 0.6s cubic-bezier(0.22,1,0.36,1) 0.3s both",
        }}
      >
        <style>{`
          @keyframes gwc-slide-down {
            from { transform: translateX(-50%) translateY(-160px); }
            to   { transform: translateX(-50%) translateY(0); }
          }
          @keyframes gwc-pop-in {
            from { transform: scale(0); opacity: 0; }
            to   { transform: scale(1); opacity: 1; }
          }
          @keyframes gwc-fade-in {
            from { opacity: 0; transform: translateY(-6px); }
            to   { opacity: 1; transform: translateY(0); }
          }
          .gwc-btn:hover  { transform: translateY(-2px) !important; box-shadow: 0 6px 16px rgba(0,0,0,0.15) !important; }
          .gwc-btn:active { transform: translateY(0) !important; opacity: 0.9; }
          .gwc-more:hover { color: #4338ca !important; }
        `}</style>

        <div style={{
          background:   "#ffffff",
          borderRadius: "18px",
          boxShadow:    "0 8px 32px rgba(0,0,0,0.18), 0 2px 8px rgba(0,0,0,0.10)",
          padding:      "36px 44px 28px",
          minWidth:     "380px",
          maxWidth:     "480px",
          textAlign:    "center",
          position:     "relative",
          borderTop:    "5px solid #003366",   // GWC navy
        }}>

          {/* Icon */}
          <span style={{
            fontSize:  "2.6rem",
            marginBottom: "12px",
            display:   "block",
            animation: "gwc-pop-in 0.5s cubic-bezier(0.34,1.56,0.64,1) 0.9s both",
          }}>🎉</span>

          {/* Title */}
          <p style={{
            fontSize:   "1.3rem",
            fontWeight: 900,
            color:      "#003366",
            lineHeight: 1.4,
            marginBottom: "6px",
          }}>
            Congratulations {firstName}, you qualify for EOPS!
          </p>

          {/* More information row */}
          <div style={{
            display:        "flex",
            justifyContent: "flex-end",
            marginBottom:   "22px",
            position:       "relative",
          }}>
            <button
              className="gwc-more"
              onClick={() => setDropdownOpen((v) => !v)}
              aria-expanded={dropdownOpen}
              style={{
                background:      "none",
                border:          "none",
                padding:         0,
                fontSize:        "0.72rem",
                color:           "#003366",
                cursor:          "pointer",
                textDecoration:  "underline",
                textUnderlineOffset: "2px",
                display:         "inline-flex",
                alignItems:      "center",
                gap:             "3px",
                fontFamily:      "inherit",
              }}
            >
              more information{" "}
              <span style={{
                display:    "inline-block",
                transition: "transform 0.25s",
                fontSize:   "0.65rem",
                transform:  dropdownOpen ? "rotate(180deg)" : "rotate(0deg)",
              }}>▾</span>
            </button>

            {/* Dropdown */}
            {dropdownOpen && (
              <div style={{
                position:     "absolute",
                top:          "calc(100% + 6px)",
                right:        0,
                width:        "340px",
                background:   "#ffffff",
                border:       "1px solid #c7d2fe",
                borderRadius: "14px",
                boxShadow:    "0 12px 36px rgba(0,51,102,0.18)",
                padding:      "18px 20px 16px",
                textAlign:    "left",
                zIndex:       200,
                animation:    "gwc-fade-in 0.2s ease",
              }}>
                <p style={{
                  fontSize:      "0.68rem",
                  fontWeight:    800,
                  color:         "#003366",
                  textTransform: "uppercase",
                  letterSpacing: "0.08em",
                  marginBottom:  "12px",
                }}>
                  Eligibility Requirements
                </p>
                <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: "10px" }}>
                  {ELIGIBILITY_ITEMS.map((item) => (
                    <li key={item} style={{
                      fontSize:    "0.74rem",
                      color:       "#374151",
                      lineHeight:  1.5,
                      paddingLeft: "18px",
                      position:    "relative",
                    }}>
                      <span style={{
                        position:   "absolute",
                        left:       0,
                        color:      "#FFCC00",
                        fontWeight: 700,
                        fontSize:   "0.68rem",
                        top:        "1px",
                      }}>✓</span>
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {/* Action buttons */}
          <div style={{ display: "flex", gap: "14px", justifyContent: "center" }}>
            <button
              className="gwc-btn"
              onClick={handleAccept}
              style={{
                padding:       "12px 28px",
                borderRadius:  "10px",
                fontSize:      "0.95rem",
                fontWeight:    700,
                cursor:        "pointer",
                border:        "none",
                background:    "#003366",
                color:         "#ffffff",
                minWidth:      "130px",
                transition:    "transform 0.15s, box-shadow 0.15s",
              }}
            >
              Accept now
            </button>
            <button
              className="gwc-btn"
              onClick={handleDismiss}
              style={{
                padding:       "12px 28px",
                borderRadius:  "10px",
                fontSize:      "0.95rem",
                fontWeight:    700,
                cursor:        "pointer",
                background:    "#ffffff",
                color:         "#6b7280",
                border:        "2px solid #d1d5db",
                minWidth:      "130px",
                transition:    "transform 0.15s, box-shadow 0.15s",
              }}
            >
              Opt-out
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

// ── Confetti helpers ───────────────────────────────────────────────────────

interface ConfettiPiece {
  x: number; y: number; w: number; h: number;
  color: string; vx: number; vy: number;
  angle: number; spin: number; opacity: number;
  gravity: number; decay: number; shape: "rect" | "circle";
}

const CONFETTI_COLORS = [
  "#003366","#FFCC00","#818cf8","#34d399",
  "#f472b6","#60a5fa","#f87171","#a78bfa",
];

function rand(a: number, b: number) { return a + Math.random() * (b - a); }

function spawnBurst(count: number, canvas: HTMLCanvasElement, pieces: ConfettiPiece[]) {
  for (let i = 0; i < count; i++) {
    pieces.push({
      x: rand(canvas.width * 0.25, canvas.width * 0.75),
      y: rand(-20, canvas.height * 0.25),
      w: rand(7, 14), h: rand(4, 9),
      color:   CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)],
      vx:      rand(-4, 4),    vy:      rand(2, 7),
      angle:   rand(0, Math.PI * 2),
      spin:    rand(-0.15, 0.15),
      opacity: 1,              gravity: 0.12,
      decay:   rand(0.992, 0.999),
      shape:   Math.random() > 0.5 ? "rect" : "circle",
    });
  }
}

function tick(
  ctx: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  piecesRef: React.MutableRefObject<ConfettiPiece[]>,
  animIdRef: React.MutableRefObject<number>,
) {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  piecesRef.current = piecesRef.current.filter((p) => p.opacity > 0.05);
  piecesRef.current.forEach((p) => {
    p.vy += p.gravity; p.vx *= p.decay;
    p.x  += p.vx;     p.y  += p.vy;
    p.angle += p.spin; p.opacity *= 0.993;
    ctx.save();
    ctx.globalAlpha = p.opacity;
    ctx.translate(p.x, p.y);
    ctx.rotate(p.angle);
    ctx.fillStyle = p.color;
    if (p.shape === "circle") {
      ctx.beginPath(); ctx.arc(0, 0, p.w / 2, 0, Math.PI * 2); ctx.fill();
    } else {
      ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
    }
    ctx.restore();
  });
  if (piecesRef.current.length > 0) {
    animIdRef.current = requestAnimationFrame(() =>
      tick(ctx, canvas, piecesRef, animIdRef)
    );
  }
}
