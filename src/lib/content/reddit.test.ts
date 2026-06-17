import { describe, it, expect, vi, beforeEach } from "vitest";
import { fetchRedditPosts, searchRedditPosts } from "./reddit";

describe("Reddit Content API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn();
  });

  describe("fetchRedditPosts", () => {
    it("should fetch and format hot posts from a subreddit", async () => {
      const mockResponse = {
        data: {
          children: [
            {
              data: {
                id: "post1",
                title: "AI is changing everything",
                url: "https://example.com/ai",
                author: "redditor1",
                score: 1500,
                num_comments: 200,
                created_utc: 1700000000,
                subreddit: "technology",
                thumbnail: "https://thumb.example.com/1.jpg",
              },
            },
            {
              data: {
                id: "post2",
                title: "New framework released",
                url: "https://example.com/framework",
                author: "redditor2",
                score: 800,
                num_comments: 100,
                created_utc: 1700000001,
                subreddit: "technology",
                thumbnail: "self",
              },
            },
          ],
        },
      };

      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const result = await fetchRedditPosts("technology", 2);

      expect(result.items).toHaveLength(2);
      expect(result.items[0].id).toBe("reddit-post1");
      expect(result.items[0].title).toBe("AI is changing everything");
      expect(result.items[0].score).toBe(1500);
      expect(result.items[0].commentCount).toBe(200);
      expect(result.items[0].source).toBe("reddit");
      expect(result.items[0].tags).toContain("technology");
    });

    it("should handle self posts correctly", async () => {
      const mockResponse = {
        data: {
          children: [
            {
              data: {
                id: "post3",
                title: "Discussion post",
                url: "/r/technology/comments/post3/discussion",
                author: "redditor3",
                score: 500,
                num_comments: 50,
                created_utc: 1700000002,
                subreddit: "technology",
                selftext: "This is a discussion post",
              },
            },
          ],
        },
      };

      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const result = await fetchRedditPosts("technology", 1);

      expect(result.items[0].url).toBe("https://www.reddit.com/r/technology/comments/post3/discussion");
      expect(result.items[0].description).toBe("This is a discussion post");
    });

    it("should handle API errors", async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: false,
        status: 429,
      });

      await expect(fetchRedditPosts("technology")).rejects.toEqual({
        type: "api_error",
        message: "Reddit API error: 429",
      });
    });
  });

  describe("searchRedditPosts", () => {
    it("should search for posts by query", async () => {
      const mockResponse = {
        data: {
          children: [
            {
              data: {
                id: "search1",
                title: "Machine learning tutorial",
                url: "https://example.com/ml",
                author: "ml_expert",
                score: 3000,
                num_comments: 500,
                created_utc: 1700000003,
                subreddit: "MachineLearning",
              },
            },
          ],
        },
      };

      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const result = await searchRedditPosts("machine learning");

      expect(result.items).toHaveLength(1);
      expect(result.items[0].title).toBe("Machine learning tutorial");
      expect(result.items[0].score).toBe(3000);
    });
  });
});
