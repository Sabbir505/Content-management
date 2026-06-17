import type { ContentItem } from "@/types/content";
import type { VideoWithOutlier } from "@/types/video";

// Source-specific score normalization constants
// These map typical score ranges to 0-100 scale
const SOURCE_BASELINES: Record<string, { typicalMax: number; typicalMedian: number }> = {
  hackernews: { typicalMax: 500, typicalMedian: 50 },
  reddit: { typicalMax: 5000, typicalMedian: 200 },
  devto: { typicalMax: 100, typicalMedian: 10 },
  googlenews: { typicalMax: 1, typicalMedian: 1 }, // No scores available
};

/**
 * Normalize a raw score from a specific source to 0-100 scale.
 * Uses logarithmic scaling to handle wide ranges and give smaller scores visibility.
 */
function normalizeSourceScore(source: string, rawScore: number): number {
  const baseline = SOURCE_BASELINES[source];
  if (!baseline || baseline.typicalMax <= 1) {
    return 50; // Default for sources without scores (e.g., Google News)
  }

  // Logarithmic normalization: ln(score + 1) / ln(max + 1) * 100
  const normalized = (Math.log(rawScore + 1) / Math.log(baseline.typicalMax + 1)) * 100;
  return Math.min(Math.max(normalized, 0), 100);
}

/**
 * Calculate age in hours from a published date string.
 */
function getAgeHours(publishedAt: string): number {
  const published = new Date(publishedAt).getTime();
  const now = Date.now();
  return Math.max((now - published) / (1000 * 60 * 60), 0.01); // Min 0.01h to avoid division by zero
}

/**
 * Calculate recency boost using exponential decay.
 * @param ageHours - Age in hours
 * @param halfLifeHours - Half-life in hours (default: 24h for articles)
 */
function calculateRecencyBoost(ageHours: number, halfLifeHours: number = 24): number {
  return Math.exp(-ageHours / halfLifeHours);
}

/**
 * Calculate velocity score: engagement per hour, log-scaled.
 */
function calculateVelocityScore(normalizedScore: number, ageHours: number): number {
  const velocity = normalizedScore / ageHours;
  return Math.min(Math.log10(velocity * 10 + 1) * 25, 100);
}

/**
 * Calculate engagement quality based on comment-to-score ratio.
 * High comment ratio = more discussion = higher quality signal.
 */
function calculateEngagementQuality(
  score: number,
  commentCount: number,
  source: string
): number {
  if (score <= 0 || commentCount <= 0) return 0;

  // Normalize comment ratio: comments per point of score
  const commentRatio = commentCount / score;

  // Scale and cap: 0.1 comments per point = strong signal
  const qualityScore = Math.min(commentRatio * 50, 100);

  // Boost for sources with naturally lower comment ratios (Reddit)
  const sourceMultiplier = source === "reddit" ? 1.5 : 1.0;

  return Math.min(qualityScore * sourceMultiplier, 100);
}

/**
 * Calculate a unified discovery score for articles/content items.
 *
 * Weights:
 * - Velocity (engagement per hour): 35% — surfaces rising trends
 * - Engagement quality (comment ratio): 30% — surfaces discussion-worthy content
 * - Normalized score: 20% — raw popularity, source-normalized
 * - Recency boost: 15% — favors fresh content
 */
export function calculateContentDiscoveryScore(item: ContentItem): number {
  const ageHours = getAgeHours(item.publishedAt);
  const normalizedScore = normalizeSourceScore(item.source, item.score);

  // 1. Velocity: engagement per hour (35%)
  const velocityScore = calculateVelocityScore(normalizedScore, ageHours);

  // 2. Engagement quality: comment-to-score ratio (30%)
  const engagementQuality = calculateEngagementQuality(
    item.score,
    item.commentCount || 0,
    item.source
  );

  // 3. Normalized score (20%)
  const popularityScore = normalizedScore;

  // 4. Recency boost (15%)
  const recencyBoost = calculateRecencyBoost(ageHours, 24) * 100;

  const discoveryScore =
    velocityScore * 0.35 +
    engagementQuality * 0.3 +
    popularityScore * 0.2 +
    recencyBoost * 0.15;

  return Math.round(discoveryScore * 10) / 10; // Round to 1 decimal
}

/**
 * Calculate a unified discovery score for YouTube videos.
 *
 * Weights:
 * - Outlier score (virality relative to channel): 35% — your existing best signal
 * - Engagement rate (comments + likes per view): 25% — quality of engagement
 * - View velocity (views per hour): 25% — rising trends
 * - Recency boost: 15% — fresh content
 */
export function calculateVideoDiscoveryScore(video: VideoWithOutlier): number {
  const ageHours = getAgeHours(video.publishedAt);

  // 1. Outlier score: views relative to channel average (35%)
  // Cap at 10x for scoring purposes
  const outlierWeight = Math.min(video.outlierScore / 10, 1);
  const outlierScore = outlierWeight * 100;

  // 2. Engagement rate: comments + likes per 1000 views (25%)
  const commentRate = video.viewCount > 0 ? (video.commentCount / video.viewCount) * 1000 : 0;
  const likeRate = video.viewCount > 0 ? (video.likeCount / video.viewCount) * 1000 : 0;
  // Engagement score: combine comment rate (weighted higher) and like rate
  const engagementScore = Math.min(commentRate * 5 + likeRate * 0.5, 100);

  // 3. View velocity: views per hour, log-scaled (25%)
  const velocity = video.viewCount / ageHours;
  const velocityScore = Math.min(Math.log10(velocity + 1) * 12, 100);

  // 4. Recency boost: half-life of 48 hours for videos (15%)
  const recencyBoost = calculateRecencyBoost(ageHours, 48) * 100;

  const discoveryScore =
    outlierScore * 0.35 +
    engagementScore * 0.25 +
    velocityScore * 0.25 +
    recencyBoost * 0.15;

  return Math.round(discoveryScore * 10) / 10; // Round to 1 decimal
}

/**
 * Sort content items by discovery score (descending).
 */
export function sortByDiscoveryScore<T extends { discoveryScore: number }>(
  items: T[]
): T[] {
  return [...items].sort((a, b) => b.discoveryScore - a.discoveryScore);
}

/**
 * Interleave videos and articles into a single unified feed.
 * Sorts by discovery score, with optional source diversity boost.
 */
export function interleaveUnifiedFeed(
  videos: (VideoWithOutlier & { discoveryScore: number })[],
  articles: (ContentItem & { discoveryScore: number })[]
): Array<
  | (VideoWithOutlier & { discoveryScore: number; contentType: "video" })
  | (ContentItem & { discoveryScore: number; contentType: "article" })
> {
  const typedVideos = videos.map((v) => ({ ...v, contentType: "video" as const }));
  const typedArticles = articles.map((a) => ({ ...a, contentType: "article" as const }));

  const combined = [...typedVideos, ...typedArticles];

  // Sort by discovery score descending
  return combined.sort((a, b) => b.discoveryScore - a.discoveryScore);
}
