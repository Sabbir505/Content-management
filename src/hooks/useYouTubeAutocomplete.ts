"use client";

import { useQuery } from "@tanstack/react-query";
import type { YouTubeAutocompleteResult } from "@/lib/quality/types";

export function useYouTubeAutocomplete(query: string | null) {
  return useQuery({
    queryKey: ["youtubeAutocomplete", query],
    queryFn: async () => {
      if (!query) return null;
      const response = await fetch(`/api/quality/autocomplete?query=${encodeURIComponent(query)}`);
      if (!response.ok) throw new Error("Failed to fetch autocomplete");
      const result = await response.json();
      if (!result.success) throw new Error(result.error);
      return result.data as YouTubeAutocompleteResult;
    },
    enabled: !!query,
    staleTime: 24 * 60 * 60 * 1000,
  });
}
