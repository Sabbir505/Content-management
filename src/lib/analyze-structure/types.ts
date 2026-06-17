export type SourceType = "video" | "article";

export type HookType =
  | "bold_claim"
  | "question"
  | "story"
  | "statistic"
  | "counter_intuitive"
  | "controversy"
  | "other";

export type DominantFormat =
  | "educational"
  | "opinion"
  | "story"
  | "listicle"
  | "documentary"
  | "hybrid";

export type Pacing = "fast" | "medium" | "slow";

export type TranscriptQuality = "high" | "medium" | "low";

export interface Hook {
  type: HookType;
  technique: string;
  exact_text: string;
  why_it_works: string;
}

export interface Intro {
  approach: string;
  viewer_promise: string;
}

export interface Beat {
  beat_number: number;
  label: string;
  purpose: string;
  technique_used: string;
  transition_to_next: string;
}

export interface Outro {
  style: string;
  cta_type: string;
  cta_exact_phrase: string;
}

export interface Overall {
  dominant_format: DominantFormat;
  pacing: Pacing;
  tone: string;
  replicability_score: number;
  replicability_note: string;
  best_for_niches: string[];
}

export interface StructuralBreakdown {
  hook: Hook;
  intro: Intro;
  beats: Beat[];
  outro: Outro;
  overall: Overall;
}

export interface VideoSourceSpecific {
  duration_seconds: number;
  transcript_quality: TranscriptQuality;
}

export interface ArticleSourceSpecific {
  word_count: number;
  read_time_minutes: number;
  had_headers: boolean;
}

export interface AnalyzeResult {
  source_type: SourceType;
  structural_breakdown: StructuralBreakdown;
  source_specific: {
    video: VideoSourceSpecific | null;
    article: ArticleSourceSpecific | null;
  };
}

// Pipeline intermediate types

export interface TimedSegment {
  start_time_seconds: number;
  end_time_seconds: number;
  text: string;
  word_count: number;
}

export interface ArticleSegment {
  beat_number: number;
  start_word_index: number;
  end_word_index: number;
  text: string;
  word_count: number;
  had_header: boolean;
  header_text: string;
}

export interface VideoPipelineInput {
  videoId: string;
  title: string;
  channelTitle: string;
  viewCount: number;
  duration: string; // ISO 8601 like PT14M32S
  publishedAt: string;
  description: string;
  tags: string[];
}

export interface ArticlePipelineInput {
  url: string;
  title: string;
  author?: string;
  publishedAt?: string;
  content: string;
  wordCount: number;
  hadHeaders: boolean;
  headers?: { text: string; level: number }[];
}

export interface PipelineFailure {
  reason: string;
  message: string;
  recoverable: boolean;
}
