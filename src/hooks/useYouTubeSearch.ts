"use client";

import { useQuery, UseQueryOptions } from "@tanstack/react-query";
import type { YouTubeSearchResult, YouTubeSearchError } from "@/lib/quality/types";

interface UseYouTubeSearchOptions {
  query: string | null;
  filters?: {
    niche?: string;
    timeRange?: "day" | "week" | "month" | "year";
    language?: "any" | "en";
  };
  enabled?: boolean;
  options?: Omit<
    UseQueryOptions<YouTubeSearchResult, YouTubeSearchError>,
    "queryKey" | "queryFn" | "enabled"
  >;
}

export function useYouTubeSearch({
  query,
  filters = {},
  enabled = true,
  options = {},
}: UseYouTubeSearchOptions) {
  const niche = filters.niche || "all";
  const timeRange = filters.timeRange || "week";
  const language = filters.language || "any";

  return useQuery<YouTubeSearchResult, YouTubeSearchError>({
    queryKey: ["youtubeSearch", query, niche, timeRange, language],
    queryFn: async ({ signal }) => {
      if (!query) {
        return {
          query: "",
          videos: [],
          fromCache: false,
          fetchedAt: new Date().toISOString(),
        };
      }

      const params = new URLSearchParams({
        query,
        niche,
        timeRange,
        language,
      });

      const response = await fetch(`/api/youtube/search?${params}`, { signal });
      const result = await response.json();

      if (!response.ok) {
        const error: YouTubeSearchError = {
          type: result.errorType || "api_error",
          message: result.error || "Failed to search videos",
          retryAfter: result.retryAfter,
          isQuotaExceeded: result.errorType === "quota_exceeded",
        };
        throw Object.assign(new Error(error.message), error);
      }

      return result.data as YouTubeSearchResult;
    },
    enabled: !!query && enabled,
    staleTime: 6 * 60 * 60 * 1000, // 6 hours
    gcTime: 24 * 60 * 60 * 1000, // 24 hours garbage collection
    retry: (failureCount, error) => {
      // Don't retry quota exceeded errors
      if (error.isQuotaExceeded) return false;
      // Retry other errors up to 2 times
      return failureCount < 2;
    },
    ...options,
  });
}