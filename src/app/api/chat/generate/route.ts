import { z } from "zod";
import { NextRequest, NextResponse } from "next/server";
import { callLLM, parseJsonResponse } from "@/lib/generation/llm";
import { parseBody, guardApiKey } from "@/lib/api-helpers";

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
  model: z.string().optional(),
});

function stripHtml(html: string): string {
  if (!html) return "";
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function buildContextFromAttachments(attachments: unknown[]): { context: string; cardTitle?: string } {
  if (!attachments || attachments.length === 0) return { context: "" };

  const parts: string[] = [];
  let cardTitle: string | undefined;
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
        cardTitle = a.title || "";
        parts.push(`BOARD CARD REFERENCE
Title: ${a.title || ""}
Content: ${stripHtml(a.content || "")}`);
        break;
    }
  }
  return { context: parts.join("\n\n---\n\n"), cardTitle };
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


function renderJsonAsMarkdown(parsed: unknown): string {
  if (Array.isArray(parsed)) {
    return parsed
      .map((item, i) => {
        if (item && typeof item === "object") {
          const fields = Object.entries(item as Record<string, unknown>)
            .map(([k, v]) => `**${k}**: ${typeof v === "string" ? v : JSON.stringify(v)}`);
          return `${i + 1}.\n${fields.map((f) => `   - ${f}`).join("\n")}`;
        }
        return `${i + 1}. ${String(item)}`;
      })
      .join("\n\n");
  }
  if (parsed && typeof parsed === "object") {
    return Object.entries(parsed as Record<string, unknown>)
      .map(([k, v]) => {
        if (Array.isArray(v)) {
          return `**${k}:**\n${v.map((item) => `- ${typeof item === "string" ? item : JSON.stringify(item)}`).join("\n")}`;
        }
        return `**${k}:** ${typeof v === "string" ? v : JSON.stringify(v)}`;
      })
      .join("\n\n");
  }
  return String(parsed);
}

export async function POST(request: NextRequest) {
  try {
    const guard = await guardApiKey("KIMI_API_KEY");
    if (guard) return guard;

    const validation = await parseBody(request, generateSchema);
    if (!validation.success) return validation.errorResponse;

    const { messages, intent, platform, tone, targetDuration, userVoice, model } = validation.data;

    // Build context from the last user message's attachments
    const lastUserMessage = [...messages].reverse().find((m) => m.role === "user");
    const { context: attachmentContext, cardTitle } = buildContextFromAttachments(lastUserMessage?.attachments || []);

    // Extract any system messages from the client to merge into our system prompt
    const clientSystemMessages = messages.filter((m) => m.role === "system").map((m) => m.text);
    const clientSystemContext = clientSystemMessages.length > 0
      ? clientSystemMessages.join("\n\n")
      : "";

    const baseSystemPrompt = buildSystemPromptForIntent(intent);
    const systemPrompt = cardTitle
      ? `${baseSystemPrompt}\n\n${clientSystemContext ? clientSystemContext + "\n\n" : ""}The user is discussing a saved card titled "${cardTitle}". Use the card content below to provide relevant, specific advice.`
      : clientSystemContext
        ? `${baseSystemPrompt}\n\n${clientSystemContext}`
        : baseSystemPrompt;

    const userPrompt = `${attachmentContext ? `CONTEXT:\n${attachmentContext}\n\n` : ""}USER REQUEST:\n${lastUserMessage?.text || ""}

${intent === "script" && targetDuration ? `Target duration: ${targetDuration} minutes` : ""}
${intent === "social" && platform ? `Platform: ${platform}` : ""}
${tone ? `Tone: ${tone}` : ""}
${userVoice ? `Voice: ${userVoice}` : ""}`;

    const apiMessages = [
      { role: "system" as const, content: systemPrompt },
      ...messages.slice(0, -1)
        .filter((m) => m.role !== "system")
        .map((m) => ({ role: m.role as "user" | "assistant" | "system", content: m.text })),
      { role: "user" as const, content: userPrompt },
    ];

    const content = await callLLM(apiMessages, { temperature: 0.7, ...(model ? { model } : {}) });

    let artifact: { type: string; content: string } | undefined;
    let displayText = content;

    // Safety net: if the model returned JSON for a plain chat response (no
    // structured intent asked for), render it as readable markdown instead of
    // leaking raw JSON to the UI.
    if (intent === "chat") {
      const trimmed = content.trim();
      if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
        const parsed = parseJsonResponse(content, null);
        if (parsed !== null) {
          displayText = renderJsonAsMarkdown(parsed);
        }
      }
    }

    if (intent === "script") {
      const parsedScript = parseJsonResponse(content, null as unknown as Record<string, unknown>);
      if (parsedScript && typeof parsedScript === "object" && "script" in parsedScript) {
        const script = (parsedScript as Record<string, unknown>).script as Record<string, unknown>;
        const sections = Array.isArray(script.sections) ? script.sections as Array<{ label: string; content: string }> : [];
        const titleSuggestion = typeof script.title_suggestion === "string" ? script.title_suggestion : "";
        const totalWords = typeof script.total_word_count === "number" ? script.total_word_count : 0;
        const duration = typeof script.estimated_duration_minutes === "number" ? script.estimated_duration_minutes : 0;

        displayText = [
          titleSuggestion ? `**${titleSuggestion}**\n` : "",
          totalWords ? `*${totalWords} words · ~${duration} min*\n` : "",
          "",
          ...sections.map((s: { label: string; content: string }) => `### ${s.label}\n${s.content}\n`),
        ].join("\n");

        artifact = { type: "script", content: titleSuggestion || "Generated Script" };
      } else if (parsedScript !== null) {
        // JSON came back but in an unexpected shape — render, don't dump raw.
        displayText = renderJsonAsMarkdown(parsedScript);
        artifact = { type: "script", content: "Generated Script" };
      } else {
        // Not JSON — plain text prose is fine to show as-is.
        displayText = content;
        artifact = { type: "script", content: "Generated Script" };
      }
    } else if (intent === "social") {
      const parsedSocial = parseJsonResponse(content, null as unknown as Record<string, unknown>);
      if (parsedSocial && typeof parsedSocial === "object" && "posts" in parsedSocial) {
        const posts = Array.isArray((parsedSocial as Record<string, unknown>).posts)
          ? (parsedSocial as Record<string, unknown>).posts as Array<{ platform: string; text: string }>
          : [];
        displayText = posts.map((p: { platform: string; text: string }) => `**${p.platform}**\n${p.text}`).join("\n\n---\n\n");
        artifact = { type: "social_posts", content: posts.length > 0 ? posts[0].text.slice(0, 100) : "Generated Posts" };
      } else if (parsedSocial !== null) {
        displayText = renderJsonAsMarkdown(parsedSocial);
        artifact = { type: "social_posts", content: "Generated Posts" };
      } else {
        displayText = content;
        artifact = { type: "social_posts", content: "Generated Posts" };
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        text: displayText,
        artifact,
      },
    });
  } catch (error) {
    console.error("Chat generation error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
