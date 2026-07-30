import { describe, it, expect, vi, beforeEach } from "vitest";
import { fetchHackerNewsStories, searchHackerNewsByTopic } from "./hackernews";

describe("Hacker News Content API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn();
  });

  describe("fetchHackerNewsStories", () => {
    it("should fetch and format top stories correctly", async () => {
      const mockStoryIds = [1, 2, 3];
      const mockStories = [
        { id: 1, title: "Story 1", url: "https://example.com/1", by: "user1", score: 100, time: 1700000000, descendants: 10 },
        { id: 2, title: "Story 2", url: "https://example.com/2", by: "user2", score: 50, time: 1700000001, descendants: 5 },
        { id: 3, title: "Story 3", url: "https://example.com/3", by: "user3", score: 200, time: 1700000002, descendants: 20 },
      ];

      (global.fetch as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce({
          json: () => Promise.resolve(mockStoryIds),
        })
        .mockResolvedValueOnce({
          json: () => Promise.resolve(mockStories[0]),
        })
        .mockResolvedValueOnce({
          json: () => Promise.resolve(mockStories[1]),
        })
        .mockResolvedValueOnce({
          json: () => Promise.resolve(mockStories[2]),
        });

      const result = await fetchHackerNewsStories(3);

      expect(result.items).toHaveLength(3);
      expect(result.source).toBe("hackernews");
      expect(result.items[0].title).toBe("Story 1");
      expect(result.items[0].score).toBe(100);
      expect(result.items[0].commentCount).toBe(10);
      expect(result.items[0].source).toBe("hackernews");
    });

    it("should filter out stories without URLs", async () => {
      const mockStoryIds = [1, 2];
      const mockStories = [
        { id: 1, title: "Story with URL", url: "https://example.com/1", by: "user1", score: 100, time: 1700000000 },
        { id: 2, title: "Story without URL", by: "user2", score: 50, time: 1700000001 },
      ];

      (global.fetch as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce({
          json: () => Promise.resolve(mockStoryIds),
        })
        .mockResolvedValueOnce({
          json: () => Promise.resolve(mockStories[0]),
        })
        .mockResolvedValueOnce({
          json: () => Promise.resolve(mockStories[1]),
        });

      const result = await fetchHackerNewsStories(2);

      expect(result.items).toHaveLength(1);
      expect(result.items[0].title).toBe("Story with URL");
    });

    it("should handle API errors gracefully", async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("Network error"));

      await expect(fetchHackerNewsStories()).rejects.toEqual({
        type: "api_error",
        message: "Network error",
      });
    });
  });

  describe("searchHackerNewsByTopic", () => {
    it("should search and return formatted results", async () => {
      const mockSearchResult = {
        hits: [
          {
            objectID: "123",
            title: "AI breakthrough",
            url: "https://example.com/ai",
            author: "hacker1",
            points: 500,
            num_comments: 50,
            created_at_i: 1700000000,
          },
        ],
      };

      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        json: () => Promise.resolve(mockSearchResult),
      });

      const result = await searchHackerNewsByTopic("AI");

      expect(result.items).toHaveLength(1);
      expect(result.items[0].id).toBe("hn-123");
      expect(result.items[0].title).toBe("AI breakthrough");
      expect(result.items[0].score).toBe(500);
      expect(result.items[0].commentCount).toBe(50);
    });

    it("should handle empty search results", async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        json: () => Promise.resolve({ hits: [] }),
      });

      const result = await searchHackerNewsByTopic("nonexistenttopic12345");

      expect(result.items).toHaveLength(0);
    });
  });
});
