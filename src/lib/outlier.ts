export function calculateOutlierScore(videoViews: number, channelAvgViews: number): number {
  if (channelAvgViews === 0) return 0;
  return parseFloat((videoViews / channelAvgViews).toFixed(1));
}

/**
 * Calculate a subscriber-weighted outlier score.
 * Small channels get a bonus because virality is harder with fewer subscribers.
 * Formula: outlierScore * (1 + log10(max(subs, 1)) / 10)
 * Examples:
 *   - 1K subs: multiplier ~1.3x
 *   - 100K subs: multiplier ~1.5x
 *   - 1M subs: multiplier ~1.6x
 *   - 10M subs: multiplier ~1.7x
 */
export function calculateSubscriberWeightedOutlier(
  outlierScore: number,
  subscriberCount: number
): number {
  const subs = Math.max(subscriberCount, 1);
  const multiplier = 1 + Math.log10(subs) / 10;
  return parseFloat((outlierScore * multiplier).toFixed(1));
}

/**
 * Calculate a niche-baseline-adjusted outlier score.
 * Normalizes the outlier against the niche average, so "viral" means relative
 * to the niche, not just the channel.
 */
export function calculateNicheAdjustedOutlier(
  outlierScore: number,
  nicheBaseline: number,
  channelAvgViews: number
): number {
  if (nicheBaseline <= 0 || channelAvgViews <= 0) return outlierScore;
  // If the channel already performs above niche average, their outlier is more impressive
  const nicheRatio = channelAvgViews / nicheBaseline;
  const adjustment = Math.sqrt(Math.max(nicheRatio, 0.1));
  return parseFloat((outlierScore * adjustment).toFixed(1));
}

/**
 * Calculate view velocity trend: views per hour since last fetch.
 * Positive = accelerating, negative = decelerating.
 */
export function calculateVelocityTrend(
  currentViews: number,
  previousViews: number,
  hoursSinceFetch: number
): number {
  if (hoursSinceFetch <= 0) return 0;
  const viewDelta = currentViews - previousViews;
  return Math.round(viewDelta / hoursSinceFetch);
}

export function estimateHookType(title: string): string {
  const t = title.toLowerCase();
  if (/^why\s/.test(t) || /\?/.test(t)) return "Question";
  if (/\d+%?|\d+\s*(million|billion|thousand)/.test(t)) return "Statistic";
  if (/\b(i |my |we |our )/.test(t)) return "Story";
  if (/\b(never|always|secret|truth|nobody|everyone|stop|why\s+\w+\s+(don't|doesn't|won't|can't))/.test(t)) return "Bold Claim";
  if (/\b(how to|tutorial|guide|steps|ways)\b/.test(t)) return "How-To";
  if (/\b(should|must|need to|have to)\b/.test(t)) return "Bold Claim";
  if (/\b(best|worst|top|ultimate|complete)\b/.test(t)) return "Bold Claim";
  return "Pattern Interrupt";
}

export function estimateStructure(title: string): string {
  const lowerTitle = title.toLowerCase();

  if (lowerTitle.includes("top ") || lowerTitle.includes("best ") || lowerTitle.includes("ways ")) {
    return "Listicle";
  }
  if (lowerTitle.includes("how to") || lowerTitle.includes("tutorial") || lowerTitle.includes("guide")) {
    return "Tutorial";
  }
  if (lowerTitle.includes("vs") || lowerTitle.includes("versus") || lowerTitle.includes("compare")) {
    return "Comparison";
  }
  if (lowerTitle.includes("story") || lowerTitle.includes("journey") || lowerTitle.includes("experience")) {
    return "Storytelling";
  }
  if (lowerTitle.includes("review") || lowerTitle.includes("opinion")) {
    return "Review";
  }

  return "Informational";
}

export function calculatePerformanceScore(video: { viewCount: number }, avgViews: number): number {
  if (avgViews === 0) return 50;
  const ratio = video.viewCount / avgViews;
  // Scale so that 1x average = 50%, 2x average = 100%
  const score = Math.min(100, Math.max(0, ratio * 50));
  return Math.round(score);
}

export function calculateImprovementPotential(performanceScore: number): number {
  if (performanceScore >= 80) return Math.max(5, 100 - performanceScore);
  if (performanceScore >= 50) return 100 - performanceScore;
  const bonus = 20 * (1 - performanceScore / 50);
  return Math.min(95, 100 - performanceScore + bonus);
}

export function calculateHealthScore(videos: { performanceScore: number }[]): { score: number; breakdown: { avgPerf: number; consistency: number; topRatio: number } } {
  if (videos.length === 0) return { score: 0, breakdown: { avgPerf: 0, consistency: 0, topRatio: 0 } };
  const avgPerf = videos.reduce((sum, v) => sum + v.performanceScore, 0) / videos.length;
  const consistency = 100 - (videos.reduce((sum, v) => sum + Math.abs(v.performanceScore - avgPerf), 0) / videos.length);
  const topRatio = videos.filter((v) => v.performanceScore >= 80).length / videos.length;
  const score = Math.round((avgPerf * 0.5 + consistency * 0.3 + topRatio * 100 * 0.2));
  return { score, breakdown: { avgPerf: Math.round(avgPerf), consistency: Math.round(consistency), topRatio: Math.round(topRatio * 100) } };
}

export function isShortVideo(durationSeconds: number): boolean {
  return durationSeconds <= 60;
}
