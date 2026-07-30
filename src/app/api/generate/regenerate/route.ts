import { z } from "zod";
import { NextRequest, NextResponse } from "next/server";
import { parseBody, guardApiKey } from "@/lib/api-helpers";
import { callLLM, type ApiMessage } from "@/lib/generation/llm";

const regenerateSchema = z.object({
  sectionType: z.string().min(1, "Section type is required"),
  currentScript: z.string().min(1, "Current script is required"),
  userVoice: z.string().optional(),
  instruction: z.string().optional(),
});

export async function POST(request: NextRequest) {
  try {
    const guard = await guardApiKey("KIMI_API_KEY");
    if (guard) return guard;

    const validation = await parseBody(request, regenerateSchema);
    if (!validation.success) return validation.errorResponse;

    const { sectionType, currentScript, userVoice, instruction } = validation.data;

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

    const section = await callLLM(messages, {
      temperature: 0.7,
      maxTokens: 1000,
      timeoutMs: 30000,
      maxRetries: 0,
    });

    return NextResponse.json({ success: true, data: section });
  } catch {
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}
