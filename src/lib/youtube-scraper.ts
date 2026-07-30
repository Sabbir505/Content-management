import { rateLimiter } from "./rate-limiter";
import { proxyFetch } from "./proxy";
import {
  calculateOutlierScore,
  estimateHookType,
  estimateStructure,
  calculateSubscriberWeightedOutlier,
} from "./outlier";
import { calculateVideoDiscoveryScore } from "./discovery-score";
import { formatDuration } from "./youtube";
import { parseViewCount, parsePublishedDate } from "./youtube-parsers";
import { parseDurationToSeconds } from "./discovery/time-periods";
import type { VideoWithOutlier } from "@/types/video";
import type { YouTubeSearchResult } from "./quality/types";

interface SearchFilters {
  niche: string;
  timeRange: "day" | "week" | "month" | "3months" | "year";
  language: "any" | "en";
}

// In-memory cache for channel stats to avoid repeated fetches
interface ChannelStats {
  avgViews: number;
  subscriberCount: number;
  fetchedAt: number;
}
const channelStatsCache = new Map<string, ChannelStats>();
const CHANNEL_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

function getCachedChannelStats(channelId: string): ChannelStats | null {
  const cached = channelStatsCache.get(channelId);
  if (!cached) return null;
  if (Date.now() - cached.fetchedAt > CHANNEL_CACHE_TTL) {
    channelStatsCache.delete(channelId);
    return null;
  }
  return cached;
}

function setCachedChannelStats(channelId: string, stats: ChannelStats): void {
  channelStatsCache.set(channelId, stats);
}

async function fetchChannelStatsScrape(channelId: string): Promise<ChannelStats | null> {
  const cached = getCachedChannelStats(channelId);
  if (cached) return cached;

  try {
    const channelUrl = `https://www.youtube.com/channel/${channelId}/videos`;
    const response = await proxyFetch(channelUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept-Language": "en-US,en;q=0.9",
      },
      timeout: 15000,
    });

    if (!response.ok) return null;

    const html = await response.text();
    const ytDataMatch = html.match(/var ytInitialData = ({.*?});<\/script>/);
    if (!ytDataMatch) return null;

    const ytData = JSON.parse(ytDataMatch[1]);

    // Extract subscriber count from channel metadata
    const header = ytData?.header?.c4TabbedHeaderRenderer || ytData?.header?.pageHeaderRenderer;
    let subscriberCount = 0;
    const subscriberText = header?.subscriberCountText?.simpleText || "";
    const subscriberMatch = subscriberText.match(/([\d.]+)\s*([KMB]?)/i);
    if (subscriberMatch) {
      const num = parseFloat(subscriberMatch[1]);
      const suffix = subscriberMatch[2].toUpperCase();
      const multipliers: Record<string, number> = { "": 1, K: 1_000, M: 1_000_000, B: 1_000_000_000 };
      subscriberCount = Math.round(num * (multipliers[suffix] || 1));
    }

    // Extract recent video view counts to estimate channel average
    const tabs = ytData?.contents?.twoColumnBrowseResultsRenderer?.tabs;
    let totalViews = 0;
    let videoCount = 0;

    if (tabs && Array.isArray(tabs)) {
      for (const tab of tabs) {
        const contents = tab?.tabRenderer?.content?.sectionListRenderer?.contents;
        if (contents && Array.isArray(contents)) {
          for (const section of contents) {
            const items = section?.itemSectionRenderer?.contents;
            if (items && Array.isArray(items)) {
              for (const item of items) {
                const grid = item?.gridRenderer?.items || item?.shelfRenderer?.content?.gridRenderer?.items;
                if (grid && Array.isArray(grid)) {
                  for (const gridItem of grid) {
                    const renderer = gridItem?.gridVideoRenderer;
                    if (renderer) {
                      const viewText = renderer?.viewCountText?.simpleText || "";
                      const views = parseViewCount(viewText);
                      if (views > 0) {
                        totalViews += views;
                        videoCount++;
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    }

    const avgViews = videoCount > 0 ? Math.round(totalViews / videoCount) : 0;
    const stats: ChannelStats = { avgViews, subscriberCount, fetchedAt: Date.now() };
    setCachedChannelStats(channelId, stats);
    return stats;
  } catch (error) {
    console.error(`Failed to fetch channel stats for ${channelId}:`, error);
    return null;
  }
}


function extractVideoDataFromHtml(html: string): VideoWithOutlier[] {
  const videos: VideoWithOutlier[] = [];

  // Try to extract ytInitialData from the HTML
  const ytDataMatch = html.match(/var ytInitialData = ({.*?});<\/script>/);
  if (ytDataMatch) {
    try {
      const ytData = JSON.parse(ytDataMatch[1]);
      const contents = ytData?.contents?.twoColumnSearchResultsRenderer?.primaryContents?.sectionListRenderer?.contents;

      if (contents && Array.isArray(contents)) {
        for (const section of contents) {
          const items = section?.itemSectionRenderer?.contents;
          if (items && Array.isArray(items)) {
            for (const item of items) {
              const videoRenderer = item?.videoRenderer;
              if (videoRenderer) {
                const videoId = videoRenderer?.videoId;
                const title = videoRenderer?.title?.runs?.[0]?.text || "";
                const channelTitle = videoRenderer?.ownerText?.runs?.[0]?.text || "";
                const channelId = videoRenderer?.ownerText?.runs?.[0]?.navigationEndpoint?.browseEndpoint?.browseId || "";
                const viewCountText = videoRenderer?.viewCountText?.simpleText || "";
                const viewCount = parseViewCount(viewCountText);
                const publishedText = videoRenderer?.publishedTimeText?.simpleText || "";
                const durationText = videoRenderer?.lengthText?.simpleText || "0:00";
                const durationSeconds = parseDurationToSeconds(durationText);
                const description = videoRenderer?.detailedMetadataSnippets?.[0]?.snippetText?.runs?.[0]?.text ||
                                      videoRenderer?.descriptionSnippet?.runs?.[0]?.text || "";
                const thumbnail = videoRenderer?.thumbnail?.thumbnails?.[videoRenderer.thumbnail.thumbnails.length - 1]?.url ||
                                    videoRenderer?.thumbnail?.thumbnails?.[0]?.url || "";

                // Skip shorts (under 60 seconds AND duration available)
                if (durationSeconds > 0 && durationSeconds < 60) continue;

                // Try to get real channel stats; fallback to estimate
                const channelStats = channelId ? getCachedChannelStats(channelId) : null;
                const channelAvgViews = channelStats?.avgViews ?? 0; // Use 0 to signal "unknown" instead of fake 10x
                const subscriberCount = channelStats?.subscriberCount ?? 0;
                const outlierScore = channelAvgViews > 0
                  ? calculateOutlierScore(viewCount, channelAvgViews)
                  : 0; // 0 = unknown, don't show fake outlier
                const subscriberWeightedOutlier = subscriberCount > 0 && outlierScore > 0
                  ? calculateSubscriberWeightedOutlier(outlierScore, subscriberCount)
                  : outlierScore;

                const videoData: VideoWithOutlier = {
                  id: videoId,
                  title,
                  channelTitle,
                  channelId,
                  viewCount,
                  likeCount: 0,
                  commentCount: 0,
                  thumbnail,
                  publishedAt: parsePublishedDate(publishedText),
                  duration: formatDuration(durationSeconds),
                  description,
                  tags: [],
                  subscriberCount,
                  channelAvgViews: Math.round(channelAvgViews),
                  outlierScore,
                  subscriberWeightedOutlier,
                  hookType: estimateHookType(title),
                  estimatedStructure: estimateStructure(title),
                };

                videoData.discoveryScore = calculateVideoDiscoveryScore(videoData);
                videos.push(videoData);
              }
            }
          }
        }
      }
    } catch (error) {
      console.error("Error parsing ytInitialData:", error);
    }
  }

  return videos;
}

function getTimeRangeCutoff(timeRange: "day" | "week" | "month" | "3months" | "year"): Date {
  const now = new Date();
  switch (timeRange) {
    case "day":
      return new Date(now.getTime() - 24 * 60 * 60 * 1000);
    case "week":
      return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    case "month":
      return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    case "3months":
      return new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
    case "year":
      return new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
    default:
      return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  }
}

export async function searchYouTubeVideosScrape(
  query: string,
  filters: SearchFilters
): Promise<YouTubeSearchResult> {
  return rateLimiter.executeWithRetry("youtube", async () => {
    const MAX_PAGES = 3;
    const allVideos: VideoWithOutlier[] = [];
    const seenIds = new Set<string>();

    for (let page = 0; page < MAX_PAGES; page++) {
      const encodedQuery = encodeURIComponent(query);
      const pageParam = page > 0 ? `&page=${page + 1}` : "";
      const searchUrl = `https://www.youtube.com/results?search_query=${encodedQuery}${pageParam}&sp=EgIQAQ%253D%253D`;

      const response = await proxyFetch(searchUrl, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          "Accept-Language": "en-US,en;q=0.9",
          "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
        },
        timeout: 55000,
      });

      if (!response.ok) {
        if (page === 0) throw new Error(`YouTube search failed: ${response.status}`);
        break; // break silently on subsequent page failures
      }

      const html = await response.text();
      const pageVideos = extractVideoDataFromHtml(html);

      let newCount = 0;
      for (const video of pageVideos) {
        if (!seenIds.has(video.id)) {
          seenIds.add(video.id);
          allVideos.push(video);
          newCount++;
        }
      }

      // If this page added nothing new, stop
      if (newCount === 0) break;
    }

    // Enrich videos with real channel stats asynchronously
    const uniqueChannelIds = [...new Set(allVideos.map((v) => v.channelId).filter(Boolean))];
    const channelStatsPromises = uniqueChannelIds.map(async (channelId) => {
      const stats = await fetchChannelStatsScrape(channelId);
      return { channelId, stats };
    });
    const channelStatsResults = await Promise.allSettled(channelStatsPromises);

    const statsMap = new Map<string, ChannelStats>();
    for (const result of channelStatsResults) {
      if (result.status === "fulfilled" && result.value.stats) {
        statsMap.set(result.value.channelId, result.value.stats);
      }
    }

    // Recompute outlier scores with real channel averages
    const enrichedVideos = allVideos.map((video) => {
      const stats = video.channelId ? statsMap.get(video.channelId) : null;
      if (!stats) return video;

      const channelAvgViews = stats.avgViews > 0 ? stats.avgViews : Math.round(video.viewCount * 0.1);
      const subscriberCount = stats.subscriberCount;
      const outlierScore = calculateOutlierScore(video.viewCount, channelAvgViews);
      const subscriberWeightedOutlier = subscriberCount > 0
        ? calculateSubscriberWeightedOutlier(outlierScore, subscriberCount)
        : outlierScore;

      const updated: VideoWithOutlier = {
        ...video,
        subscriberCount,
        channelAvgViews: Math.round(channelAvgViews),
        outlierScore,
        subscriberWeightedOutlier,
      };
      updated.discoveryScore = calculateVideoDiscoveryScore(updated);
      return updated;
    });

    // Filter videos by time range based on parsed published date
    const cutoffDate = getTimeRangeCutoff(filters.timeRange);
    const filteredVideos = enrichedVideos.filter((video) => {
      const publishedDate = new Date(video.publishedAt).getTime();
      return publishedDate >= cutoffDate.getTime();
    });

    return {
      query,
      videos: filteredVideos,
      fromCache: false,
      fetchedAt: new Date().toISOString(),
    };
  });
}

export async function getVideoDetailsScrape(videoId: string) {
  return rateLimiter.executeWithRetry("youtube", async () => {
    const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;

    const response = await proxyFetch(videoUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept-Language": "en-US,en;q=0.9",
      },
    });

    if (!response.ok) {
      throw new Error(`YouTube video fetch failed: ${response.status}`);
    }

    const html = await response.text();

    // Extract ytInitialData
    const ytDataMatch = html.match(/var ytInitialData = ({.*?});<\/script>/);
    if (ytDataMatch) {
      try {
        const ytData = JSON.parse(ytDataMatch[1]);
        const videoDetails = ytData?.contents?.twoColumnWatchNextResults?.results?.results?.contents?.[0]?.videoPrimaryInfoRenderer;
        const channelDetails = ytData?.contents?.twoColumnWatchNextResults?.results?.results?.contents?.[1]?.videoSecondaryInfoRenderer?.owner?.videoOwnerRenderer;

        return {
          id: videoId,
          snippet: {
            title: videoDetails?.title?.runs?.[0]?.text || "",
            channelId: channelDetails?.navigationEndpoint?.browseEndpoint?.browseId || "",
            channelTitle: channelDetails?.title?.runs?.[0]?.text || "",
            description: ytData?.contents?.twoColumnWatchNextResults?.results?.results?.contents?.[1]?.videoSecondaryInfoRenderer?.attributedDescription?.content || "",
            publishedAt: new Date().toISOString(),
            thumbnails: {
              medium: {
                url: `https://i.ytimg.com/vi/${videoId}/mqdefault.jpg`,
              },
            },
            tags: [],
          },
          statistics: {
            viewCount: videoDetails?.viewCount?.videoViewCountRenderer?.viewCount?.runs?.[0]?.text?.replace(/[^\d]/g, "") || "0",
            likeCount: "0",
            commentCount: "0",
          },
          contentDetails: {
            duration: "PT0S",
          },
        };
      } catch (error) {
        console.error("Error parsing video details:", error);
      }
    }

    return null;
  });
}

export async function getChannelDetailsScrape(channelId: string) {
  return rateLimiter.executeWithRetry("youtube", async () => {
    const channelUrl = `https://www.youtube.com/channel/${channelId}/about`;

    const response = await proxyFetch(channelUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept-Language": "en-US,en;q=0.9",
      },
    });

    if (!response.ok) {
      throw new Error(`YouTube channel fetch failed: ${response.status}`);
    }

    const html = await response.text();

    // Extract ytInitialData
    const ytDataMatch = html.match(/var ytInitialData = ({.*?});<\/script>/);
    if (ytDataMatch) {
      try {
        const ytData = JSON.parse(ytDataMatch[1]);
        const channelData = ytData?.contents?.twoColumnBrowseResultsRenderer?.tabs?.[0]?.tabRenderer?.content?.sectionListRenderer?.contents?.[0]?.itemSectionRenderer?.contents?.[0]?.channelAboutFullMetadataRenderer;

        return {
          id: channelId,
          statistics: {
            viewCount: "0",
            subscriberCount: channelData?.subscriberCountText?.runs?.[0]?.text?.replace(/[^\d]/g, "") || "0",
            videoCount: "0",
          },
          snippet: {
            title: channelData?.title?.runs?.[0]?.text || "",
            description: channelData?.description?.runs?.[0]?.text || "",
            thumbnails: {
              default: {
                url: "",
              },
            },
          },
        };
      } catch (error) {
        console.error("Error parsing channel details:", error);
      }
    }

    return null;
  });
}
