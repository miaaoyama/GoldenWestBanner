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
            // Only include students who have at least one confirmed/pending program
            return Object.values(t.programs).some(
              (p: any) => p.status === "pending" || p.status === "not_sent"
            );
          })
          .map((t: any) => {
            const programs = Object.entries(t.programs)
              .filter(([_, p]: [string, any]) => p.status !== "not_eligible")
              .map(([name]) => name.toUpperCase());
            return {
              name: t.name,
              phone: "(714) " + Math.floor(100 + Math.random() * 900) + "-" + Math.floor(1000 + Math.random() * 9000),
              programs,
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
      const programList = student.programs.join(" & ");
      const smsBody = `[Golden West College — Official Notice]\n\nCongratulations ${student.name.split(" ")[0]}! Based on your application, you are eligible for the ${programList} program${student.programs.length > 1 ? "s" : ""}.\n\nReply Y to opt in or N to opt out.\n\nQuestions? Contact the EOPS office at (714) 892-7711 ext. 55327 or visit goldenwestcollege.edu/eops`;

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
