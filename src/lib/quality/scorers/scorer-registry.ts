import type { QualityScore, OutputType, ScoringContext } from "../types";
import { scoreSEO } from "./seo-scorer";
import { scoreScript } from "./script-scorer";
import { scorePost } from "./post-scorer";

type ScorerFunction<T = unknown> = (
  output: T,
  context: ScoringContext
) => QualityScore;

const scorerMap: Record<OutputType, ScorerFunction> = {
  seo: (output, context) =>
    scoreSEO(
      output as Parameters<typeof scoreSEO>[0],
      context.trendsData || null
    ),
  script: (output, context) =>
    scoreScript(
      output as Parameters<typeof scoreScript>[0],
      context.voiceProfile || null,
      context.hookPatterns || [],
      context.format || "long-form"
    ),
  social_x: (output) => scorePost(output, "x"),
  social_instagram: (output) => scorePost(output, "instagram"),
  social_facebook: (output) => scorePost(output, "facebook"),
};

export function getScorer(outputType: OutputType): ScorerFunction {
  return scorerMap[outputType];
}

export function scoreOutput(
  output: unknown,
  outputType: OutputType,
  context: ScoringContext = {}
): QualityScore {
  const scorer = getScorer(outputType);
  return scorer(output, context);
}