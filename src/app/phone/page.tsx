"use client";
// src/app/phone/page.tsx — Phone SMS mockup page (accessible at /phone)

import SmsSimulationPanel from "@/components/SmsSimulationPanel";

export default function PhonePage() {
  return (
    <div style={{ minHeight: "100vh", background: "#1a1a2e", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <SmsSimulationPanel />
    </div>
  );
}
