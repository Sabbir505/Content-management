import { getYouTubeClient } from "./youtube-client";
import {
  calculateOutlierScore,
  estimateHookType,
  estimateStructure,
  calculateSubscriberWeightedOutlier,
} from "./outlier";
import * as memoryCache from "./quality/cache";
import { calculateVideoDiscoveryScore } from "./discovery-score";
import type { VideoWithOutlier } from "@/types/video";
import type { YouTubeSearchResult, YouTubeSearchError } from "./quality/types";
import { parseViewCount, parsePublishedDate } from "./youtube-parsers";

const MEMORY_CACHE_TTL = 30 * 60 * 1000; // 30 minutes

// Minimal shapes for youtubei.js responses whose exported types omit these fields
interface YtVideoSearchResult {
  id: string;
  title?: { text: string };
  author?: { id: string; name: string };
  duration?: { text: string };
  view_count?: { text: string };
  published?: { text: string };
  description_snippet?: { text: string };
  thumbnails: { url: string }[];
}

interface YtChannelMetadata {
  view_count?: number | string;
  subscriber_count?: number | string;
  total_videos?: number | string;
  title: string;
  description: string;
  avatar?: { url: string }[];
}

interface YtBasicVideoInfo {
  title: string;
  channel_id: string;
  author: string;
  short_description: string;
  publish_date?: string;
  thumbnail?: { url: string }[];
  tags?: string[];
  duration?: number;
  view_count?: number | string;
}

interface SearchFilters {
  niche: string;
  timeRange: "day" | "week" | "month" | "year";
  language: "any" | "en";
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

export function extractVideoId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/watch\?.*v=([a-zA-Z0-9_-]{11})/,
  ];
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  return null;
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
  // v2: includes date parsing fix - old v1 cache entries are invalidated
  return `ytsearch:v2:${query.toLowerCase()}:${filters.niche}:${filters.timeRange}:${filters.language}`;
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
  const nicheQuery = filters.niche !== "all" ? `${query} ${filters.niche}` : query;

  try {
    const searchResults = await yt.search(nicheQuery, {
      type: "video",
    });

    // youtubei.js types search results as a heterogeneous union that omits
    // the fields we need (duration, view_count, published) on some members,
    // so cast each video to a uniform shape we know the library returns.
    const videoPromises = searchResults.videos
      .filter((raw) => {
        const video = raw as unknown as YtVideoSearchResult;
        // Filter by duration (skip shorts)
        const durationText = video.duration?.text || "0:00";
        const durationSeconds = parseYouTubeDuration(durationText);
        return durationSeconds >= 60;
      })
      .map(async (raw) => {
        const video = raw as unknown as YtVideoSearchResult;
        const viewCount = parseViewCount(video.view_count?.text || "0");
        const durationText = video.duration?.text || "0:00";
        const durationSeconds = parseYouTubeDuration(durationText);
        const publishedAt = parsePublishedDate(video.published?.text || "");

        // For outlier score, we need channel stats - fetch channel data for accurate calculation
        let channelAvgViews = 0; // Start at 0 = unknown, don't fake it
        let subscriberCount = 0;
        let outlierScore = 0;
        try {
          const channelInfo = await yt.getChannel(video.author?.id || "");
          if (channelInfo && (channelInfo as { metadata?: YtChannelMetadata }).metadata) {
            const metadata = (channelInfo as { metadata: YtChannelMetadata }).metadata;
            const totalViews = parseInt(metadata.view_count?.toString() || "0", 10);
            const totalVideos = parseInt(metadata.total_videos?.toString() || "0", 10);
            if (totalVideos > 0 && totalViews > 0) {
              channelAvgViews = totalViews / totalVideos;
            }
            subscriberCount = parseInt(metadata.subscriber_count?.toString() || "0", 10);
          }
        } catch {
          // Channel fetch failed, outlierScore stays 0 (unknown)
        }
        outlierScore = channelAvgViews > 0 ? calculateOutlierScore(viewCount, channelAvgViews) : 0;
        const subscriberWeightedOutlier = subscriberCount > 0 && outlierScore > 0
          ? calculateSubscriberWeightedOutlier(outlierScore, subscriberCount)
          : outlierScore;

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
          subscriberCount,
          channelAvgViews: Math.round(channelAvgViews),
          outlierScore,
          subscriberWeightedOutlier,
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
          publishedAt: (basicInfo as YtBasicVideoInfo).publish_date || new Date().toISOString(),
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
          viewCount: (metadata as YtChannelMetadata).view_count?.toString() || "0",
          subscriberCount: (metadata as YtChannelMetadata).subscriber_count?.toString() || "0",
          videoCount: (metadata as YtChannelMetadata).total_videos?.toString() || "0",
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
