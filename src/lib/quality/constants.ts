import type { ScoreGrade } from "./types";

export const SCORE_THRESHOLD = 60;
export const MAX_REGENERATION_ATTEMPTS = 2;
export const CURRENT_SCORER_VERSION = 1;

// ---- Power Words ----

export const POWER_WORDS = [
  "why", "how", "best", "never", "always", "secret", "proven", "real",
  "truth", "hidden", "shocking", "surprising", "essential", "ultimate",
  "complete", "simple", "easy", "fast", "instant", "guaranteed", "free",
  "exclusive", "limited", "new", "powerful", "surprising",
];

export const POWER_WORDS_REGEX = new RegExp(
  POWER_WORDS.map((w) => `\\b${w}\\b`).join("|"),
  "i"
);

// ---- CTA Indicators ----

export const CTA_INDICATORS = [
  "comment below",
  "subscribe",
  "link in description",
  "next video",
  "follow me",
  "check out",
  "watch next",
  "let me know",
  "what do you think",
  "share this",
  "retweet",
  "reply",
  "link in bio",
  "send this to",
  "save this",
];

export const CTA_REGEX = new RegExp(CTA_INDICATORS.join("|"), "i");

// ---- Shareability Phrases ----

export const SHAREABILITY_PHRASES = [
  "most people don't know",
  "share this if",
  "send this to",
  "tag someone who",
  "save this for later",
  "share with someone",
];

export const SHAREABILITY_REGEX = new RegExp(
  SHAREABILITY_PHRASES.join("|"),
  "i"
);

// ---- Generic Openers (to penalize) ----

export const GENERIC_OPENERS = [
  "hey everyone",
  "just posted",
  "new video",
  "check out",
  "in this video",
  "today we're going to",
  "welcome back to",
  "what's up guys",
  "hi guys",
];

export const GENERIC_OPENERS_REGEX = new RegExp(
  `^(${GENERIC_OPENERS.join("|")})`,
  "i"
);

// ---- Pattern Match: Hook Types ----

export const HOOK_PATTERNS = {
  question: /\?/,
  boldClaim:
    /\b(never|always|every|most people|the truth|secret|nobody|everyone)\b/i,
  statistic: /\d+%|\d+\s*(million|billion|thousand)|times|percent/i,
  story: /\b(i |my |we |our )/i,
  counterIntuitive:
    /\b(but|however|actually|surprisingly|shockingly|despite)\b/i,
};

// ---- Pattern-Interrupt Openers (X/Twitter) ----

export const PATTERN_INTERRUPT_OPENERS = [
  "most people",
  "unpopular opinion",
  "hot take",
  "stop",
  "the truth about",
  "nobody talks about",
  "why no one",
  "the real reason",
];

export const PATTERN_INTERRUPT_REGEX = new RegExp(
  PATTERN_INTERRUPT_OPENERS.join("|"),
  "i"
);

// ---- Grade Mapping ----

export interface GradeEntry {
  min: number;
  max: number;
  grade: ScoreGrade;
  label: string;
  behavior: string;
}

export const GRADE_MAP: GradeEntry[] = [
  { min: 90, max: 100, grade: "A", label: "Excellent", behavior: "Delivered immediately" },
  { min: 80, max: 89, grade: "B+", label: "Strong", behavior: "Delivered immediately" },
  { min: 70, max: 79, grade: "B", label: "Good", behavior: "Delivered immediately" },
  { min: 60, max: 69, grade: "C", label: "Acceptable", behavior: "Delivered with suggestions" },
  { min: 45, max: 59, grade: "D", label: "Weak", behavior: "Auto-regenerate once before showing" },
  { min: 0, max: 44, grade: "F", label: "Poor", behavior: "Auto-regenerate once; if still fails, show with full warning" },
];

export function getGrade(score: number): { grade: ScoreGrade; label: string; behavior: string } {
  for (const entry of GRADE_MAP) {
    if (score >= entry.min && score <= entry.max) {
      return { grade: entry.grade, label: entry.label, behavior: entry.behavior };
    }
  }
  return { grade: "F", label: "Poor", behavior: "Show with full warning" };
}

// ---- Default Scorer Weights ----

export const DEFAULT_SCORER_WEIGHTS: Record<string, number> = {
  seo_title_keyword_position: 1.0,
  seo_title_length: 1.0,
  seo_title_power_word: 1.0,
  seo_description_keyword: 1.0,
  seo_description_length: 1.0,
  seo_description_timestamps: 1.0,
  seo_tags_count: 1.0,
  seo_tags_trending_match: 1.0,
  seo_keyword_score: 1.0,
  seo_keyword_trend: 1.0,
  script_hook_length: 1.0,
  script_hook_pattern: 1.0,
  script_structure_beats: 1.0,
  script_structure_cta: 1.0,
  script_pacing_length: 1.0,
  script_pacing_balance: 1.0,
  script_voice_sentence_length: 1.0,
  script_voice_vocabulary: 1.0,
  post_hook_length: 1.0,
  post_hook_pattern: 1.0,
  post_structure: 1.0,
  post_engagement: 1.0,
  post_hashtags: 1.0,
};

// ---- Word Count Ranges ----

export const FORMAT_RANGES: Record<string, { min: number; max: number }> = {
  "long-form": { min: 1400, max: 2600 },
  shorts: { min: 75, max: 150 },
};

// ---- Hashtag Tier Thresholds (Instagram) ----

export const HASHTAG_TIERS = {
  broad: 1_000_000, // >1M posts
  medium: 100_000, // 100K–1M
  // niche: <100K
};

// ---- Correlation Thresholds ----

export const MIN_TRACKED_PIECES_FOR_CALIBRATION = 5;
export const CALIBRATION_INTERVAL_DAYS = 14;
export const MAX_WEIGHT_ADJUSTMENT = 0.3; // +/-30% cap
export const WEIGHT_ADJUSTMENT_STEP = 0.2; // +/-20% per strong correlation
export const STRONG_CORRELATION_THRESHOLD = 0.3;

// ---- Performance Pull Windows ----

export const PERFORMANCE_WINDOWS = [
  { name: "48h" as const, ms: 48 * 60 * 60 * 1000 },
  { name: "7d" as const, ms: 7 * 24 * 60 * 60 * 1000 },
  { name: "28d" as const, ms: 28 * 24 * 60 * 60 * 1000 },
];