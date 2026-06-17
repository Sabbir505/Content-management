import { describe, it, expect } from "vitest";
import {
  extractArticleContent,
  extractArticleMetadata,
  scoreArticleQuality,
  segmentArticleIntoBeats,
} from "./article-pipeline";

describe("Article Pipeline", () => {
  describe("extractArticleContent", () => {
    it("should extract content from article HTML", () => {
      const html = `
        <html><body>
          <article>
            <h1>Test Article</h1>
            <p>This is the first paragraph of the article.</p>
            <p>This is the second paragraph with more content.</p>
          </article>
        </body></html>
      `;

      const result = extractArticleContent(html);
      expect(result.content).toContain("Test Article");
      expect(result.content).toContain("first paragraph");
      expect(result.headers).toHaveLength(1);
      expect(result.headers[0].text).toBe("Test Article");
      expect(result.headers[0].level).toBe(1);
    });

    it("should handle HTML with no article tag", () => {
      const html = `
        <html><body>
          <h2>Section 1</h2>
          <p>Content here</p>
          <h2>Section 2</h2>
          <p>More content</p>
        </body></html>
      `;

      const result = extractArticleContent(html);
      expect(result.content).toContain("Section 1");
      expect(result.content).toContain("Content here");
      expect(result.headers).toHaveLength(2);
    });
  });

  describe("extractArticleMetadata", () => {
    it("should extract title from og:title meta tag", () => {
      const html = `<html><head><meta property="og:title" content="My Article Title"></head><body></body></html>`;
      const result = extractArticleMetadata(html, "https://example.com");
      expect(result.title).toBe("My Article Title");
    });

    it("should fallback to URL if no title found", () => {
      const html = `<html><head></head><body></body></html>`;
      const result = extractArticleMetadata(html, "https://example.com/article");
      expect(result.title).toBe("https://example.com/article");
    });

    it("should extract author from meta tag", () => {
      const html = `<html><head><meta name="author" content="John Doe"></head><body></body></html>`;
      const result = extractArticleMetadata(html, "https://example.com");
      expect(result.author).toBe("John Doe");
    });
  });

  describe("scoreArticleQuality", () => {
    it("should score high quality with headers and sufficient words", () => {
      const longText = "This is a long article with many words that exceeds the minimum threshold for high quality content. ".repeat(20);
      expect(scoreArticleQuality(longText, true)).toBe("high");
    });

    it("should score low quality with too few words", () => {
      expect(scoreArticleQuality("Short text", true)).toBe("low");
    });

    it("should score medium without headers and moderate word count", () => {
      const text = "This is a moderately long article with enough words to pass the low threshold but not having headers. ".repeat(10);
      expect(scoreArticleQuality(text, false)).toBe("medium");
    });
  });

  describe("segmentArticleIntoBeats", () => {
    it("should use header-based segmentation when headers exist", () => {
      const content = "Intro paragraph. Section one content. Section two content.";
      const headers = [
        { text: "Section 1", level: 2 },
        { text: "Section 2", level: 2 },
      ];

      const beats = segmentArticleIntoBeats(content, headers);
      expect(beats.length).toBeGreaterThan(0);
    });

    it("should use paragraph-based segmentation when no headers exist", () => {
      const content = "Paragraph one.\n\nParagraph two.\n\nParagraph three.\n\nParagraph four.\n\nParagraph five.\n\nParagraph six.\n\nParagraph seven.\n\nParagraph eight.";
      const beats = segmentArticleIntoBeats(content, []);
      expect(beats.length).toBeGreaterThan(0);
    });
  });
});
