import { NextRequest, NextResponse } from "next/server";
import { trackPublishedContent } from "@/lib/quality/feedback/content-tracker";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, contentId, contentType, scoreAtGeneration, niche, voiceProfileVersion, platform } = body;

    if (!userId || !contentId || !contentType || !platform) {
      return NextResponse.json(
        { success: false, error: "userId, contentId, contentType, and platform are required" },
        { status: 400 }
      );
    }

    const id = await trackPublishedContent({
      userId,
      contentId,
      contentType,
      scoreAtGeneration: scoreAtGeneration || 0,
      niche: niche || "",
      voiceProfileVersion: voiceProfileVersion || 1,
      generationDate: new Date().toISOString(),
      platform,
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
