import { NextRequest, NextResponse } from "next/server";
import { pullAllDueMetrics } from "@/lib/quality/feedback/performance-puller";
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

    await pullAllDueMetrics(userId);
    return NextResponse.json({ success: true, data: { pulled: true } });
  } catch (error) {
    console.error("Performance pull error:", error);
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}
