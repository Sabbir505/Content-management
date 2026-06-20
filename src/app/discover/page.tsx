"use client";

import { useState, useEffect, Suspense, useMemo, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { VideoWithOutlier } from "@/types/video";
import { ContentItem } from "@/types/content";
import { VideoCard } from "@/components/discover/VideoCard";
import { ContentCard } from "@/components/discover/ContentCard";
import { QuotaExceededError } from "@/components/discover/QuotaExceededError";
import { calculateContentDiscoveryScore, calculateVideoDiscoveryScore } from "@/lib/discovery-score";
import { BoardPicker } from "@/components/discover/BoardPicker";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { useRouter } from "next/navigation";
import { useConnectChannel } from "@/hooks/useConnectChannel";
import type { YouTubeSearchError } from "@/lib/quality/types";
import type { TrackedCreator } from "@/types/creator";

type ContentType = "videos" | "articles" | "all";
type SortOption = "discovery" | "trending" | "top" | "recent" | "discussed";
type TimeRange = "day" | "week" | "month" | "year";
type ResearchTab = "discover" | "creators" | "lists" | "channel";

const PLATFORMS = [
  { id: "youtube", label: "YouTube", icon: "▶️" },
  { id: "hackernews", label: "Hacker News", icon: "🟠" },
  { id: "reddit", label: "Reddit", icon: "🔴" },
  { id: "devto", label: "DEV.to", icon: "🟣" },
  { id: "googlenews", label: "Google News", icon: "🔵" },
];

const LANGUAGES = [
  { id: "en", label: "English" },
  { id: "es", label: "Spanish" },
  { id: "fr", label: "French" },
  { id: "de", label: "German" },
  { id: "pt", label: "Portuguese" },
  { id: "hi", label: "Hindi" },
  { id: "ja", label: "Japanese" },
  { id: "ko", label: "Korean" },
  { id: "ar", label: "Arabic" },
  { id: "zh", label: "Chinese" },
];

const FOLLOWER_RANGES = [
  { id: "any", label: "Any" },
  { id: "1k", label: "1K+" },
  { id: "10k", label: "10K+" },
  { id: "100k", label: "100K+" },
  { id: "1m", label: "1M+" },
  { id: "10m", label: "10M+" },
];

const OUTLIER_RANGES = [
  { id: "any", label: "Any" },
  { id: "2x", label: "2x+" },
  { id: "5x", label: "5x+" },
  { id: "10x", label: "10x+" },
  { id: "50x", label: "50x+" },
  { id: "100x", label: "100x+" },
];

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
  const router = useRouter();
  const searchParams = useSearchParams();
  const [videos, setVideos] = useState<VideoWithOutlier[]>([]);
  const [contentItems, setContentItems] = useState<ContentItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingVideos, setIsLoadingVideos] = useState(false);
  const [isLoadingContent, setIsLoadingContent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [quotaError, setQuotaError] = useState<YouTubeSearchError | null>(null);
  const [fromCache, setFromCache] = useState(false);
  const [activeTab, setActiveTab] = useState<ContentType>("all");
  const [researchTab, setResearchTab] = useState<ResearchTab>("discover");
  const [sortBy, setSortBy] = useState<SortOption>("top");
  const [timeRange, setTimeRange] = useState<TimeRange>("week");
  const [initialLoadDone, setInitialLoadDone] = useState(false);
  const [boardPickerOpen, setBoardPickerOpen] = useState(false);
  const [pendingSaveVideo, setPendingSaveVideo] = useState<VideoWithOutlier | null>(null);
  const [pendingSaveContent, setPendingSaveContent] = useState<ContentItem | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>(["youtube", "hackernews", "reddit", "devto", "googlenews"]);
  const [selectedFormat, setSelectedFormat] = useState<"all" | "videos" | "articles" | "shorts" | "notes" | "reels" | "carousel" | "photos">("all");
  const [selectedLanguage, setSelectedLanguage] = useState("en");
  const [selectedFollowers, setSelectedFollowers] = useState("any");
  const [selectedOutlier, setSelectedOutlier] = useState("any");
  // Initialize with defaults — load from localStorage in useEffect after hydration
  const [customCategories, setCustomCategories] = useState<string[]>([]);
  const [activeCategories, setActiveCategories] = useState<string[]>([
    "Productivity",
    "Self-improvement",
    "Business",
    "Health & fitness",
    "Content creation",
    "Psychology",
    "Technology",
    "Finance",
    "Entertainment",
  ]);
  const [showAddCategory, setShowAddCategory] = useState(false);
  const [newCategory, setNewCategory] = useState("");
  // Creators tab state
  const [trackedCreators, setTrackedCreators] = useState<TrackedCreator[]>([]);
  const [isLoadingCreators, setIsLoadingCreators] = useState(false);
  const [creatorUrl, setCreatorUrl] = useState("");
  const [isTrackingCreator, setIsTrackingCreator] = useState(false);
  const filterRef = useRef<HTMLDivElement>(null);
  const fetchInProgressRef = useRef(false);

  const queryParam = searchParams.get("query");
  const userId = user?.uid;

  // Close filter dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        filterRef.current &&
        !filterRef.current.contains(event.target as Node) &&
        showFilters
      ) {
        setShowFilters(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showFilters]);

  // Chat sessions state
  const [chatSessions, setChatSessions] = useState<{ id: string; title: string }[]>([]);
  const [isLoadingChatSessions, setIsLoadingChatSessions] = useState(false);
  const [chatDropdownOpen, setChatDropdownOpen] = useState(false);

  // Load categories from localStorage after hydration
  useEffect(() => {
    try {
      const savedActive = localStorage.getItem("discover_activeCategories");
      if (savedActive) {
        const parsed = JSON.parse(savedActive);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setActiveCategories(parsed);
        }
      }
      const savedCustom = localStorage.getItem("discover_customCategories");
      if (savedCustom) {
        const parsed = JSON.parse(savedCustom);
        if (Array.isArray(parsed)) {
          setCustomCategories(parsed);
        }
      }
    } catch {
      // ignore parse errors
    }
  }, []);

  // Persist categories to localStorage
  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem("discover_activeCategories", JSON.stringify(activeCategories));
    }
  }, [activeCategories]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem("discover_customCategories", JSON.stringify(customCategories));
    }
  }, [customCategories]);

  // Initial load: fetch trending content based on selected category
  useEffect(() => {
    if (!userId) return;
    if (fetchInProgressRef.current) return;

    setVideos([]);
    setContentItems([]);

    const abortController = new AbortController();
    fetchInProgressRef.current = true;

    // When "All" is selected, fetch content for all active categories combined
    let query: string;
    if (selectedCategory !== "All") {
      query = selectedCategory;
    } else {
      // Combine all active and custom categories into a single query for broader relevant results
      const allCats = [...activeCategories, ...customCategories];
      if (allCats.length > 0) {
        query = allCats.join(" | ");
      } else {
        query = "trending";
      }
    }
    fetchVideos(query, abortController.signal);
    fetchContent(query, abortController.signal);

    return () => {
      abortController.abort();
      fetchInProgressRef.current = false;
    };
  }, [userId, timeRange, selectedCategory]);

  // Load chat sessions when dropdown opens
  useEffect(() => {
    if (chatDropdownOpen && user) {
      loadChatSessions();
    }
  }, [chatDropdownOpen, user]);

  async function loadChatSessions() {
    if (!user) return;
    setIsLoadingChatSessions(true);
    try {
      const response = await fetch(`/api/chat/session?userId=${user.uid}`);
      const result = await response.json();
      if (result.success) {
        setChatSessions(result.data.map((s: { id: string; title: string }) => ({ id: s.id, title: s.title })));
      }
    } catch (error) {
      console.error("Failed to load chat sessions:", error);
    } finally {
      setIsLoadingChatSessions(false);
    }
  }

  // Load tracked creators when on creators tab
  useEffect(() => {
    if (researchTab === "creators" && user) {
      loadTrackedCreators();
    }
  }, [researchTab, user]);

  useEffect(() => {
    if (!isLoading && !isLoadingVideos && !isLoadingContent) return;
    const timer = setTimeout(() => {
      setIsLoading(false);
      setIsLoadingVideos(false);
      setIsLoadingContent(false);
      setInitialLoadDone(true);
    }, 65000);
    return () => clearTimeout(timer);
  }, [isLoading, isLoadingVideos, isLoadingContent]);

  async function fetchVideos(query: string, abortSignal?: AbortSignal) {
    setIsLoadingVideos(true);
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
      if (err instanceof DOMException && err.name === "AbortError") return;
      setError(err instanceof Error ? err.message : "Failed to load videos");
      setVideos([]);
    } finally {
      setIsLoadingVideos(false);
      fetchInProgressRef.current = false;
    }
  }

  async function fetchContent(query: string, abortSignal?: AbortSignal) {
    setIsLoadingContent(true);
    try {
      if (abortSignal?.aborted) return;

      const controller = new AbortController();
      if (abortSignal) {
        const onAbort = () => controller.abort();
        abortSignal.addEventListener("abort", onAbort, { once: true });
      }
      const timeoutId = setTimeout(() => controller.abort(), 45000);

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
      if (err instanceof DOMException && err.name === "AbortError") return;
      console.error("Content fetch error:", err);
    } finally {
      setIsLoadingContent(false);
      fetchInProgressRef.current = false;
    }
  }

  async function loadTrackedCreators() {
    if (!user) return;
    setIsLoadingCreators(true);
    try {
      const response = await fetch(`/api/creators?userId=${user.uid}`);
      const result = await response.json();
      if (result.success) {
        setTrackedCreators(result.data);
      }
    } catch (error) {
      console.error("Failed to load creators:", error);
    } finally {
      setIsLoadingCreators(false);
    }
  }

  async function handleTrackCreator() {
    if (!user || !creatorUrl.trim()) return;
    setIsTrackingCreator(true);
    try {
      const response = await fetch("/api/creators", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: user.uid,
          channelUrl: creatorUrl.trim(),
        }),
      });
      const result = await response.json();
      if (result.success) {
        setTrackedCreators((prev) => [result.data, ...prev]);
        setCreatorUrl("");
        toast.success("Creator tracked!");
      } else {
        toast.error(result.error || "Failed to track creator");
      }
    } catch {
      toast.error("Failed to track creator");
    } finally {
      setIsTrackingCreator(false);
    }
  }

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

  async function handleSaveToBoard(boardId: string) {
    if (!user || !pendingSaveVideo) return;
    try {
      const { collection, addDoc, doc, updateDoc, increment, serverTimestamp } = await import("firebase/firestore");
      const { db } = await import("@/lib/firebase");
      await addDoc(collection(db, "users", user.uid, "boards", boardId, "items"), {
        type: "video",
        title: pendingSaveVideo.title,
        thumbnail: pendingSaveVideo.thumbnail,
        videoId: pendingSaveVideo.id,
        channelTitle: pendingSaveVideo.channelTitle,
        viewCount: pendingSaveVideo.viewCount,
        outlierScore: pendingSaveVideo.outlierScore,
        hookType: pendingSaveVideo.hookType,
        estimatedStructure: pendingSaveVideo.estimatedStructure,
        duration: pendingSaveVideo.duration,
        publishedAt: pendingSaveVideo.publishedAt,
        createdAt: serverTimestamp(),
      });
      await updateDoc(doc(db, "users", user.uid, "boards", boardId), {
        itemCount: increment(1),
        updatedAt: serverTimestamp(),
      });
      toast.success("Saved to board!");
    } catch {
      toast.error("Failed to save video");
    } finally {
      setPendingSaveVideo(null);
      setBoardPickerOpen(false);
    }
  }

  async function handleSaveContentToBoard(boardId: string) {
    if (!user || !pendingSaveContent) return;
    try {
      const { collection, addDoc, doc, updateDoc, increment, serverTimestamp } = await import("firebase/firestore");
      const { db } = await import("@/lib/firebase");
      await addDoc(collection(db, "users", user.uid, "boards", boardId, "items"), {
        type: "post",
        title: pendingSaveContent.title,
        thumbnail: pendingSaveContent.thumbnail,
        url: pendingSaveContent.url,
        source: pendingSaveContent.source,
        author: pendingSaveContent.author,
        score: pendingSaveContent.score,
        createdAt: serverTimestamp(),
      });
      await updateDoc(doc(db, "users", user.uid, "boards", boardId), {
        itemCount: increment(1),
        updatedAt: serverTimestamp(),
      });
      toast.success("Saved to board!");
    } catch {
      toast.error("Failed to save content");
    } finally {
      setPendingSaveContent(null);
      setBoardPickerOpen(false);
    }
  }

  function openBoardPickerForVideo(video: VideoWithOutlier) {
    if (!user) {
      toast.error("You must be signed in to save");
      return;
    }
    setPendingSaveVideo(video);
    setPendingSaveContent(null);
    setBoardPickerOpen(true);
  }

  function openBoardPickerForContent(item: ContentItem) {
    if (!user) {
      toast.error("You must be signed in to save");
      return;
    }
    setPendingSaveContent(item);
    setPendingSaveVideo(null);
    setBoardPickerOpen(true);
  }

  function handleRetry() {
    setQuotaError(null);
    const query = selectedCategory !== "All" ? selectedCategory : searchQuery || "trending";
    const controller = new AbortController();
    fetchVideos(query, controller.signal);
    fetchContent(query, controller.signal);
  }

  function handleSearchSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    setVideos([]);
    setContentItems([]);
    fetchVideos(searchQuery.trim());
    fetchContent(searchQuery.trim());
  }

  function togglePlatform(platformId: string) {
    setSelectedPlatforms((prev) =>
      prev.includes(platformId) ? prev.filter((p) => p !== platformId) : [...prev, platformId]
    );
  }

  function handleAddCategory() {
    if (!newCategory.trim()) return;
    const trimmed = newCategory.trim();
    if (!activeCategories.includes(trimmed) && !customCategories.includes(trimmed) && trimmed !== "All") {
      setCustomCategories((prev) => [...prev, trimmed]);
    }
    setNewCategory("");
    setShowAddCategory(false);
  }

  const allCategories = ["All", ...activeCategories, ...customCategories];

  const filteredVideos = useMemo(() => {
    let filtered = [...videos];
    // Search filter
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter((v) => v.title.toLowerCase().includes(q) || (v.channelTitle || "").toLowerCase().includes(q));
    }
    // Category filter
    if (selectedCategory !== "All") {
      filtered = filtered.filter((v) => v.title.toLowerCase().includes(selectedCategory.toLowerCase()));
    }
    // Outlier filter
    if (selectedOutlier !== "any") {
      const minOutlier = parseInt(selectedOutlier);
      filtered = filtered.filter((v) => (v.outlierScore || 0) >= minOutlier);
    }
    // Platform filter - check if youtube is selected
    if (!selectedPlatforms.includes("youtube")) {
      filtered = [];
    }
    // Format filter
    if (selectedFormat === "shorts") {
      filtered = filtered.filter((v) => {
        const durationParts = v.duration.split(":").map(Number);
        const seconds = durationParts.length === 3
          ? durationParts[0] * 3600 + durationParts[1] * 60 + durationParts[2]
          : durationParts.length === 2
            ? durationParts[0] * 60 + durationParts[1]
            : 0;
        return seconds <= 60;
      });
    } else if (selectedFormat === "videos") {
      filtered = filtered.filter((v) => {
        const durationParts = v.duration.split(":").map(Number);
        const seconds = durationParts.length === 3
          ? durationParts[0] * 3600 + durationParts[1] * 60 + durationParts[2]
          : durationParts.length === 2
            ? durationParts[0] * 60 + durationParts[1]
            : 0;
        return seconds > 60;
      });
    }
    // Time range filter (client-side fallback for cached data)
    const cutoffDate = getTimeRangeCutoff(timeRange);
    filtered = filtered.filter((v) => new Date(v.publishedAt).getTime() >= cutoffDate.getTime());
    return filtered;
  }, [videos, searchQuery, selectedCategory, selectedOutlier, selectedPlatforms, selectedFormat, timeRange]);

  const filteredArticles = useMemo(() => {
    let filtered = [...contentItems];
    // Search filter
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter((item) => item.title.toLowerCase().includes(q) || (item.author || "").toLowerCase().includes(q));
    }
    // Category filter
    if (selectedCategory !== "All") {
      filtered = filtered.filter((item) => item.title.toLowerCase().includes(selectedCategory.toLowerCase()));
    }
    // Platform filter
    filtered = filtered.filter((item) => selectedPlatforms.includes(item.source));
    // Time range filter
    const cutoffDate = getTimeRangeCutoff(timeRange);
    filtered = filtered.filter((item) => new Date(item.publishedAt).getTime() >= cutoffDate.getTime());
    return filtered;
  }, [contentItems, searchQuery, selectedCategory, selectedPlatforms, timeRange]);

  const unifiedItemsMemo = useMemo(() => {
    const scoredVideos = filteredVideos.map((video) => ({
      ...video,
      contentType: "video" as const,
      discoveryScore: video.discoveryScore ?? calculateVideoDiscoveryScore(video),
    }));
    const scoredArticles = filteredArticles.map((item) => ({
      ...item,
      contentType: "article" as const,
      discoveryScore: item.discoveryScore ?? calculateContentDiscoveryScore(item),
    }));

    const combined = [...scoredVideos, ...scoredArticles];

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
      default:
        combined.sort((a, b) => b.discoveryScore - a.discoveryScore);
    }

    return combined;
  }, [filteredVideos, filteredArticles, sortBy]);

  const sortedVideos = useMemo(() => {
    const sorted = [...filteredVideos];
    switch (sortBy) {
      case "trending":
        sorted.sort((a, b) => {
          const aVelocity = (a.viewCount || 0) / Math.max(getAgeHours(a.publishedAt), 0.01);
          const bVelocity = (b.viewCount || 0) / Math.max(getAgeHours(b.publishedAt), 0.01);
          return bVelocity - aVelocity;
        });
        break;
      case "top":
        sorted.sort((a, b) => (b.viewCount || 0) - (a.viewCount || 0));
        break;
      case "recent":
        sorted.sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime());
        break;
      case "discussed":
        sorted.sort((a, b) => (b.commentCount || 0) - (a.commentCount || 0));
        break;
      default:
        sorted.sort((a, b) => (b.discoveryScore || 0) - (a.discoveryScore || 0));
    }
    return sorted;
  }, [filteredVideos, sortBy]);

  const sortedArticles = useMemo(() => {
    const sorted = [...filteredArticles];
    switch (sortBy) {
      case "trending":
        sorted.sort((a, b) => {
          const aVelocity = (a.score || 0) / Math.max(getAgeHours(a.publishedAt), 0.01);
          const bVelocity = (b.score || 0) / Math.max(getAgeHours(b.publishedAt), 0.01);
          return bVelocity - aVelocity;
        });
        break;
      case "top":
        sorted.sort((a, b) => (b.score || 0) - (a.score || 0));
        break;
      case "recent":
        sorted.sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime());
        break;
      case "discussed":
        sorted.sort((a, b) => (b.score || 0) - (a.score || 0));
        break;
      default:
        sorted.sort((a, b) => (b.discoveryScore || 0) - (a.discoveryScore || 0));
    }
    return sorted;
  }, [filteredArticles, sortBy]);

  return (
    <div className="min-h-screen bg-[#0a0a0a] flex">
      {/* Sidebar */}
      <div className="w-64 bg-[#181818] border-r border-[#1a1a1a] flex flex-col h-screen sticky top-0 shrink-0">
        <div className="p-4">
          <button
            onClick={() => router.push("/")}
            className="flex items-center gap-2 text-white font-semibold text-lg"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
            TubeForge
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-3 space-y-1">
          <SidebarItem icon="home" label="Home" onClick={() => router.push("/")} />
          <SidebarItem icon="research" label="Research" active onClick={() => {}} />
          <SidebarItem icon="menu" label="Menu" onClick={() => {}} />

          <div className="pt-4 pb-2">
            <p className="text-xs text-[#666] px-3 uppercase tracking-wider font-medium">Analyze</p>
          </div>
          {/* Chat Nav with Dropdown */}
          <div className="relative">
            <button
              onClick={() => setChatDropdownOpen(!chatDropdownOpen)}
              onMouseEnter={() => setChatDropdownOpen(true)}
              className={`w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors ${
                chatDropdownOpen ? "bg-[#1a1a1a] text-white" : "text-[#888] hover:bg-[#1a1a1a] hover:text-white"
              }`}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-4.72C3.512 14.042 3 12.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
              <span className="truncate">Chat</span>
              <svg
                className={`w-3 h-3 ml-auto transition-transform ${chatDropdownOpen ? "rotate-180" : ""}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            {chatDropdownOpen && (
              <div
                className="mt-1 ml-4 space-y-0.5"
                onMouseLeave={() => setChatDropdownOpen(false)}
              >
                {isLoadingChatSessions ? (
                  <div className="px-3 py-2 text-xs text-[#666]">Loading...</div>
                ) : chatSessions.length > 0 ? (
                  chatSessions.map((session) => (
                    <button
                      key={session.id}
                      onClick={() => router.push(`/boards?chatSession=${session.id}`)}
                      className="w-full text-left px-3 py-1.5 rounded-md text-xs text-[#888] hover:bg-[#1a1a1a] hover:text-white transition-colors truncate"
                    >
                      {session.title}
                    </button>
                  ))
                ) : (
                  <div className="px-3 py-2 text-xs text-[#666]">No chat sessions yet</div>
                )}
                <button
                  onClick={() => router.push("/boards")}
                  className="w-full text-left px-3 py-1.5 rounded-md text-xs text-blue-400 hover:text-blue-300 transition-colors"
                >
                  + New Chat
                </button>
              </div>
            )}
          </div>

          <div className="pt-4 pb-2">
            <p className="text-xs text-[#666] px-3 uppercase tracking-wider font-medium">Boards</p>
          </div>
          <SidebarItem icon="board" label="My Ideas" onClick={() => router.push("/boards")} />
        </div>

        <div className="p-3 border-t border-[#1a1a1a] space-y-1">
          <SidebarItem icon="academy" label="Academy" onClick={() => {}} />
          <SidebarItem icon="help" label="Help & Support" onClick={() => {}} />
          {user && (
            <div className="flex items-center gap-2 px-3 py-2 mt-2">
              <div className="w-6 h-6 rounded-full bg-blue-600 flex items-center justify-center text-xs text-white font-medium">
                {user.displayName?.[0] || user.email?.[0] || "U"}
              </div>
              <span className="text-sm text-[#888] truncate">{user.displayName || user.email}</span>
            </div>
          )}
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto">
        {/* Top Search Bar */}
        <div className="sticky top-0 z-40 bg-[#0a0a0a]/80 backdrop-blur-sm border-b border-[#1a1a1a] px-6 py-3">
          <div className="flex items-center gap-3">
            <form onSubmit={handleSearchSubmit} className="flex-1">
              <div className="relative">
                <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#666]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <input
                  type="text"
                  placeholder="Search videos, articles, creators..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg pl-10 pr-32 py-2.5 text-sm text-white placeholder-[#666] focus:outline-none focus:border-[#3a3a3a]"
                />
                {/* Filter button inside search input */}
                <button
                  type="button"
                  onClick={() => setShowFilters(!showFilters)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1.5 px-3 py-1 rounded-md bg-[#2a2a2a] hover:bg-[#3a3a3a] transition-colors text-xs text-[#888]"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
                  </svg>
                  <span>Filters</span>
                  <svg className={`w-3 h-3 transition-transform ${showFilters ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
              </div>
            </form>

            {/* Refresh */}
            <Button
              variant="ghost"
              size="sm"
              onClick={handleRetry}
              disabled={isLoadingVideos || isLoadingContent}
              className="text-[#888] hover:text-white"
            >
              <svg className={`w-4 h-4 ${isLoadingVideos || isLoadingContent ? "animate-spin" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </Button>
          </div>

          {/* Filter Dropdown - Positioned absolutely like Eden */}
          {showFilters && (
            <div
              ref={filterRef}
              className="absolute right-6 top-16 z-50 w-[300px] max-h-[500px] overflow-y-auto scrollbar-hide bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg shadow-2xl p-4"
            >
              <div className="space-y-5">
                {/* Platforms */}
                <div>
                  <p className="text-xs text-[#666] uppercase tracking-wider font-medium mb-2">Platforms</p>
                  <div className="space-y-1.5">
                    {PLATFORMS.map((platform) => (
                      <button
                        key={platform.id}
                        onClick={() => togglePlatform(platform.id)}
                        className="w-full flex items-center justify-between p-2 rounded-md hover:bg-[#2a2a2a] transition-colors"
                      >
                        <div className="flex items-center gap-2">
                          <span>{platform.icon}</span>
                          <span className="text-sm text-white">{platform.label}</span>
                        </div>
                        <div className={`w-4 h-4 rounded border flex items-center justify-center ${
                          selectedPlatforms.includes(platform.id)
                            ? "bg-green-500 border-green-500"
                            : "border-[#3a3a3a]"
                        }`}>
                          {selectedPlatforms.includes(platform.id) && (
                            <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                            </svg>
                          )}
                        </div>
                      </button>
                    ))}
                  </div>
                  <div className="flex items-center justify-between mt-1.5">
                    <span className="text-xs text-[#666]">{selectedPlatforms.length} of {PLATFORMS.length} selected</span>
                    <button
                      onClick={() => setSelectedPlatforms(PLATFORMS.map((p) => p.id))}
                      className="text-xs text-blue-400 hover:text-blue-300"
                    >
                      Select all
                    </button>
                  </div>
                </div>

                {/* Format - YouTube */}
                <div>
                  <p className="text-xs text-[#666] uppercase tracking-wider font-medium mb-2">Content Format</p>
                  <div className="space-y-2.5">
                    <div>
                      <p className="text-xs text-[#888] mb-1.5 flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-red-500"></span>
                        YouTube
                      </p>
                      <div className="flex gap-1.5">
                        {(["videos", "shorts", "all"] as const).map((fmt) => (
                          <button
                            key={fmt}
                            onClick={() => setSelectedFormat(fmt === "shorts" ? "all" : fmt as "videos" | "all" | "articles")}
                            className={`px-2.5 py-1 rounded-full text-xs border transition-colors ${
                              selectedFormat === fmt || (fmt === "all" && selectedFormat === "shorts")
                                ? "bg-[#2a2a2a] border-[#3a3a3a] text-white"
                                : "border-[#2a2a2a] text-[#888] hover:border-[#3a3a3a]"
                            }`}
                          >
                            {fmt.charAt(0).toUpperCase() + fmt.slice(1)}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <p className="text-xs text-[#888] mb-1.5 flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-orange-500"></span>
                        Substack
                      </p>
                      <div className="flex gap-1.5">
                        {(["articles", "notes", "all"] as const).map((fmt) => (
                          <button
                            key={fmt}
                            onClick={() => setSelectedFormat(fmt === "notes" ? "all" : fmt as "videos" | "all" | "articles")}
                            className={`px-2.5 py-1 rounded-full text-xs border transition-colors ${
                              selectedFormat === fmt || (fmt === "all" && selectedFormat === "notes")
                                ? "bg-[#2a2a2a] border-[#3a3a3a] text-white"
                                : "border-[#2a2a2a] text-[#888] hover:border-[#3a3a3a]"
                            }`}
                          >
                            {fmt.charAt(0).toUpperCase() + fmt.slice(1)}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <p className="text-xs text-[#888] mb-1.5 flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-pink-500"></span>
                        Instagram
                      </p>
                      <div className="flex gap-1.5">
                        {(["reels", "carousel", "photos", "all"] as const).map((fmt) => (
                          <button
                            key={fmt}
                            onClick={() => setSelectedFormat(fmt === "carousel" || fmt === "photos" ? "all" : fmt as "videos" | "all" | "articles")}
                            className={`px-2.5 py-1 rounded-full text-xs border transition-colors ${
                              selectedFormat === fmt || (fmt === "all" && (selectedFormat === "carousel" || selectedFormat === "photos"))
                                ? "bg-[#2a2a2a] border-[#3a3a3a] text-white"
                                : "border-[#2a2a2a] text-[#888] hover:border-[#3a3a3a]"
                            }`}
                          >
                            {fmt.charAt(0).toUpperCase() + fmt.slice(1)}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Language */}
                <div>
                  <p className="text-xs text-[#666] uppercase tracking-wider font-medium mb-2">Language</p>
                  <div className="max-h-40 overflow-y-auto scrollbar-hide space-y-0.5">
                    {LANGUAGES.map((lang) => (
                      <button
                        key={lang.id}
                        onClick={() => setSelectedLanguage(lang.id)}
                        className={`w-full text-left px-2.5 py-1.5 rounded-md text-xs transition-colors ${
                          selectedLanguage === lang.id
                            ? "bg-[#2a2a2a] text-white"
                            : "text-[#888] hover:bg-[#2a2a2a] hover:text-white"
                        }`}
                      >
                        {lang.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Outlier Score */}
                <div>
                  <p className="text-xs text-[#666] uppercase tracking-wider font-medium mb-2">Outlier Score</p>
                  <div className="flex flex-wrap gap-1.5">
                    {OUTLIER_RANGES.map((range) => (
                      <button
                        key={range.id}
                        onClick={() => setSelectedOutlier(range.id)}
                        className={`px-2.5 py-1 rounded-full text-xs border transition-colors ${
                          selectedOutlier === range.id
                            ? "bg-[#2a2a2a] border-[#3a3a3a] text-white"
                            : "border-[#2a2a2a] text-[#888] hover:border-[#3a3a3a]"
                        }`}
                      >
                        {range.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Timeline */}
                <div>
                  <p className="text-xs text-[#666] uppercase tracking-wider font-medium mb-2">Time Period</p>
                  <div className="grid grid-cols-2 gap-1.5">
                    {([
                      { value: "day", label: "24 Hours" },
                      { value: "week", label: "7 Days" },
                      { value: "month", label: "30 Days" },
                      { value: "year", label: "1 Year" },
                    ] as { value: TimeRange; label: string }[]).map((range) => (
                      <button
                        key={range.value}
                        onClick={() => setTimeRange(range.value)}
                        className={`text-xs py-1.5 px-2 rounded-md border transition-colors ${
                          timeRange === range.value
                            ? "bg-blue-600/20 border-blue-500/50 text-blue-400 font-medium"
                            : "bg-[#0a0a0a] border-[#2a2a2a] text-[#888] hover:bg-[#2a2a2a] hover:border-[#3a3a3a]"
                        }`}
                      >
                        {range.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="max-w-7xl mx-auto px-6 py-6">
          {/* Research Tabs */}
          <div className="flex items-center gap-6 mb-4">
            {([
              { id: "discover" as ResearchTab, label: "Discover" },
              { id: "creators" as ResearchTab, label: "Creators" },
              { id: "lists" as ResearchTab, label: "Lists" },
              { id: "channel" as ResearchTab, label: "Channel" },
            ]).map((tab) => (
              <button
                key={tab.id}
                onClick={() => setResearchTab(tab.id)}
                className={`text-lg font-medium pb-1 border-b-2 transition-colors ${
                  researchTab === tab.id
                    ? "text-white border-white"
                    : "text-[#666] border-transparent hover:text-[#888]"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Category Pills - only show on Discover */}
          {researchTab === "discover" && (
            <div className="flex items-center gap-2 mb-6 overflow-x-auto pb-2">
              {allCategories.map((category) => (
                <button
                  key={category}
                  onClick={() => setSelectedCategory(category)}
                  className={`group relative px-4 py-1.5 rounded-full text-sm border whitespace-nowrap transition-colors ${
                    selectedCategory === category
                      ? "bg-[#2a2a2a] border-[#3a3a3a] text-white"
                      : "border-[#2a2a2a] text-[#888] hover:border-[#3a3a3a] hover:text-white"
                  }`}
                >
                  <span className="flex items-center gap-1.5">
                    {category === "All" ? (
                      <>
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                        </svg>
                        All
                      </>
                    ) : (
                      category
                    )}
                  </span>
                  {/* Trash icon for all categories except "All" */}
                  {category !== "All" && (
                    <span
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        // Remove from active categories (built-in)
                        setActiveCategories((prev) => prev.filter((c) => c !== category));
                        // Remove from custom categories (user-added)
                        setCustomCategories((prev) => prev.filter((c) => c !== category));
                        // Always reset to "All" when deleting current category
                        if (selectedCategory === category) {
                          setSelectedCategory("All");
                        }
                      }}
                      className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500/90 hover:bg-red-500 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer z-10"
                      title="Remove category"
                    >
                      <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </span>
                  )}
                </button>
              ))}
              {/* Add Category Button */}
              {showAddCategory ? (
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={newCategory}
                    onChange={(e) => setNewCategory(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleAddCategory();
                      if (e.key === "Escape") {
                        setShowAddCategory(false);
                        setNewCategory("");
                      }
                    }}
                    placeholder="New category..."
                    autoFocus
                    className="px-3 py-1.5 rounded-full text-sm bg-[#1a1a1a] border border-[#3a3a3a] text-white placeholder-[#666] focus:outline-none focus:border-[#4a4a4a] w-32"
                  />
                  <button
                    onClick={handleAddCategory}
                    className="p-1.5 rounded-full bg-[#2a2a2a] hover:bg-[#3a3a3a] text-white transition-colors"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </button>
                  <button
                    onClick={() => {
                      setShowAddCategory(false);
                      setNewCategory("");
                    }}
                    className="p-1.5 rounded-full bg-[#2a2a2a] hover:bg-[#3a3a3a] text-white transition-colors"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setShowAddCategory(true)}
                  className="px-4 py-1.5 rounded-full text-sm border border-dashed border-[#3a3a3a] text-[#888] hover:text-white hover:border-[#4a4a4a] transition-colors flex items-center gap-1.5"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  Add
                </button>
              )}
            </div>
          )}

          {/* ===== DISCOVER TAB ===== */}
          {researchTab === "discover" && (
            <>
              <div className="flex items-center justify-between mb-6">
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as SortOption)}
                  className="text-sm border border-[#2a2a2a] rounded-md px-3 py-1.5 bg-[#1a1a1a] text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="top">Best Performance</option>
                  <option value="discovery">Discovery Score</option>
                  <option value="trending">Trending</option>
                  <option value="recent">Most Recent</option>
                  <option value="discussed">Most Discussed</option>
                </select>
              </div>

              {/* Quota Error */}
              {quotaError && (
                <div className="mb-6">
                  <QuotaExceededError
                    retryAfter={quotaError.retryAfter}
                    onRetry={handleRetry}
                    hasCachedResults={fromCache && (unifiedItemsMemo.length > 0 || videos.length > 0 || contentItems.length > 0)}
                  />
                </div>
              )}

              {/* Error */}
              {error && !quotaError && videos.length === 0 && contentItems.length === 0 && (
                <div className="rounded-lg border border-dashed border-[#2a2a2a] bg-[#0a0a0a]/50 p-8 mb-6">
                  <div className="flex flex-col items-center text-center">
                    <svg className="text-[#666] mb-4" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <circle cx="12" cy="12" r="10" />
                      <line x1="12" x2="12" y1="8" y2="12" />
                      <line x1="12" x2="12.01" y1="16" y2="16" />
                    </svg>
                    <p className="text-base font-medium text-white mb-2">Something went wrong</p>
                    <p className="text-sm text-[#888] mb-4">{error}</p>
                    <Button variant="outline" size="sm" onClick={handleRetry} className="border-[#2a2a2a] text-white hover:bg-[#1a1a1a]">
                      Try Again
                    </Button>
                  </div>
                </div>
              )}

              {/* Loading */}
              {(isLoadingVideos || isLoadingContent) && videos.length === 0 && contentItems.length === 0 && (
                <div className="columns-1 sm:columns-2 lg:columns-3 xl:columns-4 gap-4 space-y-4">
                  {Array.from({ length: 8 }).map((_, i) => (
                    <div key={i} className="break-inside-avoid mb-4">
                      <Card className="bg-[#1a1a1a] border-[#2a2a2a]">
                        <CardContent className="p-3">
                          <div className="w-full h-32 bg-[#252525] animate-pulse rounded mb-3" />
                          <div className="w-3/4 h-3 bg-[#252525] animate-pulse rounded mb-2" />
                          <div className="w-1/2 h-3 bg-[#252525] animate-pulse rounded" />
                        </CardContent>
                      </Card>
                    </div>
                  ))}
                </div>
              )}

              {/* Masonry Content Grid */}
              {activeTab === "all" && (
                <div className="columns-1 sm:columns-2 lg:columns-3 xl:columns-4 gap-4 space-y-4">
                  {unifiedItemsMemo.map((item) =>
                    item.contentType === "video" ? (
                      <div key={item.id} className="break-inside-avoid mb-4">
                        <VideoCard key={item.id} video={item} onSave={openBoardPickerForVideo} />
                      </div>
                    ) : (
                      <div key={item.id} className="break-inside-avoid mb-4">
                        <ContentCard key={item.id} item={item} onSave={openBoardPickerForContent} />
                      </div>
                    )
                  )}
                </div>
              )}

              {activeTab === "videos" && (
                <div className="columns-1 sm:columns-2 lg:columns-3 xl:columns-4 gap-4 space-y-4">
                  {sortedVideos.map((video) => (
                    <div key={video.id} className="break-inside-avoid mb-4">
                      <VideoCard video={video} onSave={openBoardPickerForVideo} />
                    </div>
                  ))}
                </div>
              )}

              {activeTab === "articles" && (
                <div className="columns-1 sm:columns-2 lg:columns-3 xl:columns-4 gap-4 space-y-4">
                  {sortedArticles.map((item) => (
                    <div key={item.id} className="break-inside-avoid mb-4">
                      <ContentCard item={item} onSave={openBoardPickerForContent} />
                    </div>
                  ))}
                </div>
              )}

              {/* Empty */}
              {!isLoadingVideos && !isLoadingContent && videos.length === 0 && contentItems.length === 0 && !error && !quotaError && (
                <div className="text-center py-12">
                  <p className="text-[#888]">{user ? "Select a category or search to discover content" : "Sign in to discover content"}</p>
                </div>
              )}
            </>
          )}

          {/* ===== CREATORS TAB ===== */}
          {researchTab === "creators" && (
            <div className="space-y-6">
              {/* Add Creator */}
              <div className="flex gap-2 max-w-xl">
                <input
                  type="text"
                  placeholder="Paste YouTube channel URL..."
                  value={creatorUrl}
                  onChange={(e) => setCreatorUrl(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleTrackCreator();
                  }}
                  className="flex-1 bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg px-4 py-2.5 text-sm text-white placeholder-[#666] focus:outline-none focus:border-[#3a3a3a]"
                />
                <Button
                  onClick={handleTrackCreator}
                  disabled={isTrackingCreator || !creatorUrl.trim()}
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  {isTrackingCreator ? "Tracking..." : "Track"}
                </Button>
              </div>

              {/* Loading */}
              {isLoadingCreators && (
                <div className="flex items-center justify-center py-12">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white" />
                </div>
              )}

              {/* Creators Grid */}
              {!isLoadingCreators && (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {trackedCreators.map((creator) => (
                    <button
                      key={creator.id}
                      onClick={() => router.push(`/creators?channelId=${creator.channelId}`)}
                      className="text-left bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg p-4 hover:border-[#3a3a3a] transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        {creator.thumbnail ? (
                          <img
                            src={creator.thumbnail}
                            alt={creator.channelTitle}
                            className="w-12 h-12 rounded-full object-cover"
                          />
                        ) : (
                          <div className="w-12 h-12 rounded-full bg-[#2a2a2a] flex items-center justify-center">
                            <svg className="w-6 h-6 text-[#666]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                            </svg>
                          </div>
                        )}
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-white truncate">{creator.channelTitle}</p>
                          <p className="text-xs text-[#888]">
                            {creator.subscriberCount?.toLocaleString()} subscribers
                          </p>
                          <p className="text-xs text-[#666]">
                            {creator.videoCount?.toLocaleString()} videos
                          </p>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}

              {/* Empty */}
              {!isLoadingCreators && trackedCreators.length === 0 && (
                <div className="text-center py-12">
                  <svg className="w-12 h-12 mx-auto mb-4 text-[#3a3a3a]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                  <p className="text-[#888] text-sm">No creators tracked yet.</p>
                  <p className="text-[#666] text-xs mt-1">Paste a YouTube channel URL above to start tracking.</p>
                </div>
              )}
            </div>
          )}

          {/* ===== LISTS TAB ===== */}
          {researchTab === "lists" && (
            <div className="text-center py-12">
              <p className="text-[#888]">Lists coming soon</p>
            </div>
          )}

          {/* ===== CHANNEL TAB ===== */}
          {researchTab === "channel" && (
            <ChannelTabContent />
          )}
        </div>
      </div>

      <BoardPicker
        isOpen={boardPickerOpen}
        onClose={() => { setBoardPickerOpen(false); setPendingSaveVideo(null); setPendingSaveContent(null); }}
        onSave={(boardId) => {
          if (pendingSaveVideo) {
            handleSaveToBoard(boardId);
          } else if (pendingSaveContent) {
            handleSaveContentToBoard(boardId);
          }
        }}
        itemTitle={pendingSaveVideo?.title || pendingSaveContent?.title || ""}
      />
    </div>
  );
}

function SidebarItem({
  icon,
  label,
  active,
  onClick,
}: {
  icon: string;
  label: string;
  active?: boolean;
  onClick: () => void;
}) {
  const iconMap: Record<string, React.ReactNode> = {
    home: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
      </svg>
    ),
    research: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
      </svg>
    ),
    menu: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 6h16M4 12h16M4 18h16" />
      </svg>
    ),
    chart: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
      </svg>
    ),
    board: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
      </svg>
    ),
    academy: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 19.477 5.754 19 7.5 19s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 19.477 18.247 19 16.5 19c-1.746 0-3.332.477-4.5 1.253" />
      </svg>
    ),
    help: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  };

  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors ${
        active ? "bg-[#1a1a1a] text-white" : "text-[#888] hover:bg-[#1a1a1a] hover:text-white"
      }`}
    >
      {iconMap[icon] || iconMap.home}
      <span className="truncate">{label}</span>
    </button>
  );
}

export default function DiscoverPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white" />
        </div>
      }
    >
      <DiscoverPageContent />
    </Suspense>
  );
}

// ---- Inline Channel Tab Component ----

function ChannelTabContent() {
  const { isAuthenticated, user } = useAuth();
  const { channel: connectedChannel, isConnecting, isConnected, connectChannel, disconnectChannel, refreshChannel } = useConnectChannel();
  const [isLoading, setIsLoading] = useState(false);
  const [videos, setVideos] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);

  useEffect(() => {
    if (isConnected && connectedChannel?.channelId) {
      loadChannelVideos();
    }
  }, [isConnected, connectedChannel]);

  async function loadChannelVideos() {
    if (!connectedChannel?.channelId) return;
    setIsLoading(true);
    try {
      const response = await fetch(`/api/youtube/channel-videos?channelId=${connectedChannel.channelId}`);
      const result = await response.json();
      if (result.success && result.data) {
        // Transform API response to flat structure
        const transformedVideos = (result.data.videos || []).map((v: any) => ({
          id: v.id,
          title: v.snippet?.title || "",
          thumbnail: v.snippet?.thumbnails?.medium?.url || v.snippet?.thumbnails?.default?.url || "",
          channelTitle: v.snippet?.channelTitle || "",
          channelId: v.snippet?.channelId || "",
          description: v.snippet?.description || "",
          publishedAt: v.snippet?.publishedAt || "",
          viewCount: parseInt(v.statistics?.viewCount || "0", 10),
          likeCount: parseInt(v.statistics?.likeCount || "0", 10),
          commentCount: parseInt(v.statistics?.commentCount || "0", 10),
          duration: v.contentDetails?.duration || "",
          tags: v.snippet?.tags || [],
        }));
        setVideos(transformedVideos);

        // Calculate stats
        const totalVideos = transformedVideos.length;
        const totalViews = transformedVideos.reduce((sum: number, v: any) => sum + (v.viewCount || 0), 0);
        const avgViews = totalVideos > 0 ? Math.round(totalViews / totalVideos) : 0;
        const totalLikes = transformedVideos.reduce((sum: number, v: any) => sum + (v.likeCount || 0), 0);
        const totalComments = transformedVideos.reduce((sum: number, v: any) => sum + (v.commentCount || 0), 0);
        const engagementRate = totalViews > 0 ? Math.round(((totalLikes + totalComments) / totalViews) * 1000) / 10 : 0;

        setStats({
          totalVideos,
          avgViews,
          engagementRate,
          avgPerformance: 0,
        });
      }
    } catch (error) {
      console.error("Failed to load channel videos:", error);
    } finally {
      setIsLoading(false);
    }
  }

  if (!isAuthenticated) {
    return (
      <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg p-8 text-center">
        <p className="text-white text-lg mb-2">Sign in to connect your channel</p>
        <p className="text-[#888] text-sm mb-6">Link your YouTube channel to get personalized analytics</p>
        <button
          onClick={() => window.location.href = "/auth/login"}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors"
        >
          Sign In
        </button>
      </div>
    );
  }

  if (!isConnected) {
    return (
      <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg p-8 text-center">
        <div className="w-16 h-16 mx-auto mb-4 bg-[#2a2a2a] rounded-full flex items-center justify-center">
          <svg className="w-8 h-8 text-[#666]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
          </svg>
        </div>
        <h3 className="text-white text-lg font-medium mb-2">Connect Your YouTube Channel</h3>
        <p className="text-[#888] text-sm mb-6 max-w-md mx-auto">
          Link your YouTube channel to get personalized analytics, performance insights, and optimization tips.
        </p>
        <button
          onClick={connectChannel}
          disabled={isConnecting}
          className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors"
        >
          {isConnecting ? "Connecting..." : "Connect Channel"}
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Connected Channel Header */}
      <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {connectedChannel?.thumbnail ? (
              <img
                src={connectedChannel.thumbnail}
                alt={connectedChannel.title}
                className="w-12 h-12 rounded-full object-cover"
              />
            ) : (
              <div className="w-12 h-12 rounded-full bg-[#2a2a2a] flex items-center justify-center">
                <span className="text-xl">▶️</span>
              </div>
            )}
            <div>
              <h3 className="text-white font-medium">{connectedChannel?.title}</h3>
              <p className="text-[#888] text-sm">
                {connectedChannel?.subscriberCount?.toLocaleString()} subscribers · {connectedChannel?.videoCount?.toLocaleString()} videos
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => { refreshChannel(); loadChannelVideos(); }}
              disabled={isLoading}
              className="px-3 py-1.5 text-sm text-[#888] hover:text-white transition-colors"
            >
              {isLoading ? "Refreshing..." : "Refresh"}
            </button>
            <button
              onClick={disconnectChannel}
              className="px-3 py-1.5 text-sm text-red-400 hover:text-red-300 transition-colors"
            >
              Disconnect
            </button>
          </div>
        </div>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg p-4 text-center">
            <p className="text-2xl font-bold text-white">{stats.totalVideos}</p>
            <p className="text-xs text-[#888]">Videos</p>
          </div>
          <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg p-4 text-center">
            <p className="text-2xl font-bold text-white">{stats.avgViews?.toLocaleString()}</p>
            <p className="text-xs text-[#888]">Avg Views</p>
          </div>
          <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg p-4 text-center">
            <p className="text-2xl font-bold text-white">{stats.engagementRate}%</p>
            <p className="text-xs text-[#888]">Engagement</p>
          </div>
          <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg p-4 text-center">
            <p className="text-2xl font-bold text-white">{stats.avgPerformance}/100</p>
            <p className="text-xs text-[#888]">Avg Score</p>
          </div>
        </div>
      )}

      {/* Videos Grid */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white" />
        </div>
      ) : videos.length > 0 ? (
        <div className="columns-1 sm:columns-2 lg:columns-3 xl:columns-4 gap-4 space-y-4">
          {videos.map((video: any) => (
            <div key={video.id} className="break-inside-avoid mb-4">
              <div className="bg-[#101010] rounded-xl overflow-hidden border border-[#2a2a2a] hover:border-[#3a3a3a] transition-all duration-200">
                <div className="relative w-full">
                  <img
                    src={video.thumbnail}
                    alt={video.title}
                    className="w-full h-auto object-cover"
                  />
                  {video.duration && (
                    <div className="absolute bottom-2 right-2 bg-black/80 text-white text-xs px-1.5 py-0.5 rounded">
                      {video.duration}
                    </div>
                  )}
                </div>
                <div className="p-3">
                  <h3 className="text-sm font-medium text-white leading-snug line-clamp-2 mb-2">{video.title}</h3>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-[#888]">{video.viewCount?.toLocaleString()} views</span>
                    <span className="text-xs text-[#666]">{video.outlierScore}x outlier</span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-12">
          <p className="text-[#888]">No videos found</p>
        </div>
      )}
    </div>
  );
}
