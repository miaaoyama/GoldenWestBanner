"use client";
// src/components/EopsBanner.tsx
// GWC Automated Eligibility Notification Banner
//
// Shows every program a student qualifies for, split into:
//   CONFIRMED   — 100% qualified, no further action needed
//   CONDITIONAL — core criteria met, one supplemental item required
//
// Design by DXHub — Tier 1 gets confetti, all states get the slide-in card.

import { useEffect, useRef, useState } from "react";
import type { ProgramResult, EligibilitySummary } from "@/lib/programsEligibility";

interface StudentProfile {
  banner_sis?:  Record<string, unknown>;
  fafsa_cadaa?: Record<string, unknown>;
  cccapply?:    Record<string, unknown>;
}

interface ApiResponse extends EligibilitySummary {
  bannerIntro: string;
  hasMatches:  boolean;
}

export default function EopsBanner({ profile }: { profile: StudentProfile }) {
  const [data,       setData]       = useState<ApiResponse | null>(null);
  const [loading,    setLoading]    = useState(true);
  const [dismissed,  setDismissed]  = useState(false);
  const [accepted,   setAccepted]   = useState(false);
  const [expanded,   setExpanded]   = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animIdRef = useRef<number>(0);
  const piecesRef = useRef<ConfettiPiece[]>([]);

  useEffect(() => {
    if (!profile?.banner_sis) { setLoading(false); return; }
    if (sessionStorage.getItem("eops-banner-dismissed") === "1") {
      setDismissed(true); setLoading(false); return;
    }
    fetch("/api/eops", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(profile),
    })
      .then(r => r.json())
      .then((d: ApiResponse) => setData(d))
      .catch(e => console.error("Eligibility check failed:", e))
      .finally(() => setLoading(false));
  }, [profile]);

  // Confetti if Tier 1 confirmed
  useEffect(() => {
    const hasTier1 = data?.confirmed.some(p => p.programId === "eops" && p.tier === "tier1");
    if (!hasTier1) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    function resize() { canvas!.width = window.innerWidth; canvas!.height = window.innerHeight; }
    resize();
    window.addEventListener("resize", resize);
    setTimeout(() => {
      spawnBurst(200, canvas, piecesRef.current);
      tick(ctx, canvas, piecesRef, animIdRef);
      setTimeout(() => spawnBurst(100, canvas, piecesRef.current), 600);
    }, 800);
    return () => { window.removeEventListener("resize", resize); cancelAnimationFrame(animIdRef.current); };
  }, [data]);

  function stopConfetti() {
    cancelAnimationFrame(animIdRef.current);
    const c = canvasRef.current;
    if (c) setTimeout(() => c.getContext("2d")?.clearRect(0, 0, c.width, c.height), 350);
  }

  function handleAccept() {
    stopConfetti(); setAccepted(true);
    setTimeout(() => { sessionStorage.setItem("eops-banner-dismissed", "1"); setDismissed(true); }, 5000);
  }

  function handleDismiss() {
    stopConfetti();
    sessionStorage.setItem("eops-banner-dismissed", "1");
    setDismissed(true);
  }

  if (loading || dismissed || !data?.hasMatches) return null;

  const { confirmed, conditional, bannerIntro } = data;
  const firstName = (profile.banner_sis?.preferred_name as string) ||
                    (profile.banner_sis?.first_name     as string) || "Student";
  const gwcEmail  = (profile.banner_sis?.email_gwc     as string) || "your GWC student email";

  return (
    <>
      <canvas ref={canvasRef} style={{ position:"fixed", inset:0, pointerEvents:"none", zIndex:99 }} />

      <div
        role="dialog" aria-modal="false" aria-label="Program eligibility notification"
        style={{ position:"fixed", top:"28px", left:"50%", transform:"translateX(-50%)", zIndex:100, animation:"gwc-slide-down 0.6s cubic-bezier(0.22,1,0.36,1) 0.3s both" }}
      >
        <style>{`
          @keyframes gwc-slide-down{from{transform:translateX(-50%) translateY(-180px)}to{transform:translateX(-50%) translateY(0)}}
          @keyframes gwc-pop-in{from{transform:scale(0);opacity:0}to{transform:scale(1);opacity:1}}
          @keyframes gwc-fade-in{from{opacity:0;transform:translateY(-4px)}to{opacity:1;transform:translateY(0)}}
          .gwc-btn-p:hover{transform:translateY(-2px)!important;box-shadow:0 6px 16px rgba(0,0,0,0.18)!important}
          .gwc-btn-s:hover{border-color:#9ca3af!important;color:#374151!important}
          .gwc-prog-row:hover{background:#f0f4ff!important}
        `}</style>

        <div style={{ background:"#fff", borderRadius:"18px", boxShadow:"0 8px 32px rgba(0,0,0,0.18),0 2px 8px rgba(0,0,0,0.08)", padding:"28px 36px 24px", minWidth:"460px", maxWidth:"560px", position:"relative", borderTop:"5px solid #003366" }}>

          {/* ── ACCEPTED STATE ── */}
          {accepted ? (
            <div style={{ textAlign:"center", animation:"gwc-fade-in 0.3s ease" }}>
              <span style={{ fontSize:"2.6rem", display:"block", marginBottom:"12px", animation:"gwc-pop-in 0.4s cubic-bezier(0.34,1.56,0.64,1) both" }}>✅</span>
              <p style={{ fontSize:"1.1rem", fontWeight:900, color:"#003366", marginBottom:"8px" }}>You're confirmed!</p>
              <p style={{ fontSize:"0.85rem", color:"#374151", lineHeight:1.6, marginBottom:"6px" }}>
                A confirmation email has been sent to <strong style={{ color:"#003366" }}>{gwcEmail}</strong>.
              </p>
              <p style={{ fontSize:"0.72rem", color:"#9ca3af" }}>This message will close automatically in a few seconds.</p>
            </div>

          ) : (
          <>
            {/* ── INTRO ── */}
            <div style={{ marginBottom:"18px" }}>
              <span style={{ fontSize:"1.5rem", display:"block", marginBottom:"8px", animation:"gwc-pop-in 0.5s cubic-bezier(0.34,1.56,0.64,1) 0.9s both" }}>
                {confirmed.length > 0 ? "🎉" : "📋"}
              </span>
              <p style={{ fontSize:"1.05rem", fontWeight:900, color:"#003366", lineHeight:1.4, margin:0 }}>
                {bannerIntro}
              </p>
            </div>

            {/* ── CONFIRMED PROGRAMS ── */}
            {confirmed.length > 0 && (
              <section style={{ marginBottom:"16px" }}>
                <p style={{ fontSize:"0.68rem", fontWeight:800, color:"#166534", textTransform:"uppercase", letterSpacing:"0.08em", marginBottom:"8px" }}>
                  ✅ 100% Qualified — No action needed
                </p>
                {confirmed.map(prog => (
                  <ProgramCard
                    key={prog.programId}
                    prog={prog}
                    expanded={expanded === prog.programId}
                    onToggle={() => setExpanded(prev => prev === prog.programId ? null : prog.programId)}
                    accentColor="#003366"
                  />
                ))}
              </section>
            )}

            {/* ── CONDITIONAL PROGRAMS ── */}
            {conditional.length > 0 && (
              <section style={{ marginBottom:"16px" }}>
                <p style={{ fontSize:"0.68rem", fontWeight:800, color:"#92400e", textTransform:"uppercase", letterSpacing:"0.08em", marginBottom:"8px" }}>
                  📋 Conditionally Qualified — One item needed
                </p>
                {conditional.map(prog => (
                  <ProgramCard
                    key={prog.programId}
                    prog={prog}
                    expanded={expanded === prog.programId}
                    onToggle={() => setExpanded(prev => prev === prog.programId ? null : prog.programId)}
                    accentColor="#b45309"
                  />
                ))}
              </section>
            )}

            {/* ── ACTION BUTTONS ── */}
            <div style={{ display:"flex", gap:"10px", justifyContent:"center", marginTop:"4px" }}>
              {confirmed.length > 0 && (
                <button className="gwc-btn-p" onClick={handleAccept}
                  style={{ padding:"10px 24px", borderRadius:"10px", fontSize:"0.88rem", fontWeight:700, cursor:"pointer", border:"none", background:"#003366", color:"#fff", minWidth:"130px", transition:"transform 0.15s,box-shadow 0.15s" }}>
                  Accept &amp; Confirm
                </button>
              )}
              <button className="gwc-btn-s" onClick={handleDismiss}
                style={{ padding:"10px 24px", borderRadius:"10px", fontSize:"0.88rem", fontWeight:700, cursor:"pointer", background:"#fff", color:"#6b7280", border:"2px solid #d1d5db", minWidth:"110px", transition:"border-color 0.15s,color 0.15s" }}>
                {confirmed.length > 0 ? "Opt-out" : "Dismiss"}
              </button>
            </div>
          </>
          )}
        </div>
      </div>
    </>
  );
}

// ── Program card sub-component ────────────────────────────────────────────

function ProgramCard({
  prog, expanded, onToggle, accentColor,
}: {
  prog: ProgramResult;
  expanded: boolean;
  onToggle: () => void;
  accentColor: string;
}) {
  return (
    <div className="gwc-prog-row"
      style={{ background:"#f9fafb", borderRadius:"10px", borderLeft:`3px solid ${accentColor}`, marginBottom:"8px", overflow:"hidden", transition:"background 0.15s" }}>

      {/* Row header */}
      <button onClick={onToggle}
        style={{ width:"100%", background:"none", border:"none", padding:"10px 14px", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"space-between", textAlign:"left" }}>
        <div>
          <span style={{ fontSize:"0.82rem", fontWeight:700, color:"#003366" }}>{prog.shortName}</span>
          <span style={{ fontSize:"0.75rem", color:"#6b7280", marginLeft:"8px" }}>{prog.programName}</span>
        </div>
        <span style={{ fontSize:"0.65rem", color:accentColor, transition:"transform 0.25s", transform:expanded?"rotate(180deg)":"rotate(0deg)" }}>▾</span>
      </button>

      {/* Expandable detail */}
      {expanded && (
        <div style={{ padding:"0 14px 12px", animation:"gwc-fade-in 0.2s ease" }}>
          <p style={{ fontSize:"0.78rem", color:"#374151", lineHeight:1.5, marginBottom:"10px" }}>{prog.body}</p>

          {/* Pending items for conditional */}
          {prog.pendingItems.length > 0 && (
            <div style={{ background:"#fffbeb", border:"1px solid #fde68a", borderRadius:"8px", padding:"10px 12px", marginBottom:"10px" }}>
              <p style={{ fontSize:"0.68rem", fontWeight:800, color:"#92400e", textTransform:"uppercase", letterSpacing:"0.07em", marginBottom:"6px" }}>Needed to confirm</p>
              {prog.pendingItems.map(item => (
                <div key={item.label} style={{ marginBottom:"6px" }}>
                  <p style={{ fontSize:"0.75rem", fontWeight:700, color:"#374151", margin:"0 0 2px" }}>• {item.label}</p>
                  <p style={{ fontSize:"0.72rem", color:"#6b7280", margin:0 }}>{item.description}</p>
                </div>
              ))}
            </div>
          )}

          {/* Tier badge for EOPS */}
          {prog.programId === "eops" && prog.tier && (
            <span style={{ display:"inline-block", background: prog.tier==="tier1"?"#003366": prog.tier==="tier2"?"#FFCC00":"#6b7280", color: prog.tier==="tier2"?"#003366":"#fff", fontSize:"0.62rem", fontWeight:800, borderRadius:"20px", padding:"2px 10px", marginBottom:"8px", textTransform:"uppercase", letterSpacing:"0.08em" }}>
              {prog.tier==="tier1"?"Immediate Enrollment": prog.tier==="tier2"?"Priority Waitlist":"Waitlist — At Capacity"}
            </span>
          )}

          {/* Tier 3 alternatives */}
          {prog.alternatives.length > 0 && (
            <div style={{ marginBottom:"8px" }}>
              <p style={{ fontSize:"0.68rem", fontWeight:800, color:"#6b7280", textTransform:"uppercase", letterSpacing:"0.07em", marginBottom:"6px" }}>Other programs that can help now</p>
              {prog.alternatives.map(alt => (
                <a key={alt.name} href={alt.url} target="_blank" rel="noopener noreferrer"
                  style={{ display:"block", fontSize:"0.73rem", color:"#003366", fontWeight:600, marginBottom:"4px", textDecoration:"underline" }}>
                  {alt.name} →
                </a>
              ))}
            </div>
          )}

          <a href={prog.applyUrl} target="_blank" rel="noopener noreferrer"
            style={{ fontSize:"0.75rem", fontWeight:700, color:"#fff", background:accentColor, padding:"6px 14px", borderRadius:"6px", textDecoration:"none", display:"inline-block" }}>
            Learn more &amp; apply →
          </a>
        </div>
      )}
    </div>
  );
}

// ── Confetti ──────────────────────────────────────────────────────────────
interface ConfettiPiece { x:number;y:number;w:number;h:number;color:string;vx:number;vy:number;angle:number;spin:number;opacity:number;gravity:number;decay:number;shape:"rect"|"circle"; }
const COLORS=["#003366","#FFCC00","#818cf8","#34d399","#f472b6","#60a5fa","#f87171"];
function rand(a:number,b:number){return a+Math.random()*(b-a);}
function spawnBurst(count:number,canvas:HTMLCanvasElement,pieces:ConfettiPiece[]){for(let i=0;i<count;i++)pieces.push({x:rand(canvas.width*.25,canvas.width*.75),y:rand(-20,canvas.height*.25),w:rand(7,14),h:rand(4,9),color:COLORS[Math.floor(Math.random()*COLORS.length)],vx:rand(-4,4),vy:rand(2,7),angle:rand(0,Math.PI*2),spin:rand(-.15,.15),opacity:1,gravity:.12,decay:rand(.992,.999),shape:Math.random()>.5?"rect":"circle"});}
function tick(ctx:CanvasRenderingContext2D,canvas:HTMLCanvasElement,piecesRef:React.MutableRefObject<ConfettiPiece[]>,animIdRef:React.MutableRefObject<number>){ctx.clearRect(0,0,canvas.width,canvas.height);piecesRef.current=piecesRef.current.filter(p=>p.opacity>.05);piecesRef.current.forEach(p=>{p.vy+=p.gravity;p.vx*=p.decay;p.x+=p.vx;p.y+=p.vy;p.angle+=p.spin;p.opacity*=.993;ctx.save();ctx.globalAlpha=p.opacity;ctx.translate(p.x,p.y);ctx.rotate(p.angle);ctx.fillStyle=p.color;if(p.shape==="circle"){ctx.beginPath();ctx.arc(0,0,p.w/2,0,Math.PI*2);ctx.fill();}else{ctx.fillRect(-p.w/2,-p.h/2,p.w,p.h);}ctx.restore();});if(piecesRef.current.length>0)animIdRef.current=requestAnimationFrame(()=>tick(ctx,canvas,piecesRef,animIdRef));}
