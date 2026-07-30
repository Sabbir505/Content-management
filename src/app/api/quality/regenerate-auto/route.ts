import { NextRequest, NextResponse } from "next/server";
import { guardApiKey } from "@/lib/api-helpers";
import { buildRegenerationPrompt } from "@/lib/quality/regeneration";
import { callLLM } from "@/lib/generation/llm";

export async function POST(request: NextRequest) {
  try {
    const guard = await guardApiKey("KIMI_API_KEY");
    if (guard) return guard;

    const body = await request.json();
    const {
      outputType,
      score,
      originalPrompt,
      systemPrompt,
    } = body as {
      outputType: string;
      originalOutput: unknown;
      score: { score: number; breakdown: Record<string, { issues: string[] }>; suggestions: string[] };
      originalPrompt: string;
      systemPrompt: string;
    };

    if (!outputType || !originalPrompt) {
      return NextResponse.json(
        { success: false, error: "outputType and originalPrompt are required" },
        { status: 400 }
      );
    }

    const regenerationContext = buildRegenerationPrompt(
      score as Parameters<typeof buildRegenerationPrompt>[0]
    );

    const messages = [
      { role: "system" as const, content: systemPrompt },
      { role: "user" as const, content: regenerationContext + originalPrompt },
    ];

    const improvedOutput = await callLLM(messages, {
      temperature: 0.6,
      maxTokens: 2500,
      timeoutMs: 30000,
      maxRetries: 0,
    });

    return NextResponse.json({ success: true, data: improvedOutput });
  } catch (error) {
    console.error("Auto-regeneration error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
