import type {
  ScoredOutput,
  QualityScore,
  OutputType,
  ScoringContext,
} from "./types";
import { SCORE_THRESHOLD, MAX_REGENERATION_ATTEMPTS } from "./constants";
import { scoreOutput } from "./scorers/scorer-registry";

export async function evaluateAndDeliver<T>(
  output: T,
  outputType: OutputType,
  context: ScoringContext,
  regenerateFn: (
    output: T,
    issues: string[],
    suggestions: string[]
  ) => Promise<T>,
  attempt: number = 1
): Promise<ScoredOutput<T>> {
  const score = scoreOutput(output, outputType, context);

  if (score.score >= SCORE_THRESHOLD) {
    return {
      output,
      score,
      attempt,
      autoRegenerated: attempt > 1,
    };
  }

  if (attempt >= MAX_REGENERATION_ATTEMPTS) {
    return {
      output,
      score,
      attempt,
      autoRegenerated: true,
    };
  }

  // Collect all issues from breakdown
  const allIssues: string[] = [];
  for (const category of Object.values(score.breakdown)) {
    for (const issue of category.issues) {
      allIssues.push(issue);
    }
  }

  try {
    const regenerated = await regenerateFn(
      output,
      allIssues,
      score.suggestions
    );
    return evaluateAndDeliver(
      regenerated,
      outputType,
      context,
      regenerateFn,
      attempt + 1
    );
  } catch (error) {
    console.error("Auto-regeneration failed:", error);
    return {
      output,
      score,
      attempt,
      autoRegenerated: false,
    };
  }
}

export function buildRegenerationPrompt(
  score: QualityScore,
  outputType: OutputType
): string {
  const issues = Object.values(score.breakdown)
    .flatMap((b) => b.issues)
    .map((i) => `- ${i}`)
    .join("\n");

  const suggestions = score.suggestions
    .map((s) => `- ${s}`)
    .join("\n");

  return `REGENERATION CONTEXT
--------------------
The previous generation attempt scored ${score.score}/100 and did not
meet the quality threshold. It was not shown to the user.

The following specific issues were identified by the quality scorer:

${issues}

The following improvements are required in this new attempt:

${suggestions}

Regenerate the output below, specifically addressing every issue listed above.
Do not repeat the same mistakes. The requirements in the system prompt still
apply in full.

---

`;
}