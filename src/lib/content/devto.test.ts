import { describe, it, expect, vi, beforeEach } from "vitest";
import { fetchDevToArticles, searchDevToArticles } from "./devto";

describe("DEV.to Content API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn();
  });

  describe("fetchDevToArticles", () => {
    it("should fetch and format articles by tag", async () => {
      const mockArticles = [
        {
          id: 1,
          title: "Getting Started with AI",
          url: "https://dev.to/user/getting-started-with-ai",
          user: { name: "Jane Doe", username: "janedoe" },
          published_at: "2024-01-01T00:00:00Z",
          published_timestamp: "2024-01-01T00:00:00Z",
          positive_reactions_count: 150,
          comments_count: 25,
          cover_image: "https://example.com/cover.jpg",
          description: "A guide to AI",
          tags: ["ai", "machinelearning"],
        },
        {
          id: 2,
          title: "React Patterns",
          url: "https://dev.to/user/react-patterns",
          user: { name: "John Smith", username: "johnsmith" },
          published_at: "2024-01-02T00:00:00Z",
          published_timestamp: "2024-01-02T00:00:00Z",
          positive_reactions_count: 80,
          comments_count: 10,
          cover_image: null,
          description: "React best practices",
          tags: ["react", "javascript"],
        },
      ];

      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockArticles),
      });

      const result = await fetchDevToArticles("ai", 2);

      expect(result.items).toHaveLength(2);
      expect(result.items[0].id).toBe("devto-1");
      expect(result.items[0].title).toBe("Getting Started with AI");
      expect(result.items[0].score).toBe(150);
      expect(result.items[0].commentCount).toBe(25);
      expect(result.items[0].source).toBe("devto");
      expect(result.items[0].thumbnail).toBe("https://example.com/cover.jpg");
      expect(result.items[0].tags).toContain("ai");
    });

    it("should handle API errors", async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: false,
        status: 500,
      });

      await expect(fetchDevToArticles("ai")).rejects.toEqual({
        type: "api_error",
        message: "DEV.to API error: 500",
      });
    });
  });

  describe("searchDevToArticles", () => {
    it("should filter articles by query", async () => {
      const mockArticles = [
        {
          id: 1,
          title: "AI in Healthcare",
          url: "https://dev.to/user/ai-healthcare",
          user: { name: "Alice", username: "alice" },
          published_at: "2024-01-01T00:00:00Z",
          published_timestamp: "2024-01-01T00:00:00Z",
          positive_reactions_count: 200,
          comments_count: 30,
          description: "How AI is transforming healthcare",
          tags: ["ai", "healthcare"],
        },
        {
          id: 2,
          title: "CSS Grid Layout",
          url: "https://dev.to/user/css-grid",
          user: { name: "Bob", username: "bob" },
          published_at: "2024-01-02T00:00:00Z",
          published_timestamp: "2024-01-02T00:00:00Z",
          positive_reactions_count: 50,
          comments_count: 5,
          description: "Master CSS Grid",
          tags: ["css", "webdev"],
        },
      ];

      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockArticles),
      });

      const result = await searchDevToArticles("AI", 10);

      // Should only return articles matching "AI"
      expect(result.items.length).toBeGreaterThan(0);
      expect(result.items[0].title).toBe("AI in Healthcare");
    });
  });
});
