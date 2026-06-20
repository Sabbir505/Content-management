import { z } from "zod";
import { NextRequest, NextResponse } from "next/server";
import { evaluateAndDeliver } from "@/lib/quality/regeneration";
import { enrichGenerationContext } from "@/lib/quality/grounding/grounding-pipeline";
import type { ScoredOutput } from "@/lib/quality/types";

const seoSchema = z.object({
  videoTitle: z.string().min(1, "Video title is required"),
  videoDescription: z.string().optional(),
  existingTags: z.array(z.string()).optional(),
  topic: z.string().optional(),
  niche: z.string().optional(),
  primaryKeyword: z.string().optional(),
  secondaryKeywords: z.array(z.string()).optional(),
});

const API_URL = process.env.KIMI_API_ENDPOINT || "https://ai2.18.show/v1/chat/completions";
const API_KEY = process.env.KIMI_API_KEY;
const MODEL = process.env.KIMI_MODEL || "DeepSeek-V4-Pro";

interface ApiMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

interface ApiResponse {
  choices: {
    message: {
      content: string;
    };
  }[];
}

interface SeoPackage {
  titles: {
    rank: number;
    text: string;
    char_count: number;
    primary_keyword_position: number;
    power_word_used: string;
    ctr_rationale: string;
  }[];
  description: {
    full_text: string;
    word_count: number;
    primary_keyword_in_first_25_words: boolean;
  };
  tags: {
    tag: string;
    tier: "broad" | "medium" | "niche";
  }[];
  thumbnail_concepts: {
    concept_number: number;
    text_overlay: string;
    visual_composition: string;
    colour_recommendation: string;
    emotional_trigger: string;
  }[];
  chapters: {
    timestamp: string;
    title: string;
  }[];
  pinned_comment: string;
}

import { getProxyUrl } from "@/lib/proxy";

async function callLLM(messages: ApiMessage[], temperature: number = 0.3): Promise<string> {
  if (!API_KEY) {
    throw new Error("KIMI_API_KEY not configured");
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30000);

  try {
    const response = await fetch(API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${API_KEY}`,
      },
      body: JSON.stringify({
        model: MODEL,
        messages,
        temperature,
        max_tokens: 2500,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorText = await response.text().catch(() => "");
      throw new Error(`API error: ${response.status} - ${errorText}`);
    }

    const data: ApiResponse = await response.json();
    return data.choices[0]?.message?.content || "{}";
  } catch (error) {
    clearTimeout(timeoutId);
    throw error;
  }
}

function parseSeoResponse(content: string, videoTitle: string, existingTags: string[]): SeoPackage {
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
        },
      ],
      description: {
        full_text: `Learn about ${videoTitle}.\n\nSubscribe for more content!`,
        word_count: 10,
        primary_keyword_in_first_25_words: true,
      },
      tags: (existingTags || []).map((tag: string) => ({ tag, tier: "medium" as const })),
      thumbnail_concepts: [
        { concept_number: 1, text_overlay: "Close-up reaction shot", visual_composition: "Face fills 60% of frame", colour_recommendation: "High contrast red/black", emotional_trigger: "Curiosity" },
        { concept_number: 2, text_overlay: "Before/After", visual_composition: "Split screen", colour_recommendation: "Warm vs cool tones", emotional_trigger: "Aspiration" },
        { concept_number: 3, text_overlay: "Bold number", visual_composition: "Text dominates right half", colour_recommendation: "Yellow on dark", emotional_trigger: "Surprise" },
      ],
      chapters: [{ timestamp: "0:00", title: "Intro" }],
      pinned_comment: `What did you think about ${videoTitle}? Let me know in the comments!`,
    };
  }
}

function buildSystemPrompt(): string {
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

function buildUserPrompt(params: {
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
    existingTags,
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

export async function POST(request: NextRequest) {
  try {
    if (!API_KEY) {
      return NextResponse.json({ success: false, error: "KIMI_API_KEY not configured" }, { status: 500 });
    }

    const body = await request.json();
    const parsed = seoSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: parsed.error.issues.map((e: { message: string }) => e.message).join(", ") },
        { status: 400 }
      );
    }

    const {
      videoTitle,
      videoDescription,
      existingTags,
      topic,
      niche,
      primaryKeyword,
      secondaryKeywords,
    } = parsed.data;

    if (!videoTitle.trim()) {
      return NextResponse.json(
        { success: false, error: "Video title is required" },
        { status: 400 }
      );
    }

    // Layer 1: Data Grounding — enrich with real search data
    const groundingContext = await enrichGenerationContext(
      topic || videoTitle,
      niche || "general",
      "seo"
    );

    const pk = primaryKeyword || videoTitle;
    const sk = secondaryKeywords || [];

    const userPrompt = buildUserPrompt({
      videoTitle,
      videoDescription: videoDescription || "",
      existingTags: existingTags || [],
      primaryKeyword: pk,
      secondaryKeywords: sk,
      trendsData: groundingContext.trendsData,
      autocompleteSuggestions: groundingContext.autocompleteData?.suggestions,
    });

    // First LLM call to generate initial output
    const initialMessages: ApiMessage[] = [
      { role: "system", content: buildSystemPrompt() },
      { role: "user", content: userPrompt },
    ];
    const initialContent = await callLLM(initialMessages, 0.3);
    const initialOutput = parseSeoResponse(initialContent, videoTitle, existingTags || []);

    // Score and auto-regenerate if needed
    const scoredOutput = await evaluateAndDeliver(
      initialOutput,
      "seo",
      { trendsData: groundingContext.trendsData },
      async (_prevOutput, issues, suggestions) => {
        const regenerationContext = issues.length > 0
          ? `REGENERATION CONTEXT
The previous generation attempt had these issues:
${issues.map((i) => `- ${i}`).join("\n")}

Required improvements:
${suggestions.map((s) => `- ${s}`).join("\n")}

---
`
          : "";

        const messages: ApiMessage[] = [
          { role: "system", content: buildSystemPrompt() },
          { role: "user", content: regenerationContext + userPrompt },
        ];

        const content = await callLLM(messages, 0.2); // Drop temperature by 0.1 for regeneration
        return parseSeoResponse(content, videoTitle, existingTags || []);
      }
    );

    return NextResponse.json({ success: true, data: scoredOutput });
  } catch (error) {
    console.error("SEO generation error:", error);
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}
