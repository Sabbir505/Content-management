import { NextRequest, NextResponse } from "next/server";
import { searchContent, fetchTrendingContent } from "@/lib/content";

// Helper to wrap a promise with a timeout
function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`${label} timed out after ${ms}ms`));
    }, ms);
    promise
      .then((result) => {
        clearTimeout(timer);
        resolve(result);
      })
      .catch((err) => {
        clearTimeout(timer);
        reject(err);
      });
  });
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get("query");
    const type = searchParams.get("type") || "search"; // "search" or "trending"
    const sources = searchParams.get("sources")?.split(",") || undefined;
    let limit = parseInt(searchParams.get("limit") || "20", 10);
    if (isNaN(limit)) limit = 20;

    if (type === "trending") {
      const bypassCache = searchParams.get("fresh") === "true";
      const results = await withTimeout(
        fetchTrendingContent(sources as any, limit, bypassCache),
        10000,
        "Trending content fetch"
      );
      return NextResponse.json({
        success: true,
        data: results,
      });
    }

    if (!query) {
      return NextResponse.json(
        { success: false, error: "query parameter is required" },
        { status: 400 }
      );
    }

    const results = await withTimeout(
      searchContent({
        query,
        sources: sources as any,
        limit,
        bypassCache: searchParams.get("fresh") === "true",
      }),
      25000,
      "Content search"
    );

    return NextResponse.json({
      success: true,
      data: results,
    });
  } catch (error) {
    console.error("Content search error:", error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Failed to fetch content" },
      { status: 500 }
    );
  }
}
