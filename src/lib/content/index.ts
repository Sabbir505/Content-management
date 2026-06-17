import { ContentItem, ContentSearchResult } from "@/types/content";
import { fetchHackerNewsStories, searchHackerNewsByTopic } from "./hackernews";
import { fetchRedditPosts, searchRedditPosts } from "./reddit";
import { fetchDevToArticles, searchDevToArticles } from "./devto";
import { fetchGoogleNewsViaRSS2JSON, fetchGoogleNewsRSS } from "./googlenews";
import { calculateContentDiscoveryScore } from "../discovery-score";
import * as memoryCache from "@/lib/quality/cache";

export type ContentSource = "hackernews" | "reddit" | "devto" | "googlenews";

export interface ContentSearchOptions {
  query: string;
  sources?: ContentSource[];
  limit?: number;
  subreddit?: string;
  devToTag?: string;
  bypassCache?: boolean;
}

const MEMORY_CACHE_TTL = 15 * 60 * 1000; // 15 minutes

function buildMemoryCacheKey(query: string, sources: string[]): string {
  const sourcesHash = sources.sort().join(",");
  return `content:${query.toLowerCase().trim()}:${sourcesHash}`;
}

// Helper to add timeout to individual source fetches
function withSourceTimeout<T>(promise: Promise<T>, ms: number, source: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`${source} timed out after ${ms}ms`));
    }, ms);
    promise
      .then((result) => {
        clearTimeout(timer);
        resolve(result);
      })
      .catch((err) => {
        clearTimeout(timer);
        reject(err);
      });
  });
}

export async function searchContent(options: ContentSearchOptions): Promise<ContentSearchResult[]> {
  const { query, sources = ["hackernews", "reddit", "devto", "googlenews"], limit = 20 } = options;

  // Check in-memory cache (skip if fresh requested via bypass)
  const bypassCache = options.bypassCache === true;
  const cacheKey = buildMemoryCacheKey(query, sources);

  if (!bypassCache) {
    const cached = memoryCache.get<ContentSearchResult[]>(cacheKey);
    if (cached) {
      return cached;
    }
  }

  // Fetch from APIs with individual source timeouts
  const results: ContentSearchResult[] = [];
  const sourceTimeout = 8000; // 8 seconds per source

  const promises: Promise<ContentSearchResult>[] = [];

  if (sources.includes("hackernews")) {
    promises.push(
      withSourceTimeout(searchHackerNewsByTopic(query, limit), sourceTimeout, "hackernews").catch((error) => {
        console.warn(`[Content] HackerNews failed for "${query}":`, error.message);
        return {
          items: [],
          source: "hackernews",
          fromCache: false,
          fetchedAt: new Date().toISOString(),
          error: error.message,
        };
      })
    );
  }

  if (sources.includes("reddit")) {
    promises.push(
      withSourceTimeout(searchRedditPosts(query, limit), sourceTimeout, "reddit").catch((error) => {
        console.warn(`[Content] Reddit failed for "${query}":`, error.message);
        return {
          items: [],
          source: "reddit",
          fromCache: false,
          fetchedAt: new Date().toISOString(),
          error: error.message,
        };
      })
    );
  }

  if (sources.includes("devto")) {
    promises.push(
      withSourceTimeout(searchDevToArticles(query, limit), sourceTimeout, "devto").catch((error) => {
        console.warn(`[Content] DEV.to failed for "${query}":`, error.message);
        return {
          items: [],
          source: "devto",
          fromCache: false,
          fetchedAt: new Date().toISOString(),
          error: error.message,
        };
      })
    );
  }

  if (sources.includes("googlenews")) {
    promises.push(
      withSourceTimeout(fetchGoogleNewsRSS(query, limit), sourceTimeout, "googlenews").catch((error) => {
        console.warn(`[Content] Google News failed for "${query}":`, error.message);
        return {
          items: [],
          source: "googlenews",
          fromCache: false,
          fetchedAt: new Date().toISOString(),
          error: error.message,
        };
      })
    );
  }

  const settledResults = await Promise.allSettled(promises);

  for (const result of settledResults) {
    if (result.status === "fulfilled") {
      results.push(result.value);
      console.log(`[Content] ${result.value.source} returned ${result.value.items.length} items for "${query}"`);
    }
  }

  // Store in memory cache
  memoryCache.set(cacheKey, results, MEMORY_CACHE_TTL);

  return results;
}

export async function fetchTrendingContent(sources?: ContentSource[], limit = 20, bypassCache = false): Promise<ContentSearchResult[]> {
  const allSources = sources || ["hackernews", "reddit", "devto", "googlenews"];

  // Check in-memory cache (skip if fresh requested)
  const cacheKey = buildMemoryCacheKey("trending", allSources);

  if (!bypassCache) {
    const cached = memoryCache.get<ContentSearchResult[]>(cacheKey);
    if (cached) {
      return cached;
    }
  }

  const results: ContentSearchResult[] = [];
  const sourceTimeout = 8000; // 8 seconds per source

  const promises: Promise<ContentSearchResult>[] = [];

  if (allSources.includes("hackernews")) {
    promises.push(
      withSourceTimeout(fetchHackerNewsStories(limit), sourceTimeout, "hackernews").catch((error) => ({
        items: [],
        source: "hackernews",
        fromCache: false,
        fetchedAt: new Date().toISOString(),
        error: error.message,
      }))
    );
  }

  if (allSources.includes("reddit")) {
    promises.push(
      withSourceTimeout(fetchRedditPosts("technology", limit), sourceTimeout, "reddit").catch((error) => ({
        items: [],
        source: "reddit",
        fromCache: false,
        fetchedAt: new Date().toISOString(),
        error: error.message,
      }))
    );
  }

  if (allSources.includes("devto")) {
    promises.push(
      withSourceTimeout(fetchDevToArticles("ai", limit), sourceTimeout, "devto").catch((error) => ({
        items: [],
        source: "devto",
        fromCache: false,
        fetchedAt: new Date().toISOString(),
        error: error.message,
      }))
    );
  }

  if (allSources.includes("googlenews")) {
    promises.push(
      withSourceTimeout(fetchGoogleNewsRSS("AI technology", limit), sourceTimeout, "googlenews").catch((error) => ({
        items: [],
        source: "googlenews",
        fromCache: false,
        fetchedAt: new Date().toISOString(),
        error: error.message,
      }))
    );
  }

  const settledResults = await Promise.allSettled(promises);

  for (const result of settledResults) {
    if (result.status === "fulfilled") {
      results.push(result.value);
    }
  }

  // Store in memory cache
  memoryCache.set(cacheKey, results, MEMORY_CACHE_TTL);

  return results;
}

// Merge and sort all content items by discovery score
export function mergeAndSortContent(results: ContentSearchResult[]): ContentItem[] {
  const allItems: ContentItem[] = [];

  for (const result of results) {
    if (result.items && result.items.length > 0) {
      allItems.push(...result.items);
    }
  }

  // Calculate discovery score for each item and sort by it
  return allItems
    .map((item) => ({
      ...item,
      discoveryScore: calculateContentDiscoveryScore(item),
    }))
    .sort((a, b) => (b.discoveryScore || 0) - (a.discoveryScore || 0));
}
