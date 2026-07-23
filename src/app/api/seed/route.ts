// src/app/api/seed/route.ts
// GET /api/seed — seeds DynamoDB with the same 25 students from the Team-13 UI.
// These are the students shown in the student portal.

import { NextResponse } from "next/server";
import { resetDB, upsertStudentBatch } from "@/lib/db/store";
import type { StudentRecord, EligibilityStatus, OutreachStatus } from "@/lib/db/schema";

export const dynamic = "force-dynamic";

// The 25 students from Team-13 patch-3 students.js (same data the UI shows)
const STUDENTS = [
  { name:"Maria Delgado", id:"T00154237", major:"Nursing (RN)", gpa:3.42, units:15, unitsEarned:12, income:28000, pell:true, homeless:false, foster:false, firstGen:true, singleParent:false, calworks:false, disability:false, email:"mdelgado@student.goldenwestcollege.edu" },
  { name:"Jamal Carter", id:"T00154274", major:"Business Administration", gpa:2.18, units:13, unitsEarned:9, income:19500, pell:true, homeless:true, foster:false, firstGen:true, singleParent:true, calworks:false, disability:false, email:"jcarter@student.goldenwestcollege.edu" },
  { name:"Emily Nguyen", id:"T00154311", major:"Biology (Pre-Med)", gpa:3.88, units:16, unitsEarned:24, income:61000, pell:false, homeless:false, foster:false, firstGen:false, singleParent:false, calworks:false, disability:false, email:"enguyen@student.goldenwestcollege.edu" },
  { name:"Carlos Ramirez", id:"T00154348", major:"Petroleum Technology", gpa:2.95, units:12, unitsEarned:30, income:34000, pell:true, homeless:false, foster:false, firstGen:true, singleParent:false, calworks:false, disability:true, email:"cramirez@student.goldenwestcollege.edu" },
  { name:"Ashley Thompson", id:"T00154385", major:"Psychology", gpa:3.15, units:15, unitsEarned:15, income:47000, pell:true, homeless:false, foster:true, firstGen:false, singleParent:false, calworks:false, disability:false, email:"athompson@student.goldenwestcollege.edu" },
  { name:"Diego Herrera", id:"T00154422", major:"Administration of Justice", gpa:2.62, units:12, unitsEarned:6, income:22000, pell:true, homeless:false, foster:false, firstGen:true, singleParent:false, calworks:false, disability:false, email:"dherrera@student.goldenwestcollege.edu" },
  { name:"Sarah Kim", id:"T00154459", major:"Computer Science", gpa:3.71, units:16, unitsEarned:18, income:88000, pell:false, homeless:false, foster:false, firstGen:false, singleParent:false, calworks:false, disability:true, email:"skim@student.goldenwestcollege.edu" },
  { name:"Michael Johnson", id:"T00154496", major:"Kinesiology", gpa:2.05, units:9, unitsEarned:12, income:15000, pell:true, homeless:true, foster:false, firstGen:true, singleParent:true, calworks:true, disability:false, email:"mjohnson@student.goldenwestcollege.edu" },
  { name:"Fatima Al-Hassan", id:"T00154533", major:"Early Childhood Education", gpa:3.55, units:14, unitsEarned:21, income:31000, pell:true, homeless:false, foster:false, firstGen:true, singleParent:true, calworks:false, disability:false, email:"falhassan@student.goldenwestcollege.edu" },
  { name:"Tyler Brooks", id:"T00154570", major:"Welding Technology", gpa:2.40, units:12, unitsEarned:3, income:26000, pell:true, homeless:false, foster:false, firstGen:true, singleParent:false, calworks:false, disability:false, email:"tbrooks@student.goldenwestcollege.edu" },
  { name:"Grace Okoro", id:"T00154607", major:"Chemistry", gpa:3.92, units:15, unitsEarned:27, income:54000, pell:false, homeless:false, foster:false, firstGen:true, singleParent:false, calworks:false, disability:false, email:"gokoro@student.goldenwestcollege.edu" },
  { name:"Antonio Rossi", id:"T00154644", major:"Music", gpa:2.88, units:12, unitsEarned:14, income:40000, pell:true, homeless:false, foster:true, firstGen:false, singleParent:false, calworks:false, disability:true, email:"arossi@student.goldenwestcollege.edu" },
  { name:"Destiny Williams", id:"T00154681", major:"Social Work", gpa:2.33, units:15, unitsEarned:10, income:17000, pell:true, homeless:true, foster:true, firstGen:true, singleParent:true, calworks:false, disability:false, email:"dwilliams@student.goldenwestcollege.edu" },
  { name:"Kevin Tran", id:"T00154718", major:"Engineering", gpa:3.64, units:16, unitsEarned:20, income:72000, pell:false, homeless:false, foster:false, firstGen:false, singleParent:false, calworks:false, disability:false, email:"ktran@student.goldenwestcollege.edu" },
  { name:"Isabella Flores", id:"T00154755", major:"Communication Studies", gpa:3.02, units:13, unitsEarned:12, income:29000, pell:true, homeless:false, foster:false, firstGen:true, singleParent:false, calworks:false, disability:false, email:"iflores@student.goldenwestcollege.edu" },
  { name:"Marcus Green", id:"T00154792", major:"Automotive Technology", gpa:2.11, units:12, unitsEarned:6, income:21000, pell:true, homeless:false, foster:false, firstGen:true, singleParent:false, calworks:false, disability:true, email:"mgreen@student.goldenwestcollege.edu" },
  { name:"Hannah Martinez", id:"T00154829", major:"Art History", gpa:3.28, units:12, unitsEarned:16, income:45000, pell:true, homeless:false, foster:true, firstGen:false, singleParent:false, calworks:false, disability:false, email:"hmartinez@student.goldenwestcollege.edu" },
  { name:"Omar Farah", id:"T00154866", major:"Mathematics", gpa:3.79, units:16, unitsEarned:22, income:33000, pell:true, homeless:false, foster:false, firstGen:true, singleParent:false, calworks:false, disability:false, email:"ofarah@student.goldenwestcollege.edu" },
  { name:"Chloe Anderson", id:"T00154903", major:"Dental Hygiene", gpa:3.10, units:14, unitsEarned:15, income:58000, pell:false, homeless:false, foster:false, firstGen:false, singleParent:false, calworks:false, disability:true, email:"canderson@student.goldenwestcollege.edu" },
  { name:"Luis Mendoza", id:"T00154940", major:"Agriculture Business", gpa:2.74, units:13, unitsEarned:9, income:25000, pell:true, homeless:false, foster:false, firstGen:true, singleParent:false, calworks:false, disability:true, email:"lmendoza@student.goldenwestcollege.edu" },
  { name:"Nia Robinson", id:"T00154977", major:"Sociology", gpa:2.57, units:12, unitsEarned:12, income:23500, pell:true, homeless:false, foster:true, firstGen:true, singleParent:true, calworks:false, disability:false, email:"nrobinson@student.goldenwestcollege.edu" },
  { name:"Ethan Walker", id:"T00155014", major:"Fire Technology", gpa:2.99, units:12, unitsEarned:18, income:49000, pell:true, homeless:false, foster:false, firstGen:false, singleParent:false, calworks:false, disability:false, email:"ewalker@student.goldenwestcollege.edu" },
  { name:"Priscilla Vega", id:"T00155051", major:"Liberal Arts", gpa:3.20, units:15, unitsEarned:14, income:30000, pell:true, homeless:true, foster:false, firstGen:true, singleParent:true, calworks:false, disability:false, email:"pvega@student.goldenwestcollege.edu" },
  { name:"Brandon Lee", id:"T00155088", major:"Physics", gpa:3.85, units:16, unitsEarned:26, income:95000, pell:false, homeless:false, foster:false, firstGen:false, singleParent:false, calworks:false, disability:false, email:"blee@student.goldenwestcollege.edu" },
  { name:"Aaliyah Jackson", id:"T00155125", major:"Respiratory Therapy", gpa:2.66, units:14, unitsEarned:11, income:20000, pell:true, homeless:true, foster:true, firstGen:true, singleParent:true, calworks:false, disability:false, email:"ajackson@student.goldenwestcollege.edu" },
  { name:"Jacob Torres", id:"T00155162", major:"Business Administration", gpa:3.05, units:13, unitsEarned:17, income:42000, pell:true, homeless:false, foster:false, firstGen:true, singleParent:false, calworks:false, disability:false, email:"jtorres@student.goldenwestcollege.edu" },
];

// Simple eligibility rules (mirrors the UI's rules engine)
function checkEligibility(s: typeof STUDENTS[0]) {
  const lowIncome = s.income < 45000;
  const veryLowIncome = s.income < 19000;

  // EOPS: low income + educationally disadvantaged + 12+ units
  const eopsEligible = lowIncome && (s.firstGen || s.gpa < 2.5) && s.units >= 12;
  const eopsConditional = lowIncome && (s.firstGen || s.gpa < 2.5) && s.units >= 9 && s.units < 12;

  // CARE: EOPS eligible + single parent + public assistance indicator
  const careEligible = eopsEligible && s.singleParent && (veryLowIncome || s.calworks);
  const careConditional = eopsEligible && s.singleParent && !veryLowIncome && !s.calworks;

  // CalWORKs: has calworks flag or (single parent + very low income)
  const calworksEligible = s.calworks || (s.singleParent && veryLowIncome);
  const calworksConditional = s.singleParent && lowIncome && !veryLowIncome && !s.calworks;

  // Priority score
  let score = 0;
  if (veryLowIncome) score++;
  if (s.homeless) score++;
  if (s.foster) score++;
  if (s.gpa < 2.0) score++;
  if (s.firstGen) score++;

  return {
    eops: eopsEligible ? "confirmed" : eopsConditional ? "conditional" : "not_eligible",
    care: careEligible ? "confirmed" : careConditional ? "conditional" : "not_eligible",
    calworks: calworksEligible ? "confirmed" : calworksConditional ? "conditional" : "not_eligible",
    score,
  };
}

export async function GET() {
  await resetDB();

  const now = new Date().toISOString();
  const records: StudentRecord[] = [];
  let confirmed = 0, conditional = 0;

  for (const s of STUDENTS) {
    const [firstName, ...lastParts] = s.name.split(" ");
    const lastName = lastParts.join(" ");
    const elig = checkEligibility(s);

    const hasConfirmed = elig.eops === "confirmed" || elig.care === "confirmed" || elig.calworks === "confirmed";
    const hasConditional = elig.eops === "conditional" || elig.care === "conditional" || elig.calworks === "conditional";
    if (hasConfirmed) confirmed++;
    else if (hasConditional) conditional++;

    const record: StudentRecord = {
      cwid: s.id,
      first_name: firstName,
      last_name: lastName,
      email_gwc: s.email,
      phone: null,
      program_of_study: s.major,
      year_in_college: s.unitsEarned > 30 ? "Sophomore" : "Freshman",
      enrollment_status: s.units >= 12 ? "Full-Time" : "Part-Time",

      ep_eops_status: elig.eops as EligibilityStatus,
      ep_care_status: elig.care as EligibilityStatus,
      ep_calworks_status: elig.calworks as EligibilityStatus,
      ep_eops_tier: elig.eops === "confirmed" ? (elig.score >= 3 ? "tier1" : "tier2") : null,
      ep_priority_score: elig.score,
      ep_pending_items: null,

      ep_eops_email_sent: null, ep_eops_email_clicked: null,
      ep_care_email_sent: null, ep_care_email_clicked: null,
      ep_calworks_email_sent: null, ep_calworks_email_clicked: null,

      ep_eops_accepted_date: null, ep_care_accepted_date: null, ep_calworks_accepted_date: null,

      ep_eops_outreach_status: (elig.eops === "conditional" ? "needed" : "not_needed") as OutreachStatus,
      ep_care_outreach_status: (elig.care === "conditional" ? "needed" : "not_needed") as OutreachStatus,
      ep_calworks_outreach_status: (elig.calworks === "conditional" ? "needed" : "not_needed") as OutreachStatus,

      ep_staff_notes: "", ep_outreach_attempts: 0, ep_last_outreach_date: null,
      ep_last_eligibility_check: now, created_at: now, updated_at: now,
    };
    records.push(record);
  }

  await upsertStudentBatch(records);

  return NextResponse.json({
    success: true,
    message: `Seeded ${records.length} students (same as portal UI) into DynamoDB`,
    stats: { total: records.length, confirmed, conditional, not_eligible: records.length - confirmed - conditional },
  });
}
