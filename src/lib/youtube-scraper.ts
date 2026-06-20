import { rateLimiter } from "./rate-limiter";
import { proxyFetch } from "./proxy";
import { calculateOutlierScore, estimateHookType, estimateStructure } from "./outlier";
import { calculateVideoDiscoveryScore } from "./discovery-score";
import type { VideoWithOutlier } from "@/types/video";
import type { YouTubeSearchResult } from "./quality/types";

interface SearchFilters {
  niche: string;
  timeRange: "day" | "week" | "month" | "year";
  language: "any" | "en";
}

function parseDuration(durationText: string): number {
  const parts = durationText.split(":").map(Number);
  if (parts.length === 3) {
    return parts[0] * 3600 + parts[1] * 60 + parts[2];
  } else if (parts.length === 2) {
    return parts[0] * 60 + parts[1];
  }
  return 0;
}

function formatDuration(seconds: number): string {
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
  const lower = dateText.toLowerCase().trim();

  // Handle empty/undefined dates
  if (!lower || lower === "") {
    return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
  }

  // Handle "today" and "yesterday" specifically
  if (lower === "today" || lower.includes("today")) {
    return now.toISOString();
  }
  if (lower === "yesterday" || lower.includes("yesterday")) {
    return new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
  }

  // Extract number from relative time strings like "2 years ago", "Streamed 3 days ago"
  const numberMatch = lower.match(/(\d+)/);
  const number = numberMatch ? parseInt(numberMatch[1], 10) : 1;

  if (lower.includes("year")) {
    return new Date(now.getTime() - number * 365 * 24 * 60 * 60 * 1000).toISOString();
  }
  if (lower.includes("month")) {
    return new Date(now.getTime() - number * 30 * 24 * 60 * 60 * 1000).toISOString();
  }
  if (lower.includes("week")) {
    return new Date(now.getTime() - number * 7 * 24 * 60 * 60 * 1000).toISOString();
  }
  // Only match "day" if it's NOT part of "today" or "yesterday" (already handled above)
  if (lower.includes("day") && !lower.includes("today") && !lower.includes("yesterday")) {
    return new Date(now.getTime() - number * 24 * 60 * 60 * 1000).toISOString();
  }
  if (lower.includes("hour")) {
    return new Date(now.getTime() - number * 60 * 60 * 1000).toISOString();
  }
  if (lower.includes("minute")) {
    return new Date(now.getTime() - number * 60 * 1000).toISOString();
  }
  if (lower.includes("second")) {
    return new Date(now.getTime() - number * 1000).toISOString();
  }

  // Try to parse as an absolute date
  if (!isNaN(Date.parse(dateText))) {
    return new Date(dateText).toISOString();
  }

  // Fallback: assume 30 days ago rather than "now" to avoid showing old videos as recent
  return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
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
                const durationSeconds = parseDuration(durationText);
                const description = videoRenderer?.detailedMetadataSnippets?.[0]?.snippetText?.runs?.[0]?.text ||
                                      videoRenderer?.descriptionSnippet?.runs?.[0]?.text || "";
                const thumbnail = videoRenderer?.thumbnail?.thumbnails?.[videoRenderer.thumbnail.thumbnails.length - 1]?.url ||
                                    videoRenderer?.thumbnail?.thumbnails?.[0]?.url || "";

                // Skip shorts (under 60 seconds)
                if (durationSeconds < 60) continue;

                const channelAvgViews = viewCount * 0.1;
                const outlierScore = calculateOutlierScore(viewCount, channelAvgViews);

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
                  channelAvgViews: Math.round(channelAvgViews),
                  outlierScore,
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

function getTimeRangeCutoff(timeRange: "day" | "week" | "month" | "year"): Date {
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
      return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  }
}

export async function searchYouTubeVideosScrape(
  query: string,
  filters: SearchFilters
): Promise<YouTubeSearchResult> {
  return rateLimiter.executeWithRetry("youtube", async () => {
    const encodedQuery = encodeURIComponent(query);
    const searchUrl = `https://www.youtube.com/results?search_query=${encodedQuery}&sp=EgIQAQ%253D%253D`;

    const response = await proxyFetch(searchUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept-Language": "en-US,en;q=0.9",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
      },
      timeout: 55000,
    });

    if (!response.ok) {
      throw new Error(`YouTube search failed: ${response.status}`);
    }

    const html = await response.text();
    const allVideos = extractVideoDataFromHtml(html);

    // Filter videos by time range based on parsed published date
    const cutoffDate = getTimeRangeCutoff(filters.timeRange);
    const filteredVideos = allVideos.filter((video) => {
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
