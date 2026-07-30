"use client";

import { useState, useRef, useCallback } from "react";
import type { VideoWithOutlier } from "@/types/video";
import type { ContentItem } from "@/types/content";
import { calculateContentDiscoveryScore, calculateVideoDiscoveryScore } from "@/lib/discovery-score";
import type { YouTubeSearchError } from "@/lib/quality/types";
import {
  getTimeRangeCutoffDate,
  calculateSecondsUntilMidnight,
  isQuotaError,
  CONTENT_FETCH_TIMEOUT_MS,
  CONTENT_FETCH_LIMIT,
} from "@/lib/discovery/time-periods";

interface UseDiscoverDataResult {
  videos: VideoWithOutlier[];
  setVideos: React.Dispatch<React.SetStateAction<VideoWithOutlier[]>>;
  contentItems: ContentItem[];
  setContentItems: React.Dispatch<React.SetStateAction<ContentItem[]>>;
  isLoadingVideos: boolean;
  setIsLoadingVideos: React.Dispatch<React.SetStateAction<boolean>>;
  isLoadingContent: boolean;
  setIsLoadingContent: React.Dispatch<React.SetStateAction<boolean>>;
  error: string | null;
  setError: React.Dispatch<React.SetStateAction<string | null>>;
  quotaError: YouTubeSearchError | null;
  setQuotaError: React.Dispatch<React.SetStateAction<YouTubeSearchError | null>>;
  fromCache: boolean;
  fetchCountRef: React.MutableRefObject<number>;
  fetchVideos: (args: { queries: string[]; timePeriod: string; abortSignal?: AbortSignal }) => Promise<void>;
  fetchContent: (args: { query: string; timePeriod: string; abortSignal?: AbortSignal }) => Promise<void>;
  handleRetry: (args: {
    searchQuery: string;
    selectedCategory: string;
    activeCategories: string[];
    customCategories: string[];
    timePeriod: string;
  }) => void;
}

export function useDiscoverData(): UseDiscoverDataResult {
  const [videos, setVideos] = useState<VideoWithOutlier[]>([]);
  const [contentItems, setContentItems] = useState<ContentItem[]>([]);
  const [isLoadingVideos, setIsLoadingVideos] = useState(false);
  const [isLoadingContent, setIsLoadingContent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [quotaError, setQuotaError] = useState<YouTubeSearchError | null>(null);
  const [fromCache, setFromCache] = useState(false);
  const fetchCountRef = useRef(0);

  const fetchVideos = useCallback(
    async ({ queries, timePeriod, abortSignal }: { queries: string[]; timePeriod: string; abortSignal?: AbortSignal }) => {
      setIsLoadingVideos(true);
      setError(null);
      setQuotaError(null);
      setVideos([]);

      try {
        const apiTimeRange = timePeriod === "all" ? "year" : timePeriod;
        const seenIds = new Set<string>();
        const allVideos: VideoWithOutlier[] = [];

        for (const q of queries) {
          if (abortSignal?.aborted) break;
          const response = await fetch(
            `/api/youtube/search?query=${encodeURIComponent(q)}&timeRange=${apiTimeRange}`,
            { signal: abortSignal }
          );
          const result = await response.json();

          if (!response.ok) {
            const errorType = result.errorType || (isQuotaError(result.error) ? "quota_exceeded" : "api_error");
            if (errorType === "quota_exceeded") {
              setQuotaError({
                type: "quota_exceeded",
                message: result.error || "YouTube API daily quota exceeded",
                retryAfter: result.retryAfter || calculateSecondsUntilMidnight(),
                isQuotaExceeded: true,
              });
              break;
            }
            continue; // skip failed queries, try others
          }

          const scoredVideos = (result.data.videos || []).map((video: VideoWithOutlier) => ({
            ...video,
            discoveryScore: video.discoveryScore ?? calculateVideoDiscoveryScore(video),
          }));

          for (const video of scoredVideos) {
            if (!seenIds.has(video.id)) {
              seenIds.add(video.id);
              allVideos.push(video);
            }
          }
        }

        setVideos(allVideos);
        setFromCache(false);
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") return;
        setError(err instanceof Error ? err.message : "Failed to load videos");
        setVideos([]);
      } finally {
        setIsLoadingVideos(false);
      }
    },
    []
  );

  const fetchContent = useCallback(
    async ({ query, timePeriod, abortSignal }: { query: string; timePeriod: string; abortSignal?: AbortSignal }) => {
      setIsLoadingContent(true);
      setContentItems([]);
      try {
        if (abortSignal?.aborted) return;

        const controller = new AbortController();
        if (abortSignal) {
          const onAbort = () => controller.abort();
          abortSignal.addEventListener("abort", onAbort, { once: true });
        }
        const timeoutId = setTimeout(() => controller.abort(), CONTENT_FETCH_TIMEOUT_MS);

        const response = await fetch(
          `/api/content/search?query=${encodeURIComponent(query)}&limit=${CONTENT_FETCH_LIMIT}`,
          { signal: controller.signal }
        );
        clearTimeout(timeoutId);

        const result = await response.json();

        if (result.success && result.data) {
          const allItems: ContentItem[] = [];
          for (const sourceResult of result.data) {
            if (sourceResult.items) {
              allItems.push(...sourceResult.items);
            }
          }
          const cutoffDate = getTimeRangeCutoffDate(timePeriod);
          const filteredItems = allItems.filter((item) => {
            const itemDate = new Date(item.publishedAt).getTime();
            return itemDate >= cutoffDate.getTime();
          });

          const scoredItems = filteredItems.map((item) => ({
            ...item,
            discoveryScore: calculateContentDiscoveryScore(item),
          }));
          scoredItems.sort((a, b) => (b.discoveryScore || 0) - (a.discoveryScore || 0));
          setContentItems(scoredItems);
        }
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") return;
        console.error("Content fetch error:", err);
      } finally {
        setIsLoadingContent(false);
      }
    },
    []
  );

  const handleRetry = useCallback(
    (args: {
      searchQuery: string;
      selectedCategory: string;
      activeCategories: string[];
      customCategories: string[];
      timePeriod: string;
    }) => {
      setQuotaError(null);
      let retryQueries: string[];
      let retryContentQuery: string;
      if (args.searchQuery.trim()) {
        retryQueries = [args.searchQuery.trim()];
        retryContentQuery = args.searchQuery.trim();
      } else if (args.selectedCategory !== "All") {
        retryQueries = [args.selectedCategory];
        retryContentQuery = args.selectedCategory;
      } else {
        const allCats = [...args.activeCategories, ...args.customCategories];
        retryQueries = allCats.length > 0 ? allCats.slice(0, 3) : ["content creation"];
        retryContentQuery = retryQueries[0];
      }
      const controller = new AbortController();
      fetchVideos({ queries: retryQueries, timePeriod: args.timePeriod, abortSignal: controller.signal });
      fetchContent({ query: retryContentQuery, timePeriod: args.timePeriod, abortSignal: controller.signal });
    },
    [fetchVideos, fetchContent]
  );

  return {
    videos,
    setVideos,
    contentItems,
    setContentItems,
    isLoadingVideos,
    setIsLoadingVideos,
    isLoadingContent,
    setIsLoadingContent,
    error,
    setError,
    quotaError,
    setQuotaError,
    fromCache,
    fetchCountRef,
    fetchVideos,
    fetchContent,
    handleRetry,
  };
}
