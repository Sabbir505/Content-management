"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { collection, addDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { AnalyzeResult } from "@/lib/analyze-structure/types";
import {
  type AnalysisError,
  formatAnalysisAsMarkdown,
} from "@/lib/analyze-helpers";

export function useAnalyzePage() {
  const { user } = useAuth();
  const searchParams = useSearchParams();
  const videoId = searchParams.get("videoId");
  const contentId = searchParams.get("contentId");

  const [result, setResult] = useState<AnalyzeResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<AnalysisError | null>(null);
  const [expandedBeats, setExpandedBeats] = useState(false);

  const analyzeVideo = useCallback(async (id: string, signal?: AbortSignal) => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`${window.location.origin}/api/analyze`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sourceType: "video", videoId: id }),
        ...(signal ? { signal } : {}),
      });

      const data = await response.json();
      if (signal?.aborted) return;
      if (!data.success) {
        throw new Error(data.error || "Failed to analyze video");
      }

      setResult(data.data);
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") return;
      const message = err instanceof Error ? err.message : "Failed to analyze video";
      setError({ message, canRetry: true });
      toast.error(message);
    } finally {
      if (!signal?.aborted) setIsLoading(false);
    }
  }, []);

  const analyzeArticle = useCallback(async (url: string, signal?: AbortSignal) => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`${window.location.origin}/api/analyze`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sourceType: "article", articleUrl: url }),
        ...(signal ? { signal } : {}),
      });

      const data = await response.json();
      if (signal?.aborted) return;
      if (!data.success) {
        throw new Error(data.error || "Failed to analyze article");
      }

      setResult(data.data);
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") return;
      const message = err instanceof Error ? err.message : "Failed to analyze article";
      setError({ message, canRetry: true });
      toast.error(message);
    } finally {
      if (!signal?.aborted) setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    // Defer to a microtask so setState calls inside analyze* don't run
    // synchronously within the effect body (react-hooks/set-state-in-effect)
    queueMicrotask(() => {
      if (videoId) {
        void analyzeVideo(videoId, controller.signal);
      } else if (contentId) {
        void analyzeArticle(contentId, controller.signal);
      }
    });
    return () => controller.abort();
  }, [videoId, contentId, analyzeVideo, analyzeArticle]);

  const handleRetry = useCallback(() => {
    if (videoId) {
      analyzeVideo(videoId);
    } else if (contentId) {
      analyzeArticle(contentId);
    }
  }, [videoId, contentId, analyzeVideo, analyzeArticle]);

  const handleCopy = useCallback(() => {
    if (!result) return;
    navigator.clipboard.writeText(formatAnalysisAsMarkdown(result));
    toast.success("Analysis copied to clipboard");
  }, [result]);

  const handleExportJson = useCallback(() => {
    if (!result) return;

    const blob = new Blob([JSON.stringify(result, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `structure-analysis-${videoId || "article"}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success("Analysis exported as JSON");
  }, [result, videoId]);

  const handleSaveToBoard = useCallback(async () => {
    if (!user) {
      toast.error("You must be signed in to save analyses");
      return;
    }
    if (!result) return;

    try {
      await addDoc(collection(db, "users", user.uid, "savedAnalyses"), {
        sourceType: result.source_type,
        structuralBreakdown: result.structural_breakdown,
        sourceSpecific: result.source_specific,
        sourceMetadata: result.source_metadata,
        videoId: videoId || null,
        articleUrl: contentId || null,
        savedAt: new Date().toISOString(),
      });
      toast.success("Analysis saved to board");
    } catch {
      toast.error("Failed to save analysis");
    }
  }, [user, result, videoId, contentId]);

  const visibleBeats = useMemo(() => {
    if (!result) return [];
    return expandedBeats ? result.structural_breakdown.beats : result.structural_breakdown.beats.slice(0, 4);
  }, [result, expandedBeats]);

  const hasMoreBeats = (result?.structural_breakdown.beats.length || 0) > 4;

  return {
    user,
    videoId,
    contentId,
    result,
    isLoading,
    error,
    expandedBeats,
    setExpandedBeats,
    visibleBeats,
    hasMoreBeats,
    handleRetry,
    handleCopy,
    handleExportJson,
    handleSaveToBoard,
  };
}
