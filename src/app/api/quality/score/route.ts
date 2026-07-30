import { z } from "zod";
import { NextRequest, NextResponse } from "next/server";
import { scoreOutput } from "@/lib/quality/scorers/scorer-registry";
import { parseBody } from "@/lib/api-helpers";

const scoreSchema = z.object({
  output: z.unknown(),
  outputType: z.enum(["seo", "script", "social_x", "social_instagram", "social_facebook"]),
  context: z.record(z.string(), z.unknown()).optional(),
});

export async function POST(request: NextRequest) {
  try {
    const validation = await parseBody(request, scoreSchema);
    if (!validation.success) return validation.errorResponse;

    const { output, outputType, context } = validation.data;

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
