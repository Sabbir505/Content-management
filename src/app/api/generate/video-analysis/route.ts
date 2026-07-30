import { NextRequest, NextResponse } from "next/server";
import { guardApiKey } from "@/lib/api-helpers";
import { callLLM, type ApiMessage } from "@/lib/generation/llm";
import type { VideoAnalysisResult } from "@/lib/channel-analytics";

const LLM_OPTS = { temperature: 0.3, maxTokens: 3000, timeoutMs: 60000, maxRetries: 0, emptyFallback: "{}" } as const;

interface VideoAnalysisInput {
  videoId: string;
  title: string;
  channelTitle: string;
  description: string;
  tags: string[];
  duration: string;
  durationSeconds: number;
  publishedAt: string;
  viewCount: number;
  likeCount: number;
  commentCount: number;
  outlierScore: number;
  performanceScore: number;
  improvementPotential: number;
  hookType: string;
  isShort: boolean;
  channelAvgViews: number;
  channelHealthScore?: number;
  channelAvgPerformance?: number;
  bestTopic?: string;
  bestHook?: string;
}

function buildSystemPrompt(): string {
  return `You are TubeForge's senior YouTube content strategist. Your job is to analyze a video's performance data and metadata to provide actionable, specific insights.

You have access to:
- Video metadata (title, description, tags, duration, publish date)
- Performance metrics (views, likes, comments, outlier score vs channel average)
- Channel context (average views, health score, best performing topics/hooks)

Analyze the video deeply and provide specific, actionable feedback. Generic advice like "make better thumbnails" is useless. "The title uses a question hook but lacks a power word — adding 'Proven' or 'Secret' could increase CTR by 15-20%" is useful.

For each analysis category, give a score (0-100) and specific feedback.

OUTPUT FORMAT
- Return valid JSON only
- No preamble or explanation outside the JSON
- Follow the exact schema in the user prompt`;
}

function buildUserPrompt(input: VideoAnalysisInput): string {
  const engagementRate = input.viewCount > 0 
    ? (((input.likeCount + input.commentCount) / input.viewCount) * 100).toFixed(2)
    : "0";

  const viewsVsAvg = input.channelAvgViews > 0 
    ? ((input.viewCount / input.channelAvgViews)).toFixed(2)
    : "N/A";

  return `Analyze the following YouTube video and provide a comprehensive performance analysis.

VIDEO METADATA
--------------
Title: ${input.title}
Channel: ${input.channelTitle}
Duration: ${input.duration} (${input.durationSeconds}s)
Published: ${input.publishedAt}
Is Short: ${input.isShort ? "Yes" : "No"}
Description: ${input.description.slice(0, 500)}${input.description.length > 500 ? "..." : ""}
Tags: ${input.tags.slice(0, 15).join(", ")}

PERFORMANCE METRICS
-------------------
Views: ${input.viewCount.toLocaleString()}
Likes: ${input.likeCount.toLocaleString()}
Comments: ${input.commentCount.toLocaleString()}
Engagement Rate: ${engagementRate}%
Outlier Score: ${input.outlierScore}x (vs channel average)
Performance Score: ${input.performanceScore}%
Improvement Potential: ${input.improvementPotential}%
Hook Type: ${input.hookType}
Views vs Channel Average: ${viewsVsAvg}x

CHANNEL CONTEXT
---------------
Channel Average Views: ${input.channelAvgViews.toLocaleString()}
${input.channelHealthScore ? `Channel Health Score: ${input.channelHealthScore}/100` : ""}
${input.channelAvgPerformance ? `Channel Avg Performance: ${input.channelAvgPerformance}%` : ""}
${input.bestTopic ? `Best Performing Topic: ${input.bestTopic}` : ""}
${input.bestHook ? `Best Performing Hook: ${input.bestHook}` : ""}

Respond using this exact JSON schema:

{
  "summary": "A 2-3 sentence overview of why this video performed the way it did",
  "strengths": ["Specific strength 1", "Specific strength 2", "Specific strength 3"],
  "weaknesses": ["Specific weakness 1", "Specific weakness 2"],
  "opportunities": ["Specific opportunity 1", "Specific opportunity 2"],
  "title_analysis": {
    "score": 0,
    "feedback": "Detailed feedback on the title's effectiveness",
    "suggestions": ["Specific suggestion 1", "Specific suggestion 2"]
  },
  "thumbnail_analysis": {
    "score": 0,
    "feedback": "What the thumbnail likely does well or poorly based on title + performance",
    "suggestions": ["Specific suggestion 1", "Specific suggestion 2"]
  },
  "hook_analysis": {
    "score": 0,
    "feedback": "Analysis of the opening hook based on title and performance data",
    "suggestions": ["Specific suggestion 1", "Specific suggestion 2"]
  },
  "retention_analysis": {
    "score": 0,
    "feedback": "Inferred retention issues based on duration, views, and engagement patterns",
    "suggestions": ["Specific suggestion 1", "Specific suggestion 2"]
  },
  "seo_analysis": {
    "score": 0,
    "feedback": "Analysis of description, tags, and discoverability",
    "suggestions": ["Specific suggestion 1", "Specific suggestion 2"]
  },
  "overall_score": 0,
  "overall_grade": "A | B+ | B | C | D | F",
  "action_items": ["Priority action 1", "Priority action 2", "Priority action 3"]
}`;
}

function parseAnalysisResponse(content: string): VideoAnalysisResult {
  const cleanJson = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();

  try {
    const parsed = JSON.parse(cleanJson);
    return {
      summary: parsed.summary || "Analysis complete.",
      strengths: parsed.strengths || [],
      weaknesses: parsed.weaknesses || [],
      opportunities: parsed.opportunities || [],
      title_analysis: {
        score: parsed.title_analysis?.score || 0,
        feedback: parsed.title_analysis?.feedback || "",
        suggestions: parsed.title_analysis?.suggestions || [],
      },
      thumbnail_analysis: {
        score: parsed.thumbnail_analysis?.score || 0,
        feedback: parsed.thumbnail_analysis?.feedback || "",
        suggestions: parsed.thumbnail_analysis?.suggestions || [],
      },
      hook_analysis: {
        score: parsed.hook_analysis?.score || 0,
        feedback: parsed.hook_analysis?.feedback || "",
        suggestions: parsed.hook_analysis?.suggestions || [],
      },
      retention_analysis: {
        score: parsed.retention_analysis?.score || 0,
        feedback: parsed.retention_analysis?.feedback || "",
        suggestions: parsed.retention_analysis?.suggestions || [],
      },
      seo_analysis: {
        score: parsed.seo_analysis?.score || 0,
        feedback: parsed.seo_analysis?.feedback || "",
        suggestions: parsed.seo_analysis?.suggestions || [],
      },
      overall_score: parsed.overall_score || 0,
      overall_grade: parsed.overall_grade || "C",
      action_items: parsed.action_items || [],
    };
  } catch (err) {
    console.error("[ANALYSIS PARSE ERROR]", err instanceof Error ? err.message : err);
    console.error("[RAW RESPONSE]", content.slice(0, 2000));
    return {
      summary: "Analysis parsing failed. Raw data available.",
      strengths: [],
      weaknesses: [],
      opportunities: [],
      title_analysis: { score: 0, feedback: "Unable to analyze", suggestions: [] },
      thumbnail_analysis: { score: 0, feedback: "Unable to analyze", suggestions: [] },
      hook_analysis: { score: 0, feedback: "Unable to analyze", suggestions: [] },
      retention_analysis: { score: 0, feedback: "Unable to analyze", suggestions: [] },
      seo_analysis: { score: 0, feedback: "Unable to analyze", suggestions: [] },
      overall_score: 0,
      overall_grade: "F",
      action_items: ["Try refreshing the analysis"],
    };
  }
}

export async function POST(request: NextRequest) {
  try {
    const guard = await guardApiKey("KIMI_API_KEY");
    if (guard) return guard;

    const body = await request.json();
    const input = body as VideoAnalysisInput;

    if (!input.videoId || !input.title) {
      return NextResponse.json(
        { success: false, error: "videoId and title are required" },
        { status: 400 }
      );
    }

    const messages: ApiMessage[] = [
      { role: "system", content: buildSystemPrompt() },
      { role: "user", content: buildUserPrompt(input) },
    ];

    const content = await callLLM(messages, LLM_OPTS);
    const result = parseAnalysisResponse(content);

    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    console.error("Video analysis error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to analyze video" },
      { status: 500 }
    );
  }
}
