import { NextRequest, NextResponse } from "next/server";
import { analyzeVideo } from "@/lib/analyze-structure/video-pipeline";
import { analyzeArticle } from "@/lib/analyze-structure/article-pipeline";
import { analyzeStructureWithLLM } from "@/lib/analyze-structure/llm-analysis";
import type { SourceType, AnalyzeResult } from "@/lib/analyze-structure/types";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { sourceType, videoId, articleUrl } = body as {
      sourceType: SourceType;
      videoId?: string;
      articleUrl?: string;
    };

    if (!sourceType || (sourceType !== "video" && sourceType !== "article")) {
      return NextResponse.json(
        { success: false, error: "Invalid or missing sourceType. Must be 'video' or 'article'" },
        { status: 400 }
      );
    }

    let result: AnalyzeResult;

    if (sourceType === "video") {
      if (!videoId) {
        return NextResponse.json(
          { success: false, error: "videoId is required for video analysis" },
          { status: 400 }
        );
      }

      let videoData;
      try {
        videoData = await analyzeVideo(videoId);
      } catch (videoError) {
        const message = videoError instanceof Error ? videoError.message : "Failed to analyze video";
        // Check for common failure cases
        if (message.includes("No transcript") || message.includes("transcript") || message.includes("captions") || message.includes("unavailable") || message.includes("fetch")) {
          return NextResponse.json(
            { success: false, error: "This video doesn't have captions available, so we can't analyze its structure." },
            { status: 404 }
          );
        }
        if (message.includes("not found") || message.includes("not available")) {
          return NextResponse.json(
            { success: false, error: "Video not found or unavailable." },
            { status: 404 }
          );
        }
        throw videoError;
      }

      const llmResult = await analyzeStructureWithLLM({
        sourceType: "video",
        title: videoData.segments[0]?.text.slice(0, 100) || "Unknown",
        creator: "YouTube Creator",
        engagement: "N/A",
        niche: "general",
        durationSeconds: videoData.durationSeconds,
        transcriptQuality: videoData.transcriptQuality,
        beats: videoData.beats,
      });

      result = {
        source_type: "video",
        structural_breakdown: llmResult.structuralBreakdown,
        source_specific: llmResult.sourceSpecific,
      };
    } else {
      if (!articleUrl) {
        return NextResponse.json(
          { success: false, error: "articleUrl is required for article analysis" },
          { status: 400 }
        );
      }

      let articleData;
      try {
        articleData = await analyzeArticle(articleUrl);
      } catch (articleError) {
        const message = articleError instanceof Error ? articleError.message : "Failed to analyze article";
        if (message.includes("JavaScript rendering") || message.includes("JS")) {
          return NextResponse.json(
            { success: false, error: "We couldn't access this article's content. Try a different link or check if it's behind a login." },
            { status: 404 }
          );
        }
        if (message.includes("paywall") || message.includes("blocked")) {
          return NextResponse.json(
            { success: false, error: "This article may be paywalled or partially blocked." },
            { status: 404 }
          );
        }
        throw articleError;
      }

      const llmResult = await analyzeStructureWithLLM({
        sourceType: "article",
        title: articleData.metadata.title,
        creator: articleData.metadata.author || "Unknown Author",
        engagement: "N/A",
        niche: "general",
        wordCount: articleData.wordCount,
        readTimeMinutes: Math.round(articleData.wordCount / 230),
        hadHeaders: articleData.hadHeaders,
        beats: articleData.beats,
      });

      result = {
        source_type: "article",
        structural_breakdown: llmResult.structuralBreakdown,
        source_specific: llmResult.sourceSpecific,
      };
    }

    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    console.error("Analyze structure error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to analyze structure",
      },
      { status: 500 }
    );
  }
}
