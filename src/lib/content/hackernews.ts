import { rateLimiter } from "@/lib/rate-limiter";
import type { ContentItem, ContentSearchResult } from "@/types/content";
import { proxyFetch } from "../proxy";
import { getBestThumbnail } from "./thumbnails";

const HN_API_BASE = "https://hacker-news.firebaseio.com/v0";

interface HNItem {
  id: number;
  title: string;
  url?: string;
  text?: string;
  by: string;
  score: number;
  time: number;
  descendants?: number;
}

interface AlgoliaHit {
  objectID: string;
  title?: string;
  url?: string;
  author?: string;
  points?: number;
  num_comments?: number;
  created_at_i: number;
  _highlightResult?: { title?: { value: string } };
}

export async function fetchHackerNewsStories(limit = 20): Promise<ContentSearchResult> {
  return rateLimiter.executeWithRetry("hackernews", async () => {
    // Fetch top stories
    const topStoriesResponse = await proxyFetch(`${HN_API_BASE}/topstories.json`);
    const topStoryIds: number[] = await topStoriesResponse.json();

    // Fetch details for first N stories
    const storyPromises = topStoryIds.slice(0, limit).map(async (id) => {
      const response = await proxyFetch(`${HN_API_BASE}/item/${id}.json`);
      return response.json() as Promise<HNItem>;
    });

    const stories = await Promise.all(storyPromises);

    // Filter and format
    const items: ContentItem[] = stories
      .filter((story) => story && story.url)
      .map((story) => ({
        id: `hn-${story.id}`,
        title: story.title,
        url: story.url || `https://news.ycombinator.com/item?id=${story.id}`,
        source: "hackernews" as const,
        author: story.by || "unknown",
        authorUrl: `https://news.ycombinator.com/user?id=${story.by}`,
        score: story.score,
        commentCount: story.descendants || 0,
        publishedAt: new Date(story.time * 1000).toISOString(),
        description: story.text ? story.text.slice(0, 200) : undefined,
        thumbnail: getBestThumbnail(story.url || "", "hackernews"),
      }));

    return {
      items,
      source: "hackernews",
      fromCache: false,
      fetchedAt: new Date().toISOString(),
    };
  });
}

export async function searchHackerNewsByTopic(topic: string, limit = 15): Promise<ContentSearchResult> {
  return rateLimiter.executeWithRetry("hackernews", async () => {
    // HN doesn't have a direct search API, so we use Algolia's HN search
    const searchUrl = `https://hn.algolia.com/api/v1/search?query=${encodeURIComponent(topic)}&tags=story&hitsPerPage=${limit}&numericFilters=created_at_i%3E${Math.floor(Date.now() / 1000) - 30 * 24 * 60 * 60}`;

    try {
      const response = await proxyFetch(searchUrl, { timeout: 15000 });
      if (!response.ok) {
        throw new Error(`Algolia search returned ${response.status}`);
      }
      const data = await response.json();

      if (!data.hits || !Array.isArray(data.hits)) {
        throw new Error("Algolia search returned invalid data");
      }

      const items: ContentItem[] = data.hits.map((hit: AlgoliaHit) => ({
        id: `hn-${hit.objectID}`,
        title: hit.title || hit._highlightResult?.title?.value || "",
        url: hit.url || `https://news.ycombinator.com/item?id=${hit.objectID}`,
        source: "hackernews" as const,
        author: hit.author || "unknown",
        authorUrl: `https://news.ycombinator.com/user?id=${hit.author}`,
        score: hit.points || 0,
        commentCount: hit.num_comments || 0,
        publishedAt: new Date(hit.created_at_i * 1000).toISOString(),
        thumbnail: getBestThumbnail(hit.url || "", "hackernews"),
      }));

      return {
        items,
        source: "hackernews",
        fromCache: false,
        fetchedAt: new Date().toISOString(),
      };
    } catch (error) {
      console.error("[HN] Search failed:", error);
      throw error;
    }
  });
}
