import { describe, it, expect } from "vitest";
import { parseStructuralResponse } from "./llm-analysis";

describe("LLM Analysis", () => {
  describe("parseStructuralResponse", () => {
    it("should parse valid JSON response", () => {
      const validJson = JSON.stringify({
        structural_breakdown: {
          hook: {
            type: "bold_claim",
            technique: "Opens with a surprising statistic",
            exact_text: "90% of people do this wrong",
            why_it_works: "Creates immediate curiosity gap",
          },
          intro: {
            approach: "Promise-based",
            viewer_promise: "You'll learn the right way",
          },
          beats: [
            {
              beat_number: 1,
              label: "The Problem",
              purpose: "Establish pain point",
              technique_used: "Relatable scenario",
              transition_to_next: "Now let me show you the solution",
            },
          ],
          outro: {
            style: "Direct CTA",
            cta_type: "subscribe",
            cta_exact_phrase: "Subscribe for more tips",
          },
          overall: {
            dominant_format: "educational",
            pacing: "medium",
            tone: "conversational",
            replicability_score: 8,
            replicability_note: "Easy to adapt",
            best_for_niches: ["education", "how-to"],
          },
        },
      });

      const result = parseStructuralResponse(validJson);
      expect(result.hook.type).toBe("bold_claim");
      expect(result.hook.technique).toBe("Opens with a surprising statistic");
      expect(result.beats).toHaveLength(1);
      expect(result.overall.replicability_score).toBe(8);
    });

    it("should return fallback breakdown for invalid JSON", () => {
      const result = parseStructuralResponse("not valid json");
      expect(result.hook.type).toBe("other");
      expect(result.beats).toHaveLength(0);
      expect(result.overall.replicability_score).toBe(5);
    });

    it("should return fallback for JSON missing structural_breakdown", () => {
      const result = parseStructuralResponse('{"other_field": "value"}');
      expect(result.hook.type).toBe("other");
      expect(result.beats).toHaveLength(0);
    });
  });
});
