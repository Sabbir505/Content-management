import { getGrade } from "@/lib/channel-analytics";
import type { SeoPackage } from "@/lib/optimize-types";

export function scoreTitle(title: { text: string; char_count: number; primary_keyword_position?: number; power_word_used?: string; ctr_rationale?: string }, primaryKeyword: string): { score: number; grade: "A" | "B+" | "B" | "C" | "D" | "F" } {
  let score = 0;
  const len = title.text.length;
  if (len >= 40 && len <= 60) score += 30;
  else if (len >= 35 && len <= 65) score += 20;
  else if (len >= 30 && len <= 70) score += 10;
  if (primaryKeyword) {
    const first4 = title.text.split(/\s+/).slice(0, 4).join(" ").toLowerCase();
    if (first4.includes(primaryKeyword.toLowerCase())) score += 25;
  } else score += 25;
  const powerWords = ["why", "how", "best", "never", "always", "secret", "proven", "real", "truth", "hidden", "shocking", "surprising", "essential", "ultimate", "complete", "simple", "easy", "fast", "instant", "guaranteed", "free", "exclusive", "limited", "new", "powerful"];
  const hasPowerWord = powerWords.some(w => new RegExp(`\\b${w}\\b`, "i").test(title.text));
  if (hasPowerWord || /\d/.test(title.text)) score += 25;
  if (title.ctr_rationale && title.ctr_rationale.length > 10) score += 10;
  if (title.primary_keyword_position && title.primary_keyword_position <= 4) score += 10;
  const clamped = Math.min(100, Math.max(0, score));
  const grade = getGrade(clamped);
  return { score: clamped, grade };
}

export function scoreDescription(desc: { full_text: string; word_count: number; primary_keyword_in_first_25_words?: boolean }, primaryKeyword: string): { score: number; grade: "A" | "B+" | "B" | "C" | "D" | "F" } {
  let score = 0;
  const text = desc.full_text || "";
  if (desc.primary_keyword_in_first_25_words) score += 30;
  else if (primaryKeyword) {
    const first25 = text.split(/\s+/).slice(0, 25).join(" ").toLowerCase();
    if (first25.includes(primaryKeyword.toLowerCase())) score += 25;
  }
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  if (words >= 200) score += 30;
  else if (words >= 150) score += 20;
  else if (words >= 100) score += 10;
  if (/\d+:\d{2}/.test(text)) score += 20;
  const ctaIndicators = ["comment below", "subscribe", "link in description", "next video", "follow me", "check out", "watch next", "let me know", "what do you think", "share this"];
  if (ctaIndicators.some(c => text.toLowerCase().includes(c))) score += 10;
  if (/#\w+/.test(text)) score += 10;
  const clamped = Math.min(100, Math.max(0, score));
  const grade = getGrade(clamped);
  return { score: clamped, grade };
}

export function scoreTag(tag: { tag: string; tier: string }, primaryKeyword: string, trendsData?: { recommendedTags: string[]; relatedRising: string[] } | null): { score: number; grade: "A" | "B+" | "B" | "C" | "D" | "F" } {
  let score = 0;
  const t = tag.tag.toLowerCase();
  const wordCount = t.split(/\s+/).filter(Boolean).length;
  if (wordCount >= 2 && wordCount <= 4) score += 25;
  else if (wordCount >= 1 && wordCount <= 5) score += 15;
  if (primaryKeyword && t.includes(primaryKeyword.toLowerCase())) score += 25;
  if (trendsData) {
    const trending = [...trendsData.recommendedTags, ...trendsData.relatedRising].map(k => k.toLowerCase());
    if (trending.some(k => t.includes(k) || k.includes(t))) score += 25;
  } else score += 25;
  if (tag.tier === "broad" || tag.tier === "medium" || tag.tier === "niche") score += 25;
  const clamped = Math.min(100, Math.max(0, score));
  const grade = getGrade(clamped);
  return { score: clamped, grade };
}

export function scoreThumbnail(concept: { text_overlay: string; visual_composition: string; colour_recommendation: string; emotional_trigger: string }): { score: number; grade: "A" | "B+" | "B" | "C" | "D" | "F" } {
  let score = 0;
  if (concept.text_overlay && concept.text_overlay.length > 5) score += 30;
  else if (concept.text_overlay) score += 15;
  if (concept.visual_composition && concept.visual_composition.length > 15) score += 25;
  else if (concept.visual_composition) score += 15;
  if (concept.colour_recommendation && concept.colour_recommendation.length > 5) score += 25;
  else if (concept.colour_recommendation) score += 15;
  if (concept.emotional_trigger && concept.emotional_trigger.length > 3) score += 20;
  else if (concept.emotional_trigger) score += 10;
  const clamped = Math.min(100, Math.max(0, score));
  const grade = getGrade(clamped);
  return { score: clamped, grade };
}

export function enrichWithScores(pkg: SeoPackage, primaryKeyword: string, trendsData?: { recommendedTags: string[]; relatedRising: string[] } | null): SeoPackage {
  return {
    ...pkg,
    titles: pkg.titles.map(t => {
      const s = scoreTitle(t, primaryKeyword);
      return { ...t, seo_score: s.score, seo_grade: s.grade };
    }),
    description: { ...pkg.description, ...scoreDescription(pkg.description, primaryKeyword) },
    tags: pkg.tags.map(t => {
      const s = scoreTag(t, primaryKeyword, trendsData);
      return { ...t, seo_score: s.score, seo_grade: s.grade };
    }),
    thumbnail_concepts: pkg.thumbnail_concepts.map(tc => {
      const s = scoreThumbnail(tc);
      return { ...tc, seo_score: s.score, seo_grade: s.grade };
    }),
  };
}

export function parseSeoResponse(content: string, videoTitle: string, existingTags: string[]): SeoPackage {
  const cleanJson = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();

  try {
    const parsed = JSON.parse(cleanJson);
    return {
      titles: parsed.titles || [],
      description: parsed.description || { full_text: "", word_count: 0, primary_keyword_in_first_25_words: false },
      tags: parsed.tags || [],
      thumbnail_concepts: parsed.thumbnail_concepts || [],
      chapters: parsed.chapters || [],
      pinned_comment: parsed.pinned_comment || "",
    };
  } catch {
    return {
      titles: [
        {
          rank: 1,
          text: videoTitle,
          char_count: videoTitle.length,
          primary_keyword_position: 1,
          power_word_used: "",
          ctr_rationale: "Original title",
          seo_score: 70,
          seo_grade: "B" as const,
        },
      ],
      description: {
        full_text: `Learn about ${videoTitle}.\n\nSubscribe for more content!`,
        word_count: 10,
        primary_keyword_in_first_25_words: true,
        seo_score: 65,
        seo_grade: "B" as const,
      },
      tags: (existingTags || []).map((tag: string) => ({ tag, tier: "medium" as const, seo_score: 60, seo_grade: "C" as const })),
      thumbnail_concepts: [
        { concept_number: 1, text_overlay: "Close-up reaction shot", visual_composition: "Face fills 60% of frame", colour_recommendation: "High contrast red/black", emotional_trigger: "Curiosity", seo_score: 75, seo_grade: "A" as const },
        { concept_number: 2, text_overlay: "Before/After", visual_composition: "Split screen", colour_recommendation: "Warm vs cool tones", emotional_trigger: "Aspiration", seo_score: 70, seo_grade: "B+" as const },
        { concept_number: 3, text_overlay: "Bold number", visual_composition: "Text dominates right half", colour_recommendation: "Yellow on dark", emotional_trigger: "Surprise", seo_score: 68, seo_grade: "B" as const },
      ],
      chapters: [{ timestamp: "0:00", title: "Intro" }],
      pinned_comment: `What did you think about ${videoTitle}? Let me know in the comments!`,
    };
  }
}

export function buildSeoSystemPrompt(): string {
  return `You are TubeForge's YouTube SEO specialist. Your job is to generate high-performing YouTube metadata — titles, descriptions, tags, chapters, and thumbnail concepts — for a given video.

You operate with the following rules, non-negotiable:

TITLES
- Always place the primary keyword within the first 4 words
- Length must be between 40 and 60 characters
- Every title must contain at least one of: a number, a power word (Why / How / Best / Never / Always / Secret / Proven / Real), or a strong emotional trigger (shocking, surprising, counter-intuitive)
- Generate exactly 3 title options, ranked by estimated CTR potential
- Never use clickbait that misrepresents the video content

DESCRIPTION
- First 25 words must contain the primary keyword naturally
- Minimum 200 words total
- Structure: hook sentence → 2–3 sentence video summary → timestamps section → 3–5 relevant links/resources → CTA → hashtags (3 max)
- Write timestamps only if chapters data is provided
- End with a subscribe CTA and one engagement question

TAGS
- Generate exactly 18 tags
- Order: primary keyword first, then related keywords by search volume descending
- Mix: 6 broad tags (high volume), 6 medium tags, 6 niche/long-tail tags
- Every tag must be a real search phrase a human would type — no invented phrases
- Maximum 4 words per tag

THUMBNAIL CONCEPTS
- Generate 3 thumbnail concepts
- Each concept must include: text overlay suggestion, visual composition, colour contrast recommendation, emotional trigger
- Base concepts on what performs in the video's niche — not generic advice

CHAPTERS
- Only generate if a transcript is provided
- Format: MM:SS Title (max 30 chars per chapter title)
- Minimum 4 chapters, maximum 10

OUTPUT FORMAT
- Always respond with valid JSON only
- No preamble, no explanation outside the JSON
- Follow the exact schema provided in the user prompt`;
}

export function buildSeoUserPrompt(params: {
  videoTitle: string;
  videoDescription: string;
  existingTags: string[];
  primaryKeyword: string;
  secondaryKeywords: string[];
  trendsData?: {
    primaryKeyword: string;
    searchScore: number;
    trendDirection: string;
    relatedRising: string[];
    recommendedTags: string[];
  } | null;
  autocompleteSuggestions?: string[];
}): string {
  const {
    videoTitle,
    videoDescription,
    primaryKeyword,
    secondaryKeywords,
    trendsData,
    autocompleteSuggestions,
  } = params;

  let keywordDataSection = "";
  if (trendsData) {
    keywordDataSection = `KEYWORD DATA (from Google Trends + YouTube Autocomplete)
---------------------------------------------------------
Primary keyword: ${trendsData.primaryKeyword}
Search score: ${trendsData.searchScore}/100
Trend direction: ${trendsData.trendDirection}
Rising keywords: ${trendsData.relatedRising.join(", ")}
Recommended tags: ${trendsData.recommendedTags.join(", ")}
`;
  }

  let autocompleteSection = "";
  if (autocompleteSuggestions && autocompleteSuggestions.length > 0) {
    autocompleteSection = `YOUTUBE AUTOCOMPLETE SUGGESTIONS
--------------------------------
${autocompleteSuggestions.slice(0, 15).join(", ")}
`;
  }

  return `Generate YouTube SEO metadata for the following video.

VIDEO INFORMATION
----------------
Title (current):     ${videoTitle}
Topic / niche:       ${videoDescription || videoTitle}
Primary keyword:     ${primaryKeyword || videoTitle}
Secondary keywords:  ${secondaryKeywords.join(", ") || "N/A"}
Video summary:       ${videoDescription || videoTitle}

${keywordDataSection}${autocompleteSection}
Respond using this exact JSON schema:

{
  "titles": [
    {
      "rank": 1,
      "text": "",
      "char_count": 0,
      "primary_keyword_position": 0,
      "power_word_used": "",
      "ctr_rationale": ""
    }
  ],
  "description": {
    "full_text": "",
    "word_count": 0,
    "primary_keyword_in_first_25_words": true
  },
  "tags": [
    {
      "tag": "",
      "tier": "broad | medium | niche"
    }
  ],
  "thumbnail_concepts": [
    {
      "concept_number": 1,
      "text_overlay": "",
      "visual_composition": "",
      "colour_recommendation": "",
      "emotional_trigger": ""
    }
  ],
  "chapters": [
    {
      "timestamp": "0:00",
      "title": ""
    }
  ],
  "pinned_comment": ""
}`;
}
