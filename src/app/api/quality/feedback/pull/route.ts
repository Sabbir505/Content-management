import { NextRequest, NextResponse } from "next/server";
import { pullAllDueMetrics } from "@/lib/quality/feedback/performance-puller";

export async function POST(request: NextRequest) {
  try {
    const { userId } = await request.json();
    if (!userId) {
      return NextResponse.json(
        { success: false, error: "userId is required" },
        { status: 400 }
      );
    }

    await pullAllDueMetrics(userId);
    return NextResponse.json({ success: true, data: { pulled: true } });
  } catch (error) {
    console.error("Performance pull error:", error);
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}
