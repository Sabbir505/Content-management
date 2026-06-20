import { NextRequest, NextResponse } from "next/server";
import { analyzeVideo } from "@/lib/analyze-structure/video-pipeline";
import { analyzeArticle } from "@/lib/analyze-structure/article-pipeline";
import { analyzeStructureWithLLM } from "@/lib/analyze-structure/llm-analysis";
import type { SourceType, AnalyzeResult } from "@/lib/analyze-structure/types";

function isTranscriptError(message: string): boolean {
  const lower = message.toLowerCase();
  const transcriptKeywords = [
    "transcript",
    "captions",
    "subtitles",
    "disabled",
    "unavailable",
    "fetch",
    "network",
    "timeout",
    "aborted",
    "abort",
    "no captions",
    "not available",
  ];
  return transcriptKeywords.some((keyword) => lower.includes(keyword));
}

function getLLMErrorMessage(message: string): string {
  const lower = message.toLowerCase();
  if (lower.includes("api key") || lower.includes("not configured")) {
    return "Analysis service is not configured. Please check your API key.";
  }
  if (lower.includes("rate") || lower.includes("429") || lower.includes("too many")) {
    return "Analysis service is temporarily rate limited. Please try again in a moment.";
  }
  if (lower.includes("timeout") || lower.includes("abort") || lower.includes("timed out")) {
    return "Analysis took too long to complete. Please try again.";
  }
  if (lower.includes("network") || lower.includes("fetch")) {
    return "Could not reach the analysis service. Please check your connection and try again.";
  }
  return "We couldn't analyze this content right now. Please try again later.";
}

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
        console.error("analyzeVideo error:", message, videoError);
        if (isTranscriptError(message)) {
          return NextResponse.json(
            { success: false, error: "This video doesn't have captions available, so we can't analyze its structure." },
            { status: 200 }
          );
        }
        if (message.toLowerCase().includes("not found") || message.toLowerCase().includes("not available") || message.toLowerCase().includes("unavailable")) {
          return NextResponse.json(
            { success: false, error: "Video not found or unavailable." },
            { status: 200 }
          );
        }
        throw videoError;
      }

      let llmResult;
      try {
        llmResult = await analyzeStructureWithLLM({
          sourceType: "video",
          title: videoData.metadata.title || videoData.segments[0]?.text.slice(0, 100) || "Unknown",
          creator: videoData.metadata.channel_title || "YouTube Creator",
          engagement: "N/A",
          niche: "general",
          durationSeconds: videoData.durationSeconds,
          transcriptQuality: videoData.transcriptQuality,
          beats: videoData.beats,
          videoMetadata: videoData.metadata,
        });
      } catch (llmError) {
        const message = llmError instanceof Error ? llmError.message : "Failed to analyze structure";
        console.error("analyzeStructureWithLLM error:", message, llmError);
        return NextResponse.json(
          { success: false, error: getLLMErrorMessage(message) },
          { status: 200 }
        );
      }

      result = {
        source_type: "video",
        structural_breakdown: llmResult.structuralBreakdown,
        source_specific: llmResult.sourceSpecific,
        source_metadata: llmResult.sourceMetadata,
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
        console.error("analyzeArticle error:", message, articleError);
        if (message.includes("JavaScript rendering") || message.includes("JS")) {
          return NextResponse.json(
            { success: false, error: "We couldn't access this article's content. Try a different link or check if it's behind a login." },
            { status: 200 }
          );
        }
        if (message.includes("paywall") || message.includes("blocked")) {
          return NextResponse.json(
            { success: false, error: "This article may be paywalled or partially blocked." },
            { status: 200 }
          );
        }
        throw articleError;
      }

      let llmResult;
      try {
        llmResult = await analyzeStructureWithLLM({
          sourceType: "article",
          title: articleData.metadata.title,
          creator: articleData.metadata.author || "Unknown Author",
          engagement: "N/A",
          niche: "general",
          wordCount: articleData.wordCount,
          readTimeMinutes: Math.round(articleData.wordCount / 230),
          hadHeaders: articleData.hadHeaders,
          beats: articleData.beats,
          articleMetadata: articleData.metadata,
        });
      } catch (llmError) {
        const message = llmError instanceof Error ? llmError.message : "Failed to analyze structure";
        console.error("analyzeStructureWithLLM error:", message, llmError);
        return NextResponse.json(
          { success: false, error: getLLMErrorMessage(message) },
          { status: 200 }
        );
      }

      result = {
        source_type: "article",
        structural_breakdown: llmResult.structuralBreakdown,
        source_specific: llmResult.sourceSpecific,
        source_metadata: llmResult.sourceMetadata,
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
