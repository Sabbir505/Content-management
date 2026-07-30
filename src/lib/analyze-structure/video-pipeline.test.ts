import { describe, it, expect } from "vitest";
import {
  parseISODuration,
  cleanTranscript,
  scoreTranscriptQuality,
  segmentIntoBeats,
} from "./video-pipeline";
import type { TimedSegment } from "./types";

describe("Video Pipeline", () => {
  describe("parseISODuration", () => {
    it("should parse PT14M32S to 872 seconds", () => {
      expect(parseISODuration("PT14M32S")).toBe(14 * 60 + 32);
    });

    it("should parse PT1H30M to 5400 seconds", () => {
      expect(parseISODuration("PT1H30M")).toBe(3600 + 30 * 60);
    });

    it("should parse PT45S to 45 seconds", () => {
      expect(parseISODuration("PT45S")).toBe(45);
    });

    it("should return 0 for invalid duration", () => {
      expect(parseISODuration("invalid")).toBe(0);
    });
  });

  describe("cleanTranscript", () => {
    it("should strip non-speech markers", () => {
      const segments: TimedSegment[] = [
        { text: "Hello world", start_time_seconds: 0, end_time_seconds: 2, word_count: 2 },
        { text: "[Music]", start_time_seconds: 2, end_time_seconds: 3, word_count: 1 },
        { text: "Next sentence", start_time_seconds: 5, end_time_seconds: 7, word_count: 2 },
      ];

      const cleaned = cleanTranscript(segments);
      expect(cleaned).toHaveLength(2);
      expect(cleaned[0].text).toBe("Hello world");
      expect(cleaned[1].text).toBe("Next sentence");
    });

    it("should merge short consecutive segments", () => {
      const segments: TimedSegment[] = [
        { text: "Hello", start_time_seconds: 0, end_time_seconds: 1, word_count: 1 },
        { text: "world", start_time_seconds: 1, end_time_seconds: 2, word_count: 1 },
        { text: "This is a longer segment with many words", start_time_seconds: 5, end_time_seconds: 8, word_count: 8 },
      ];

      const cleaned = cleanTranscript(segments);
      expect(cleaned).toHaveLength(2);
      expect(cleaned[0].text).toBe("Hello world");
      expect(cleaned[0].word_count).toBe(2);
    });
  });

  describe("scoreTranscriptQuality", () => {
    it("should score high quality transcript", () => {
      const segments: TimedSegment[] = [
        { text: "Hello world this is a test", start_time_seconds: 0, end_time_seconds: 2, word_count: 6 },
        { text: "Another sentence here", start_time_seconds: 2, end_time_seconds: 4, word_count: 4 },
      ];

      expect(scoreTranscriptQuality(segments)).toBe("high");
    });

    it("should score low quality with many inaudible markers", () => {
      const segments: TimedSegment[] = [
        { text: "Hello [inaudible] world", start_time_seconds: 0, end_time_seconds: 2, word_count: 3 },
        { text: "Test [inaudible] again", start_time_seconds: 2, end_time_seconds: 4, word_count: 3 },
        { text: "More [inaudible] here", start_time_seconds: 4, end_time_seconds: 6, word_count: 3 },
        { text: "Final [inaudible] word", start_time_seconds: 6, end_time_seconds: 8, word_count: 3 },
      ];

      expect(scoreTranscriptQuality(segments)).toBe("low");
    });
  });

  describe("segmentIntoBeats", () => {
    it("should segment into time-based beats", () => {
      const segments: TimedSegment[] = [
        { text: "Beat one content", start_time_seconds: 0, end_time_seconds: 10, word_count: 3 },
        { text: "Beat one more", start_time_seconds: 10, end_time_seconds: 20, word_count: 3 },
        { text: "Beat two content", start_time_seconds: 20, end_time_seconds: 35, word_count: 3 },
        { text: "Beat two more", start_time_seconds: 35, end_time_seconds: 50, word_count: 3 },
        { text: "Beat three", start_time_seconds: 50, end_time_seconds: 65, word_count: 2 },
      ];

      const beats = segmentIntoBeats(segments);
      expect(beats.length).toBeGreaterThan(0);
      expect(beats[0].text).toContain("Beat one");
    });

    it("should handle empty segments", () => {
      const beats = segmentIntoBeats([]);
      expect(beats).toHaveLength(0);
    });
  });
});
