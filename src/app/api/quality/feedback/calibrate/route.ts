import { NextRequest, NextResponse } from "next/server";
import { shouldCalibrate, runCalibration } from "@/lib/quality/feedback/calibration";
import { validateUserAccess } from "@/lib/api-auth";

export async function POST(request: NextRequest) {
  try {
    const { userId } = await request.json();
    if (!userId) {
      return NextResponse.json(
        { success: false, error: "userId is required" },
        { status: 400 }
      );
    }

    const authError = await validateUserAccess(request, userId);
    if (authError) return authError;

    const canCalibrate = await shouldCalibrate(userId);
    if (!canCalibrate) {
      return NextResponse.json({
        success: true,
        data: { calibrated: false, reason: "Not enough data or too soon since last calibration" },
      });
    }

    const newWeights = await runCalibration(userId);
    return NextResponse.json({
      success: true,
      data: { calibrated: true, weights: newWeights },
    });
  } catch (error) {
    console.error("Calibration error:", error);
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}
