"use client";
// src/components/SmsSimulationPanel.tsx
// Fetches students from the main backend (DynamoDB) and sends SMS simulations.

import { useState, useCallback, useEffect } from "react";
import PhoneMockup, { type SmsMessage } from "./PhoneMockup";

interface MockStudent {
  name: string;
  phone: string;
  programs: string[];
  tier: string;
  gpa: number;
  major: string;
}

const BACKEND_URL = "";

export default function SmsSimulationPanel() {
  const [messages, setMessages] = useState<SmsMessage[]>([]);
  const [processing, setProcessing] = useState(false);
  const [studentIndex, setStudentIndex] = useState(0);
  const [resetKey, setResetKey] = useState(0);
  const [students, setStudents] = useState<MockStudent[]>([]);
  const [loading, setLoading] = useState(true);

  // Fetch students from DynamoDB via the main backend
  useEffect(() => {
    fetch(`${BACKEND_URL}/api/tracking`)
      .then(r => r.json())
      .then(data => {
        const mapped: MockStudent[] = data.tracking
          .filter((t: any) => {
            // Only include students who have at least one confirmed program
            return Object.values(t.programs).some(
              (p: any) => p.eligibility === "confirmed"
            );
          })
          .map((t: any) => {
            // Confirmed programs (can opt in via SMS)
            const confirmedProgs = Object.entries(t.programs)
              .filter(([_, p]: [string, any]) => p.eligibility === "confirmed")
              .map(([_, p]: [string, any]) => p.displayName);
            // Conditional programs (need docs — mentioned but can't opt in)
            const conditionalProgs = Object.entries(t.programs)
              .filter(([_, p]: [string, any]) => p.eligibility === "conditional")
              .map(([_, p]: [string, any]) => ({ name: p.displayName, missing: p.missingDocs }));
            // Check if already accepted (via email or previous SMS)
            const alreadyAccepted = Object.values(t.programs).some(
              (p: any) => p.status === "opted_in"
            );
            const alreadyOptedOut = Object.values(t.programs).some(
              (p: any) => p.status === "opted_out"
            );
            return {
              name: t.name,
              cwid: t.cwid,
              phone: "(714) " + Math.floor(100 + Math.random() * 900) + "-" + Math.floor(1000 + Math.random() * 9000),
              programs: confirmedProgs,
              conditionalPrograms: conditionalProgs,
              alreadyAccepted,
              alreadyOptedOut,
              tier: "Tier 1",
              gpa: 0,
              major: "",
            };
          });
        setStudents(mapped);
        setLoading(false);
      })
      .catch(err => {
        console.log("[SMS Panel] Backend unavailable:", err.message);
        setLoading(false);
      });
  }, []);

  const simulateNewStudent = useCallback(() => {
    if (processing || students.length === 0) return;
    setProcessing(true);

    const student = students[studentIndex % students.length];
    setStudentIndex(prev => prev + 1);

    setTimeout(() => {
      // Always send the normal eligibility notification first
      const programList = student.programs.join(", ");
      const conditionalText = student.conditionalPrograms && student.conditionalPrograms.length > 0
        ? `\n\nYou may also qualify for ${student.conditionalPrograms.map((p: any) => p.name).join(", ")} once we receive: ${student.conditionalPrograms.map((p: any) => p.missing).join("; ")}`
        : "";

      const smsBody = `[Golden West College]\n\nCongratulations ${student.name.split(" ")[0]}! You are 100% eligible for: ${programList}.\n\nReply Y to opt in or N to opt out.${conditionalText}\n\nQuestions? (714) 892-7711 ext. 55327`;

      const newMessage: SmsMessage = {
        id: crypto.randomUUID(),
        from: "Golden West College",
        body: smsBody,
        timestamp: new Date().toISOString(),
        studentName: student.name,
        isUserReply: false,
      };

      setMessages([newMessage]);
      setResetKey(prev => prev + 1);
      setProcessing(false);
    }, 500);
  }, [processing, students, studentIndex]);

  if (loading) {
    return <div style={{ textAlign: "center", padding: "40px", color: "#6b7280" }}>Loading students from database...</div>;
  }

  if (students.length === 0) {
    return <div style={{ textAlign: "center", padding: "40px", color: "#6b7280" }}>No students with pending programs found. Run /api/seed first.</div>;
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "20px", padding: "20px" }}>
      <PhoneMockup messages={messages} resetKey={resetKey} />
      <button
        onClick={simulateNewStudent}
        disabled={processing}
        style={{
          background: "#0F603D",
          color: "#fff",
          border: "none",
          padding: "12px 24px",
          borderRadius: "10px",
          fontSize: "14px",
          fontWeight: 700,
          cursor: processing ? "not-allowed" : "pointer",
          opacity: processing ? 0.6 : 1,
        }}
      >
        {processing ? "Sending..." : `Send SMS to ${students[studentIndex % students.length]?.name || "next student"}`}
      </button>
      <p style={{ fontSize: "12px", color: "#9ca3af" }}>
        {students.length} students loaded from DynamoDB • Reply Y to opt in, N to opt out
      </p>
    </div>
  );
}
