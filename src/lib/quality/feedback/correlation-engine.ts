import {
  collection,
  query,
  where,
  getDocs,
} from "firebase/firestore";
import { db } from "../../firebase";
import { getTrackedContent } from "./content-tracker";
import { STRONG_CORRELATION_THRESHOLD } from "../constants";
import type { CorrelationResult, PerformanceSnapshot, ScoreBreakdown } from "../types";

interface ScorePerformancePair {
  scoreBreakdown: ScoreBreakdown;
  metrics: Record<string, number>;
}

export async function computeCorrelations(
  userId: string
): Promise<CorrelationResult[]> {
  const trackedContent = await getTrackedContent(userId, {
    hasPublishedUrl: true,
  });

  if (trackedContent.length < 5) return [];

  const pairs: ScorePerformancePair[] = [];

  for (const entry of trackedContent) {
    // Get the 28d performance snapshot
    const q = query(
      collection(db, "performanceSnapshots"),
      where("trackingEntryId", "==", entry.id),
      where("window", "==", "28d")
    );
    const snapshot = await getDocs(q);

    if (snapshot.empty) continue;

    const perfData = snapshot.docs[0].data() as PerformanceSnapshot;

    // Use stored scoreBreakdown if available, otherwise log warning and skip
    if (!entry.scoreBreakdown || Object.keys(entry.scoreBreakdown).length === 0) {
      console.warn(
        `[CorrelationEngine] No scoreBreakdown stored for tracking entry ${entry.id}. ` +
        `Running computeCorrelations without score data will produce no insights. ` +
        `Ensure scoreBreakdown is stored when tracking content.`
      );
      continue;
    }

    pairs.push({
      scoreBreakdown: entry.scoreBreakdown,
      metrics: perfData.metrics,
    });
  }

  if (pairs.length < 5) return [];

  // Compute Pearson correlations between each score criterion and each metric
  const results: CorrelationResult[] = [];
  const criteria = extractAllCriteria(pairs);
  const metricNames = extractAllMetricNames(pairs);

  for (const criterion of criteria) {
    for (const metric of metricNames) {
      const criterionValues = pairs.map((p) => p.scoreBreakdown[criterion]?.score ?? 0);
      const metricValues = pairs.map((p) => p.metrics[metric] ?? 0);

      const correlation = pearsonCorrelation(criterionValues, metricValues);

      if (Math.abs(correlation) >= STRONG_CORRELATION_THRESHOLD) {
        results.push({
          criterion,
          metric,
          correlation: Math.round(correlation * 100) / 100,
          insight: generateInsightText(criterion, metric, correlation),
          direction: correlation > 0 ? "positive" : "negative",
        });
      }
    }
  }

  return results.sort((a, b) => Math.abs(b.correlation) - Math.abs(a.correlation));
}

function pearsonCorrelation(x: number[], y: number[]): number {
  const n = x.length;
  if (n === 0) return 0;

  const meanX = x.reduce((a, b) => a + b, 0) / n;
  const meanY = y.reduce((a, b) => a + b, 0) / n;

  let num = 0;
  let denX = 0;
  let denY = 0;

  for (let i = 0; i < n; i++) {
    const dx = x[i] - meanX;
    const dy = y[i] - meanY;
    num += dx * dy;
    denX += dx * dx;
    denY += dy * dy;
  }

  const den = Math.sqrt(denX * denY);
  if (den === 0) return 0;

  return num / den;
}

function extractAllCriteria(pairs: ScorePerformancePair[]): string[] {
  const criteriaSet = new Set<string>();
  for (const pair of pairs) {
    for (const key of Object.keys(pair.scoreBreakdown)) {
      criteriaSet.add(key);
    }
  }
  return [...criteriaSet];
}

function extractAllMetricNames(pairs: ScorePerformancePair[]): string[] {
  const metricSet = new Set<string>();
  for (const pair of pairs) {
    for (const key of Object.keys(pair.metrics)) {
      metricSet.add(key);
    }
  }
  return [...metricSet];
}

function generateInsightText(
  criterion: string,
  metric: string,
  correlation: number
): string {
  const direction = correlation > 0 ? "higher" : "lower";
  const strength =
    Math.abs(correlation) >= 0.7 ? "strongly" : Math.abs(correlation) >= 0.5 ? "moderately" : "weakly";

  return `${criterion} ${strength} correlates with ${direction} ${metric}`;
}
