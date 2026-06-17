import { NextRequest, NextResponse } from "next/server";
import { fetchGoogleTrends } from "@/lib/quality/grounding/google-trends";

export async function GET(request: NextRequest) {
  try {
    const keyword = request.nextUrl.searchParams.get("keyword");
    if (!keyword) {
      return NextResponse.json(
        { success: false, error: "keyword query parameter is required" },
        { status: 400 }
      );
    }

    const data = await fetchGoogleTrends(keyword);
    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error("Trends fetch error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch trends data" },
      { status: 500 }
    );
  }
}
