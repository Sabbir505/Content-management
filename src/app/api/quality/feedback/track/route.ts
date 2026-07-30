import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { trackPublishedContent } from "@/lib/quality/feedback/content-tracker";
import { validateUserAccess } from "@/lib/api-auth";

const trackSchema = z.object({
  userId: z.string().min(1),
  contentId: z.string().min(1),
  contentType: z.enum(["seo", "script", "social_x", "social_instagram", "social_facebook"]),
  platform: z.enum(["youtube", "x", "instagram", "facebook"]),
  scoreAtGeneration: z.number().optional().default(0),
  niche: z.string().optional().default(""),
  voiceProfileVersion: z.number().optional().default(1),
});

export async function POST(request: NextRequest) {
  try {
    const parsed = trackSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: parsed.error.issues.map((e) => e.message).join(", ") },
        { status: 400 }
      );
    }
    const body = parsed.data;

    const authError = await validateUserAccess(request, body.userId);
    if (authError) return authError;

    const id = await trackPublishedContent({
      userId: body.userId,
      contentId: body.contentId,
      contentType: body.contentType,
      scoreAtGeneration: body.scoreAtGeneration,
      niche: body.niche,
      voiceProfileVersion: body.voiceProfileVersion,
      generationDate: new Date().toISOString(),
      platform: body.platform,
      publishedUrl: null,
      publishedAt: null,
      scoreBreakdown: null,
    });

    return NextResponse.json({ success: true, data: { id } });
  } catch (error) {
    console.error("Content tracking error:", error);
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}
