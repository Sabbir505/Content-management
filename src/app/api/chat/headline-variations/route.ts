import { z } from "zod";
import { NextRequest, NextResponse } from "next/server";
import { callLLM } from "@/lib/generation/llm";
import { parseBody } from "@/lib/api-helpers";

const headlineSchema = z.object({
  title: z.string().min(1),
  type: z.enum(["video", "article"]),
  description: z.string().optional(),
});

const SYSTEM_PROMPT = `You are an expert headline copywriter for content creators. Given a title, generate 5 headline variations, each following a specific psychological hook pattern.

For each category, follow these rules:

1. **Contrarian reframe** — Challenge a widely-held belief in the niche. Start with "Why..." or "Stop..." or flip a common assumption.
2. **Confession / Stakes** — Make it feel like an insider secret or a high-stakes revelation. Use words like "confession," "truth," "nobody tells you," "real reason."
3. **Specific promise** — A concrete, measurable benefit. Use numbers, timeframes, or dollar amounts. The reader knows exactly what they'll get.
4. **Curiosity gap** — Tease without giving away the answer. Create an itch they must scratch. Use "this," "here's what," "one thing."
5. **Polarizing swing** — Take a bold stand that divides the room. Strong opinion, no hedging. "Unpopular opinion," "Hot take," "Change my mind."

CRITICAL RULES:
- Each headline MUST be different from the original title
- Each headline must be under 120 characters
- Write for a content creator audience (YouTubers, newsletter writers, social media creators)
- Use the original title's topic/niche — don't change the subject, only the framing

Return ONLY valid JSON with this exact schema:
{
  "variations": [
    { "label": "Contrarian reframe", "headline": "..." },
    { "label": "Confession / Stakes", "headline": "..." },
    { "label": "Specific promise", "headline": "..." },
    { "label": "Curiosity gap", "headline": "..." },
    { "label": "Polarizing swing", "headline": "..." }
  ]
}`;

export async function POST(request: NextRequest) {
  try {
    const validation = await parseBody(request, headlineSchema);
    if (!validation.success) return validation.errorResponse;

    const { title, type, description } = validation.data;

    const userPrompt = `Original ${type === "video" ? "YouTube video" : "article"} title: "${title}"${description ? `\nDescription context: "${description.slice(0, 300)}"` : ""}

Generate 5 headline variations following the 5 psychological hook patterns.`;

    const content = await callLLM(
      [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userPrompt },
      ],
      0.8
    );

    const cleanJson = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    const parsedResponse = JSON.parse(cleanJson);

    // Guard against a non-array `variations` value — fall back to [] so the
    // client's .map() never receives a non-iterable and no raw value leaks.
    const variations = Array.isArray(parsedResponse?.variations)
      ? parsedResponse.variations.filter(
          (v: unknown): v is { label: string; headline: string } =>
            !!v && typeof v === "object" &&
            typeof (v as { label: unknown }).label === "string" &&
            typeof (v as { headline: unknown }).headline === "string",
        )
      : [];

    return NextResponse.json({
      success: true,
      data: {
        variations,
        sourceTitle: title,
      },
    });
  } catch (error) {
    console.error("Headline variations error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
