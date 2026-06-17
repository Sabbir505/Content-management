"use client";

import { useQuery } from "@tanstack/react-query";
import type { PerformanceInsights } from "@/lib/quality/types";

export function usePerformanceInsights(userId: string | null) {
  return useQuery({
    queryKey: ["performanceInsights", userId],
    queryFn: async () => {
      if (!userId) return null;
      const response = await fetch(
        `/api/quality/feedback/insights?userId=${encodeURIComponent(userId)}`
      );
      if (!response.ok) throw new Error("Failed to fetch insights");
      const result = await response.json();
      if (!result.success) throw new Error(result.error);
      return result.data as PerformanceInsights;
    },
    enabled: !!userId,
    staleTime: 5 * 60 * 1000,
  });
}
