import { NextRequest, NextResponse } from "next/server";
import { searchContent, fetchTrendingContent, type ContentSource } from "@/lib/content";

const VALID_SOURCES: ContentSource[] = ["hackernews", "devto", "substack"];

function parseSources(raw: string[] | undefined): ContentSource[] | undefined {
  if (!raw) return undefined;
  const filtered = raw.filter((s): s is ContentSource =>
    (VALID_SOURCES as string[]).includes(s)
  );
  return filtered.length > 0 ? filtered : undefined;
}

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
    const sources = parseSources(searchParams.get("sources")?.split(","));
    const rawTimeRange = searchParams.get("timeRange") || "week";
    const validTimeRanges = ["day", "week", "month", "year"] as const;
    const timeRange = validTimeRanges.includes(rawTimeRange as typeof validTimeRanges[number])
      ? (rawTimeRange as "day" | "week" | "month" | "year")
      : "week";
    let limit = parseInt(searchParams.get("limit") || "20", 10);
    if (isNaN(limit)) limit = 20;

    if (type === "trending") {
      const bypassCache = searchParams.get("fresh") === "true";
      const results = await withTimeout(
        fetchTrendingContent(sources, limit, bypassCache),
        20000,
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
        sources,
        limit,
        timeRange,
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
      { success: false, error: "Failed to fetch content" },
      { status: 500 }
    );
  }
}
