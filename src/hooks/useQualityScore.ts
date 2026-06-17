"use client";

import { useMutation } from "@tanstack/react-query";
import type { QualityScore, OutputType, ScoringContext } from "@/lib/quality/types";

export function useQualityScore() {
  return useMutation({
    mutationFn: async ({
      output,
      outputType,
      context,
    }: {
      output: unknown;
      outputType: OutputType;
      context?: ScoringContext;
    }) => {
      const response = await fetch("/api/quality/score", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ output, outputType, context }),
      });

      if (!response.ok) {
        throw new Error("Failed to score output");
      }

      const result = await response.json();
      if (!result.success) {
        throw new Error(result.error || "Scoring failed");
      }

      return result.data as QualityScore;
    },
  });
}
