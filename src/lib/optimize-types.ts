export interface SeoTitle {
  rank: number;
  text: string;
  char_count: number;
  primary_keyword_position: number;
  power_word_used: string;
  ctr_rationale: string;
  seo_score: number;
  seo_grade: "A" | "B+" | "B" | "C" | "D" | "F";
}

export interface SeoTag {
  tag: string;
  tier: "broad" | "medium" | "niche";
  seo_score: number;
  seo_grade: "A" | "B+" | "B" | "C" | "D" | "F";
}

export interface ThumbnailConcept {
  concept_number: number;
  text_overlay: string;
  visual_composition: string;
  colour_recommendation: string;
  emotional_trigger: string;
  seo_score: number;
  seo_grade: "A" | "B+" | "B" | "C" | "D" | "F";
}

export interface SeoChapter {
  timestamp: string;
  title: string;
}

export interface SeoDescription {
  full_text: string;
  word_count: number;
  primary_keyword_in_first_25_words: boolean;
  seo_score: number;
  seo_grade: "A" | "B+" | "B" | "C" | "D" | "F";
}

export interface SeoPackage {
  titles: SeoTitle[];
  description: SeoDescription;
  tags: SeoTag[];
  thumbnail_concepts: ThumbnailConcept[];
  chapters: SeoChapter[];
  pinned_comment: string;
}
