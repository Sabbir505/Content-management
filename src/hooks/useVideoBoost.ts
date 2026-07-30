"use client";

import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import type { ChannelVideo, ChannelStats, SeoPackage, VideoAnalysisResult } from "@/lib/channel-analytics";

interface VideoBoostState {
  isBoosting: boolean;
  seoPackage: SeoPackage | null;
  activeBoostTab: "titles" | "description" | "tags" | "thumbnails";
  videoAnalysis: VideoAnalysisResult | null;
  isAnalyzing: boolean;
  activeAnalysisTab: "overview" | "title" | "thumbnail" | "hook" | "retention" | "seo" | "actions";
}

interface VideoBoostActions {
  setActiveBoostTab: (tab: VideoBoostState["activeBoostTab"]) => void;
  setActiveAnalysisTab: (tab: VideoBoostState["activeAnalysisTab"]) => void;
  fetchAnalysis: (force?: boolean) => Promise<void>;
  handleBoost: () => Promise<void>;
}

interface UseVideoBoostInput {
  video: ChannelVideo | null;
  isOpen: boolean;
  channelStats?: ChannelStats | null;
}

export function useVideoBoost({ video, isOpen, channelStats }: UseVideoBoostInput): VideoBoostState & VideoBoostActions {
  const [isBoosting, setIsBoosting] = useState(false);
  const [seoPackage, setSeoPackage] = useState<SeoPackage | null>(null);
  const [activeBoostTab, setActiveBoostTab] = useState<VideoBoostState["activeBoostTab"]>("titles");
  const [videoAnalysis, setVideoAnalysis] = useState<VideoAnalysisResult | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [activeAnalysisTab, setActiveAnalysisTab] = useState<VideoBoostState["activeAnalysisTab"]>("overview");

  // Reset boost/analysis state when the selected video changes (render-phase reset,
  // not an effect, to avoid cascading renders flagged by react-hooks/set-state-in-effect).
  // Loads cached analysis if present, else clears it.
  const videoId = video?.id;
  const [lastVideoId, setLastVideoId] = useState(videoId);
  if (videoId !== lastVideoId) {
    setLastVideoId(videoId);
    setSeoPackage(null);
    setActiveBoostTab("titles");
    if (videoId) {
      const cached = localStorage.getItem(`video_analysis_${videoId}`);
      try {
        setVideoAnalysis(cached ? JSON.parse(cached) : null);
      } catch { /* ignore */ }
    } else {
      setVideoAnalysis(null);
    }
  }

  const fetchAnalysisInternal = useCallback(async (force = false) => {
    if (!video) return;
    if (!force) {
      const cached = localStorage.getItem(`video_analysis_${video.id}`);
      if (cached) {
        try { setVideoAnalysis(JSON.parse(cached)); return; } catch { /* ignore */ }
      }
    }
    setIsAnalyzing(true);
    try {
      const response = await fetch("/api/generate/video-analysis", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          videoId: video.id,
          title: video.title,
          channelTitle: video.channelTitle,
          description: video.description || "",
          tags: video.tags || [],
          duration: video.duration,
          durationSeconds: video.durationSeconds,
          publishedAt: video.publishedAt,
          viewCount: video.viewCount,
          likeCount: video.likeCount || 0,
          commentCount: video.commentCount || 0,
          outlierScore: video.outlierScore,
          performanceScore: video.performanceScore,
          improvementPotential: video.improvementPotential,
          hookType: video.hookType,
          isShort: video.isShort,
          channelAvgViews: video.channelAvgViews,
          channelHealthScore: channelStats?.healthScore,
          channelAvgPerformance: channelStats?.avgPerformance,
          bestTopic: channelStats?.insights.bestTopic,
          bestHook: channelStats?.insights.bestHook,
        }),
      });
      const result = await response.json();
      if (!result.success) throw new Error(result.error || "Failed to analyze video");
      setVideoAnalysis(result.data);
      localStorage.setItem(`video_analysis_${video.id}`, JSON.stringify(result.data));
      toast.success("Video analysis complete");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to analyze video");
    } finally { setIsAnalyzing(false); }
  }, [video?.id, channelStats]);

  // Auto-fetch analysis when modal opens
  useEffect(() => {
    if (!video || !isOpen) return;
    const cached = localStorage.getItem(`video_analysis_${video.id}`);
    if (!cached && !isAnalyzing && !videoAnalysis) {
      // Defer so setState inside fetchAnalysisInternal doesn't run synchronously in the effect
      queueMicrotask(() => void fetchAnalysisInternal(false));
    }
  }, [video?.id, isOpen, isAnalyzing, videoAnalysis, fetchAnalysisInternal]);

  const handleBoost = useCallback(async () => {
    if (!video) return;
    setIsBoosting(true);
    const bestTopic = channelStats?.insights.bestTopic || video.title.split(" ").slice(0, 3).join(" ");
    const bestHook = channelStats?.insights.bestHook || "";
    try {
      const response = await fetch("/api/generate/seo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          videoTitle: video.title, videoDescription: video.description || "", existingTags: video.tags || [],
          topic: video.title, niche: bestTopic, primaryKeyword: video.title.split(" ").slice(0, 3).join(" "),
          secondaryKeywords: [...(video.tags || []).slice(0, 5), bestTopic, bestHook].filter(Boolean),
        }),
      });
      const result = await response.json();
      if (!result.success) throw new Error(result.error || "Failed to generate SEO package");
      setSeoPackage(result.data.output);
      toast.success("Boost complete — metadata generated");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to boost video");
    } finally { setIsBoosting(false); }
  }, [video?.id, channelStats]);

  return {
    isBoosting,
    seoPackage,
    activeBoostTab,
    videoAnalysis,
    isAnalyzing,
    activeAnalysisTab,
    setActiveBoostTab,
    setActiveAnalysisTab,
    fetchAnalysis: fetchAnalysisInternal,
    handleBoost,
  };
}
