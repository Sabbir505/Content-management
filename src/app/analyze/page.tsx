"use client";

import { useState, Suspense, useEffect, useCallback } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import type { AnalyzeResult } from "@/lib/analyze-structure/types";

function AnalyzePageContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const videoId = searchParams.get("videoId");
  const contentId = searchParams.get("contentId");

  const [result, setResult] = useState<AnalyzeResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const analyzeVideo = useCallback(async (id: string) => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/analyze", {
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
      setError(message);
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const analyzeArticle = useCallback(async (url: string) => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/analyze", {
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
      setError(message);
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
              <p className="text-red-700">{error}</p>
              <Button
                variant="outline"
                className="mt-4"
                onClick={() => window.history.back()}
              >
                Go Back
              </Button>
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
              <Button
                variant="outline"
                className="mt-4"
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
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Structure Analysis</h1>
          <p className="text-gray-600">Structural DNA breakdown of the selected content</p>
        </div>

        {result && (
          <div className="grid gap-6">
            {/* Hook Section */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <span className="text-2xl">🎯</span>
                  Hook
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center gap-2">
                  <Badge variant="secondary">{result.structural_breakdown.hook.type}</Badge>
                  <span className="text-sm font-medium">{result.structural_breakdown.hook.technique}</span>
                </div>
                {result.structural_breakdown.hook.exact_text && (
                  <blockquote className="border-l-4 border-blue-500 pl-4 italic text-gray-700">
                    &ldquo;{result.structural_breakdown.hook.exact_text}&rdquo;
                  </blockquote>
                )}
                <p className="text-sm text-gray-600">{result.structural_breakdown.hook.why_it_works}</p>
              </CardContent>
            </Card>

            {/* Intro Section */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <span className="text-2xl">🚪</span>
                  Intro
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm text-gray-600">
                  <span className="font-medium">Approach:</span> {result.structural_breakdown.intro.approach}
                </p>
                <p className="text-sm text-gray-600">
                  <span className="font-medium">Viewer Promise:</span> {result.structural_breakdown.intro.viewer_promise}
                </p>
              </CardContent>
            </Card>

            {/* Beats Section */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <span className="text-2xl">📊</span>
                  Beats ({result.structural_breakdown.beats.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {result.structural_breakdown.beats.map((beat) => (
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
                      <p className="text-sm text-gray-500 italic">
                        → {beat.transition_to_next}
                      </p>
                    )}
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Outro Section */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <span className="text-2xl">🏁</span>
                  Outro
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm text-gray-600">
                  <span className="font-medium">Style:</span> {result.structural_breakdown.outro.style}
                </p>
                <p className="text-sm text-gray-600">
                  <span className="font-medium">CTA Type:</span> {result.structural_breakdown.outro.cta_type}
                </p>
                {result.structural_breakdown.outro.cta_exact_phrase && (
                  <blockquote className="border-l-4 border-green-500 pl-4 italic text-gray-700">
                    &ldquo;{result.structural_breakdown.outro.cta_exact_phrase}&rdquo;
                  </blockquote>
                )}
              </CardContent>
            </Card>

            {/* Overall Section */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <span className="text-2xl">🎨</span>
                  Overall Assessment
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex flex-wrap gap-2">
                  <Badge variant="secondary">{result.structural_breakdown.overall.dominant_format}</Badge>
                  <Badge variant="secondary">{result.structural_breakdown.overall.pacing} pacing</Badge>
                  <Badge variant="secondary">{result.structural_breakdown.overall.tone}</Badge>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">Replicability Score:</span>
                  <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-blue-500 rounded-full"
                      style={{ width: `${result.structural_breakdown.overall.replicability_score * 10}%` }}
                    />
                  </div>
                  <span className="text-sm font-medium">{result.structural_breakdown.overall.replicability_score}/10</span>
                </div>
                <p className="text-sm text-gray-600">{result.structural_breakdown.overall.replicability_note}</p>
                {result.structural_breakdown.overall.best_for_niches.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    <span className="text-sm font-medium">Best for niches:</span>
                    {result.structural_breakdown.overall.best_for_niches.map((niche) => (
                      <Badge key={niche} variant="outline" className="text-xs">
                        {niche}
                      </Badge>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}
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
