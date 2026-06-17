import { getYouTubeClient } from "./youtube-client";
import { calculateOutlierScore, estimateHookType, estimateStructure } from "./outlier";
import { proxyFetch } from "./proxy";
import * as memoryCache from "./quality/cache";
import { calculateVideoDiscoveryScore } from "./discovery-score";
import type { VideoWithOutlier } from "@/types/video";
import type { YouTubeSearchResult, YouTubeSearchError } from "./quality/types";

const MEMORY_CACHE_TTL = 30 * 60 * 1000; // 30 minutes

interface SearchFilters {
  niche: string;
  timeRange: "day" | "week" | "month" | "year";
  language: "any" | "en";
}

function getPublishedAfter(timeRange: string): Date | null {
  const now = new Date();
  switch (timeRange) {
    case "day":
      return new Date(now.getTime() - 24 * 60 * 60 * 1000);
    case "week":
      return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    case "month":
      return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    case "year":
      return new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
    default:
      return null;
  }
}

function parseYouTubeDuration(durationText: string): number {
  // Handle formats like "1:23:45", "12:34", "1h 23m 45s"
  const parts = durationText.split(":").map(Number);
  if (parts.length === 3) {
    return parts[0] * 3600 + parts[1] * 60 + parts[2];
  } else if (parts.length === 2) {
    return parts[0] * 60 + parts[1];
  }
  return 0;
}

export function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  }
  return `${minutes}:${secs.toString().padStart(2, "0")}`;
}

function parseViewCount(viewText: string): number {
  if (!viewText) return 0;
  const cleaned = viewText.replace(/[^\d]/g, "");
  return parseInt(cleaned) || 0;
}

function parsePublishedDate(dateText: string): string {
  const now = new Date();
  const lower = dateText.toLowerCase();

  if (lower.includes("year")) {
    const match = lower.match(/(\d+)/);
    const years = match ? parseInt(match[1]) : 1;
    return new Date(now.getTime() - years * 365 * 24 * 60 * 60 * 1000).toISOString();
  }
  if (lower.includes("month")) {
    const match = lower.match(/(\d+)/);
    const months = match ? parseInt(match[1]) : 1;
    return new Date(now.getTime() - months * 30 * 24 * 60 * 60 * 1000).toISOString();
  }
  if (lower.includes("week")) {
    const match = lower.match(/(\d+)/);
    const weeks = match ? parseInt(match[1]) : 1;
    return new Date(now.getTime() - weeks * 7 * 24 * 60 * 60 * 1000).toISOString();
  }
  if (lower.includes("day")) {
    const match = lower.match(/(\d+)/);
    const days = match ? parseInt(match[1]) : 1;
    return new Date(now.getTime() - days * 24 * 60 * 60 * 1000).toISOString();
  }
  if (lower.includes("hour")) {
    const match = lower.match(/(\d+)/);
    const hours = match ? parseInt(match[1]) : 1;
    return new Date(now.getTime() - hours * 60 * 60 * 1000).toISOString();
  }
  if (lower.includes("minute")) {
    const match = lower.match(/(\d+)/);
    const minutes = match ? parseInt(match[1]) : 1;
    return new Date(now.getTime() - minutes * 60 * 1000).toISOString();
  }
  if (lower.includes("streamed") || lower.includes("live")) {
    return now.toISOString();
  }

  if (!isNaN(Date.parse(dateText))) {
    return new Date(dateText).toISOString();
  }

  return now.toISOString();
}

function parseQuotaError(error: unknown): YouTubeSearchError {
  const errorMessage = error instanceof Error ? error.message : String(error);

  if (
    errorMessage.includes("429") ||
    errorMessage.includes("rate") ||
    errorMessage.includes("too many")
  ) {
    return {
      type: "rate_limited",
      message: "Rate limited by YouTube. Please try again later.",
      retryAfter: 60,
      isQuotaExceeded: false,
    };
  }

  return {
    type: "api_error",
    message: errorMessage,
    isQuotaExceeded: false,
  };
}

function buildMemoryCacheKey(query: string, filters: SearchFilters): string {
  return `ytsearch:${query.toLowerCase()}:${filters.niche}:${filters.timeRange}:${filters.language}`;
}

export async function searchYouTubeVideos(
  query: string,
  filters: SearchFilters
): Promise<YouTubeSearchResult> {
  const memoryCacheKey = buildMemoryCacheKey(query, filters);

  // Check in-memory cache
  const memoryCached = memoryCache.get<YouTubeSearchResult>(memoryCacheKey);
  if (memoryCached) {
    return { ...memoryCached, fromCache: true };
  }

  // Fetch from YouTube.js
  const yt = await getYouTubeClient();
  const publishedAfter = getPublishedAfter(filters.timeRange);
  const nicheQuery = filters.niche !== "all" ? `${query} ${filters.niche}` : query;

  try {
    const searchResults = await yt.search(nicheQuery, {
      type: "video",
    });

    const videoPromises = searchResults.videos
      .filter((video: any) => {
        // Filter by duration (skip shorts)
        const durationText = video.duration?.text || "0:00";
        const durationSeconds = parseYouTubeDuration(durationText);
        return durationSeconds >= 60;
      })
      .map(async (video: any) => {
        const viewCount = parseViewCount(video.view_count?.text || "0");
        const durationText = video.duration?.text || "0:00";
        const durationSeconds = parseYouTubeDuration(durationText);
        const publishedAt = parsePublishedDate(video.published?.text || "");

        // For outlier score, we need channel stats - fetch channel data for accurate calculation
        let channelAvgViews = viewCount * 0.1; // Fallback rough estimate
        let outlierScore = 1.0;
        try {
          const channelInfo = await yt.getChannel(video.author?.id || "");
          if (channelInfo && (channelInfo as any).metadata) {
            const metadata = (channelInfo as any).metadata;
            const totalViews = parseInt(metadata.view_count?.toString() || "0", 10);
            const totalVideos = parseInt(metadata.total_videos?.toString() || "0", 10);
            if (totalVideos > 0 && totalViews > 0) {
              channelAvgViews = totalViews / totalVideos;
            }
          }
        } catch {
          // Fallback to rough estimate if channel fetch fails
        }
        outlierScore = calculateOutlierScore(viewCount, channelAvgViews);

        const videoData: VideoWithOutlier = {
          id: video.id,
          title: video.title?.text || "",
          channelTitle: video.author?.name || "",
          channelId: video.author?.id || "",
          viewCount,
          likeCount: 0, // Not available in search results
          commentCount: 0, // Not available in search results
          thumbnail: video.thumbnails[0]?.url || "",
          publishedAt,
          duration: formatDuration(durationSeconds),
          description: video.description_snippet?.text || "",
          tags: [], // Not available in search results
          channelAvgViews: Math.round(channelAvgViews),
          outlierScore,
          hookType: estimateHookType(video.title?.text || ""),
          estimatedStructure: estimateStructure(video.title?.text || ""),
        };

        return {
          ...videoData,
          discoveryScore: calculateVideoDiscoveryScore(videoData),
        };
      });

    const formattedVideos = await Promise.all(videoPromises);

    // Sort by discovery score
    formattedVideos.sort((a, b) => (b.discoveryScore || 0) - (a.discoveryScore || 0));

    const result: YouTubeSearchResult = {
      query,
      videos: formattedVideos,
      fromCache: false,
      fetchedAt: new Date().toISOString(),
    };

    memoryCache.set(memoryCacheKey, result, MEMORY_CACHE_TTL);

    return result;
  } catch (error) {
    throw parseQuotaError(error);
  }
}

export async function getVideoDetails(videoIds: string[]) {
  const yt = await getYouTubeClient();
  const details = [];

  for (const videoId of videoIds) {
    try {
      const info = await yt.getInfo(videoId);
      const basicInfo = info.basic_info;

      details.push({
        id: videoId,
        snippet: {
          title: basicInfo.title,
          channelId: basicInfo.channel_id,
          channelTitle: basicInfo.author,
          description: basicInfo.short_description,
          publishedAt: (basicInfo as any).publish_date || new Date().toISOString(),
          thumbnails: {
            medium: {
              url: basicInfo.thumbnail?.[0]?.url || "",
            },
          },
          tags: basicInfo.tags || [],
        },
        statistics: {
          viewCount: basicInfo.view_count?.toString() || "0",
          likeCount: "0", // May need separate fetch
          commentCount: "0", // May need separate fetch
        },
        contentDetails: {
          duration: `PT${basicInfo.duration || 0}S`,
        },
      });
    } catch (error) {
      console.error(`Failed to get details for video ${videoId}:`, error);
    }
  }

  return details;
}

export async function getChannelDetails(channelIds: string[]) {
  const yt = await getYouTubeClient();
  const details = [];

  for (const channelId of channelIds) {
    try {
      const channel = await yt.getChannel(channelId);
      const metadata = channel.metadata;

      details.push({
        id: channelId,
        statistics: {
          viewCount: (metadata as any).view_count?.toString() || "0",
          subscriberCount: (metadata as any).subscriber_count?.toString() || "0",
          videoCount: (metadata as any).total_videos?.toString() || "0",
        },
        snippet: {
          title: metadata.title,
          description: metadata.description,
          thumbnails: {
            default: {
              url: metadata.avatar?.[0]?.url || "",
            },
          },
        },
      });
    } catch (error) {
      console.error(`Failed to get details for channel ${channelId}:`, error);
    }
  }

  return details;
}

export function parseDuration(duration: string): number {
  const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return 0;
  const hours = parseInt(match[1] || "0");
  const minutes = parseInt(match[2] || "0");
  const seconds = parseInt(match[3] || "0");
  return hours * 3600 + minutes * 60 + seconds;
}
