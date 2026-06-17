import { CURRENT_SCORER_VERSION } from "./constants";
import type { QualityScore } from "./types";

let currentVersion = CURRENT_SCORER_VERSION;

export function getCurrentScorerVersion(): number {
  return currentVersion;
}

export function incrementScorerVersion(): number {
  currentVersion += 1;
  return currentVersion;
}

export function stampScore(score: Omit<QualityScore, "scorerVersion" | "scoredAt">): QualityScore {
  return {
    ...score,
    scorerVersion: currentVersion,
    scoredAt: new Date().toISOString(),
  };
}