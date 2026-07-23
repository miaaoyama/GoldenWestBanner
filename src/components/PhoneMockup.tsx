"use client";
// src/components/PhoneMockup.tsx
// iPhone 16 Pro-style phone mockup with interactive SMS simulation.
// Features: Dynamic Island, thin bezels, iOS 18 Messages UI, green SMS bubbles.

import { useEffect, useRef, useState } from "react";

export interface SmsMessage {
  id: string;
  from: string;
  body: string;
  timestamp: string;
  studentName: string;
  isUserReply?: boolean;
}

interface PhoneMockupProps {
  messages: SmsMessage[];
  resetKey?: number;
}

export default function PhoneMockup({ messages, resetKey }: PhoneMockupProps) {
  const [visibleMessages, setVisibleMessages] = useState<SmsMessage[]>([]);
  const [localMessages, setLocalMessages] = useState<SmsMessage[]>([]);
  const [typing, setTyping] = useState(false);
  const [inputText, setInputText] = useState("");
  const [showConfetti, setShowConfetti] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const confettiRef = useRef<HTMLCanvasElement>(null);

  // Clear local messages when resetKey changes
  useEffect(() => {
    setLocalMessages([]);
    setVisibleMessages([]);
    setInputText("");
    setTyping(false);
    setShowConfetti(false);
  }, [resetKey]);

  // Confetti animation
  useEffect(() => {
    if (!showConfetti || !confettiRef.current) return;
    const canvas = confettiRef.current;
    const ctx = canvas.getContext("2d")!;
    canvas.width = 380;
    canvas.height = 700;
    const colors = ["#0F603D","#FFC522","#BADB3E","#1A9959","#f472b6","#60a5fa"];
    let pieces: any[] = [];
    for (let i = 0; i < 100; i++) {
      pieces.push({
        x: Math.random() * canvas.width, y: Math.random() * -200,
        w: 5 + Math.random() * 5, h: 3 + Math.random() * 4,
        color: colors[Math.floor(Math.random() * colors.length)],
        vx: (Math.random() - 0.5) * 4, vy: 2 + Math.random() * 4,
        angle: Math.random() * Math.PI * 2, spin: (Math.random() - 0.5) * 0.2,
        opacity: 1, gravity: 0.08
      });
    }
    let animId: number;
    function draw() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      pieces = pieces.filter(p => p.opacity > 0.02);
      pieces.forEach(p => {
        p.vy += p.gravity; p.x += p.vx; p.y += p.vy;
        p.angle += p.spin; p.opacity *= 0.99;
        ctx.save(); ctx.globalAlpha = p.opacity;
        ctx.translate(p.x, p.y); ctx.rotate(p.angle);
        ctx.fillStyle = p.color; ctx.fillRect(-p.w/2, -p.h/2, p.w, p.h);
        ctx.restore();
      });
      if (pieces.length > 0) animId = requestAnimationFrame(draw);
    }
    draw();
    return () => cancelAnimationFrame(animId);
  }, [showConfetti]);

  // Auto-scroll to bottom when new messages appear
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [visibleMessages, typing]);

  // Animate new incoming messages with a typing indicator
  useEffect(() => {
    const incomingCount = visibleMessages.filter(m => !m.isUserReply).length;
    if (messages.length > incomingCount) {
      setTyping(true);
      const timer = setTimeout(() => {
        setTyping(false);
        setVisibleMessages([...messages, ...localMessages]);
      }, 1200);
      return () => clearTimeout(timer);
    } else {
      setVisibleMessages([...messages, ...localMessages]);
    }
  }, [messages.length]);

  // Keep local messages in sync
  useEffect(() => {
    setVisibleMessages([...messages, ...localMessages]);
  }, [localMessages]);

  function handleSend() {
    const text = inputText.trim().toLowerCase();
    if (!text) return;

    const userMsg: SmsMessage = {
      id: crypto.randomUUID(),
      from: "student",
      body: inputText.trim().toUpperCase(),
      timestamp: new Date().toISOString(),
      studentName: "",
      isUserReply: true,
    };
    setLocalMessages(prev => [...prev, userMsg]);
    setInputText("");

    setTimeout(() => {
      setTyping(true);
      setTimeout(() => {
        setTyping(false);
        let responseBody: string;
        if (text === "y" || text === "yes") {
          responseBody = `Thank you! You have been opted in. Make an appointment with a counselor within the next 1-2 business days to learn more about next steps.\n\nWelcome to the program! 🎉\n\nhttps://www.goldenwestcollege.edu/counseling/index.html`;
          
          // Show confetti
          setShowConfetti(true);
          setTimeout(() => setShowConfetti(false), 4000);

          // Record opt-in in the backend (same as clicking Accept in email)
          fetch("/api/sms-reply", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: "accept", studentName: messages[0]?.studentName || "" })
          }).catch(function(e) { console.log("[SMS] Backend unavailable:", e.message); });

        } else if (text === "n" || text === "no") {
          responseBody = `You have been opted out. If you change your mind, you can contact the EOPS office at (714) 892-7711 ext. 55327 or visit goldenwestcollege.edu/eops anytime.`;
          
          // Record opt-out in the backend (same as clicking Opt Out in email)
          fetch("/api/sms-reply", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: "optout", studentName: messages[0]?.studentName || "" })
          }).catch(function(e) { console.log("[SMS] Backend unavailable:", e.message); });

        } else {
          responseBody = `Sorry, we didn't understand that. Please reply Y to opt in or N to opt out.`;
        }

        const responseMsg: SmsMessage = {
          id: crypto.randomUUID(),
          from: "Golden West College",
          body: responseBody,
          timestamp: new Date().toISOString(),
          studentName: "",
          isUserReply: false,
        };
        setLocalMessages(prev => [...prev, responseMsg]);
      }, 1000);
    }, 300);
  }

  const now = new Date();
  const timeString = now.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });

  // Convert URLs in text to clickable links
  function linkify(text: string, isUser: boolean) {
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    const parts = text.split(urlRegex);
    return parts.map((part, i) => {
      if (part.match(urlRegex)) {
        return (
          <a
            key={i}
            href={part}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              color: isUser ? "#fff" : "#007AFF",
              textDecoration: "underline",
              wordBreak: "break-all",
            }}
          >
            {part}
          </a>
        );
      }
      return part;
    });
  }

  return (
    <div style={styles.wrapper}>
      <style>{`
        @keyframes sms-fade-in {
          from { opacity: 0; transform: translateY(8px) scale(0.97); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes typing-bounce {
          0%, 60%, 100% { transform: translateY(0); opacity: 0.4; }
          30% { transform: translateY(-4px); opacity: 1; }
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        .phone-input:focus {
          outline: none;
          border-color: #007AFF !important;
        }
      `}</style>

      {/* iPhone 16 Pro frame */}
      <div style={styles.phone}>
        {/* Confetti overlay */}
        {showConfetti && (
          <canvas ref={confettiRef} style={{ position: "absolute", inset: 0, zIndex: 999, pointerEvents: "none", borderRadius: "54px" }} />
        )}
        {/* Titanium side frame effect */}
        <div style={styles.innerFrame}>

          {/* Dynamic Island */}
          <div style={styles.dynamicIsland} />

          {/* Status bar */}
          <div style={styles.statusBar}>
            <span style={styles.statusTime}>{timeString}</span>
            <div style={styles.statusRight}>
              <svg width="17" height="12" viewBox="0 0 17 12" fill="none">
                <path d="M1 9.5h1.5a.5.5 0 0 0 .5-.5V8a.5.5 0 0 0-.5-.5H1a.5.5 0 0 0-.5.5v1a.5.5 0 0 0 .5.5ZM4.5 9.5H6a.5.5 0 0 0 .5-.5V6a.5.5 0 0 0-.5-.5H4.5A.5.5 0 0 0 4 6v3a.5.5 0 0 0 .5.5ZM8 9.5h1.5A.5.5 0 0 0 10 9V4a.5.5 0 0 0-.5-.5H8a.5.5 0 0 0-.5.5v5a.5.5 0 0 0 .5.5ZM11.5 9.5H13a.5.5 0 0 0 .5-.5V2a.5.5 0 0 0-.5-.5h-1.5a.5.5 0 0 0-.5.5v7a.5.5 0 0 0 .5.5Z" fill="#000"/>
              </svg>
              <svg width="16" height="12" viewBox="0 0 16 12" fill="none">
                <path d="M8 3a6.7 6.7 0 0 1 4.77 2l.71-.71A7.9 7.9 0 0 0 8 2a7.9 7.9 0 0 0-5.48 2.29l.71.71A6.7 6.7 0 0 1 8 3Zm0 2.5a4.45 4.45 0 0 1 3.18 1.32l.71-.71A5.62 5.62 0 0 0 8 4.5a5.62 5.62 0 0 0-3.89 1.61l.71.71A4.45 4.45 0 0 1 8 5.5Zm0 2.5c.83 0 1.58.34 2.12.88l.71-.71A4 4 0 0 0 8 7a4 4 0 0 0-2.83 1.17l.71.71A2.98 2.98 0 0 1 8 8Zm0 2a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z" fill="#000"/>
              </svg>
              <div style={styles.battery}>
                <div style={styles.batteryInner} />
                <div style={styles.batteryTip} />
              </div>
            </div>
          </div>

          {/* Navigation / Contact header */}
          <div style={styles.navHeader}>
            <div style={styles.navBack}>
              <svg width="10" height="18" viewBox="0 0 10 18" fill="none">
                <path d="M9 1L1 9l8 8" stroke="#007AFF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <div style={styles.contactSection}>
              <div style={styles.avatar}>
                <span style={styles.avatarText}>GWC</span>
              </div>
              <div style={styles.contactDetails}>
                <div style={styles.contactName}>Golden West College</div>
                <div style={styles.contactSub}>Text Message</div>
              </div>
            </div>
          </div>

          {/* Messages */}
          <div style={styles.messagesArea}>
            {visibleMessages.length === 0 && !typing && (
              <div style={styles.emptyState}>
                <div style={styles.emptyBadge}>
                  <span style={styles.emptyBadgeText}>GWC</span>
                </div>
                <p style={styles.emptyName}>Golden West College</p>
                <p style={styles.emptyHint}>Text Message</p>
              </div>
            )}

            {visibleMessages.map((msg, i) => (
              <div
                key={msg.id}
                style={{
                  ...(msg.isUserReply ? styles.userBubble : styles.incomingBubble),
                  animation: `sms-fade-in 0.35s cubic-bezier(0.22, 1, 0.36, 1) forwards`,
                }}
              >
                <div style={{
                  ...styles.bubbleText,
                  color: msg.isUserReply ? "#fff" : "#000",
                }}>{linkify(msg.body, !!msg.isUserReply)}</div>
                <div style={{
                  ...styles.bubbleTime,
                  color: msg.isUserReply ? "rgba(255,255,255,0.6)" : "rgba(0,0,0,0.4)",
                }}>
                  {new Date(msg.timestamp).toLocaleTimeString([], {
                    hour: "numeric",
                    minute: "2-digit",
                  })}
                </div>
              </div>
            ))}

            {typing && (
              <div style={styles.typingContainer}>
                <span style={{ ...styles.typingDot, animationDelay: "0s" }}>●</span>
                <span style={{ ...styles.typingDot, animationDelay: "0.2s" }}>●</span>
                <span style={{ ...styles.typingDot, animationDelay: "0.4s" }}>●</span>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input area */}
          <div style={styles.inputArea}>
            <div style={styles.inputRow}>
              <div style={styles.plusButton}>+</div>
              <input
                className="phone-input"
                type="text"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") handleSend(); }}
                placeholder="Text Message"
                style={styles.textInput}
              />
              <button
                onClick={handleSend}
                style={{
                  ...styles.sendBtn,
                  opacity: inputText.trim() ? 1 : 0.35,
                  cursor: inputText.trim() ? "pointer" : "default",
                }}
                disabled={!inputText.trim()}
              >
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                  <path d="M7 12V2M7 2L3 6M7 2l4 4" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </button>
            </div>
          </div>

          {/* Home indicator */}
          <div style={styles.homeBar} />
        </div>
      </div>

      {/* Label */}
      <div style={styles.label}>
        <span style={styles.labelDot} />
        <span style={styles.labelText}>SMS Simulation — iPhone 16 Pro</span>
      </div>
    </div>
  );
}

// ── iPhone 16 Pro Styles ──────────────────────────────────────────────────

const styles: Record<string, React.CSSProperties> = {
  wrapper: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: "14px",
  },

  // Outer titanium frame
  phone: {
    width: "300px",
    height: "620px",
    background: "linear-gradient(145deg, #2c2c2e, #1c1c1e)",
    borderRadius: "50px",
    padding: "4px",
    position: "relative",
    boxShadow:
      "0 30px 60px rgba(0,0,0,0.4), 0 10px 20px rgba(0,0,0,0.25), inset 0 1px 0 rgba(255,255,255,0.1)",
  },

  // Inner screen area
  innerFrame: {
    width: "100%",
    height: "100%",
    background: "#f2f2f7",
    borderRadius: "46px",
    overflow: "hidden",
    display: "flex",
    flexDirection: "column",
    position: "relative",
  },

  // Dynamic Island
  dynamicIsland: {
    position: "absolute",
    top: "12px",
    left: "50%",
    transform: "translateX(-50%)",
    width: "90px",
    height: "25px",
    background: "#000",
    borderRadius: "20px",
    zIndex: 20,
  },

  // Status bar
  statusBar: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "16px 28px 0",
    height: "52px",
    flexShrink: 0,
  },
  statusTime: {
    fontSize: "14px",
    fontWeight: 600,
    color: "#000",
    fontFamily: "-apple-system, 'SF Pro Text', sans-serif",
  },
  statusRight: {
    display: "flex",
    alignItems: "center",
    gap: "6px",
  },
  battery: {
    width: "22px",
    height: "11px",
    border: "1.5px solid #000",
    borderRadius: "3px",
    position: "relative",
    display: "flex",
    alignItems: "center",
    padding: "1.5px",
  },
  batteryInner: {
    width: "75%",
    height: "100%",
    background: "#000",
    borderRadius: "1.5px",
  },
  batteryTip: {
    position: "absolute",
    right: "-3px",
    width: "2px",
    height: "5px",
    background: "#000",
    borderRadius: "0 1px 1px 0",
  },

  // Nav header
  navHeader: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    padding: "8px 16px 12px",
    borderBottom: "0.5px solid rgba(0,0,0,0.12)",
    flexShrink: 0,
  },
  navBack: {
    padding: "4px",
    display: "flex",
    alignItems: "center",
  },
  contactSection: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    flex: 1,
  },
  avatar: {
    width: "34px",
    height: "34px",
    borderRadius: "50%",
    background: "linear-gradient(135deg, #003366, #00508a)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    color: "#FFCC00",
    fontSize: "10px",
    fontWeight: 800,
    letterSpacing: "0.02em",
  },
  contactDetails: {
    display: "flex",
    flexDirection: "column",
  },
  contactName: {
    fontSize: "13px",
    fontWeight: 600,
    color: "#000",
    fontFamily: "-apple-system, 'SF Pro Text', sans-serif",
  },
  contactSub: {
    fontSize: "11px",
    color: "#8e8e93",
    fontFamily: "-apple-system, 'SF Pro Text', sans-serif",
  },

  // Messages area
  messagesArea: {
    flex: 1,
    overflowY: "auto" as const,
    padding: "14px 14px 8px",
    display: "flex",
    flexDirection: "column",
    gap: "6px",
    background: "#ffffff",
  },

  // Empty state
  emptyState: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: "6px",
  },
  emptyBadge: {
    width: "52px",
    height: "52px",
    borderRadius: "50%",
    background: "linear-gradient(135deg, #003366, #00508a)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: "4px",
  },
  emptyBadgeText: {
    color: "#FFCC00",
    fontSize: "13px",
    fontWeight: 800,
  },
  emptyName: {
    fontSize: "14px",
    fontWeight: 600,
    color: "#000",
    margin: 0,
  },
  emptyHint: {
    fontSize: "12px",
    color: "#8e8e93",
    margin: 0,
  },

  // Incoming SMS bubble (green for SMS)
  incomingBubble: {
    alignSelf: "flex-start",
    maxWidth: "82%",
    background: "#e9e9eb",
    borderRadius: "18px",
    borderBottomLeftRadius: "6px",
    padding: "9px 13px",
  },

  // User reply bubble (blue)
  userBubble: {
    alignSelf: "flex-end",
    maxWidth: "82%",
    background: "#007AFF",
    borderRadius: "18px",
    borderBottomRightRadius: "6px",
    padding: "9px 13px",
  },

  bubbleText: {
    fontSize: "13.5px",
    lineHeight: 1.4,
    wordBreak: "break-word" as const,
    whiteSpace: "pre-wrap" as const,
    fontFamily: "-apple-system, 'SF Pro Text', sans-serif",
  },

  bubbleTime: {
    fontSize: "9px",
    marginTop: "4px",
    textAlign: "right" as const,
    fontFamily: "-apple-system, 'SF Pro Text', sans-serif",
  },

  // Typing indicator
  typingContainer: {
    alignSelf: "flex-start",
    background: "#e9e9eb",
    borderRadius: "18px",
    borderBottomLeftRadius: "6px",
    padding: "10px 14px",
    display: "flex",
    gap: "3px",
    alignItems: "center",
  },
  typingDot: {
    fontSize: "12px",
    color: "#8e8e93",
    animation: "typing-bounce 1.2s infinite",
    display: "inline-block",
  },

  // Input area
  inputArea: {
    padding: "8px 10px",
    background: "#f2f2f7",
    borderTop: "0.5px solid rgba(0,0,0,0.1)",
    flexShrink: 0,
  },
  inputRow: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
  },
  plusButton: {
    width: "28px",
    height: "28px",
    borderRadius: "50%",
    background: "#e5e5ea",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "18px",
    color: "#8e8e93",
    fontWeight: 300,
    flexShrink: 0,
  },
  textInput: {
    flex: 1,
    background: "#ffffff",
    border: "1px solid #c7c7cc",
    borderRadius: "20px",
    padding: "8px 14px",
    fontSize: "14px",
    fontFamily: "-apple-system, 'SF Pro Text', sans-serif",
    color: "#000",
  },
  sendBtn: {
    width: "28px",
    height: "28px",
    borderRadius: "50%",
    background: "#007AFF",
    border: "none",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
    transition: "opacity 0.2s",
  },

  // Home bar
  homeBar: {
    width: "120px",
    height: "4px",
    background: "#000",
    borderRadius: "2px",
    margin: "6px auto 8px",
    opacity: 0.25,
  },

  // Label below phone
  label: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
  },
  labelDot: {
    width: "8px",
    height: "8px",
    borderRadius: "50%",
    background: "#34c759",
  },
  labelText: {
    fontSize: "12px",
    fontWeight: 500,
    color: "#6b7280",
    fontFamily: "-apple-system, 'SF Pro Text', sans-serif",
  },
};
