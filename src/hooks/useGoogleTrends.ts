"use client";

import { useQuery } from "@tanstack/react-query";
import type { GoogleTrendsResult } from "@/lib/quality/types";

export function useGoogleTrends(keyword: string | null) {
  return useQuery({
    queryKey: ["googleTrends", keyword],
    queryFn: async () => {
      if (!keyword) return null;
      const response = await fetch(`/api/quality/trends?keyword=${encodeURIComponent(keyword)}`);
      if (!response.ok) throw new Error("Failed to fetch trends");
      const result = await response.json();
      if (!result.success) throw new Error(result.error);
      return result.data as GoogleTrendsResult;
    },
    enabled: !!keyword,
    staleTime: 6 * 60 * 60 * 1000,
  });
}
