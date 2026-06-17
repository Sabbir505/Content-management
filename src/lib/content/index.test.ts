import { describe, it, expect, vi, beforeEach } from "vitest";
import { searchContent, fetchTrendingContent, mergeAndSortContent } from "./index";
import type { ContentItem, ContentSearchResult } from "@/types/content";

// Mock the individual modules
vi.mock("./hackernews", () => ({
  fetchHackerNewsStories: vi.fn(),
  searchHackerNewsByTopic: vi.fn(),
}));

vi.mock("./reddit", () => ({
  fetchRedditPosts: vi.fn(),
  searchRedditPosts: vi.fn(),
}));

vi.mock("./devto", () => ({
  fetchDevToArticles: vi.fn(),
  searchDevToArticles: vi.fn(),
}));

vi.mock("./googlenews", () => ({
  fetchGoogleNewsViaRSS2JSON: vi.fn(),
}));

vi.mock("@/lib/quality/cache", () => ({
  get: vi.fn(() => null),
  set: vi.fn(),
  has: vi.fn(() => false),
  deleteKey: vi.fn(),
  clear: vi.fn(),
  size: vi.fn(() => 0),
}));

import { searchHackerNewsByTopic, fetchHackerNewsStories } from "./hackernews";
import { searchRedditPosts, fetchRedditPosts } from "./reddit";
import { searchDevToArticles, fetchDevToArticles } from "./devto";
import { fetchGoogleNewsViaRSS2JSON } from "./googlenews";

describe("Content Index - Unified Search", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("searchContent", () => {
    it("should search all sources and return combined results", async () => {
      const mockHNResult: ContentSearchResult = {
        items: [{ id: "hn-1", title: "HN Story", url: "https://hn.com/1", source: "hackernews", author: "user", score: 100, publishedAt: "2024-01-01" }],
        source: "hackernews",
        fromCache: false,
        fetchedAt: "2024-01-01",
      };

      const mockRedditResult: ContentSearchResult = {
        items: [{ id: "reddit-1", title: "Reddit Post", url: "https://reddit.com/1", source: "reddit", author: "redditor", score: 500, publishedAt: "2024-01-01" }],
        source: "reddit",
        fromCache: false,
        fetchedAt: "2024-01-01",
      };

      const mockDevToResult: ContentSearchResult = {
        items: [{ id: "devto-1", title: "DEV Article", url: "https://dev.to/1", source: "devto", author: "dev", score: 50, publishedAt: "2024-01-01" }],
        source: "devto",
        fromCache: false,
        fetchedAt: "2024-01-01",
      };

      const mockGoogleNewsResult: ContentSearchResult = {
        items: [{ id: "googlenews-1", title: "News Article", url: "https://news.com/1", source: "googlenews", author: "reporter", score: 0, publishedAt: "2024-01-01" }],
        source: "googlenews",
        fromCache: false,
        fetchedAt: "2024-01-01",
      };

      (searchHackerNewsByTopic as ReturnType<typeof vi.fn>).mockResolvedValue(mockHNResult);
      (searchRedditPosts as ReturnType<typeof vi.fn>).mockResolvedValue(mockRedditResult);
      (searchDevToArticles as ReturnType<typeof vi.fn>).mockResolvedValue(mockDevToResult);
      (fetchGoogleNewsViaRSS2JSON as ReturnType<typeof vi.fn>).mockResolvedValue(mockGoogleNewsResult);

      const results = await searchContent({ query: "AI", limit: 10 });

      expect(results).toHaveLength(4);
      expect(results[0].source).toBe("hackernews");
      expect(results[1].source).toBe("reddit");
      expect(results[2].source).toBe("devto");
      expect(results[3].source).toBe("googlenews");
    });

    it("should handle partial failures gracefully", async () => {
      (searchHackerNewsByTopic as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("HN Error"));
      (searchRedditPosts as ReturnType<typeof vi.fn>).mockResolvedValue({
        items: [{ id: "reddit-1", title: "Reddit Post", url: "https://reddit.com/1", source: "reddit", author: "redditor", score: 500, publishedAt: "2024-01-01" }],
        source: "reddit",
        fromCache: false,
        fetchedAt: "2024-01-01",
      });
      (searchDevToArticles as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("DEV Error"));
      (fetchGoogleNewsViaRSS2JSON as ReturnType<typeof vi.fn>).mockResolvedValue({
        items: [{ id: "googlenews-1", title: "News", url: "https://news.com/1", source: "googlenews", author: "reporter", score: 0, publishedAt: "2024-01-01" }],
        source: "googlenews",
        fromCache: false,
        fetchedAt: "2024-01-01",
      });

      const results = await searchContent({ query: "AI", limit: 10 });

      // Should still return successful sources
      expect(results.length).toBeGreaterThan(0);
      expect(results.some((r) => r.source === "reddit")).toBe(true);
      expect(results.some((r) => r.source === "googlenews")).toBe(true);
    });
  });

  describe("fetchTrendingContent", () => {
    it("should fetch trending content from all sources", async () => {
      (fetchHackerNewsStories as ReturnType<typeof vi.fn>).mockResolvedValue({
        items: [{ id: "hn-1", title: "Trending HN", url: "https://hn.com/1", source: "hackernews", author: "user", score: 200, publishedAt: "2024-01-01" }],
        source: "hackernews",
        fromCache: false,
        fetchedAt: "2024-01-01",
      });

      (fetchRedditPosts as ReturnType<typeof vi.fn>).mockResolvedValue({
        items: [{ id: "reddit-1", title: "Trending Reddit", url: "https://reddit.com/1", source: "reddit", author: "redditor", score: 1000, publishedAt: "2024-01-01" }],
        source: "reddit",
        fromCache: false,
        fetchedAt: "2024-01-01",
      });

      (fetchDevToArticles as ReturnType<typeof vi.fn>).mockResolvedValue({
        items: [{ id: "devto-1", title: "Trending DEV", url: "https://dev.to/1", source: "devto", author: "dev", score: 100, publishedAt: "2024-01-01" }],
        source: "devto",
        fromCache: false,
        fetchedAt: "2024-01-01",
      });

      (fetchGoogleNewsViaRSS2JSON as ReturnType<typeof vi.fn>).mockResolvedValue({
        items: [{ id: "googlenews-1", title: "Trending News", url: "https://news.com/1", source: "googlenews", author: "reporter", score: 0, publishedAt: "2024-01-01" }],
        source: "googlenews",
        fromCache: false,
        fetchedAt: "2024-01-01",
      });

      const results = await fetchTrendingContent(["hackernews", "reddit", "devto", "googlenews"], 10);

      expect(results).toHaveLength(4);
      expect(fetchHackerNewsStories).toHaveBeenCalledWith(10);
      expect(fetchRedditPosts).toHaveBeenCalledWith("technology", 10);
      expect(fetchDevToArticles).toHaveBeenCalledWith("ai", 10);
    });
  });

  describe("mergeAndSortContent", () => {
    it("should merge and sort content by score", () => {
      const results: ContentSearchResult[] = [
        {
          items: [
            { id: "1", title: "Low", url: "#", source: "hackernews", author: "a", score: 10, publishedAt: "2024-01-01" },
            { id: "2", title: "High", url: "#", source: "hackernews", author: "b", score: 100, publishedAt: "2024-01-01" },
          ],
          source: "hackernews",
          fromCache: false,
          fetchedAt: "2024-01-01",
        },
        {
          items: [
            { id: "3", title: "Medium", url: "#", source: "reddit", author: "c", score: 50, publishedAt: "2024-01-01" },
          ],
          source: "reddit",
          fromCache: false,
          fetchedAt: "2024-01-01",
        },
      ];

      const sorted = mergeAndSortContent(results);

      expect(sorted).toHaveLength(3);
      expect(sorted[0].title).toBe("High");
      expect(sorted[1].title).toBe("Medium");
      expect(sorted[2].title).toBe("Low");
    });

    it("should handle empty results", () => {
      const results: ContentSearchResult[] = [];
      const sorted = mergeAndSortContent(results);
      expect(sorted).toHaveLength(0);
    });

    it("should handle results with no items", () => {
      const results: ContentSearchResult[] = [
        {
          items: [],
          source: "hackernews",
          fromCache: false,
          fetchedAt: "2024-01-01",
        },
      ];
      const sorted = mergeAndSortContent(results);
      expect(sorted).toHaveLength(0);
    });
  });
});
