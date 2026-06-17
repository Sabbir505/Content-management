import { z } from "zod";
import { NextRequest, NextResponse } from "next/server";
import { evaluateAndDeliver } from "@/lib/quality/regeneration";
import { enrichGenerationContext } from "@/lib/quality/grounding/grounding-pipeline";
import type { ScoredOutput, OutputType } from "@/lib/quality/types";

const socialSchema = z.object({
  videoTitle: z.string().min(1, "Video title is required"),
  videoDescription: z.string().optional(),
  platform: z.enum(["x", "instagram", "facebook"]),
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
      max_tokens: 2000,
    }),
    signal: AbortSignal.timeout(30000),
  });

  if (!response.ok) {
    throw new Error(`API error: ${response.status}`);
  }

  const data: ApiResponse = await response.json();
  return data.choices[0]?.message?.content || "";
}

function parseSocialResponse(content: string): unknown {
  const cleanJson = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
  try {
    return JSON.parse(cleanJson);
  } catch {
    return content;
  }
}

function formatPostOutput(platform: string, output: unknown): string {
  if (!output || typeof output !== "object") {
    return typeof output === "string" ? output : "";
  }

  const data = output as Record<string, unknown>;

  switch (platform) {
    case "x": {
      const thread = data.thread as Record<string, unknown> | undefined;
      const tweets = thread?.tweets as Array<Record<string, unknown>> | undefined;
      if (tweets && Array.isArray(tweets)) {
        return tweets.map((t) => String(t.content || "")).filter(Boolean).join("\n\n");
      }
      return "";
    }
    case "instagram": {
      const igPost = data.instagram_post as Record<string, unknown> | undefined;
      if (igPost) {
        const fullPost = String(igPost.full_post || "");
        if (fullPost) return fullPost;

        const firstLine = String(igPost.first_line || "");
        const captionBody = String(igPost.caption_body || "");
        const closingQuestion = String(igPost.closing_question || "");
        const hashtagsObj = igPost.hashtags as Record<string, unknown> | undefined;
        const hashtags = Array.isArray(hashtagsObj?.all)
          ? hashtagsObj.all.join(" ")
          : "";
        return [firstLine, captionBody, closingQuestion, hashtags].filter(Boolean).join("\n\n");
      }
      return "";
    }
    case "facebook": {
      const fbPost = data.facebook_post as Record<string, unknown> | undefined;
      if (fbPost) {
        const fullPost = String(fbPost.full_post || "");
        if (fullPost) return fullPost;

        const openingLine = String(fbPost.opening_line || "");
        const body = String(fbPost.body || "");
        const closingQuestion = String(fbPost.closing_question || "");
        const hashtags = Array.isArray(fbPost.hashtags)
          ? fbPost.hashtags.join(" ")
          : "";
        return [openingLine, body, closingQuestion, hashtags].filter(Boolean).join("\n\n");
      }
      return "";
    }
    default:
      return "";
  }
}

// ---- System Prompts per Platform ----

const SYSTEM_PROMPTS: Record<string, string> = {
  x: `You are TubeForge's X (Twitter) content specialist. You write high-engagement X threads and single tweets for content creators, based on their YouTube video content.

You write in the user's voice — matching their tone, sentence style, and vocabulary exactly as described in their voice profile.

NON-NEGOTIABLE RULES

HOOK TWEET (tweet 1)
- Maximum 240 characters
- Must use a pattern-interrupt: counter-intuitive claim, surprising statistic, bold opinion, or "most people" opener
- Must NOT start with the word "I"
- Must NOT start with "Hey", "So", "Just", or "Thread:"
- Must create enough curiosity that the reader cannot stop at tweet 1
- No hashtags in tweet 1 — they kill reach on the hook

THREAD STRUCTURE
- Total length: 6–8 tweets
- Tweet 2–3: expand the hook, add context or the core insight
- Tweet 4–5: the meat — 2–3 specific, actionable or surprising points (numbered lists work well here: "1/ ... 2/ ... 3/ ...")
- Tweet 6–7: the payoff or resolution — what the viewer learns/gains
- Final tweet: CTA — ask a question to the audience OR direct to YouTube video (never both in the same tweet)

FORMATTING
- Each tweet must be self-contained — readable without the others
- Use line breaks within tweets for readability (max 3 lines before a break)
- 2–4 hashtags total, placed only in the final tweet
- At least 1 tweet must contain a specific number, stat, or concrete example
- No emojis unless the voice profile specifies they use them

OUTPUT FORMAT
- Return valid JSON only
- No preamble or explanation outside the JSON
- Follow the exact schema in the user prompt`,

  instagram: `You are TubeForge's Instagram content specialist. You write high-engagement Instagram captions for content creators, based on their YouTube video content.

You write in the user's voice — matching their tone, sentence style, and vocabulary as described in their voice profile.

NON-NEGOTIABLE RULES

FIRST LINE (the hook — visible before "more")
- Maximum 125 characters
- Must compel the reader to tap "more" — use a cliffhanger, bold claim, or irresistible question
- No hashtags on the first line
- No emojis on the first line unless the voice profile specifically uses them as their signature style

CAPTION BODY
- Total length: 150–300 words
- After the first line, use a line break before continuing
- Tell a mini story or share a specific insight — not a generic summary
- Use short paragraphs (2–3 sentences max per paragraph)
- Use line breaks between paragraphs — never a wall of text
- Include at least one specific number, stat, or concrete detail from the video
- Must contain a "save this" or "share this" prompt naturally embedded in the text
- End with an open question to drive comments

HASHTAGS
- Place all hashtags after 5 line breaks below the caption body
- Total: 25–30 hashtags
- Mix: 8 broad (>1M posts), 10 medium (100K–1M posts), 7–12 niche (<100K posts)
- Place the primary keyword hashtag first
- No spaces within multi-word hashtags

OUTPUT FORMAT
- Return valid JSON only
- No preamble or explanation outside the JSON
- Follow the exact schema in the user prompt`,

  facebook: `You are TubeForge's Facebook content specialist. You write high-engagement Facebook posts for content creators, based on their YouTube video content.

Facebook is different from X and Instagram. The algorithm rewards:
- Genuine conversation and comments (not just likes)
- Content that feels personal and human, not promotional
- Posts that people share with friends because they feel relevant
- Posts that end with a question worth answering

You write in the user's voice — matching their tone, sentence style, and vocabulary as described in their voice profile.

NON-NEGOTIABLE RULES

OPENING LINE
- Must feel personal, relatable, or surprising — not like an announcement
- Never start with "Hey everyone", "Just posted", "New video", or "Check out"
- Strong openers: a confession, a surprising fact, a counter-intuitive statement, or a relatable frustration the audience will recognise immediately

POST BODY
- Total length: 150–300 words
- Write like you're talking to a friend, not broadcasting to an audience
- 2–3 short paragraphs — never a wall of text
- Include one specific, concrete detail or personal moment from the video
- Natural language only — no bullet points, no headers, no em-dashes used as formatting devices
- One subtle reference to the YouTube video (not a hard sell)

CLOSING
- End with a genuine open question — something people actually want to answer
- The question must be directly related to the post content
- Never: "What do you think?" or "Let me know below!" — these are lazy CTAs

HASHTAGS
- Maximum 3 hashtags, placed at the very end after the closing question
- Facebook penalises over-hashtagging — 3 is the ceiling, not the target
- Only use hashtags if they add genuine discoverability value

OUTPUT FORMAT
- Return valid JSON only
- No preamble or explanation outside the JSON
- Follow the exact schema in the user prompt`,
};

// ---- User Prompt Builders ----

function buildXUserPrompt(params: {
  videoTitle: string;
  videoDescription: string;
  userVoice: string;
  voiceProfile: VoiceProfileInput | null;
  postPatterns?: Array<{ patternText: string; engagementRate: number }>;
}): string {
  const { videoTitle, videoDescription, userVoice, voiceProfile, postPatterns } = params;

  let voiceSection = "";
  if (voiceProfile) {
    voiceSection = `VOICE PROFILE
-------------
Tone:                 ${voiceProfile.tone || "conversational, direct"}
Avg sentence length:  ${voiceProfile.sentenceLength || "12-15"} words
Vocabulary level:     ${voiceProfile.vocabulary || "accessible"}
Humor level:          ${voiceProfile.humorLevel || "moderate"}
Uses emojis:          ${voiceProfile.humorLevel?.includes("emoji") ? "true" : "false"}
CTA style:            ${voiceProfile.ctaPattern || "soft question-based"}
${voiceProfile.sampleSentences && voiceProfile.sampleSentences.length > 0
      ? `Sample sentences:     ${voiceProfile.sampleSentences.join(" | ")}`
      : ""}`;
  } else if (userVoice) {
    voiceSection = `VOICE PROFILE\n-------------\n${userVoice}`;
  }

  let patternsSection = "";
  if (postPatterns && postPatterns.length > 0) {
    patternsSection = `VIRAL HOOK PATTERNS FOR X IN THIS NICHE (use as inspiration only)
------------------------------------------------------------------
${postPatterns.map((p) => `- "${p.patternText}" (engagement: ${p.engagementRate})`).join("\n")}
`;
  }

  return `Write an X (Twitter) thread based on the following YouTube video content.

VIDEO CONTENT
-------------
Video title:          ${videoTitle}
Video topic:          ${videoDescription || videoTitle}
Core insight:         ${videoDescription ? videoDescription.slice(0, 200) : videoTitle}
Key points:           ${videoDescription || "See video title"}
Target audience:      Content creators and viewers interested in this topic

${voiceSection}
${patternsSection}
Respond using this exact JSON schema:

{
  "thread": {
    "tweet_count": 0,
    "tweets": [
      {
        "position": 1,
        "content": "",
        "char_count": 0,
        "hashtags": [],
        "note": "hook tweet"
      }
    ],
    "hook_pattern_used": "",
    "cta_type": ""
  }
}`;
}

function buildInstagramUserPrompt(params: {
  videoTitle: string;
  videoDescription: string;
  userVoice: string;
  voiceProfile: VoiceProfileInput | null;
  postPatterns?: Array<{ patternText: string; engagementRate: number }>;
}): string {
  const { videoTitle, videoDescription, userVoice, voiceProfile, postPatterns } = params;

  let voiceSection = "";
  if (voiceProfile) {
    voiceSection = `VOICE PROFILE
-------------
Tone:                 ${voiceProfile.tone || "conversational, direct"}
Avg sentence length:  ${voiceProfile.sentenceLength || "12-15"} words
Vocabulary level:     ${voiceProfile.vocabulary || "accessible"}
Humor level:          ${voiceProfile.humorLevel || "moderate"}
Uses emojis:          ${voiceProfile.humorLevel?.includes("emoji") ? "true" : "false"}
Emoji style:          ${voiceProfile.humorLevel?.includes("emoji") ? "Minimal — 1-2 per post, only for emphasis" : "None"}
CTA style:            ${voiceProfile.ctaPattern || "soft question-based"}
${voiceProfile.sampleSentences && voiceProfile.sampleSentences.length > 0
      ? `Sample sentences:     ${voiceProfile.sampleSentences.join(" | ")}`
      : ""}`;
  } else if (userVoice) {
    voiceSection = `VOICE PROFILE\n-------------\n${userVoice}`;
  }

  let patternsSection = "";
  if (postPatterns && postPatterns.length > 0) {
    patternsSection = `VIRAL CAPTION PATTERNS FOR INSTAGRAM IN THIS NICHE (use as inspiration only)
-------------------------------------------------------------------------
${postPatterns.map((p) => `- "${p.patternText}" (engagement: ${p.engagementRate})`).join("\n")}
`;
  }

  return `Write an Instagram caption based on the following YouTube video content.

VIDEO CONTENT
-------------
Video title:          ${videoTitle}
Video topic:          ${videoDescription || videoTitle}
Core insight:         ${videoDescription ? videoDescription.slice(0, 200) : videoTitle}
Key points:           ${videoDescription || "See video title"}
Target audience:      Content creators and viewers interested in this topic

${voiceSection}
${patternsSection}
Respond using this exact JSON schema:

{
  "instagram_post": {
    "first_line": "",
    "first_line_char_count": 0,
    "caption_body": "",
    "word_count": 0,
    "closing_question": "",
    "save_share_prompt_included": true,
    "hashtags": {
      "all": [],
      "broad_count": 0,
      "medium_count": 0,
      "niche_count": 0,
      "total_count": 0
    },
    "full_post": ""
  }
}`;
}

function buildFacebookUserPrompt(params: {
  videoTitle: string;
  videoDescription: string;
  userVoice: string;
  voiceProfile: VoiceProfileInput | null;
  postPatterns?: Array<{ patternText: string; engagementRate: number }>;
}): string {
  const { videoTitle, videoDescription, userVoice, voiceProfile, postPatterns } = params;

  let voiceSection = "";
  if (voiceProfile) {
    voiceSection = `VOICE PROFILE
-------------
Tone:                 ${voiceProfile.tone || "conversational, direct"}
Avg sentence length:  ${voiceProfile.sentenceLength || "12-15"} words
Vocabulary level:     ${voiceProfile.vocabulary || "accessible"}
Humor level:          ${voiceProfile.humorLevel || "moderate"}
Personal/vulnerable:  ${voiceProfile.tone?.includes("personal") ? "High — user shares personal struggles openly" : "Moderate"}
CTA style:            ${voiceProfile.ctaPattern || "soft question-based"}
${voiceProfile.sampleSentences && voiceProfile.sampleSentences.length > 0
      ? `Sample sentences:     ${voiceProfile.sampleSentences.join(" | ")}`
      : ""}`;
  } else if (userVoice) {
    voiceSection = `VOICE PROFILE\n-------------\n${userVoice}`;
  }

  let patternsSection = "";
  if (postPatterns && postPatterns.length > 0) {
    patternsSection = `VIRAL POST PATTERNS FOR FACEBOOK IN THIS NICHE (use as inspiration only)
------------------------------------------------------------------------
${postPatterns.map((p) => `- "${p.patternText}" (engagement: ${p.engagementRate})`).join("\n")}
`;
  }

  return `Write a Facebook post based on the following YouTube video content.

VIDEO CONTENT
-------------
Video title:          ${videoTitle}
Video topic:          ${videoDescription || videoTitle}
Core insight:         ${videoDescription ? videoDescription.slice(0, 200) : videoTitle}
Key points:           ${videoDescription || "See video title"}
Target audience:      Content creators and viewers interested in this topic

${voiceSection}
${patternsSection}
Respond using this exact JSON schema:

{
  "facebook_post": {
    "opening_line": "",
    "body": "",
    "closing_question": "",
    "hashtags": [],
    "full_post": "",
    "word_count": 0,
    "has_personal_moment": true,
    "opener_type": ""
  }
}`;
}

const USER_PROMPT_BUILDERS: Record<string, typeof buildXUserPrompt> = {
  x: buildXUserPrompt,
  instagram: buildInstagramUserPrompt,
  facebook: buildFacebookUserPrompt,
};

export async function POST(request: NextRequest) {
  try {
    if (!API_KEY) {
      return NextResponse.json({ success: false, error: "KIMI_API_KEY not configured" }, { status: 500 });
    }

    const body = await request.json();
    const parsed = socialSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: parsed.error.issues.map((e: { message: string }) => e.message).join(", ") },
        { status: 400 }
      );
    }

    const {
      videoTitle,
      videoDescription,
      platform,
      userVoice,
      voiceProfile: voiceProfileInput,
      topic,
      niche,
    } = parsed.data;

    const outputType: OutputType =
      platform === "x" ? "social_x" : platform === "instagram" ? "social_instagram" : "social_facebook";

    // Layer 1: Data Grounding
    const groundingContext = await enrichGenerationContext(
      topic || videoTitle,
      niche || "general",
      outputType
    );

    const systemPrompt = SYSTEM_PROMPTS[platform] || SYSTEM_PROMPTS.x;
    const buildUserPrompt = USER_PROMPT_BUILDERS[platform] || buildXUserPrompt;

    const userPrompt = buildUserPrompt({
      videoTitle,
      videoDescription: videoDescription || "",
      userVoice: userVoice || "Conversational, direct, slightly informal",
      voiceProfile: voiceProfileInput || null,
      postPatterns: groundingContext.postPatterns,
    });

    // First LLM call to generate initial output
    const initialMessages: ApiMessage[] = [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ];
    const initialContent = await callLLM(initialMessages, 0.7);
    const initialOutput = parseSocialResponse(initialContent);

    // Score and auto-regenerate if needed
    const scoredOutput = await evaluateAndDeliver(
      initialOutput,
      outputType,
      {},
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
          { role: "system", content: systemPrompt },
          { role: "user", content: regenerationContext + userPrompt },
        ];

        const content = await callLLM(messages, 0.6); // Drop temperature by 0.1
        return parseSocialResponse(content);
      }
    );

    const formattedOutput = formatPostOutput(platform, scoredOutput.output);

    return NextResponse.json({
      success: true,
      data: { ...scoredOutput, output: formattedOutput },
    });
  } catch (error) {
    console.error("Social post generation error:", error);
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}
