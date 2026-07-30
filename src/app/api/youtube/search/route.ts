import { NextRequest, NextResponse } from "next/server";
import { searchYouTubeVideos } from "@/lib/quality/grounding/youtube-search";
import type { YouTubeSearchError } from "@/lib/quality/types";

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
    const query = request.nextUrl.searchParams.get("query");
    const niche = request.nextUrl.searchParams.get("niche") || "all";
    const rawTimeRange = request.nextUrl.searchParams.get("timeRange") || "week";
    const validTimeRanges = ["day", "week", "month", "3months", "year"] as const;
    const timeRange = validTimeRanges.includes(rawTimeRange as typeof validTimeRanges[number])
      ? (rawTimeRange as "day" | "week" | "month" | "3months" | "year")
      : "week";
    const language = (request.nextUrl.searchParams.get("language") || "any") as "any" | "en";

    if (!query) {
      return NextResponse.json(
        { success: false, error: "query parameter is required" },
        { status: 400 }
      );
    }

    const result = await withTimeout(
      searchYouTubeVideos(query, {
        niche,
        timeRange,
        language,
      }),
      60000, // 60s timeout for scraping (first request is slow)
      "YouTube search"
    );

    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    console.error("YouTube search error:", error);

    // Check if it's a rate limited error
    const searchError = error as YouTubeSearchError;
    if (searchError.type === "rate_limited") {
      return NextResponse.json(
        {
          success: false,
          error: searchError.message,
          errorType: "rate_limited",
          retryAfter: searchError.retryAfter,
        },
        { status: 429 }
      );
    }

    return NextResponse.json(
      { success: false, error: "Failed to search YouTube videos" },
      { status: 500 }
    );
  }
}
