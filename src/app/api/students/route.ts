// src/app/api/students/route.ts
// GET /api/students — returns students from DynamoDB in the BASE array format
// that students.js expects. This replaces the hardcoded BASE array.

import { NextResponse } from "next/server";
import { getAllStudents } from "@/lib/db/store";

export const dynamic = "force-dynamic";

export async function GET() {
  const students = await getAllStudents();

  // Convert DynamoDB records back to the BASE tuple format students.js expects:
  // [name, major, gpa, completedUnits, currentUnits, residency, householdSize,
  //  householdIncome, studentIncome, parentIncome, saiRaw, pell, veteran,
  //  homeless, foster, firstGen, disability, dependency, calworks,
  //  singleParent, publicAssistance, foodInsecure]
  const base = students.map(s => {
    // Reconstruct fields from what we stored
    const income = s.ep_priority_score >= 3 ? 15000 :
                   s.ep_priority_score >= 2 ? 22000 :
                   s.ep_eops_status === "confirmed" ? 30000 : 55000;
    const pell = s.ep_eops_status === "confirmed" || s.ep_eops_status === "conditional";
    const name = `${s.first_name} ${s.last_name}`;

    return [
      name,
      s.program_of_study,
      0,       // gpa - placeholder, original is in students.js
      0,       // completedUnits
      s.enrollment_status === "Full-Time" ? 14 : 9,
      "California Resident",
      4,       // householdSize
      income,
      0,       // studentIncome
      income,  // parentIncome
      s.ep_priority_score * -100, // sai (lower = more need)
      pell,
      false,   // veteran
      false,   // homeless
      false,   // foster
      s.ep_priority_score >= 2, // firstGen
      false,   // disability
      "Dependent",
      s.ep_calworks_status === "confirmed",
      s.ep_care_status === "confirmed" || s.ep_care_status === "conditional",
      false,   // publicAssistance
      false,   // foodInsecure
    ];
  });

  return NextResponse.json({ base, total: base.length });
}
