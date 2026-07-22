// src/app/api/dashboard/export/route.ts
import { NextResponse } from "next/server";
import { exportToCSV } from "@/lib/db/store";

export const dynamic = "force-dynamic";

export async function GET() {
  const csv = await exportToCSV();
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": "attachment; filename=ep_student_export.csv",
    },
  });
}
