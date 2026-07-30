"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { parseDuration, formatDuration, extractVideoId } from "@/lib/youtube";
import { YouTubeVideo } from "@/types/video";
import type { ScoredOutput } from "@/lib/quality/types";
import type { SeoPackage } from "@/lib/optimize-types";

function buildYouTubeVideo(data: Record<string, unknown>): YouTubeVideo {
  return {
    id: data.id as string,
    title: (data.title as string) || "",
    channelTitle: (data.channelTitle as string) || "",
    channelId: (data.channelId as string) || "",
    viewCount: (data.viewCount as number) || 0,
    likeCount: (data.likeCount as number) || 0,
    commentCount: (data.commentCount as number) || 0,
    thumbnail: (data.thumbnail as string) || "",
    publishedAt: (data.publishedAt as string) || "",
    duration: formatDuration(parseDuration(data.duration as string)),
    description: (data.description as string) || "",
    tags: (data.tags as string[]) || [],
  };
}

export function useOptimizePage() {
  const searchParams = useSearchParams();
  const initialVideoId = searchParams.get("videoId");

  const [url, setUrl] = useState(initialVideoId ? `https://youtube.com/watch?v=${initialVideoId}` : "");
  const [video, setVideo] = useState<YouTubeVideo | null>(null);
  const [seoPackage, setSeoPackage] = useState<SeoPackage | null>(null);
  const [scoredOutput, setScoredOutput] = useState<ScoredOutput<SeoPackage> | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isAutoRunning, setIsAutoRunning] = useState(false);
  const [activeTab, setActiveTab] = useState("titles");
  const [selectedTitleIndex, setSelectedTitleIndex] = useState<number | null>(null);

  const abortControllerRef = useRef<AbortController | null>(null);
  const autoRunStartedRef = useRef(false);

  const fetchVideoData = useCallback(async (videoId: string): Promise<YouTubeVideo | null> => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    try {
      const response = await fetch(`/api/youtube/video?videoId=${encodeURIComponent(videoId)}`, {
        signal: controller.signal,
      });
      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || "Failed to fetch video");
      }

      return buildYouTubeVideo(result.data);
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") return null;
      toast.error(error instanceof Error ? error.message : "Failed to fetch video");
      return null;
    } finally {
      clearTimeout(timeoutId);
    }
  }, []);

  const handleAnalyzeAndOptimize = useCallback(async (videoToAnalyze?: YouTubeVideo) => {
    const targetVideo = videoToAnalyze ?? video;
    if (!targetVideo) return;

    setIsAnalyzing(true);
    let transcriptText = "";

    const transcriptController = new AbortController();
    const transcriptTimeoutId = setTimeout(() => transcriptController.abort(), 15000);

    try {
      const transcriptResponse = await fetch(`/api/youtube/transcript?videoId=${targetVideo.id}`, {
        signal: transcriptController.signal,
      });
      const transcriptResult = await transcriptResponse.json();
      if (transcriptResult.success && transcriptResult.data) {
        transcriptText = transcriptResult.data.transcript;
      }
    } catch (error) {
      if (error instanceof Error && error.name !== "AbortError") {
        console.warn("Transcript extraction failed:", error);
      }
    } finally {
      clearTimeout(transcriptTimeoutId);
    }

    setIsAnalyzing(false);
    setIsGenerating(true);

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      const response = await fetch("/api/generate/seo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          videoTitle: targetVideo.title,
          videoDescription: targetVideo.description,
          existingTags: targetVideo.tags,
          topic: targetVideo.title,
          niche: "general",
          primaryKeyword: targetVideo.title.split(" ").slice(0, 3).join(" "),
          secondaryKeywords: targetVideo.tags?.slice(0, 5) || [],
          transcript: transcriptText,
        }),
        signal: controller.signal,
      });

      const result = await response.json();
      // A newer call may have aborted this controller while we awaited.
      if (controller.signal.aborted) return;

      if (!result.success) {
        throw new Error(result.error || "Failed to generate SEO package");
      }

      const scored = result.data as ScoredOutput<SeoPackage>;
      setSeoPackage(scored.output);
      setScoredOutput(scored);
      toast.success("SEO package generated!");
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") return;
      toast.error(error instanceof Error ? error.message : "Failed to generate SEO package");
    } finally {
      setIsGenerating(false);
    }
  }, [video]);

  const handleFetchVideo = useCallback(async () => {
    const videoId = extractVideoId(url);
    if (!videoId) {
      toast.error("Please enter a valid YouTube URL");
      return;
    }

    setIsLoading(true);
    setVideo(null);
    setSeoPackage(null);
    setSelectedTitleIndex(null);

    const videoData = await fetchVideoData(videoId);
    setIsLoading(false);

    if (videoData) {
      setVideo(videoData);
      toast.success("Video fetched successfully!");
      await handleAnalyzeAndOptimize(videoData);
    }
  }, [url, fetchVideoData, handleAnalyzeAndOptimize]);

  useEffect(() => {
    if (!initialVideoId || autoRunStartedRef.current) return;
    autoRunStartedRef.current = true;

    const videoId = initialVideoId;

    async function runPipeline() {
      setIsAutoRunning(true);
      setIsLoading(true);

      const videoData = await fetchVideoData(videoId);
      if (videoData) {
        setVideo(videoData);
        setIsLoading(false);
        await handleAnalyzeAndOptimize(videoData);
      } else {
        setIsLoading(false);
      }

      setIsAutoRunning(false);
    }

    runPipeline();
  }, [initialVideoId, fetchVideoData, handleAnalyzeAndOptimize]);

  const handleCopy = useCallback((text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Copied to clipboard!");
  }, []);

  const handleCopyAll = useCallback(() => {
    if (!seoPackage) return;
    const allText = [
      `TITLE: ${seoPackage.titles[0]?.text || ""}`,
      `\nDESCRIPTION:\n${seoPackage.description.full_text}`,
      `\nTAGS:\n${seoPackage.tags.map((t) => t.tag).join(", ")}`,
      `\nCHAPTERS:\n${seoPackage.chapters.map((c) => `${c.timestamp} ${c.title}`).join("\n")}`,
      `\nPINNED COMMENT:\n${seoPackage.pinned_comment}`,
    ].join("\n");
    navigator.clipboard.writeText(allText);
    toast.success("Full SEO package copied!");
  }, [seoPackage]);

  const showVideoPreview = video && !isLoading && !isAnalyzing && !isGenerating && !isAutoRunning && !seoPackage;

  return {
    url,
    setUrl,
    video,
    seoPackage,
    scoredOutput,
    isLoading,
    isAnalyzing,
    isGenerating,
    isAutoRunning,
    activeTab,
    setActiveTab,
    selectedTitleIndex,
    setSelectedTitleIndex,
    handleFetchVideo,
    handleAnalyzeAndOptimize,
    handleCopy,
    handleCopyAll,
    showVideoPreview,
  };
}
