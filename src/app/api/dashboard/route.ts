import { NextRequest, NextResponse } from "next/server";
import {
  getAllStudents,
  getStudentsNeedingOutreach,
  getConditionalStudents,
  getRecentlyAccepted,
} from "@/lib/db/store";

export async function GET(_request: NextRequest) {
  try {
    const allStudents = getAllStudents();
    const needsOutreach = getStudentsNeedingOutreach();
    const conditional = getConditionalStudents();
    const recentlyAccepted = getRecentlyAccepted();

    return NextResponse.json({
      stats: {
        total: allStudents.length,
        needsOutreach: needsOutreach.length,
        conditional: conditional.length,
        recentlyAccepted: recentlyAccepted.length,
      },
      needsOutreach,
      conditional,
      recentlyAccepted,
    });
  } catch (error) {
    console.error("[GET /api/dashboard] Error:", error);
    return NextResponse.json(
      { error: "Failed to load dashboard data" },
      { status: 500 }
    );
  }
}
