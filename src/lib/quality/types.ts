// ---- Layer 1: Data Grounding ----

export interface GoogleTrendsResult {
  primaryKeyword: string;
  searchScore: number; // 0-100
  trendDirection: "rising" | "stable" | "falling";
  relatedRising: string[];
  relatedTop: string[];
  seasonal: boolean;
  recommendedTags: string[];
  fetchedAt: string;
}

export interface YouTubeAutocompleteResult {
  query: string;
  suggestions: string[];
  fetchedAt: string;
}

export interface ViralHookPattern {
  id: string;
  hookText: string;
  videoId: string;
  niche: string;
  outlierScore: number;
  engagementMetrics: {
    views: number;
    likes: number;
    comments: number;
  };
  dateAdded: string;
}

export interface ViralPostPattern {
  id: string;
  platform: "x" | "instagram" | "facebook";
  patternText: string;
  patternType: "hook" | "cta" | "structure";
  engagementRate: number;
  niche: string;
  dateAdded: string;
}

export interface GroundingContext {
  trendsData: GoogleTrendsResult | null;
  autocompleteData: YouTubeAutocompleteResult | null;
  hookPatterns: ViralHookPattern[];
  postPatterns: ViralPostPattern[];
}

// ---- Layer 2: Scoring Engine ----

export type ScoreGrade = "A" | "B+" | "B" | "C" | "D" | "F";

export interface ScoreBreakdownItem {
  score: number;
  max: number;
  issues: string[];
}

export interface ScoreBreakdown {
  [category: string]: ScoreBreakdownItem;
}

export interface QualityScore {
  score: number; // 0-100
  grade: ScoreGrade;
  passedThreshold: boolean; // score >= 60
  breakdown: ScoreBreakdown;
  suggestions: string[];
  scorerVersion: number;
  scoredAt: string;
}

export interface ScoredOutput<T = unknown> {
  output: T;
  score: QualityScore;
  attempt: number; // 1 or 2
  autoRegenerated: boolean;
}

export type OutputType =
  | "seo"
  | "script"
  | "social_x"
  | "social_instagram"
  | "social_facebook";

export interface ScorerWeights {
  version: number;
  updatedAt: string;
  weights: Record<string, number>; // category -> weight multiplier (1.0 = default)
  calibrationRunAt?: string | null;
}

export interface ScoringContext {
  trendsData?: GoogleTrendsResult | null;
  voiceProfile?: {
    avgSentenceLength: number;
    vocabulary: string;
    tone: string;
    sampleSentences: string[];
  } | null;
  hookPatterns?: ViralHookPattern[];
  format?: "long-form" | "shorts";
}

// ---- Layer 3: Feedback Loop ----

export type PlatformType = "youtube" | "x" | "instagram" | "facebook";

export const PLATFORM_TYPES: readonly PlatformType[] = ["youtube", "x", "instagram", "facebook"] as const;

export interface PlatformConnection {
  platform: PlatformType;
  connected: boolean;
  connectedAt: string | null;
  tokenExpiry: string | null;
  platformUserId: string | null;
  platformUsername: string | null;
}

export interface ContentTrackingEntry {
  id: string;
  userId: string;
  contentId: string;
  contentType: OutputType;
  scoreAtGeneration: number;
  scoreBreakdown: ScoreBreakdown | null;
  niche: string;
  voiceProfileVersion: number;
  generationDate: string;
  platform: PlatformType;
  publishedUrl: string | null;
  publishedAt: string | null;
}

export interface PerformanceSnapshot {
  id: string;
  trackingEntryId: string;
  window: "48h" | "7d" | "28d";
  fetchedAt: string;
  metrics: Record<string, number>;
}

export interface CorrelationResult {
  criterion: string;
  metric: string;
  correlation: number; // -1 to 1
  insight: string;
  direction: "positive" | "negative";
}

export interface PerformanceInsights {
  totalGenerated: number;
  totalTracked: number;
  platformBreakdown: {
    platform: PlatformType;
    count: number;
    avgMetrics: Record<string, number>;
    vsBaseline: Record<string, number>;
  }[];
  workingInsights: CorrelationResult[];
  notWorkingInsights: CorrelationResult[];
  lastCalibratedAt: string | null;
}

// ---- YouTube Search Cache ----

export interface YouTubeSearchResult {
  query: string;
  videos: VideoWithOutlier[];
  fromCache: boolean;
  cachedAt?: string;
  fetchedAt: string;
}

export interface YouTubeSearchError {
  type: "quota_exceeded" | "api_error" | "rate_limited" | "unknown";
  message: string;
  retryAfter?: number;
  isQuotaExceeded: boolean;
}

// Import VideoWithOutlier type for the above
import type { VideoWithOutlier } from "@/types/video";