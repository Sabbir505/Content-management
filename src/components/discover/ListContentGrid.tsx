"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { VideoCard } from "./VideoCard";
import { toast } from "sonner";
import * as memoryCache from "@/lib/quality/cache";
import type { CreatorList, TrackedCreator, CreatorVideo } from "@/types/creator";
import type { VideoWithOutlier } from "@/types/video";
import { useAuth } from "@/hooks/useAuth";
import { useBoardSave } from "@/hooks/useBoardSave";

const VIDEO_CACHE_TTL = 8 * 60 * 60 * 1000; // 8 hours

function getCacheKey(channelId: string): string {
  return `list-content-videos:${channelId}`;
}

interface ListContentGridProps {
  list: CreatorList;
  creators: TrackedCreator[];
  onBack: () => void;
  onChatOpen?: (video: VideoWithOutlier, initialPrompt?: string) => void;
}

type VideoFilter = "recent" | "topLiked" | "topViewed" | "topOutlier";

export function ListContentGrid({ list, creators, onBack, onChatOpen }: ListContentGridProps) {
  const [videosByCreator, setVideosByCreator] = useState<Record<string, CreatorVideo[]>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [activeFilter, setActiveFilter] = useState<VideoFilter>("recent");

  const listCreators = useMemo(() => {
    return creators.filter((c) => list.creatorIds.includes(c.channelId));
  }, [creators, list.creatorIds]);

  const loadVideos = useCallback(
    async (force = false) => {
      if (listCreators.length === 0) {
        setIsLoading(false);
        return;
      }

      if (force) {
        setIsRefreshing(true);
        for (const creator of listCreators) {
          memoryCache.deleteKey(getCacheKey(creator.channelId));
        }
      } else {
        setIsLoading(true);
      }

      // Load cached videos first so the UI appears instantly on revisits
      const cachedResults: Record<string, CreatorVideo[]> = {};
      const creatorsToFetch: TrackedCreator[] = [];

      for (const creator of listCreators) {
        if (force) {
          creatorsToFetch.push(creator);
          continue;
        }
        const cached = memoryCache.get<CreatorVideo[]>(getCacheKey(creator.channelId));
        if (cached) {
          cachedResults[creator.channelId] = cached;
        } else {
          creatorsToFetch.push(creator);
        }
      }

      if (Object.keys(cachedResults).length > 0) {
        setVideosByCreator((prev) => ({ ...prev, ...cachedResults }));
        if (creatorsToFetch.length === 0) {
          setIsLoading(false);
          return;
        }
      }

      const fetchedResults: Record<string, CreatorVideo[]> = {};

      await Promise.all(
        listCreators.map(async (creator) => {
          try {
            const response = await fetch(`/api/creators/${creator.channelId}/videos?channelId=${creator.channelId}`);
            const result = await response.json();
            if (result.success && Array.isArray(result.data?.videos)) {
              fetchedResults[creator.channelId] = result.data.videos;
              memoryCache.set(getCacheKey(creator.channelId), result.data.videos, VIDEO_CACHE_TTL);
            }
          } catch {
            // Skip creators that fail to load
          }
        })
      );

      setVideosByCreator((prev) => {
        const next: Record<string, CreatorVideo[]> = {};
        for (const creator of listCreators) {
          next[creator.channelId] = fetchedResults[creator.channelId] || prev[creator.channelId] || [];
        }
        return next;
      });

      setIsLoading(false);
      setIsRefreshing(false);
    },
    [listCreators]
  );

  useEffect(() => {
    // Defer so setState inside loadVideos doesn't run synchronously in the effect
    queueMicrotask(() => void loadVideos(false));
  }, [loadVideos]);

  async function handleHardRefresh() {
    await loadVideos(true);
    toast.success("Refreshed latest videos");
  }

  const allVideos = useMemo(() => {
    const videos: VideoWithOutlier[] = [];

    for (const creator of listCreators) {
      const creatorVideos = videosByCreator[creator.channelId] || [];
      for (const video of creatorVideos) {
        videos.push({
          id: video.id,
          title: video.title,
          channelTitle: creator.channelTitle,
          channelId: creator.channelId,
          viewCount: video.viewCount,
          likeCount: video.likeCount,
          commentCount: 0,
          thumbnail: video.thumbnail,
          publishedAt: video.publishedAt,
          duration: video.duration,
          description: "",
          tags: [],
          subscriberCount: creator.subscriberCount,
          channelAvgViews: 0,
          outlierScore: video.outlierScore,
          hookType: video.hookType,
          estimatedStructure: video.estimatedStructure,
        });
      }
    }

    const sorted = [...videos];
    switch (activeFilter) {
      case "recent":
        sorted.sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime());
        break;
      case "topLiked":
        sorted.sort((a, b) => (b.likeCount || 0) - (a.likeCount || 0));
        break;
      case "topViewed":
        sorted.sort((a, b) => b.viewCount - a.viewCount);
        break;
      case "topOutlier":
        sorted.sort((a, b) => b.outlierScore - a.outlierScore);
        break;
    }

    return sorted;
  }, [listCreators, videosByCreator, activeFilter]);

  const { user } = useAuth();
  const { saveVideo } = useBoardSave(user?.uid);

  function handleSaveVideo(video: VideoWithOutlier) {
    void saveVideo(video);
  }

  const filters: { id: VideoFilter; label: string }[] = [
    { id: "recent", label: "Recent" },
    { id: "topLiked", label: "Top liked" },
    { id: "topViewed", label: "Top viewed" },
    { id: "topOutlier", label: "Top outlier" },
  ];

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={onBack}
            className="text-[#888] hover:text-white hover:bg-[#2a2a2a]"
          >
            <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 19l-7-7 7-7" />
            </svg>
            All Lists
          </Button>
        </div>
        <div className="flex justify-center py-12">
          <div className="animate-spin h-8 w-8 border-b-2 border-white rounded-full" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={onBack}
            className="self-start text-[#888] hover:text-white hover:bg-[#2a2a2a] px-2"
          >
            <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 19l-7-7 7-7" />
            </svg>
            All Lists
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={() => void handleHardRefresh()}
            disabled={isRefreshing}
            className="text-[#888] hover:text-white hover:bg-[#2a2a2a]"
          >
            <svg
              className={`w-4 h-4 mr-1 ${isRefreshing ? "animate-spin" : ""}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
              />
            </svg>
            Refresh
          </Button>
        </div>

        <div className="flex items-center gap-2">
          {filters.map((filter) => (
            <button
              key={filter.id}
              onClick={() => setActiveFilter(filter.id)}
              className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
                activeFilter === filter.id
                  ? "bg-white text-black"
                  : "bg-[#1a1a1a] text-[#ccc] hover:text-white border border-[#2a2a2a]"
              }`}
            >
              {filter.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium text-white">{list.name}</h3>
        <span className="text-sm text-[#666]">{listCreators.length} creators · {allVideos.length} videos</span>
      </div>

      {allVideos.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-[#888]">No videos found in this list yet.</p>
        </div>
      ) : (
        <div className="columns-1 sm:columns-2 lg:columns-3 xl:columns-4 gap-4 space-y-4">
          {allVideos.map((video) => (
            <div key={video.id} className="break-inside-avoid mb-4">
              <VideoCard video={video} onSave={handleSaveVideo} onChatOpen={onChatOpen} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
