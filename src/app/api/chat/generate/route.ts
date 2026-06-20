import { z } from "zod";
import { NextRequest, NextResponse } from "next/server";
import { callLLM } from "@/lib/generation/llm";
import { evaluateAndDeliver } from "@/lib/quality/regeneration";
import { enrichGenerationContext } from "@/lib/quality/grounding/grounding-pipeline";
import type { ScoredOutput } from "@/lib/quality/types";

const generateSchema = z.object({
  sessionId: z.string().optional(),
  messages: z.array(z.object({
    role: z.enum(["user", "assistant", "system"]),
    text: z.string(),
    attachments: z.array(z.object({
      type: z.enum(["video", "article", "text", "board_card"]),
      videoId: z.string().optional(),
      title: z.string().optional(),
      description: z.string().optional(),
      hookType: z.string().optional(),
      structure: z.string().optional(),
      thumbnail: z.string().optional(),
      url: z.string().optional(),
      content: z.string().optional(),
      text: z.string().optional(),
      cardId: z.string().optional(),
    })).optional(),
  })),
  intent: z.enum(["script", "social", "chat"]),
  platform: z.enum(["x", "instagram", "facebook"]).optional(),
  tone: z.string().optional(),
  targetDuration: z.number().optional(),
  userVoice: z.string().optional(),
});

function buildContextFromAttachments(attachments: unknown[]): string {
  if (!attachments || attachments.length === 0) return "";

  const parts: string[] = [];
  for (const att of attachments) {
    const a = att as Record<string, string | undefined>;
    switch (a.type) {
      case "video":
        parts.push(`VIDEO REFERENCE
Title: ${a.title || ""}
Description: ${a.description || ""}
Hook Type: ${a.hookType || ""}
Structure: ${a.structure || ""}
Video ID: ${a.videoId || ""}`);
        break;
      case "article":
        parts.push(`ARTICLE REFERENCE
Title: ${a.title || ""}
URL: ${a.url || ""}
Content: ${a.content || ""}`);
        break;
      case "text":
        parts.push(`TEXT REFERENCE
${a.text || ""}`);
        break;
      case "board_card":
        parts.push(`BOARD CARD REFERENCE
Title: ${a.title || ""}
Content: ${a.content || ""}`);
        break;
    }
  }
  return parts.join("\n\n---\n\n");
}

function buildSystemPromptForIntent(intent: string): string {
  switch (intent) {
    case "script":
      return `You are TubeForge's expert video scriptwriter. Write engaging YouTube scripts that feel natural and human.

NON-NEGOTIABLE RULES:
- HOOK: Under 35 words, creates curiosity, never starts with "In this video" or "I"
- STRUCTURE: Clear beats with natural transitions
- VOICE: Match the user's voice profile exactly
- LENGTH: Honor the target duration
- OUTRO: Genuine CTA that feels earned

Return valid JSON only with this schema:
{
  "script": {
    "title_suggestion": "",
    "total_word_count": 0,
    "estimated_duration_minutes": 0,
    "sections": [
      { "label": "HOOK", "word_count": 0, "content": "" },
      { "label": "INTRO", "word_count": 0, "content": "" },
      { "label": "BEAT 1", "word_count": 0, "content": "" },
      { "label": "BEAT 2", "word_count": 0, "content": "" },
      { "label": "BEAT 3", "word_count": 0, "content": "" },
      { "label": "OUTRO & CTA", "word_count": 0, "content": "" }
    ],
    "hook_type_used": "",
    "cta_used": ""
  }
}`;
    case "social":
      return `You are TubeForge's social media content specialist. Write high-engagement posts.

Return valid JSON with platform-optimized content.`;
    default:
      return `You are TubeForge's AI assistant. Help creators with their content strategy, scriptwriting, and social media.

Be conversational, helpful, and specific. Use the provided context to give relevant advice.`;
  }
}

function parseScriptResponse(content: string): unknown {
  const cleanJson = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
  try {
    return JSON.parse(cleanJson);
  } catch {
    return { script: { title_suggestion: "", total_word_count: 0, estimated_duration_minutes: 0, sections: [{ label: "CONTENT", word_count: 0, content: cleanJson || content }], hook_type_used: "", cta_used: "" } };
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = generateSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: parsed.error.issues.map((e) => e.message).join(", ") },
        { status: 400 }
      );
    }

    const { messages, intent, platform, tone, targetDuration, userVoice } = parsed.data;

    // Build context from the last user message's attachments
    const lastUserMessage = [...messages].reverse().find((m) => m.role === "user");
    const attachmentContext = buildContextFromAttachments(lastUserMessage?.attachments || []);

    const systemPrompt = buildSystemPromptForIntent(intent);

    const userPrompt = `${attachmentContext ? `CONTEXT:\n${attachmentContext}\n\n` : ""}USER REQUEST:\n${lastUserMessage?.text || ""}

${intent === "script" && targetDuration ? `Target duration: ${targetDuration} minutes` : ""}
${intent === "social" && platform ? `Platform: ${platform}` : ""}
${tone ? `Tone: ${tone}` : ""}
${userVoice ? `Voice: ${userVoice}` : ""}`;

    const apiMessages = [
      { role: "system" as const, content: systemPrompt },
      ...messages.slice(0, -1).map((m) => ({ role: m.role as "user" | "assistant" | "system", content: m.text })),
      { role: "user" as const, content: userPrompt },
    ];

    const content = await callLLM(apiMessages, 0.7);

    let artifact: { type: string; content: string } | undefined;

    if (intent === "script") {
      const parsedScript = parseScriptResponse(content);
      artifact = { type: "script", content: JSON.stringify(parsedScript) };
    } else if (intent === "social") {
      artifact = { type: "social_posts", content };
    }

    return NextResponse.json({
      success: true,
      data: {
        text: content,
        artifact,
      },
    });
  } catch (error) {
    console.error("Chat generation error:", error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
