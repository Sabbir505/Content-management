import type { ContentItem, ContentSearchResult } from "@/types/content";
import { proxyFetch } from "../proxy";

interface TikTokOGData {
  id: string;
  title: string;
  author: string;
  authorUrl: string;
  thumbnail: string;
  videoUrl?: string;
  likes?: number;
  comments?: number;
  shares?: number;
  views?: number;
  timestamp?: string;
}

const TIKTOK_USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

/**
 * Extracts metadata from a TikTok video page via OG tags and embedded JSON-LD.
 * No API key or authentication required — parses the public HTML page.
 */
async function fetchTikTokVideoMeta(videoUrl: string): Promise<TikTokOGData | null> {
  try {
    const response = await proxyFetch(videoUrl, {
      timeout: 10000,
      headers: {
        "User-Agent": TIKTOK_USER_AGENT,
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      },
    });

    if (!response.ok) return null;
    const html = await response.text();

    // Extract from __UNIVERSAL_DATA_FOR_REHYDRATION__ script tag (most reliable)
    const universalDataMatch = html.match(
      /<script id="__UNIVERSAL_DATA_FOR_REHYDRATION__"[^>]*>([\s\S]*?)<\/script>/
    );

    if (universalDataMatch) {
      try {
        const jsonData = JSON.parse(universalDataMatch[1]);
        const defaultScope = jsonData?.__DEFAULT_SCOPE__;
        const videoDetail = defaultScope?.["webapp.video-detail"]?.itemInfo?.itemStruct;

        if (videoDetail) {
          return {
            id: videoDetail.id || "",
            title: videoDetail.desc || "",
            author: videoDetail.author?.nickname || videoDetail.author?.uniqueId || "",
            authorUrl: `https://www.tiktok.com/@${videoDetail.author?.uniqueId || ""}`,
            thumbnail: videoDetail.video?.cover || videoDetail.video?.originCover || "",
            videoUrl: videoDetail.video?.playAddr || videoDetail.video?.downloadAddr || undefined,
            likes: videoDetail.stats?.diggCount || 0,
            comments: videoDetail.stats?.commentCount || 0,
            shares: videoDetail.stats?.shareCount || 0,
            views: videoDetail.stats?.playCount || 0,
            timestamp: videoDetail.createTime
              ? new Date(parseInt(videoDetail.createTime) * 1000).toISOString()
              : undefined,
          };
        }
      } catch {
        // Fall through to OG parsing
      }
    }

    // Fallback: parse OG meta tags
    const getOG = (property: string): string => {
      const match = html.match(new RegExp(`<meta[^>]*property="${property}"[^>]*content="([^"]*)"`, "i"))
        || html.match(new RegExp(`<meta[^>]*content="([^"]*)"[^>]*property="${property}"`, "i"));
      return match?.[1] || "";
    };

    const title = getOG("og:title") || getOG("twitter:title");
    const thumbnail = getOG("og:image") || getOG("twitter:image");
    const description = getOG("og:description") || getOG("twitter:description");

    // Extract author from URL pattern: /@username/video/id
    const urlMatch = videoUrl.match(/@([^/]+)\/video\/(\d+)/);
    const author = urlMatch?.[1] || "";
    const id = urlMatch?.[2] || "";

    if (!title && !description) return null;

    return {
      id,
      title: title || description || "TikTok video",
      author,
      authorUrl: `https://www.tiktok.com/@${author}`,
      thumbnail,
    };
  } catch {
    return null;
  }
}

/**
 * Fetches trending TikTok videos from the public RSS/discovery endpoints.
 * Uses TikTok's embed oEmbed API to get structured data.
 */
async function fetchTikTokOEmbed(videoUrl: string): Promise<TikTokOGData | null> {
  try {
    const oembedUrl = `https://www.tiktok.com/oembed?url=${encodeURIComponent(videoUrl)}`;
    const response = await proxyFetch(oembedUrl, {
      timeout: 8000,
      headers: { "User-Agent": TIKTOK_USER_AGENT },
    });

    if (!response.ok) return null;
    const data = (await response.json()) as {
      title?: string;
      author_name?: string;
      author_url?: string;
      thumbnail_url?: string;
    };

    const urlMatch = videoUrl.match(/@([^/]+)\/video\/(\d+)/);

    return {
      id: urlMatch?.[2] || "",
      title: data.title || "TikTok video",
      author: data.author_name || urlMatch?.[1] || "",
      authorUrl: data.author_url || `https://www.tiktok.com/@${urlMatch?.[1] || ""}`,
      thumbnail: data.thumbnail_url || "",
    };
  } catch {
    return null;
  }
}

/**
 * Searches TikTok by parsing the discover/search page HTML.
 */
export async function searchTikTok(query: string, limit = 20): Promise<ContentSearchResult> {
  const items: ContentItem[] = [];
  const encodedQuery = encodeURIComponent(query);

  try {
    // TikTok's public search results page
    const url = `https://www.tiktok.com/search?q=${encodedQuery}`;
    const response = await proxyFetch(url, {
      timeout: 12000,
      headers: {
        "User-Agent": TIKTOK_USER_AGENT,
        Accept: "text/html,application/xhtml+xml",
        "Accept-Language": "en-US,en;q=0.9",
      },
    });

    if (!response.ok) {
      return { items: [], source: "tiktok", fromCache: false, fetchedAt: new Date().toISOString() };
    }

    const html = await response.text();

    // Try to extract from SIGI_STATE or __UNIVERSAL_DATA_FOR_REHYDRATION__
    const sigiMatch = html.match(/<script id="SIGI_STATE"[^>]*>([\s\S]*?)<\/script>/)
      || html.match(/<script id="__UNIVERSAL_DATA_FOR_REHYDRATION__"[^>]*>([\s\S]*?)<\/script>/);

    if (sigiMatch) {
      try {
        const jsonData = JSON.parse(sigiMatch[1]);
        // Navigate search results structure
        const searchData = jsonData?.ItemModule || jsonData?.__DEFAULT_SCOPE__?.["webapp.search"]?.itemList;
        
        if (searchData && typeof searchData === "object") {
          const videoItems = Array.isArray(searchData) ? searchData : Object.values(searchData);
          
          for (const item of videoItems.slice(0, limit) as Array<Record<string, unknown>>) {
            const stats = item.stats as Record<string, number> | undefined;
            const author = item.author as Record<string, string> | undefined;
            const video = item.video as Record<string, string> | undefined;

            items.push({
              id: `tiktok-${item.id || ""}`,
              title: (item.desc as string) || "TikTok video",
              url: `https://www.tiktok.com/@${author?.uniqueId || ""}/video/${item.id || ""}`,
              source: "tiktok",
              author: (author?.nickname as string) || (author?.uniqueId as string) || "",
              authorUrl: `https://www.tiktok.com/@${author?.uniqueId || ""}`,
              score: stats?.diggCount || 0,
              commentCount: stats?.commentCount || 0,
              shareCount: stats?.shareCount || 0,
              publishedAt: item.createTime
                ? new Date(parseInt(item.createTime as string) * 1000).toISOString()
                : new Date().toISOString(),
              thumbnail: (video?.cover as string) || (video?.originCover as string) || undefined,
              description: (item.desc as string) || undefined,
            });
          }
        }
      } catch {
        // JSON parse failed, fall through
      }
    }
  } catch {
    // Search page fetch failed
  }

  items.sort((a, b) => b.score - a.score);

  return {
    items: items.slice(0, limit),
    source: "tiktok",
    fromCache: false,
    fetchedAt: new Date().toISOString(),
  };
}

export async function fetchTrendingTikTok(limit = 20): Promise<ContentSearchResult> {
  return searchTikTok("trending viral", limit);
}

export { fetchTikTokVideoMeta, fetchTikTokOEmbed };
