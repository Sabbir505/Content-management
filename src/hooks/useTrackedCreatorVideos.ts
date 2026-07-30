"use client";

import { useState, useEffect } from "react";
import type { TrackedCreator, CreatorVideo } from "@/types/creator";
import type { VideoWithOutlier } from "@/types/video";
import { calculateVideoDiscoveryScore } from "@/lib/discovery-score";

const MAX_CREATORS = 10;
const FETCH_CONCURRENCY = 4;

interface RouteChannel {
  id: string;
  title: string;
  thumbnail: string;
  subscriberCount: number;
  videoCount: number;
}

interface RouteResponse {
  success: boolean;
  data?: {
    videos: CreatorVideo[];
    channel: RouteChannel;
  };
}

function mapCreatorVideos(videos: CreatorVideo[], channel: RouteChannel): VideoWithOutlier[] {
  const channelAvgViews =
    videos.length > 0
      ? Math.round(videos.reduce((sum, v) => sum + v.viewCount, 0) / videos.length)
      : 0;

  return videos.map((v) => {
    const video: VideoWithOutlier = {
      id: v.id,
      title: v.title,
      channelId: v.creatorId,
      channelTitle: channel.title,
      viewCount: v.viewCount,
      likeCount: v.likeCount,
      commentCount: 0,
      thumbnail: v.thumbnail,
      publishedAt: v.publishedAt,
      duration: v.duration,
      description: "",
      tags: [],
      subscriberCount: channel.subscriberCount,
      channelAvgViews,
      outlierScore: v.outlierScore,
      hookType: v.hookType,
      estimatedStructure: v.estimatedStructure,
    };
    video.discoveryScore = calculateVideoDiscoveryScore(video);
    return video;
  });
}

async function fetchOneCreator(channelId: string, signal?: AbortSignal): Promise<VideoWithOutlier[]> {
  const url = `/api/creators/${encodeURIComponent(channelId)}/videos?channelId=${encodeURIComponent(channelId)}`;
  const response = await fetch(url, { signal });

  // A non-JSON body means the server returned an error page (e.g. a dev-worker
  // crash) rather than our route's JSON — don't try to parse it.
  const contentType = response.headers.get("content-type") || "";
  if (!response.ok || !contentType.includes("application/json")) {
    return [];
  }

  const result: RouteResponse = await response.json().catch(() => ({ success: false }));
  if (!result.success || !result.data) return [];

  return mapCreatorVideos(result.data.videos || [], result.data.channel);
}

async function fetchAllBounded(
  channelIds: string[],
  signal: AbortSignal
): Promise<VideoWithOutlier[]> {
  const results: VideoWithOutlier[] = [];
  for (let i = 0; i < channelIds.length; i += FETCH_CONCURRENCY) {
    if (signal.aborted) break;
    const batch = channelIds.slice(i, i + FETCH_CONCURRENCY);
    const batchResults = await Promise.all(
      batch.map((id) => fetchOneCreator(id, signal).catch(() => []))
    );
    for (const videos of batchResults) {
      for (const video of videos) {
        results.push(video);
      }
    }
  }
  return results;
}

export function useTrackedCreatorVideos(creators: TrackedCreator[]): {
  creatorVideos: VideoWithOutlier[];
  isLoading: boolean;
} {
  const [creatorVideos, setCreatorVideos] = useState<VideoWithOutlier[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Stable identity for the effect: just the channel IDs + count, so adding/removing a
  // creator re-runs the fetch but re-renders that don't change the set don't.
  const channelIds = creators
    .map((c) => c.channelId)
    .filter((id): id is string => !!id)
    .slice(0, MAX_CREATORS);
  const cacheKey = channelIds.join(",");

  useEffect(() => {
    if (channelIds.length === 0) {
      setCreatorVideos([]);
      return;
    }

    const controller = new AbortController();
    setIsLoading(true);

    fetchAllBounded(channelIds, controller.signal)
      .then((all) => {
        if (controller.signal.aborted) return;
        // Dedupe by video id; first occurrence wins (category-search videos, merged
        // separately in the page, are preferred — but within the creator set, dedupe
        // across overlapping creators).
        const seen = new Set<string>();
        const deduped = all.filter((v) => {
          if (seen.has(v.id)) return false;
          seen.add(v.id);
          return true;
        });
        setCreatorVideos(deduped);
      })
      .finally(() => {
        if (!controller.signal.aborted) setIsLoading(false);
      });

    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cacheKey]);

  return { creatorVideos, isLoading };
}
