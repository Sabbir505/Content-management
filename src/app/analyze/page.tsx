"use client";

import { useState, Suspense, useEffect, useCallback, useMemo } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress, ProgressValue, ProgressLabel, ProgressTrack, ProgressIndicator } from "@/components/ui/progress";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { collection, addDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { AnalyzeResult } from "@/lib/analyze-structure/types";
import {
  RotateCcw,
  Copy,
  Download,
  Bookmark,
  ArrowLeft,
  Sparkles,
  Megaphone,
  ListOrdered,
  Flag,
  BarChart3,
  ChevronDown,
  ChevronUp,
  Clock,
  FileText,
  User,
  Calendar,
  Eye,
} from "lucide-react";

interface AnalysisError {
  message: string;
  canRetry: boolean;
}

function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  }
  return `${minutes}:${secs.toString().padStart(2, "0")}`;
}

function formatNumber(num?: number): string {
  if (num === undefined || num === null) return "N/A";
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(1)}M`;
  if (num >= 1_000) return `${(num / 1_000).toFixed(1)}K`;
  return num.toString();
}

function formatDate(dateString?: string): string {
  if (!dateString) return "N/A";
  try {
    return new Date(dateString).toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return "N/A";
  }
}

function AnalyzePageContent() {
  const { user } = useAuth();
  const searchParams = useSearchParams();
  const router = useRouter();
  const videoId = searchParams.get("videoId");
  const contentId = searchParams.get("contentId");

  const [result, setResult] = useState<AnalyzeResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<AnalysisError | null>(null);
  const [expandedBeats, setExpandedBeats] = useState(false);

  const analyzeVideo = useCallback(async (id: string) => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`${window.location.origin}/api/analyze`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sourceType: "video", videoId: id }),
      });

      const data = await response.json();
      if (!data.success) {
        throw new Error(data.error || "Failed to analyze video");
      }

      setResult(data.data);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to analyze video";
      setError({ message, canRetry: true });
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const analyzeArticle = useCallback(async (url: string) => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`${window.location.origin}/api/analyze`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sourceType: "article", articleUrl: url }),
      });

      const data = await response.json();
      if (!data.success) {
        throw new Error(data.error || "Failed to analyze article");
      }

      setResult(data.data);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to analyze article";
      setError({ message, canRetry: true });
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (videoId) {
      analyzeVideo(videoId);
    } else if (contentId) {
      analyzeArticle(contentId);
    }
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

    const { structural_breakdown, source_type } = result;
    const summary = `# Structure Analysis

## Hook
**Type:** ${structural_breakdown.hook.type}
**Technique:** ${structural_breakdown.hook.technique}
${structural_breakdown.hook.exact_text ? `**Exact text:** "${structural_breakdown.hook.exact_text}"\n` : ""}**Why it works:** ${structural_breakdown.hook.why_it_works}

## Intro
**Approach:** ${structural_breakdown.intro.approach}
**Viewer promise:** ${structural_breakdown.intro.viewer_promise}

## Beats
${structural_breakdown.beats.map((beat) => `${beat.beat_number}. **${beat.label}** — ${beat.purpose} (${beat.technique_used})`).join("\n")}

## Outro
**Style:** ${structural_breakdown.outro.style}
**CTA type:** ${structural_breakdown.outro.cta_type}
${structural_breakdown.outro.cta_exact_phrase ? `**CTA phrase:** "${structural_breakdown.outro.cta_exact_phrase}"\n` : ""}

## Overall
**Format:** ${structural_breakdown.overall.dominant_format}
**Pacing:** ${structural_breakdown.overall.pacing}
**Tone:** ${structural_breakdown.overall.tone}
**Replicability:** ${structural_breakdown.overall.replicability_score}/10
**Best for:** ${structural_breakdown.overall.best_for_niches.join(", ") || "General"}
`;

    navigator.clipboard.writeText(summary);
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

  // Loading state
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="mb-8">
            <Skeleton className="h-10 w-64 mb-2" />
            <Skeleton className="h-5 w-96" />
          </div>

          <Card>
            <CardHeader>
              <Skeleton className="h-6 w-48" />
            </CardHeader>
            <CardContent className="space-y-4">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="flex items-center gap-3">
                  <Skeleton className="h-8 w-8 rounded-full" />
                  <Skeleton className="h-4 flex-1" />
                  <Skeleton className="h-4 w-24" />
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="mb-8">
            <h1 className="text-3xl font-bold mb-2">Analyze Structure</h1>
            <p className="text-gray-600">Something went wrong</p>
          </div>

          <Card className="border-red-200 bg-red-50">
            <CardContent className="p-6">
              <p className="text-red-700">{error.message}</p>
              <div className="flex gap-3 mt-4">
                {error.canRetry && (
                  <Button variant="outline" onClick={handleRetry}>
                    <RotateCcw className="w-4 h-4 mr-2" />
                    Try Again
                  </Button>
                )}
                <Button variant="ghost" onClick={() => window.history.back()}>
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Go Back
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // No content selected
  if (!videoId && !contentId) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="mb-8">
            <h1 className="text-3xl font-bold mb-2">Analyze Structure</h1>
            <p className="text-gray-600">Select content from the Discover page to analyze its structure</p>
          </div>

          <Card>
            <CardContent className="p-6">
              <p className="text-gray-500">No content selected for analysis.</p>
              <Button variant="outline" className="mt-4" onClick={() => router.push("/discover")}>
                Go to Discover
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // Results
  if (!result) return null;

  const { structural_breakdown, source_specific, source_metadata, source_type } = result;
  const videoMeta = source_type === "video" ? source_metadata.video : null;
  const articleMeta = source_type === "article" ? source_metadata.article : null;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Structure Analysis</h1>
          <p className="text-gray-600">Structural DNA breakdown of the selected content</p>
        </div>

        {/* Source metadata card */}
        <Card className="mb-6">
          <CardContent className="p-6">
            <div className="flex flex-col md:flex-row gap-6">
              {videoMeta?.thumbnail_url && (
                <div className="relative w-full md:w-64 aspect-video rounded-lg overflow-hidden flex-shrink-0 bg-gray-100">
                  <Image
                    src={videoMeta.thumbnail_url}
                    alt={videoMeta.title || "Video thumbnail"}
                    fill
                    className="object-cover"
                    sizes="(max-width: 768px) 100vw, 256px"
                  />
                </div>
              )}

              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-4 mb-3">
                  <div>
                    <Badge variant="secondary" className="mb-2">
                      {source_type === "video" ? "YouTube Video" : "Article"}
                    </Badge>
                    <h2 className="text-xl font-semibold text-gray-900">
                      {videoMeta?.title || articleMeta?.title || "Untitled"}
                    </h2>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <Button variant="outline" size="sm" onClick={handleRetry} disabled={isLoading}>
                      <RotateCcw className={`w-4 h-4 mr-2 ${isLoading ? "animate-spin" : ""}`} />
                      Re-analyze
                    </Button>
                  </div>
                </div>

                <div className="flex flex-wrap gap-4 text-sm text-gray-600 mb-4">
                  {videoMeta?.channel_title && (
                    <div className="flex items-center gap-1.5">
                      <User className="w-4 h-4" />
                      {videoMeta.channel_title}
                    </div>
                  )}
                  {articleMeta?.author && (
                    <div className="flex items-center gap-1.5">
                      <User className="w-4 h-4" />
                      {articleMeta.author}
                    </div>
                  )}
                  {(videoMeta?.published_at || articleMeta?.published_at) && (
                    <div className="flex items-center gap-1.5">
                      <Calendar className="w-4 h-4" />
                      {formatDate(videoMeta?.published_at || articleMeta?.published_at)}
                    </div>
                  )}
                  {videoMeta?.view_count !== undefined && (
                    <div className="flex items-center gap-1.5">
                      <Eye className="w-4 h-4" />
                      {formatNumber(videoMeta.view_count)} views
                    </div>
                  )}
                  {source_type === "video" && source_specific.video && (
                    <div className="flex items-center gap-1.5">
                      <Clock className="w-4 h-4" />
                      {formatDuration(source_specific.video.duration_seconds)}
                    </div>
                  )}
                  {source_type === "video" && source_specific.video && (
                    <Badge variant="outline" className="capitalize">
                      {source_specific.video.transcript_quality} quality transcript
                    </Badge>
                  )}
                  {source_type === "article" && source_specific.article && (
                    <div className="flex items-center gap-1.5">
                      <FileText className="w-4 h-4" />
                      {source_specific.article.word_count} words · {source_specific.article.read_time_minutes} min read
                    </div>
                  )}
                </div>

                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" size="sm" onClick={handleCopy}>
                    <Copy className="w-4 h-4 mr-2" />
                    Copy
                  </Button>
                  <Button variant="outline" size="sm" onClick={handleExportJson}>
                    <Download className="w-4 h-4 mr-2" />
                    Export JSON
                  </Button>
                  <Button variant="outline" size="sm" onClick={handleSaveToBoard}>
                    <Bookmark className="w-4 h-4 mr-2" />
                    Save
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Tabs */}
        <Tabs defaultValue="hook" className="space-y-6">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="hook">
              <Sparkles className="w-4 h-4 mr-2" />
              Hook
            </TabsTrigger>
            <TabsTrigger value="intro">
              <Megaphone className="w-4 h-4 mr-2" />
              Intro
            </TabsTrigger>
            <TabsTrigger value="beats">
              <ListOrdered className="w-4 h-4 mr-2" />
              Beats ({structural_breakdown.beats.length})
            </TabsTrigger>
            <TabsTrigger value="outro">
              <Flag className="w-4 h-4 mr-2" />
              Outro
            </TabsTrigger>
            <TabsTrigger value="overall">
              <BarChart3 className="w-4 h-4 mr-2" />
              Overall
            </TabsTrigger>
          </TabsList>

          <TabsContent value="hook">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-blue-500" />
                  Hook
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="capitalize">
                    {structural_breakdown.hook.type.replace("_", " ")}
                  </Badge>
                  <span className="text-sm font-medium">{structural_breakdown.hook.technique}</span>
                </div>
                {structural_breakdown.hook.exact_text && (
                  <blockquote className="border-l-4 border-blue-500 pl-4 italic text-gray-700">
                    &ldquo;{structural_breakdown.hook.exact_text}&rdquo;
                  </blockquote>
                )}
                <p className="text-sm text-gray-600">{structural_breakdown.hook.why_it_works}</p>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="intro">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Megaphone className="w-5 h-5 text-blue-500" />
                  Intro
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-gray-600">
                  <span className="font-medium">Approach:</span> {structural_breakdown.intro.approach}
                </p>
                <p className="text-sm text-gray-600">
                  <span className="font-medium">Viewer Promise:</span> {structural_breakdown.intro.viewer_promise}
                </p>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="beats">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ListOrdered className="w-5 h-5 text-blue-500" />
                  Beats ({structural_breakdown.beats.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {visibleBeats.map((beat) => (
                  <div key={beat.beat_number} className="border rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Badge variant="outline">#{beat.beat_number}</Badge>
                      <span className="font-medium">{beat.label}</span>
                    </div>
                    <p className="text-sm text-gray-600 mb-1">
                      <span className="font-medium">Purpose:</span> {beat.purpose}
                    </p>
                    <p className="text-sm text-gray-600 mb-1">
                      <span className="font-medium">Technique:</span> {beat.technique_used}
                    </p>
                    {beat.transition_to_next && (
                      <p className="text-sm text-gray-500 italic">→ {beat.transition_to_next}</p>
                    )}
                  </div>
                ))}
                {hasMoreBeats && (
                  <Button
                    variant="ghost"
                    className="w-full"
                    onClick={() => setExpandedBeats((prev) => !prev)}
                  >
                    {expandedBeats ? (
                      <>
                        <ChevronUp className="w-4 h-4 mr-2" />
                        Show fewer beats
                      </>
                    ) : (
                      <>
                        <ChevronDown className="w-4 h-4 mr-2" />
                        Show all {structural_breakdown.beats.length} beats
                      </>
                    )}
                  </Button>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="outro">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Flag className="w-5 h-5 text-blue-500" />
                  Outro
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-gray-600">
                  <span className="font-medium">Style:</span> {structural_breakdown.outro.style}
                </p>
                <p className="text-sm text-gray-600">
                  <span className="font-medium">CTA Type:</span> {structural_breakdown.outro.cta_type}
                </p>
                {structural_breakdown.outro.cta_exact_phrase && (
                  <blockquote className="border-l-4 border-green-500 pl-4 italic text-gray-700">
                    &ldquo;{structural_breakdown.outro.cta_exact_phrase}&rdquo;
                  </blockquote>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="overall">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="w-5 h-5 text-blue-500" />
                  Overall Assessment
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="flex flex-wrap gap-2">
                  <Badge variant="secondary" className="capitalize">
                    {structural_breakdown.overall.dominant_format}
                  </Badge>
                  <Badge variant="secondary" className="capitalize">
                    {structural_breakdown.overall.pacing} pacing
                  </Badge>
                  {structural_breakdown.overall.tone && (
                    <Badge variant="secondary">{structural_breakdown.overall.tone}</Badge>
                  )}
                </div>

                <div>
                  <Progress value={structural_breakdown.overall.replicability_score * 10}>
                    <div className="flex w-full justify-between">
                      <ProgressLabel>Replicability Score</ProgressLabel>
                      <span className="text-sm text-muted-foreground tabular-nums">
                        {structural_breakdown.overall.replicability_score}/10
                      </span>
                    </div>
                    <ProgressTrack>
                      <ProgressIndicator />
                    </ProgressTrack>
                  </Progress>
                </div>

                <p className="text-sm text-gray-600">{structural_breakdown.overall.replicability_note}</p>

                {structural_breakdown.overall.best_for_niches.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    <span className="text-sm font-medium">Best for niches:</span>
                    {structural_breakdown.overall.best_for_niches.map((niche) => (
                      <Badge key={niche} variant="outline" className="text-xs">
                        {niche}
                      </Badge>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

export default function AnalyzePage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-gray-50 flex items-center justify-center">Loading...</div>}>
      <AnalyzePageContent />
    </Suspense>
  );
}
