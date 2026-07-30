import { NextRequest, NextResponse } from "next/server";
import { getTrackedContent } from "@/lib/quality/feedback/content-tracker";
import { computeCorrelations } from "@/lib/quality/feedback/correlation-engine";
import { getUserWeights } from "@/lib/quality/feedback/calibration";
import { PLATFORM_TYPES, type PerformanceInsights } from "@/lib/quality/types";
import { validateUserAccess } from "@/lib/api-auth";

export async function GET(request: NextRequest) {
  try {
    const userId = request.nextUrl.searchParams.get("userId");
    if (!userId) {
      return NextResponse.json(
        { success: false, error: "userId is required" },
        { status: 400 }
      );
    }

    const authError = await validateUserAccess(request, userId);
    if (authError) return authError;

    const [trackedContent, correlations, weights] = await Promise.all([
      getTrackedContent(userId),
      computeCorrelations(userId).catch(() => []),
      getUserWeights(userId),
    ]);

    const totalGenerated = trackedContent.length;
    const totalTracked = trackedContent.filter((t) => t.publishedUrl).length;

    const platformBreakdown = PLATFORM_TYPES.map(
      (platform) => {
        const platformContent = trackedContent.filter((t) => t.platform === platform);

        return {
          platform,
          count: platformContent.length,
          avgMetrics: {} as Record<string, number>,
          vsBaseline: {} as Record<string, number>,
        };
      }
    );

    const workingInsights = correlations.filter((c) => c.direction === "positive");
    const notWorkingInsights = correlations.filter((c) => c.direction === "negative");

    const insights: PerformanceInsights = {
      totalGenerated,
      totalTracked,
      platformBreakdown,
      workingInsights,
      notWorkingInsights,
      lastCalibratedAt: weights.updatedAt || null,
    };

    return NextResponse.json({ success: true, data: insights });
  } catch (error) {
    console.error("Performance insights error:", error);
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}
