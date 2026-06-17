"use client";

import { useState, useEffect, Suspense, useMemo, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { VideoWithOutlier } from "@/types/video";
import { ContentItem } from "@/types/content";
import { VideoCard } from "@/components/discover/VideoCard";
import { ContentCard } from "@/components/discover/ContentCard";
import { KeywordSidebar } from "@/components/keyword-sidebar";
import { QuotaExceededError } from "@/components/discover/QuotaExceededError";
import { calculateContentDiscoveryScore, calculateVideoDiscoveryScore } from "@/lib/discovery-score";

import { collection, addDoc, query, orderBy, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import type { YouTubeSearchError } from "@/lib/quality/types";

type ContentType = "videos" | "articles" | "all";
type SortOption = "discovery" | "trending" | "top" | "recent" | "discussed";
type TimeRange = "day" | "week" | "month" | "year";

function isQuotaError(error: string | undefined): boolean {
  if (!error) return false;
  const lowerError = error.toLowerCase();
  return (
    lowerError.includes("quota") ||
    lowerError.includes("429") ||
    lowerError.includes("rate limit") ||
    lowerError.includes("exceeded")
  );
}

function getAgeHours(publishedAt: string): number {
  const published = new Date(publishedAt).getTime();
  const now = Date.now();
  return Math.max((now - published) / (1000 * 60 * 60), 0.01);
}

function DiscoverPageContent() {
  const { user } = useAuth();
  const searchParams = useSearchParams();
  const [videos, setVideos] = useState<VideoWithOutlier[]>([]);
  const [contentItems, setContentItems] = useState<ContentItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [quotaError, setQuotaError] = useState<YouTubeSearchError | null>(null);
  const [fromCache, setFromCache] = useState(false);
  const [activeTab, setActiveTab] = useState<ContentType>("all");
  const [sortBy, setSortBy] = useState<SortOption>("discovery");
  const [timeRange, setTimeRange] = useState<TimeRange>("week");
  const [initialLoadDone, setInitialLoadDone] = useState(false);

  // Extract query param to stable string for dependency
  const queryParam = searchParams.get("query");
  const userId = user?.uid;
  const fetchInProgressRef = useRef(false);

  // Refetch when timeRange changes - use AbortController for cancellation
  useEffect(() => {
    if (!userId) return;
    if (fetchInProgressRef.current) return;

    const abortController = new AbortController();
    fetchInProgressRef.current = true;
    if (queryParam) {
      fetchVideos(queryParam, abortController.signal);
      fetchContent(queryParam, abortController.signal);
    } else {
      fetchAllVideos(abortController.signal);
      fetchAllContent(abortController.signal);
    }

    return () => {
      abortController.abort();
    };
  }, [queryParam, userId, timeRange]);

  // Safety timeout: ensure loading state doesn't get stuck
  useEffect(() => {
    if (!isLoading) return;
    const timer = setTimeout(() => {
      setIsLoading(false);
      setInitialLoadDone(true);
    }, 15000); // Force clear loading after 15 seconds
    return () => clearTimeout(timer);
  }, [isLoading]);

  async function fetchVideos(query: string, abortSignal?: AbortSignal) {
    setIsLoading(true);
    setError(null);
    setQuotaError(null);

    try {
      const response = await fetch(
        `/api/youtube/search?query=${encodeURIComponent(query)}&timeRange=${timeRange}`,
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
        } else {
          setError(result.error || "Failed to load videos");
        }
        setVideos([]);
        return;
      }

      const scoredVideos = (result.data.videos || []).map((video: VideoWithOutlier) => ({
        ...video,
        discoveryScore: video.discoveryScore ?? calculateVideoDiscoveryScore(video),
      }));
      setVideos(scoredVideos);
      setFromCache(result.data.fromCache || false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load videos");
      setVideos([]);
    } finally {
      setIsLoading(false);
      fetchInProgressRef.current = false;
    }
  }

  async function fetchContent(query: string, abortSignal?: AbortSignal) {
    try {
      const controller = new AbortController();
      if (abortSignal) {
        abortSignal.addEventListener("abort", () => controller.abort());
      }
      const timeoutId = setTimeout(() => controller.abort(), 15000);

      const response = await fetch(`/api/content/search?query=${encodeURIComponent(query)}&limit=20`, {
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      const result = await response.json();

      if (result.success && result.data) {
        const allItems: ContentItem[] = [];
        for (const sourceResult of result.data) {
          if (sourceResult.items) {
            allItems.push(...sourceResult.items);
          }
        }
        // Filter by time range, calculate discovery scores, and sort
        const cutoffDate = getTimeRangeCutoff(timeRange);
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
      console.error("Content fetch error:", err);
      // Don't block the UI on content fetch errors
    } finally {
      fetchInProgressRef.current = false;
    }
  }

  async function fetchAllVideos(abortSignal?: AbortSignal) {
    if (!user) return;
    setIsLoading(true);
    setError(null);
    setQuotaError(null);

    try {
      // Add timeout to Firestore query
      const q = query(
        collection(db, "users", user.uid, "keywords"),
        orderBy("createdAt", "desc")
      );

      const snapshot = await Promise.race([
        getDocs(q),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error("Firestore timeout")), 8000)
        ),
      ]);
      const keywords = snapshot.docs.map((doc) => doc.data().keyword as string);

      if (keywords.length === 0) {
        setVideos([]);
        setIsLoading(false);
        return;
      }

      const allVideos: VideoWithOutlier[] = [];
      const seenVideoIds = new Set<string>();
      let hasQuotaError = false;
      let hasOtherError = false;

      for (let i = 0; i < keywords.length; i++) {
        const keyword = keywords[i];

        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 35000); // 35s timeout to allow for scraping

          const response = await fetch(
            `/api/youtube/search?query=${encodeURIComponent(keyword)}&timeRange=${timeRange}`,
            {
              signal: abortSignal || controller.signal,
            }
          );
          clearTimeout(timeoutId);

          const result = await response.json();

          if (!response.ok) {
            const errorType = result.errorType || (isQuotaError(result.error) ? "quota_exceeded" : "api_error");

            if (errorType === "quota_exceeded" && !hasQuotaError) {
              hasQuotaError = true;
              setQuotaError({
                type: "quota_exceeded",
                message: result.error || "YouTube API daily quota exceeded",
                retryAfter: result.retryAfter || calculateSecondsUntilMidnight(),
                isQuotaExceeded: true,
              });
            } else if (!hasOtherError) {
              hasOtherError = true;
            }
            continue;
          }

          if (result.data?.videos) {
            for (const video of result.data.videos) {
              if (!seenVideoIds.has(video.id)) {
                seenVideoIds.add(video.id);
                allVideos.push({
                  ...video,
                  discoveryScore: video.discoveryScore ?? calculateVideoDiscoveryScore(video),
                });
              }
            }
            if (result.data.fromCache) {
              setFromCache(true);
            }
          }
        } catch {
          if (!hasOtherError) {
            hasOtherError = true;
          }
        }

        if (i < keywords.length - 1) {
          await new Promise((resolve) => setTimeout(resolve, 500));
        }
      }

      setVideos(allVideos);
      // Only show error if ALL keywords failed and we got zero videos
      if (hasOtherError && allVideos.length === 0 && keywords.length > 0) {
        setError("Failed to load videos");
      }
      // Clear error if we got videos despite some failures
      if (allVideos.length > 0) {
        setError(null);
      }
    } catch (err) {
      toast.error("Failed to fetch keywords");
      setError("Failed to load videos");
    } finally {
      setIsLoading(false);
      setInitialLoadDone(true);
      fetchInProgressRef.current = false;
    }
  }

  async function fetchAllContent(abortSignal?: AbortSignal, forceFresh = false) {
    if (!user) return;

    try {
      // Add timeout to Firestore query
      const q = query(
        collection(db, "users", user.uid, "keywords"),
        orderBy("createdAt", "desc")
      );

      const snapshot = await Promise.race([
        getDocs(q),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error("Firestore timeout")), 8000)
        ),
      ]);
      const keywords = snapshot.docs.map((doc) => doc.data().keyword as string);

      if (keywords.length === 0) {
        setContentItems([]);
        return;
      }

      const allItems: ContentItem[] = [];
      const seenIds = new Set<string>();

      for (const keyword of keywords) {
        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 8000);

          const response = await fetch(`/api/content/search?query=${encodeURIComponent(keyword)}&limit=10${forceFresh ? "&fresh=true" : ""}`, {
            signal: abortSignal || controller.signal,
          });
          clearTimeout(timeoutId);

          const result = await response.json();

          if (result.success && result.data) {
            for (const sourceResult of result.data) {
              if (sourceResult.items) {
                for (const item of sourceResult.items) {
                  if (!seenIds.has(item.id)) {
                    seenIds.add(item.id);
                    allItems.push(item);
                  }
                }
              }
            }
          }
        } catch {
          // Continue with other keywords
        }
      }

      // Filter by time range, calculate discovery scores, and sort
      const cutoffDate = getTimeRangeCutoff(timeRange);
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
    } catch (err) {
      console.error("Content fetch error:", err);
      setContentItems([]);
    } finally {
      fetchInProgressRef.current = false;
    }
  }

  // Build unified feed using useMemo instead of useEffect + useState
  const unifiedItemsMemo = useMemo(() => {
    const scoredVideos = videos.map((video) => ({
      ...video,
      contentType: "video" as const,
      discoveryScore: video.discoveryScore ?? calculateVideoDiscoveryScore(video),
    }));
    const scoredArticles = contentItems.map((item) => ({
      ...item,
      contentType: "article" as const,
      discoveryScore: item.discoveryScore ?? calculateContentDiscoveryScore(item),
    }));

    const combined = [...scoredVideos, ...scoredArticles];

    // Apply sort based on selected option
    switch (sortBy) {
      case "trending":
        combined.sort((a, b) => {
          const aVelocity = a.contentType === "video"
            ? (a.viewCount || 0) / Math.max(getAgeHours(a.publishedAt), 0.01)
            : (a.score || 0) / Math.max(getAgeHours(a.publishedAt), 0.01);
          const bVelocity = b.contentType === "video"
            ? (b.viewCount || 0) / Math.max(getAgeHours(b.publishedAt), 0.01)
            : (b.score || 0) / Math.max(getAgeHours(b.publishedAt), 0.01);
          return bVelocity - aVelocity;
        });
        break;
      case "top":
        combined.sort((a, b) => {
          const aScore = a.contentType === "video" ? (a.viewCount || 0) : (a.score || 0);
          const bScore = b.contentType === "video" ? (b.viewCount || 0) : (b.score || 0);
          return bScore - aScore;
        });
        break;
      case "recent":
        combined.sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime());
        break;
      case "discussed":
        combined.sort((a, b) => {
          const aComments = a.contentType === "video" ? (a.commentCount || 0) : (a.score || 0);
          const bComments = b.contentType === "video" ? (b.commentCount || 0) : (b.score || 0);
          return bComments - aComments;
        });
        break;
      default: // "discovery"
        combined.sort((a, b) => b.discoveryScore - a.discoveryScore);
    }

    return combined;
  }, [videos, contentItems, sortBy]);

  function getTimeRangeCutoff(range: TimeRange): Date {
    const now = new Date();
    switch (range) {
      case "day":
        return new Date(now.getTime() - 24 * 60 * 60 * 1000);
      case "week":
        return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      case "month":
        return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      case "year":
        return new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
      default:
        return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    }
  }

  function calculateSecondsUntilMidnight(): number {
    const now = new Date();
    const midnight = new Date(now);
    midnight.setHours(24, 0, 0, 0);
    return Math.floor((midnight.getTime() - now.getTime()) / 1000);
  }

  async function handleSaveToBoard(video: VideoWithOutlier) {
    if (!user) {
      toast.error("You must be signed in to save videos");
      return;
    }
    try {
      await addDoc(collection(db, "users", user.uid, "savedVideos"), {
        videoId: video.id,
        title: video.title,
        channelTitle: video.channelTitle,
        thumbnail: video.thumbnail,
        viewCount: video.viewCount,
        outlierScore: video.outlierScore,
        hookType: video.hookType,
        estimatedStructure: video.estimatedStructure,
        savedAt: new Date().toISOString(),
      });
      toast.success("Video saved to board!");
    } catch (err) {
      toast.error("Failed to save video");
    }
  }

  async function handleSaveContentToBoard(item: ContentItem) {
    if (!user) {
      toast.error("You must be signed in to save content");
      return;
    }
    try {
      await addDoc(collection(db, "users", user.uid, "savedContent"), {
        contentId: item.id,
        title: item.title,
        url: item.url,
        source: item.source,
        author: item.author,
        score: item.score,
        savedAt: new Date().toISOString(),
      });
      toast.success("Content saved to board!");
    } catch (err) {
      toast.error("Failed to save content");
    }
  }

  function handleRetry() {
    setQuotaError(null);
    const controller = new AbortController();
    fetchAllVideos(controller.signal);
    fetchAllContent(controller.signal, true);
  }

  // Unified feed is computed via useMemo below
  const hasResults = unifiedItemsMemo.length > 0 || videos.length > 0 || contentItems.length > 0;
  const showVideos = activeTab === "all" || activeTab === "videos";
  const showArticles = activeTab === "all" || activeTab === "articles";
  const showLoading = isLoading && !initialLoadDone;

  return (
    <div className="min-h-screen bg-gray-50 flex">
      <KeywordSidebar
        timeRange={timeRange}
        onTimeRangeChange={(range) => setTimeRange(range)}
      />

      <div className="flex-1 md:ml-72 ml-0">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="mb-8">
            <h1 className="text-3xl font-bold mb-2">Discover</h1>
            <p className="text-gray-600">Find viral YouTube content and trending articles in your niche</p>
          </div>

          {/* Content Type Tabs */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex gap-2">
              <Button
                variant={activeTab === "all" ? "default" : "outline"}
                size="sm"
                onClick={() => setActiveTab("all")}
              >
                All
              </Button>
              <Button
                variant={activeTab === "videos" ? "default" : "outline"}
                size="sm"
                onClick={() => setActiveTab("videos")}
              >
                Videos
              </Button>
              <Button
                variant={activeTab === "articles" ? "default" : "outline"}
                size="sm"
                onClick={() => setActiveTab("articles")}
              >
                Articles
              </Button>
            </div>

            {/* Sort Dropdown */}
            <div className="flex items-center gap-3">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  const controller = new AbortController();
                  fetchAllVideos(controller.signal);
                  fetchAllContent(controller.signal, true);
                }}
                disabled={isLoading}
                className="text-gray-500 hover:text-gray-700"
              >
                <svg className={`w-4 h-4 mr-1 ${isLoading ? "animate-spin" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Refresh
              </Button>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as SortOption)}
                className="text-sm border border-gray-300 rounded-md px-3 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="discovery">Discovery Score</option>
                <option value="trending">Trending</option>
                <option value="top">Top Rated</option>
                <option value="recent">Most Recent</option>
                <option value="discussed">Most Discussed</option>
              </select>
            </div>
          </div>

          {/* Quota Exceeded Error */}
          {quotaError && (
            <div className="mb-6">
              <QuotaExceededError
                retryAfter={quotaError.retryAfter}
                onRetry={handleRetry}
                hasCachedResults={fromCache && hasResults}
              />
            </div>
          )}

          {/* Single Global Error */}
          {error && !quotaError && videos.length === 0 && contentItems.length === 0 && (
            <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50/50 p-8 mb-6">
              <div className="flex flex-col items-center text-center">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="32"
                  height="32"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="text-gray-400 mb-4"
                >
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" x2="12" y1="8" y2="12" />
                  <line x1="12" x2="12.01" y1="16" y2="16" />
                </svg>
                <p className="text-base font-medium text-gray-700 mb-2">Something went wrong</p>
                <p className="text-sm text-gray-500 mb-4">{error}</p>
                <Button variant="outline" size="sm" onClick={handleRetry}>
                  Try Again
                </Button>
              </div>
            </div>
          )}

          {/* Loading skeleton */}
          {showLoading && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {Array.from({ length: 6 }).map((_, i) => (
                <Card key={i}>
                  <CardContent className="p-4">
                    <div className="w-full h-40 bg-gray-200 animate-pulse rounded mb-4" />
                    <div className="w-3/4 h-4 bg-gray-200 animate-pulse rounded mb-2" />
                    <div className="w-1/2 h-4 bg-gray-200 animate-pulse rounded" />
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {/* Unified Feed (All Tab) */}
          {activeTab === "all" && unifiedItemsMemo.length > 0 && (
            <div className="mb-8">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {unifiedItemsMemo.map((item) =>
                  item.contentType === "video" ? (
                    <VideoCard
                      key={item.id}
                      video={item}
                      onSave={handleSaveToBoard}
                    />
                  ) : (
                    <ContentCard
                      key={item.id}
                      item={item}
                      onSave={handleSaveContentToBoard}
                    />
                  )
                )}
              </div>
            </div>
          )}

          {/* Videos Section (Videos Tab) */}
          {activeTab === "videos" && videos.length > 0 && (
            <div className="mb-8">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {videos.map((video) => (
                  <VideoCard
                    key={video.id}
                    video={video}
                    onSave={handleSaveToBoard}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Articles Section (Articles Tab) */}
          {activeTab === "articles" && contentItems.length > 0 && (
            <div className="mb-8">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {contentItems.map((item) => (
                  <ContentCard
                    key={item.id}
                    item={item}
                    onSave={handleSaveContentToBoard}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Empty state */}
          {!showLoading && !hasResults && !error && !quotaError && (
            <div className="text-center py-12">
              <p className="text-gray-500">
                {user ? "Add keywords to discover content" : "Sign in to discover content"}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function DiscoverPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900" />
        </div>
      }
    >
      <DiscoverPageContent />
    </Suspense>
  );
}
