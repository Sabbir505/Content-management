import { describe, it, expect, vi, beforeEach } from "vitest";
import { fetchGoogleNewsViaRSS2JSON } from "./googlenews";

describe("Google News RSS API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn();
  });

  describe("fetchGoogleNewsViaRSS2JSON", () => {
    it("should fetch and parse Google News RSS via RSS2JSON", async () => {
      const mockRSS2JSONResponse = {
        status: "ok",
        items: [
          {
            title: "AI Breakthrough in 2024",
            link: "https://example.com/ai-breakthrough",
            author: "Tech Reporter",
            pubDate: "Mon, 01 Jan 2024 00:00:00 GMT",
            description: "A major AI breakthrough...",
            thumbnail: "https://example.com/thumb.jpg",
            categories: ["AI", "Technology"],
          },
          {
            title: "New Framework Released",
            link: "https://example.com/new-framework",
            author: "Dev News",
            pubDate: "Tue, 02 Jan 2024 00:00:00 GMT",
            description: "A new framework...",
            thumbnail: "",
            categories: ["Development"],
          },
        ],
      };

      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockRSS2JSONResponse),
      });

      const result = await fetchGoogleNewsViaRSS2JSON("AI technology", 2);

      expect(result.items).toHaveLength(2);
      expect(result.items[0].id).toBe("googlenews-0");
      expect(result.items[0].title).toBe("AI Breakthrough in 2024");
      expect(result.items[0].source).toBe("googlenews");
      expect(result.items[0].thumbnail).toBe("https://example.com/thumb.jpg");
      expect(result.items[0].tags).toContain("AI");
      expect(result.items[0].tags).toContain("Technology");
    });

    it("should handle RSS2JSON API errors", async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: false,
        status: 500,
      });

      await expect(fetchGoogleNewsViaRSS2JSON("test")).rejects.toEqual({
        type: "api_error",
        message: "RSS2JSON API error: 500",
      });
    });

    it("should handle RSS2JSON service errors", async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ status: "error", message: "Invalid RSS feed" }),
      });

      await expect(fetchGoogleNewsViaRSS2JSON("test")).rejects.toEqual({
        type: "api_error",
        message: "RSS2JSON error: Invalid RSS feed",
      });
    });

    it("should handle empty results", async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ status: "ok", items: [] }),
      });

      const result = await fetchGoogleNewsViaRSS2JSON("nonexistenttopic12345");

      expect(result.items).toHaveLength(0);
    });
  });
});
