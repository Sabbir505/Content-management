import {
  doc,
  setDoc,
  getDoc,
  type Firestore,
} from "firebase/firestore";
import { db } from "../../firebase";
import { computeCorrelations } from "./correlation-engine";
import { getTrackedContent } from "./content-tracker";
import {
  MIN_TRACKED_PIECES_FOR_CALIBRATION,
  CALIBRATION_INTERVAL_DAYS,
  MAX_WEIGHT_ADJUSTMENT,
  WEIGHT_ADJUSTMENT_STEP,
  STRONG_CORRELATION_THRESHOLD,
  DEFAULT_SCORER_WEIGHTS,
} from "../constants";
import type { ScorerWeights } from "../types";
import { incrementScorerVersion } from "../version";

function ensureDb(): Firestore {
  if (!db) throw new Error("Firestore is not configured. Set NEXT_PUBLIC_FIREBASE_* env vars.");
  return db;
}

export async function shouldCalibrate(userId: string): Promise<boolean> {
  const tracked = await getTrackedContent(userId, { hasPublishedUrl: true });
  if (tracked.length < MIN_TRACKED_PIECES_FOR_CALIBRATION) return false;

  const currentWeights = await getUserWeights(userId);
  if (!currentWeights.calibrationRunAt) return true;

  const lastCalibration = new Date(currentWeights.calibrationRunAt);
  const daysSince = (Date.now() - lastCalibration.getTime()) / (1000 * 60 * 60 * 24);

  return daysSince >= CALIBRATION_INTERVAL_DAYS;
}

export async function runCalibration(userId: string): Promise<ScorerWeights> {
  const correlations = await computeCorrelations(userId);
  const currentWeights = await getUserWeights(userId);

  const newWeights: Record<string, number> = { ...currentWeights.weights };

  for (const correlation of correlations) {
    const criterionKey = mapCriterionToWeightKey(correlation.criterion);
    if (!criterionKey) continue;

    const defaultWeight = DEFAULT_SCORER_WEIGHTS[criterionKey] || 1.0;

    const adjustment =
      correlation.direction === "positive" && correlation.correlation >= STRONG_CORRELATION_THRESHOLD
        ? WEIGHT_ADJUSTMENT_STEP
        : correlation.direction === "negative" && Math.abs(correlation.correlation) >= STRONG_CORRELATION_THRESHOLD
          ? -WEIGHT_ADJUSTMENT_STEP
          : 0;

    if (adjustment !== 0) {
      const newWeight = defaultWeight + adjustment;
      // Clamp to +/- MAX_WEIGHT_ADJUSTMENT from default
      newWeights[criterionKey] = Math.max(
        defaultWeight - MAX_WEIGHT_ADJUSTMENT,
        Math.min(defaultWeight + MAX_WEIGHT_ADJUSTMENT, newWeight)
      );
    }
  }

  const newVersion = incrementScorerVersion();
  const now = new Date().toISOString();

  const updatedWeights: ScorerWeights = {
    version: newVersion,
    updatedAt: now,
    weights: newWeights,
  };

  const docRef = doc(ensureDb(), "scorerWeights", userId);
  await setDoc(docRef, {
    ...updatedWeights,
    userId,
    calibrationRunAt: now,
  });

  return updatedWeights;
}

export async function getUserWeights(userId: string): Promise<ScorerWeights> {
  const docRef = doc(ensureDb(), "scorerWeights", userId);
  const docSnap = await getDoc(docRef);

  if (!docSnap.exists()) {
    return {
      version: 1,
      updatedAt: new Date().toISOString(),
      weights: { ...DEFAULT_SCORER_WEIGHTS },
    };
  }

  return docSnap.data() as ScorerWeights;
}

export async function resetToDefaults(userId: string): Promise<void> {
  const docRef = doc(ensureDb(), "scorerWeights", userId);
  await setDoc(docRef, {
    userId,
    version: 1,
    updatedAt: new Date().toISOString(),
    weights: { ...DEFAULT_SCORER_WEIGHTS },
    calibrationRunAt: null,
  });
}

function mapCriterionToWeightKey(criterion: string): string | null {
  const mapping: Record<string, string> = {
    title: "seo_title_keyword_position",
    description: "seo_description_keyword",
    tags: "seo_tags_count",
    keyword_data: "seo_keyword_score",
    hook: "script_hook_length",
    structure: "script_structure_beats",
    pacing: "script_pacing_length",
    voice: "script_voice_sentence_length",
    hook_tweet: "post_hook_length",
    thread_structure: "post_structure",
    caption_structure: "post_structure",
    hashtags: "post_hashtags",
    engagement: "post_engagement",
    post_structure: "post_structure",
  };

  return mapping[criterion] || null;
}
