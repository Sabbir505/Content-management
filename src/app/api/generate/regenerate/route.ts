import { z } from "zod";
import { NextRequest, NextResponse } from "next/server";

const regenerateSchema = z.object({
  sectionType: z.string().min(1, "Section type is required"),
  currentScript: z.string().min(1, "Current script is required"),
  userVoice: z.string().optional(),
  instruction: z.string().optional(),
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

export async function POST(request: NextRequest) {
  try {
    if (!API_KEY) {
      return NextResponse.json({ success: false, error: "KIMI_API_KEY not configured" }, { status: 500 });
    }

    const body = await request.json();
    const parsed = regenerateSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: parsed.error.issues.map((e: { message: string }) => e.message).join(", ") },
        { status: 400 }
      );
    }

    const { sectionType, currentScript, userVoice, instruction } = parsed.data;

    const messages: ApiMessage[] = [
      {
        role: "system",
        content: `You are an expert YouTube scriptwriter. Regenerate ONLY the specified section of a script while maintaining consistency with the rest. Do NOT rewrite or modify any other sections.

NON-NEGOTIABLE RULES
- Only rewrite the [${sectionType}] section
- Keep all other sections exactly as they are
- Match the voice profile provided exactly
- Maintain the same tone, sentence length, and vocabulary as the original script
- The new section must flow naturally into the next section

Voice: ${userVoice || "Conversational, direct, slightly informal"}`,
      },
      {
        role: "user",
        content: `Here is the full script. Regenerate ONLY the [${sectionType}] section. Do not modify any other sections.

${currentScript}

${instruction || ""}

Please provide ONLY the new ${sectionType} section content (without the section label).`,
      },
    ];

    const response = await fetch(API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${API_KEY}`,
      },
      body: JSON.stringify({
        model: MODEL,
        messages,
        temperature: 0.7,
        max_tokens: 1000,
      }),
      signal: AbortSignal.timeout(30000),
    });

    if (!response.ok) {
      return NextResponse.json({ success: false, error: "Failed to regenerate section" }, { status: 500 });
    }

    const data: ApiResponse = await response.json();
    const section = data.choices[0]?.message?.content || "";

    return NextResponse.json({ success: true, data: section });
  } catch (error) {
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}
