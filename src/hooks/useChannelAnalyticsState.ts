"use client";

import { useState, useMemo } from "react";
import type { ChannelVideo, ChannelStats } from "@/lib/channel-analytics";

type ContentFilter = "all" | "videos" | "shorts";
type SortOption = "recent" | "topLiked" | "topViewed" | "topOutlier";

export interface ChannelAnalyticsState {
  channelName: string;
  setChannelName: (v: string) => void;
  channelThumbnail: string;
  setChannelThumbnail: (v: string) => void;
  subscriberCount: number;
  setSubscriberCount: (v: number) => void;
  videoCount: number;
  setVideoCount: (v: number) => void;
  videos: ChannelVideo[];
  setVideos: (v: ChannelVideo[]) => void;
  stats: ChannelStats | null;
  setStats: (v: ChannelStats | null) => void;
  isLoading: boolean;
  setIsLoading: (v: boolean) => void;
  selectedVideo: ChannelVideo | null;
  setSelectedVideo: (v: ChannelVideo | null) => void;
  filter: ContentFilter;
  setFilter: (v: ContentFilter) => void;
  sort: SortOption;
  setSort: (v: SortOption) => void;
  searchQuery: string;
  setSearchQuery: (v: string) => void;
  isCompareMode: boolean;
  setIsCompareMode: (v: boolean) => void;
  compareSelection: Set<string>;
  setCompareSelection: (v: Set<string>) => void;
  isCompareModalOpen: boolean;
  setIsCompareModalOpen: (v: boolean) => void;
  filteredAndSortedVideos: ChannelVideo[];
}

export function useChannelAnalyticsState(): ChannelAnalyticsState {
  const [channelName, setChannelName] = useState("");
  const [channelThumbnail, setChannelThumbnail] = useState("");
  const [subscriberCount, setSubscriberCount] = useState(0);
  const [videoCount, setVideoCount] = useState(0);
  const [videos, setVideos] = useState<ChannelVideo[]>([]);
  const [stats, setStats] = useState<ChannelStats | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedVideo, setSelectedVideo] = useState<ChannelVideo | null>(null);
  const [filter, setFilter] = useState<ContentFilter>("all");
  const [sort, setSort] = useState<SortOption>("recent");
  const [searchQuery, setSearchQuery] = useState("");
  const [isCompareMode, setIsCompareMode] = useState(false);
  const [compareSelection, setCompareSelection] = useState<Set<string>>(new Set());
  const [isCompareModalOpen, setIsCompareModalOpen] = useState(false);

  const filteredAndSortedVideos = useMemo(() => {
    let result = [...videos];
    if (filter === "shorts") result = result.filter((v) => v.isShort);
    if (filter === "videos") result = result.filter((v) => !v.isShort);
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter((v) => v.title.toLowerCase().includes(q));
    }
    switch (sort) {
      case "topViewed": result.sort((a, b) => b.viewCount - a.viewCount); break;
      case "topLiked": result.sort((a, b) => (b.likeCount || 0) - (a.likeCount || 0)); break;
      case "topOutlier": result.sort((a, b) => b.outlierScore - a.outlierScore); break;
      default: result.sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime());
    }
    return result;
  }, [videos, filter, sort, searchQuery]);

  return {
    channelName, setChannelName, channelThumbnail, setChannelThumbnail,
    subscriberCount, setSubscriberCount, videoCount, setVideoCount,
    videos, setVideos, stats, setStats, isLoading, setIsLoading,
    selectedVideo, setSelectedVideo, filter, setFilter, sort, setSort,
    searchQuery, setSearchQuery, isCompareMode, setIsCompareMode,
    compareSelection, setCompareSelection, isCompareModalOpen, setIsCompareModalOpen,
    filteredAndSortedVideos,
  };
}
