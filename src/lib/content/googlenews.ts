import { rateLimiter } from "@/lib/rate-limiter";
import type { ContentSearchResult } from "@/types/content";
import { proxyFetch } from "../proxy";
import { getBestThumbnail } from "./thumbnails";

interface GoogleNewsItem {
  title: string;
  link: string;
  pubDate: string;
  description?: string;
  author?: string;
  enclosure?: {
    url: string;
  };
}

function parseRSS(xmlText: string): GoogleNewsItem[] {
  const items: GoogleNewsItem[] = [];
  const itemRegex = /<item>([\s\S]*?)<\/item>/g;
  let match;

  while ((match = itemRegex.exec(xmlText)) !== null) {
    const itemXml = match[1];

    const titleMatch = itemXml.match(/<title>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/);
    const linkMatch = itemXml.match(/<link>([^<]+)<\/link>/);
    const pubDateMatch = itemXml.match(/<pubDate>([^<]+)<\/pubDate>/);
    const descMatch = itemXml.match(/<description>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/description>/);
    const authorMatch = itemXml.match(/<author>([^<]+)<\/author>/);
    const enclosureMatch = itemXml.match(/<enclosure[^>]*url="([^"]+)"/);

    if (titleMatch && linkMatch) {
      items.push({
        title: titleMatch[1].trim(),
        link: linkMatch[1].trim(),
        pubDate: pubDateMatch ? pubDateMatch[1].trim() : new Date().toISOString(),
        description: descMatch ? descMatch[1].trim() : undefined,
        author: authorMatch ? authorMatch[1].trim() : undefined,
        enclosure: enclosureMatch ? { url: enclosureMatch[1].trim() } : undefined,
      });
    }
  }

  return items;
}

/**
 * Extract the actual article URL from Google News RSS description field.
 * Google News embeds the real URL in an HTML anchor tag within the description.
 */
function extractRealUrlFromDescription(description: string | undefined): string | null {
  if (!description) return null;

  // Look for href attribute in anchor tags
  const hrefMatch = description.match(/href=["']([^"']+)["']/);
  if (hrefMatch && hrefMatch[1]) {
    const extractedUrl = hrefMatch[1].trim();
    // Make sure it's a valid URL
    if (extractedUrl.startsWith("http")) {
      return extractedUrl;
    }
  }

  return null;
}

/**
 * Decode a Google News redirect URL to get the actual article URL.
 * Google News RSS uses encoded redirect URLs that need special handling.
 */
export async function resolveGoogleNewsUrl(url: string, description?: string): Promise<string> {
  // If it's not a Google News redirect URL, return as-is
  if (!url.includes("news.google.com/rss/articles")) {
    return url;
  }

  // First, try to extract the real URL from the description field
  const realUrlFromDesc = extractRealUrlFromDescription(description);
  if (realUrlFromDesc) {
    return realUrlFromDesc;
  }

  // Fallback: try to follow the redirect
  try {
    const response = await rateLimiter.executeWithRetry("googlenews", async () => {
      return proxyFetch(url, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        },
        redirect: "follow",
      });
    });

    // If we got a redirect response, use the final URL
    if (response.url && !response.url.includes("news.google.com")) {
      return response.url;
    }

    return url;
  } catch {
    return url;
  }
}

export async function fetchGoogleNewsRSS(topic: string, limit = 20): Promise<ContentSearchResult> {
  return rateLimiter.executeWithRetry("googlenews", async () => {
    // Use Google News RSS feed (no API key needed)
    const rssUrl = `https://news.google.com/rss/search?q=${encodeURIComponent(topic)}&hl=en-US&gl=US&ceid=US:en`;

    // Use a CORS proxy or direct fetch depending on environment
    const response = await proxyFetch(rssUrl, {
      headers: {
        "User-Agent": "TubeForge/1.0",
      },
    });

    if (!response.ok) {
      throw new Error(`Google News RSS error: ${response.status}`);
    }

    const xmlText = await response.text();
    const items = parseRSS(xmlText);

    // Resolve Google News redirect URLs to actual article URLs
    const resolvedItems = await Promise.all(
      items.slice(0, limit).map(async (item, index) => {
        const resolvedUrl = await resolveGoogleNewsUrl(item.link, item.description);
        return {
          id: `googlenews-${index}`,
          title: item.title,
          url: resolvedUrl,
          source: "googlenews" as any,
          author: item.author || "Google News",
          score: 0, // RSS doesn't provide engagement scores
          publishedAt: item.pubDate ? new Date(item.pubDate).toISOString() : new Date().toISOString(),
          description: item.description,
          thumbnail: item.enclosure?.url || getBestThumbnail(resolvedUrl, "googlenews"),
          tags: [topic],
        };
      })
    );

    return {
      items: resolvedItems,
      source: "googlenews",
      fromCache: false,
      fetchedAt: new Date().toISOString(),
    };
  });
}

// Alternative: Use RSS2JSON service for better compatibility
export async function fetchGoogleNewsViaRSS2JSON(topic: string, limit = 20): Promise<ContentSearchResult> {
  return rateLimiter.executeWithRetry("googlenews", async () => {
    const rssUrl = `https://news.google.com/rss/search?q=${encodeURIComponent(topic)}&hl=en-US&gl=US&ceid=US:en`;
    const apiUrl = `https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(rssUrl)}&count=${limit}`;

    const response = await proxyFetch(apiUrl);

    if (!response.ok) {
      throw new Error(`RSS2JSON API error: ${response.status}`);
    }

    const data = await response.json();

    if (data.status !== "ok") {
      throw new Error(`RSS2JSON error: ${data.message || "Unknown error"}`);
    }

    const items: any[] = data.items.map((item: any, index: number) => ({
      id: `googlenews-${index}`,
      title: item.title,
      url: item.link,
      source: "googlenews",
      author: item.author || "Google News",
      score: 0,
      publishedAt: item.pubDate ? new Date(item.pubDate).toISOString() : new Date().toISOString(),
      description: item.description,
      thumbnail: item.thumbnail || getBestThumbnail(item.link, "googlenews"),
      tags: item.categories || [topic],
    }));

    return {
      items,
      source: "googlenews",
      fromCache: false,
      fetchedAt: new Date().toISOString(),
    };
  });
}
