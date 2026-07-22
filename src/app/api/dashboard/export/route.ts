import { NextRequest, NextResponse } from "next/server";
import { exportToCSV } from "@/lib/db/store";

export async function GET(_request: NextRequest) {
  try {
    const csv = exportToCSV();

    return new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": "attachment; filename=ep_student_export.csv",
      },
    });
  } catch (error) {
    console.error("[GET /api/dashboard/export] Error:", error);
    return NextResponse.json(
      { error: "Failed to export CSV" },
      { status: 500 }
    );
  }
}
