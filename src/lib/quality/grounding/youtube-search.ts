import { searchYouTubeVideosScrape } from "../../youtube-scraper";
import * as memoryCache from "../cache";
import type { YouTubeSearchResult, YouTubeSearchError } from "../types";

const MEMORY_CACHE_TTL = 30 * 60 * 1000; // 30 minutes

interface SearchFilters {
  niche: string;
  timeRange: "day" | "week" | "month" | "3months" | "year";
  language: "any" | "en";
}

function parseQuotaError(error: unknown): YouTubeSearchError {
  const errorMessage = error instanceof Error ? error.message : String(error);

  if (
    errorMessage.includes("429") ||
    errorMessage.includes("rate") ||
    errorMessage.includes("too many")
  ) {
    return {
      type: "rate_limited",
      message: "Rate limited by YouTube. Please try again later.",
      retryAfter: 60,
      isQuotaExceeded: false,
    };
  }

  return {
    type: "api_error",
    message: errorMessage,
    isQuotaExceeded: false,
  };
}

function buildMemoryCacheKey(query: string, filters: SearchFilters): string {
  // v2: includes date parsing fix - old v1 cache entries are invalidated
  return `ytsearch:v2:${query.toLowerCase()}:${filters.niche}:${filters.timeRange}:${filters.language}`;
}

export async function searchYouTubeVideos(
  query: string,
  filters: SearchFilters
): Promise<YouTubeSearchResult> {
  const memoryCacheKey = buildMemoryCacheKey(query, filters);

  // Check in-memory cache
  const memoryCached = memoryCache.get<YouTubeSearchResult>(memoryCacheKey);
  if (memoryCached) {
    return { ...memoryCached, fromCache: true };
  }

  // Fetch from YouTube using web scraping
  try {
    const result = await searchYouTubeVideosScrape(query, filters);

    memoryCache.set(memoryCacheKey, result, MEMORY_CACHE_TTL);

    return result;
  } catch (error) {
    throw parseQuotaError(error);
  }
}
