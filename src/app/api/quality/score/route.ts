import { z } from "zod";
import { NextRequest, NextResponse } from "next/server";
import { scoreOutput } from "@/lib/quality/scorers/scorer-registry";
import type { OutputType, ScoringContext } from "@/lib/quality/types";

const scoreSchema = z.object({
  output: z.unknown(),
  outputType: z.enum(["seo", "script", "social_x", "social_instagram", "social_facebook"]),
  context: z.record(z.string(), z.unknown()).optional(),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = scoreSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: parsed.error.issues.map((e: { message: string }) => e.message).join(", ") },
        { status: 400 }
      );
    }

    const { output, outputType, context } = parsed.data;

    const score = scoreOutput(output, outputType, context || {});
    return NextResponse.json({ success: true, data: score });
  } catch (error) {
    console.error("Scoring error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
