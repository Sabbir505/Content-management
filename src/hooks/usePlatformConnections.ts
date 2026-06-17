"use client";

import { useQuery } from "@tanstack/react-query";
import type { PlatformConnection } from "@/lib/quality/types";

export function usePlatformConnections(userId: string | null) {
  return useQuery({
    queryKey: ["platformConnections", userId],
    queryFn: async () => {
      if (!userId) return null;
      const response = await fetch("/api/quality/feedback/connections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
      });
      if (!response.ok) throw new Error("Failed to fetch connections");
      const result = await response.json();
      if (!result.success) throw new Error(result.error);
      return result.data as PlatformConnection[];
    },
    enabled: !!userId,
    staleTime: 5 * 60 * 1000,
  });
}
