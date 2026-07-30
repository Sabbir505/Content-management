"use client";

import { useState, useMemo } from "react";
import type { VideoWithOutlier } from "@/types/video";
import type { ContentItem } from "@/types/content";
import { calculateContentDiscoveryScore, calculateVideoDiscoveryScore } from "@/lib/discovery-score";
import { isItemBlocked, detectLanguage } from "@/lib/blocklist";
import {
  getTimePeriodCutoff,
  getOutlierMin,
  platformsToSources,
  parseDurationToSeconds,
  getAgeHours,
} from "@/lib/discovery/time-periods";

export type SortOption = "discovery" | "trending" | "top" | "recent" | "discussed";
export type ContentType = "videos" | "articles" | "all";
export type FormatFilter =
  | "all"
  | "videos"
  | "articles"
  | "shorts"
  | "notes"
  | "reels"
  | "carousel"
  | "photos";

interface UseDiscoverFiltersArgs {
  videos: VideoWithOutlier[];
  contentItems: ContentItem[];
  searchQuery: string;
  sortBy: SortOption;
  blocklistVersion: number;
}

interface UseDiscoverFiltersResult {
  selectedPlatforms: string[];
  setSelectedPlatforms: React.Dispatch<React.SetStateAction<string[]>>;
  selectedFormat: FormatFilter;
  setSelectedFormat: React.Dispatch<React.SetStateAction<FormatFilter>>;
  selectedLanguage: string;
  setSelectedLanguage: React.Dispatch<React.SetStateAction<string>>;
  selectedFollowers: string;
  setSelectedFollowers: React.Dispatch<React.SetStateAction<string>>;
  followerMin: string;
  setFollowerMin: React.Dispatch<React.SetStateAction<string>>;
  followerMax: string;
  setFollowerMax: React.Dispatch<React.SetStateAction<string>>;
  selectedOutlier: string;
  setSelectedOutlier: React.Dispatch<React.SetStateAction<string>>;
  selectedTimePeriod: string;
  setSelectedTimePeriod: React.Dispatch<React.SetStateAction<string>>;
  showFilters: boolean;
  setShowFilters: React.Dispatch<React.SetStateAction<boolean>>;
  filteredVideos: VideoWithOutlier[];
  filteredArticles: ContentItem[];
  unifiedItems: Array<
    (VideoWithOutlier & { contentType: "video"; discoveryScore: number }) |
    (ContentItem & { contentType: "article"; discoveryScore: number })
  >;
  sortedVideos: VideoWithOutlier[];
  sortedArticles: ContentItem[];
}

export function useDiscoverFilters({
  videos,
  contentItems,
  searchQuery,
  sortBy,
  blocklistVersion,
}: UseDiscoverFiltersArgs): UseDiscoverFiltersResult {
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>([
    "youtube",
    "hackernews",
    "devto",
    "substack",
  ]);
  const [selectedFormat, setSelectedFormat] = useState<FormatFilter>("all");
  const [selectedLanguage, setSelectedLanguage] = useState("en");
  const [selectedFollowers, setSelectedFollowers] = useState("any");
  const [followerMin, setFollowerMin] = useState("50000");
  const [followerMax, setFollowerMax] = useState("8000000");
  const [selectedOutlier, setSelectedOutlier] = useState("any");
  const [selectedTimePeriod, setSelectedTimePeriod] = useState("all");
  const [showFilters, setShowFilters] = useState(false);

  const filteredVideos = useMemo(() => {
    let filtered = [...videos];
    filtered = filtered.filter((v) =>
      !isItemBlocked({ itemId: v.id, creatorId: v.channelId, title: v.title })
    );
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (v) => v.title.toLowerCase().includes(q) || (v.channelTitle || "").toLowerCase().includes(q)
      );
    }
    if (selectedLanguage !== "any") {
      filtered = filtered.filter(
        (v) => detectLanguage(v.title + " " + (v.description || "")) === selectedLanguage
      );
    }
    if (selectedFollowers === "custom") {
      const min = parseInt(followerMin) || 0;
      const max = parseInt(followerMax) || Infinity;
      filtered = filtered.filter((v) => {
        const subs = v.subscriberCount || 0;
        return subs >= min && subs <= max;
      });
    }
    if (selectedOutlier !== "any") {
      const minOutlier = getOutlierMin(selectedOutlier);
      filtered = filtered.filter((v) => (v.outlierScore || 0) >= minOutlier);
    }
    if (!selectedPlatforms.includes("youtube")) {
      filtered = [];
    }
    if (selectedFormat === "shorts") {
      filtered = filtered.filter((v) => parseDurationToSeconds(v.duration) <= 60);
    } else if (selectedFormat === "videos") {
      filtered = filtered.filter((v) => parseDurationToSeconds(v.duration) > 60);
    }
    const periodCutoff = getTimePeriodCutoff(selectedTimePeriod);
    if (periodCutoff !== -Infinity) {
      filtered = filtered.filter((v) => new Date(v.publishedAt).getTime() >= periodCutoff);
    }
    return filtered;
  }, [
    videos,
    searchQuery,
    selectedOutlier,
    selectedPlatforms,
    selectedFormat,
    selectedTimePeriod,
    blocklistVersion,
    selectedLanguage,
    selectedFollowers,
    followerMin,
    followerMax,
  ]);

  const filteredArticles = useMemo(() => {
    let filtered = [...contentItems];
    filtered = filtered.filter((item) =>
      !isItemBlocked({ itemId: item.id, creatorId: item.author, title: item.title })
    );
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (item) =>
          item.title.toLowerCase().includes(q) || (item.author || "").toLowerCase().includes(q)
      );
    }
    if (selectedLanguage !== "any") {
      filtered = filtered.filter(
        (item) => detectLanguage(item.title + " " + (item.description || "")) === selectedLanguage
      );
    }
    if (selectedFormat === "articles" || selectedFormat === "notes") {
      filtered = filtered.filter((item) => item.source === "substack");
    }
    const activeSources = platformsToSources(selectedPlatforms);
    if (activeSources.length > 0) {
      filtered = filtered.filter((item) => activeSources.includes(item.source));
    }
    const periodCutoff = getTimePeriodCutoff(selectedTimePeriod);
    if (periodCutoff !== -Infinity) {
      filtered = filtered.filter((item) => new Date(item.publishedAt).getTime() >= periodCutoff);
    }
    return filtered;
  }, [
    contentItems,
    searchQuery,
    selectedPlatforms,
    selectedTimePeriod,
    blocklistVersion,
    selectedLanguage,
    selectedFormat,
  ]);

  const unifiedItems = useMemo(() => {
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
          const aVel = (a.contentType === "video" ? a.viewCount : a.score) / Math.max(getAgeHours(a.publishedAt), 0.01);
          const bVel = (b.contentType === "video" ? b.viewCount : b.score) / Math.max(getAgeHours(b.publishedAt), 0.01);
          return bVel - aVel;
        });
        break;
      case "recent":
        combined.sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime());
        break;
      case "discussed":
        combined.sort((a, b) => {
          const aC = a.contentType === "video" ? (a.commentCount || 0) : (a.score || 0);
          const bC = b.contentType === "video" ? (b.commentCount || 0) : (b.score || 0);
          return bC - aC;
        });
        break;
      case "top":
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
          const aVel = (a.viewCount || 0) / Math.max(getAgeHours(a.publishedAt), 0.01);
          const bVel = (b.viewCount || 0) / Math.max(getAgeHours(b.publishedAt), 0.01);
          return bVel - aVel;
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
          const aVel = (a.score || 0) / Math.max(getAgeHours(a.publishedAt), 0.01);
          const bVel = (b.score || 0) / Math.max(getAgeHours(b.publishedAt), 0.01);
          return bVel - aVel;
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

  return {
    selectedPlatforms,
    setSelectedPlatforms,
    selectedFormat,
    setSelectedFormat,
    selectedLanguage,
    setSelectedLanguage,
    selectedFollowers,
    setSelectedFollowers,
    followerMin,
    setFollowerMin,
    followerMax,
    setFollowerMax,
    selectedOutlier,
    setSelectedOutlier,
    selectedTimePeriod,
    setSelectedTimePeriod,
    showFilters,
    setShowFilters,
    filteredVideos,
    filteredArticles,
    unifiedItems,
    sortedVideos,
    sortedArticles,
  };
}
