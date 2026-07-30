import { NextRequest, NextResponse } from "next/server";
import { searchContent } from "@/lib/content";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get("query");

    if (!query) {
      return NextResponse.json(
        { success: false, error: "query parameter is required" },
        { status: 400 }
      );
    }

    const results = await searchContent({ query });

    return NextResponse.json({
      success: true,
      data: results,
      query,
    });
  } catch (error) {
    console.error("last30days error:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to fetch content",
      },
      { status: 500 }
    );
  }
}
