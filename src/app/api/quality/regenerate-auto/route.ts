import { NextRequest, NextResponse } from "next/server";
import { buildRegenerationPrompt } from "@/lib/quality/regeneration";

const API_URL = process.env.KIMI_API_ENDPOINT || "https://ai2.18.show/v1/chat/completions";
const API_KEY = process.env.KIMI_API_KEY;
const MODEL = process.env.KIMI_MODEL || "DeepSeek-V4-Pro";

export async function POST(request: NextRequest) {
  try {
    if (!API_KEY) {
      return NextResponse.json({ success: false, error: "KIMI_API_KEY not configured" }, { status: 500 });
    }

    const body = await request.json();
    const {
      outputType,
      originalOutput,
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

    // Build regeneration context using the prompt library format
    const regenerationContext = buildRegenerationPrompt(
      score as Parameters<typeof buildRegenerationPrompt>[0],
      outputType as Parameters<typeof buildRegenerationPrompt>[1]
    );

    const fullUserPrompt = regenerationContext + originalPrompt;

    const messages = [
      { role: "system", content: systemPrompt },
      { role: "user", content: fullUserPrompt },
    ];

    // Drop temperature by 0.1 for regeneration
    const temperature = 0.6;

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
      return NextResponse.json(
        { success: false, error: `API error: ${response.status}` },
        { status: 500 }
      );
    }

    const data = await response.json();
    const content = data.choices[0]?.message?.content || "";

    // Try to parse as JSON, fall back to raw text
    let parsedOutput: unknown;
    try {
      const cleanJson = content
        .replace(/```json\n?/g, "")
        .replace(/```\n?/g, "")
        .trim();
      parsedOutput = JSON.parse(cleanJson);
    } catch {
      parsedOutput = content;
    }

    return NextResponse.json({ success: true, data: parsedOutput });
  } catch (error) {
    console.error("Auto-regeneration error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
