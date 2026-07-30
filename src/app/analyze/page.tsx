"use client";

import { Suspense } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress, ProgressLabel, ProgressTrack, ProgressIndicator } from "@/components/ui/progress";
import { useAnalyzePage } from "@/hooks/useAnalyzePage";
import { formatDate } from "@/lib/analyze-helpers";
import { formatDuration } from "@/lib/youtube";
import { formatCompactNumber } from "@/lib/format";
import { cn } from "@/lib/utils";
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

function AnalyzePageContent() {
  const router = useRouter();
  const {
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
  } = useAnalyzePage();

  // Loading state
  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#0a0a0a]">
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
      <div className="min-h-screen bg-[#0a0a0a]">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-white mb-2">Analyze Structure</h1>
            <p className="text-[#888]">Something went wrong</p>
          </div>

          <Card className="border-red-400/30 bg-red-900/20">
            <CardContent className="p-6">
              <p className="text-red-400">{error.message}</p>
              <div className="flex gap-3 mt-4">
                {error.canRetry && (
                  <Button
                    variant="outline"
                    onClick={handleRetry}
                    className="cursor-pointer transition-colors hover:border-[#3a3a3a] hover:text-white"
                  >
                    <RotateCcw className="w-4 h-4 mr-2" />
                    Try Again
                  </Button>
                )}
                <Button
                  variant="ghost"
                  onClick={() => window.history.back()}
                  className="cursor-pointer transition-colors hover:bg-[#2a2a2a] hover:text-white"
                >
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
      <div className="min-h-screen bg-[#0a0a0a]">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-white mb-2">Analyze Structure</h1>
            <p className="text-[#888]">Select content from the Discover page to analyze its structure</p>
          </div>

          <Card>
            <CardContent className="p-6 flex flex-col items-center text-center py-12">
              <BarChart3 className="w-10 h-10 text-[#666] mb-4" />
              <p className="text-[#888] mb-1">No content selected for analysis.</p>
              <p className="text-sm text-[#666] mb-4">
                Find a video or article on Discover, then open it here to break down its structure.
              </p>
              <Button
                variant="outline"
                className="cursor-pointer transition-colors hover:border-[#3a3a3a] hover:text-white"
                onClick={() => router.push("/discover")}
              >
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
  const replicability = structural_breakdown.overall.replicability_score;
  const scoreColor =
    replicability >= 8 ? "text-emerald-400" : replicability >= 5 ? "text-[#888]" : "text-red-400";
  const indicatorColor =
    replicability >= 8 ? "bg-emerald-400" : replicability >= 5 ? "bg-[#888]" : "bg-red-400";

  return (
    <div className="min-h-screen bg-[#0a0a0a]">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">Structure Analysis</h1>
          <p className="text-[#888]">Structural DNA breakdown of the selected content</p>
        </div>

        {/* Source metadata card */}
        <Card className="mb-6">
          <CardContent className="p-6">
            <div className="flex flex-col md:flex-row gap-6">
              {videoMeta?.thumbnail_url && (
                <div className="relative w-full md:w-64 aspect-video rounded-lg overflow-hidden flex-shrink-0 bg-[#1a1a1a]">
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
                  <div className="min-w-0">
                    <Badge variant="secondary" className="mb-2">
                      {source_type === "video" ? "YouTube Video" : "Article"}
                    </Badge>
                    <h2 className="text-xl font-semibold text-white truncate">
                      {videoMeta?.title || articleMeta?.title || "Untitled"}
                    </h2>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleRetry}
                      disabled={isLoading}
                      className="cursor-pointer transition-colors hover:border-[#3a3a3a] hover:text-white disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <RotateCcw className={cn("w-4 h-4 mr-2", isLoading && "animate-spin")} />
                      Re-analyze
                    </Button>
                  </div>
                </div>

                <div className="flex flex-wrap gap-4 text-sm text-[#888] mb-4">
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
                      {formatCompactNumber(videoMeta.view_count)} views
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
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleCopy}
                    className="cursor-pointer transition-colors hover:border-[#3a3a3a] hover:text-white"
                  >
                    <Copy className="w-4 h-4 mr-2" />
                    Copy
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleExportJson}
                    className="cursor-pointer transition-colors hover:border-[#3a3a3a] hover:text-white"
                  >
                    <Download className="w-4 h-4 mr-2" />
                    Export JSON
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleSaveToBoard}
                    className="cursor-pointer transition-colors hover:border-[#3a3a3a] hover:text-white"
                  >
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
              <Sparkles className="w-4 h-4 md:mr-2" />
              <span className="hidden md:inline">Hook</span>
            </TabsTrigger>
            <TabsTrigger value="intro">
              <Megaphone className="w-4 h-4 md:mr-2" />
              <span className="hidden md:inline">Intro</span>
            </TabsTrigger>
            <TabsTrigger value="beats">
              <ListOrdered className="w-4 h-4 md:mr-2" />
              <span className="hidden md:inline">Beats ({structural_breakdown.beats.length})</span>
              <span className="md:hidden">{structural_breakdown.beats.length}</span>
            </TabsTrigger>
            <TabsTrigger value="outro">
              <Flag className="w-4 h-4 md:mr-2" />
              <span className="hidden md:inline">Outro</span>
            </TabsTrigger>
            <TabsTrigger value="overall">
              <BarChart3 className="w-4 h-4 md:mr-2" />
              <span className="hidden md:inline">Overall</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="hook">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-emerald-400" />
                  Hook
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="capitalize">
                    {structural_breakdown.hook.type.replace("_", " ")}
                  </Badge>
                  <span className="text-sm font-medium text-[#ccc]">{structural_breakdown.hook.technique}</span>
                </div>
                {structural_breakdown.hook.exact_text && (
                  <blockquote className="border-l-4 border-emerald-400 pl-4 italic text-[#ccc]">
                    &ldquo;{structural_breakdown.hook.exact_text}&rdquo;
                  </blockquote>
                )}
                <p className="text-sm text-[#888]">{structural_breakdown.hook.why_it_works}</p>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="intro">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Megaphone className="w-5 h-5 text-emerald-400" />
                  Intro
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-[#888]">
                  <span className="font-medium text-[#ccc]">Approach:</span> {structural_breakdown.intro.approach}
                </p>
                <p className="text-sm text-[#888]">
                  <span className="font-medium text-[#ccc]">Viewer Promise:</span> {structural_breakdown.intro.viewer_promise}
                </p>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="beats">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ListOrdered className="w-5 h-5 text-emerald-400" />
                  Beats ({structural_breakdown.beats.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {visibleBeats.map((beat) => (
                  <div key={beat.beat_number} className="border border-[#2a2a2a] rounded-lg p-4 transition-colors hover:border-[#3a3a3a]">
                    <div className="flex items-center gap-2 mb-2">
                      <Badge variant="outline">#{beat.beat_number}</Badge>
                      <span className="font-medium text-[#ccc]">{beat.label}</span>
                    </div>
                    <p className="text-sm text-[#888] mb-1">
                      <span className="font-medium text-[#ccc]">Purpose:</span> {beat.purpose}
                    </p>
                    <p className="text-sm text-[#888] mb-1">
                      <span className="font-medium text-[#ccc]">Technique:</span> {beat.technique_used}
                    </p>
                    {beat.transition_to_next && (
                      <p className="text-sm text-[#666] italic">→ {beat.transition_to_next}</p>
                    )}
                  </div>
                ))}
                {hasMoreBeats && (
                  <Button
                    variant="ghost"
                    className="w-full cursor-pointer transition-colors hover:bg-[#2a2a2a] hover:text-white"
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
                  <Flag className="w-5 h-5 text-emerald-400" />
                  Outro
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-[#888]">
                  <span className="font-medium text-[#ccc]">Style:</span> {structural_breakdown.outro.style}
                </p>
                <p className="text-sm text-[#888]">
                  <span className="font-medium text-[#ccc]">CTA Type:</span> {structural_breakdown.outro.cta_type}
                </p>
                {structural_breakdown.outro.cta_exact_phrase && (
                  <blockquote className="border-l-4 border-emerald-400 pl-4 italic text-[#ccc]">
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
                  <BarChart3 className="w-5 h-5 text-emerald-400" />
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
                  <Progress value={replicability * 10}>
                    <div className="flex w-full justify-between">
                      <ProgressLabel>Replicability Score</ProgressLabel>
                      <span className={cn("text-sm tabular-nums font-medium", scoreColor)}>
                        {replicability}/10
                      </span>
                    </div>
                    <ProgressTrack>
                      <ProgressIndicator className={indicatorColor} />
                    </ProgressTrack>
                  </Progress>
                </div>

                <p className="text-sm text-[#888]">{structural_breakdown.overall.replicability_note}</p>

                {structural_breakdown.overall.best_for_niches.length > 0 && (
                  <div className="flex flex-wrap gap-2 items-center">
                    <span className="text-sm font-medium text-[#ccc]">Best for niches:</span>
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
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
          <div className="text-[#888]">Loading...</div>
        </div>
      }
    >
      <AnalyzePageContent />
    </Suspense>
  );
}
