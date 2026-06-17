import { z } from "zod";
import { NextRequest, NextResponse } from "next/server";
import { evaluateAndDeliver } from "@/lib/quality/regeneration";
import { enrichGenerationContext } from "@/lib/quality/grounding/grounding-pipeline";
import type { ScoredOutput } from "@/lib/quality/types";

const scriptSchema = z.object({
  videoTitle: z.string().min(1, "Video title is required"),
  videoDescription: z.string().optional(),
  tone: z.enum(["educational", "entertaining", "motivational", "conversational", "professional"]).optional(),
  userVoice: z.string().optional(),
  voiceProfile: z.object({
    hookStyle: z.string(),
    sentenceLength: z.string(),
    tone: z.string(),
    vocabulary: z.string(),
    humorLevel: z.string(),
    ctaPattern: z.string(),
    sampleSentences: z.array(z.string()).optional(),
  }).optional(),
  topic: z.string().optional(),
  niche: z.string().optional(),
  format: z.string().optional(),
  targetDuration: z.number().optional(),
  structure: z.string().optional(),
  hookType: z.string().optional(),
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

interface ScriptOutput {
  script: {
    title_suggestion: string;
    total_word_count: number;
    estimated_duration_minutes: number;
    sections: {
      label: string;
      word_count: number;
      content: string;
    }[];
    hook_type_used: string;
    cta_used: string;
  };
}

interface VoiceProfileInput {
  hookStyle: string;
  sentenceLength: string;
  tone: string;
  vocabulary: string;
  humorLevel: string;
  ctaPattern: string;
  sampleSentences?: string[];
}

async function callLLM(messages: ApiMessage[], temperature: number = 0.7): Promise<string> {
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
    signal: AbortSignal.timeout(30000),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`API error: ${response.status} ${errorText}`);
  }

  const data: ApiResponse = await response.json();
  return data.choices[0]?.message?.content || "";
}

function parseScriptResponse(content: string): ScriptOutput {
  const cleanJson = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
  try {
    return JSON.parse(cleanJson);
  } catch {
    return {
      script: {
        title_suggestion: "",
        total_word_count: 0,
        estimated_duration_minutes: 0,
        sections: [{ label: "CONTENT", word_count: 0, content: cleanJson || content }],
        hook_type_used: "",
        cta_used: "",
      },
    };
  }
}

function buildSystemPrompt(): string {
  return `You are TubeForge's expert video scriptwriter. You write YouTube video scripts that are engaging, well-structured, and feel completely natural — never like AI.

You have two inputs:
1. A reference video's structural breakdown (hook type, beats, CTA style)
2. The user's voice profile (their personal writing style)

Your job is to write a NEW, ORIGINAL script inspired by the reference structure but applied to the user's own angle or the same topic from their perspective. You are NOT rewriting or paraphrasing the reference video. You are using its STRUCTURE only — the bones, not the flesh.

NON-NEGOTIABLE RULES

HOOK (first section)
- Must be under 35 words (spoken in under 10 seconds at natural pace)
- Must use the hook type specified in the reference breakdown
- Must immediately create curiosity, tension, or surprise
- Must NOT start with "In this video..." or "Today we're going to..."
- Must NOT start with the word "I"

STRUCTURE
- Follow the beat structure from the reference breakdown exactly
- Each beat must have a clear section label (for the script doc)
- Transitions between beats must feel natural, not mechanical
- Every beat must serve a purpose — cut anything that is filler

VOICE
- Match the voice profile provided exactly: average sentence length, vocabulary level, tone, humor style
- Write how the user SPEAKS, not how they write an essay
- Short sentences are almost always better
- Use second person ("you") to address the viewer directly throughout

LENGTH
- YouTube long-form (8–15 min): 1,400–2,000 words
- YouTube Shorts / under 60s: 100–130 words
- Honour the format specified in the request

OUTRO & CTA
- Last section must include a genuine CTA (subscribe, comment, watch next)
- CTA must feel earned, not tacked on — connect it to what was just discussed
- Tease the next video if a topic is provided

OUTPUT FORMAT
- Return valid JSON only — no preamble or explanation outside the JSON
- Follow the exact schema in the user prompt`;
}

function buildUserPrompt(params: {
  videoTitle: string;
  videoDescription: string;
  tone: string;
  userVoice: string;
  voiceProfile: VoiceProfileInput | null;
  structure?: string;
  hookType?: string;
  targetDuration?: number;
  groundingContext?: {
    hookPatterns?: Array<{ hookText: string; outlierScore: number }>;
    trendsData?: { recommendedTags: string[] } | null;
  };
}): string {
  const {
    videoTitle,
    videoDescription,
    tone,
    userVoice,
    voiceProfile,
    structure,
    hookType,
    targetDuration,
    groundingContext,
  } = params;

  // Build voice profile section
  let voiceSection = "";
  if (voiceProfile) {
    voiceSection = `VOICE PROFILE
-------------
Tone:                 ${voiceProfile.tone || "conversational, direct"}
Avg sentence length:  ${voiceProfile.sentenceLength || "12-15"} words
Vocabulary level:     ${voiceProfile.vocabulary || "accessible"}
Hook style:           ${voiceProfile.hookStyle || "pattern interrupt"}
Humor level:          ${voiceProfile.humorLevel || "moderate"}
CTA style:            ${voiceProfile.ctaPattern || "soft question-based"}
${voiceProfile.sampleSentences && voiceProfile.sampleSentences.length > 0
      ? `Sample sentences:     ${voiceProfile.sampleSentences.join(" | ")}`
      : ""}`;
  } else if (userVoice) {
    voiceSection = `VOICE PROFILE
-------------
${userVoice}`;
  }

  // Build grounding section
  let groundingSection = "";
  if (groundingContext) {
    if (groundingContext.hookPatterns && groundingContext.hookPatterns.length > 0) {
      groundingSection += `TOP HOOK PATTERNS FOR THIS NICHE (use as inspiration, not copy)
---------------------------------------------------------------
${groundingContext.hookPatterns.map((p) => `- "${p.hookText}" (${p.outlierScore}x outlier)`).join("\n")}
`;
    }
    if (groundingContext.trendsData?.recommendedTags && groundingContext.trendsData.recommendedTags.length > 0) {
      groundingSection += `TRENDING KEYWORDS: ${groundingContext.trendsData.recommendedTags.join(", ")}
`;
    }
  }

  // Build structure section
  let structureSection = "";
  if (structure) {
    structureSection = `CHOSEN STRUCTURE
----------------
Structure blueprint: ${structure}
Hook type: ${hookType || "pattern interrupt"}
`;
  }

  const targetLength = targetDuration
    ? `${targetDuration} minutes (~${targetDuration * 150} words)`
    : "10 minutes (~1,500 words)";

  return `Write a YouTube video script using the following inputs.

USER'S IDEA / TOPIC
--------------------
Topic:                ${videoTitle}
Description:          ${videoDescription || ""}
Target length:        ${targetLength}
Tone:                 ${tone || "educational"}

${structureSection}${voiceSection}
${groundingSection}
Respond using this exact JSON schema:

{
  "script": {
    "title_suggestion": "",
    "total_word_count": 0,
    "estimated_duration_minutes": 0,
    "sections": [
      {
        "label": "HOOK",
        "word_count": 0,
        "content": ""
      },
      {
        "label": "INTRO",
        "word_count": 0,
        "content": ""
      },
      {
        "label": "BEAT 1 — [beat name]",
        "word_count": 0,
        "content": ""
      },
      {
        "label": "BEAT 2 — [beat name]",
        "word_count": 0,
        "content": ""
      },
      {
        "label": "BEAT 3 — [beat name]",
        "word_count": 0,
        "content": ""
      },
      {
        "label": "OUTRO & CTA",
        "word_count": 0,
        "content": ""
      }
    ],
    "hook_type_used": "",
    "cta_used": ""
  }
}`;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = scriptSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: parsed.error.issues.map((e: { message: string }) => e.message).join(", ") },
        { status: 400 }
      );
    }

    const {
      videoTitle,
      videoDescription,
      tone,
      userVoice,
      voiceProfile: voiceProfileInput,
      topic,
      niche,
      format,
      targetDuration,
      structure,
      hookType,
    } = parsed.data;

    if (!videoTitle.trim()) {
      return NextResponse.json(
        { success: false, error: "Video title is required" },
        { status: 400 }
      );
    }

    if (!API_KEY) {
      console.error("KIMI_API_KEY is not set");
      return NextResponse.json({ success: false, error: "API key not configured" }, { status: 500 });
    }

    // Layer 1: Data Grounding
    const groundingContext = await enrichGenerationContext(
      topic || videoTitle,
      niche || "general",
      "script"
    );

    // Build enriched prompt
    const userPrompt = buildUserPrompt({
      videoTitle,
      videoDescription: videoDescription || "",
      tone: tone || "educational",
      userVoice: userVoice || "Conversational, direct, slightly informal",
      voiceProfile: voiceProfileInput || null,
      structure,
      hookType,
      targetDuration,
      groundingContext,
    });

    // Build voice profile for scoring
    const voiceProfileForScoring = voiceProfileInput
      ? {
          avgSentenceLength: parseInt(voiceProfileInput.sentenceLength) || 15,
          vocabulary: `${voiceProfileInput.vocabulary}. ${voiceProfileInput.tone}. ${voiceProfileInput.humorLevel}`,
          tone: tone || "educational",
          sampleSentences: voiceProfileInput.sampleSentences || [],
        }
      : userVoice
        ? {
            avgSentenceLength: 15,
            vocabulary: userVoice,
            tone: tone || "educational",
            sampleSentences: [],
          }
        : null;

    // First LLM call to generate initial output
    const initialMessages: ApiMessage[] = [
      { role: "system", content: buildSystemPrompt() },
      { role: "user", content: userPrompt },
    ];
    const initialContent = await callLLM(initialMessages, 0.7);
    const initialOutput = parseScriptResponse(initialContent);

    // Score and auto-regenerate if needed
    const scoredOutput = await evaluateAndDeliver(
      initialOutput,
      "script",
      {
        trendsData: groundingContext.trendsData,
        voiceProfile: voiceProfileForScoring,
        hookPatterns: groundingContext.hookPatterns,
        format: (format as "long-form" | "shorts") || "long-form",
      },
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

        const content = await callLLM(messages, 0.6); // Drop temperature by 0.1 for regeneration
        return parseScriptResponse(content);
      }
    );

    return NextResponse.json({ success: true, data: scoredOutput });
  } catch (error) {
    console.error("Script generation error:", error);
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}
