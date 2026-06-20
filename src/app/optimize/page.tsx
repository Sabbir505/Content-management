"use client";

import { useState, Suspense, useRef, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScoreCard } from "@/components/quality/ScoreCard";
import Image from "next/image";
import { toast } from "sonner";
import { parseDuration, formatDuration } from "@/lib/youtube";
import { YouTubeVideo } from "@/types/video";
import type { ScoredOutput } from "@/lib/quality/types";

interface SeoTitle {
  rank: number;
  text: string;
  char_count: number;
  primary_keyword_position: number;
  power_word_used: string;
  ctr_rationale: string;
}

interface SeoTag {
  tag: string;
  tier: "broad" | "medium" | "niche";
}

interface ThumbnailConcept {
  concept_number: number;
  text_overlay: string;
  visual_composition: string;
  colour_recommendation: string;
  emotional_trigger: string;
}

interface SeoChapter {
  timestamp: string;
  title: string;
}

interface SeoDescription {
  full_text: string;
  word_count: number;
  primary_keyword_in_first_25_words: boolean;
}

interface SeoPackage {
  titles: SeoTitle[];
  description: SeoDescription;
  tags: SeoTag[];
  thumbnail_concepts: ThumbnailConcept[];
  chapters: SeoChapter[];
  pinned_comment: string;
}

function extractVideoId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/watch\?.*v=([a-zA-Z0-9_-]{11})/,
  ];
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  return null;
}

function OptimizePageContent() {
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

  // AbortController ref for cancelling in-flight generation requests
  const abortControllerRef = useRef<AbortController | null>(null);
  const autoRunStartedRef = useRef(false);

  async function fetchVideoData(videoId: string): Promise<YouTubeVideo | null> {
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

      const data = result.data;
      return {
        id: data.id,
        title: data.title || "",
        channelTitle: data.channelTitle || "",
        channelId: data.channelId || "",
        viewCount: data.viewCount || 0,
        likeCount: data.likeCount || 0,
        commentCount: data.commentCount || 0,
        thumbnail: data.thumbnail || "",
        publishedAt: data.publishedAt || "",
        duration: formatDuration(parseDuration(data.duration)),
        description: data.description || "",
        tags: data.tags || [],
      };
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") return null;
      toast.error(error instanceof Error ? error.message : "Failed to fetch video");
      return null;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  async function handleFetchVideo() {
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
  }

  async function handleAnalyzeAndOptimize(videoToAnalyze?: YouTubeVideo) {
    const targetVideo = videoToAnalyze ?? video;
    if (!targetVideo) return;

    // Step 1: Extract transcript
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

    // Cancel any previous generation request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();

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
        signal: abortControllerRef.current.signal,
      });

      const result = await response.json();
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
  }

  // Auto-run the full pipeline when the page is opened with a videoId in the URL
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
  }, [initialVideoId]);

  function handleCopy(text: string) {
    navigator.clipboard.writeText(text);
    toast.success("Copied to clipboard!");
  }

  function handleCopyAll() {
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
  }

  // Analysis steps for the loading state
  const analysisSteps = [
    { label: "Extracting transcript", icon: "📝" },
    { label: "Identifying topic & keywords", icon: "🔍" },
    { label: "Analyzing competitor titles", icon: "📊" },
    { label: "Pulling search volume data", icon: "📈" },
    { label: "Building SEO package", icon: "✨" },
  ];

  const showVideoPreview = video && !isLoading && !isAnalyzing && !isGenerating && !isAutoRunning && !seoPackage;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">SEO Optimizer</h1>
          <p className="text-gray-600">Paste a YouTube video URL to generate optimized metadata</p>
        </div>

        <div className="grid gap-6">
          {/* URL Input */}
          <Card>
            <CardContent className="p-6">
              <div className="flex gap-3">
                <Input
                  placeholder="https://youtube.com/watch?v=..."
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleFetchVideo()}
                  className="flex-1"
                />
                <Button onClick={handleFetchVideo} disabled={isLoading || isAnalyzing || isGenerating || isAutoRunning}>
                  {isAnalyzing ? "Analyzing..." : isLoading ? "Fetching..." : "Analyze & Optimize"}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Analyzing State */}
          {isAnalyzing && (
            <Card>
              <CardHeader>
                <CardTitle>Analyzing Video...</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {analysisSteps.map((step, index) => (
                  <div key={index} className="flex items-center gap-3">
                    <span className="text-lg">{step.icon}</span>
                    <span className="text-sm">{step.label}</span>
                    {index === analysisSteps.length - 1 ? (
                      <span className="ml-auto text-xs text-gray-500 animate-pulse">In progress</span>
                    ) : (
                      <span className="ml-auto text-xs text-green-600">Done</span>
                    )}
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Video Preview */}
          {isLoading && !isAnalyzing && (
            <Card>
              <CardContent className="p-6 space-y-4">
                <Skeleton className="h-64 w-full" />
                <Skeleton className="h-8 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
              </CardContent>
            </Card>
          )}

          {showVideoPreview && (
            <Card>
              <CardContent className="p-6">
                <div className="flex gap-6">
                  <Image
                    src={video.thumbnail}
                    alt={video.title}
                    width={256}
                    height={144}
                    className="w-64 h-36 object-cover rounded-lg flex-shrink-0"
                    unoptimized
                  />
                  <div className="flex-1 space-y-3">
                    <h3 className="font-semibold text-lg">{video.title}</h3>
                    <p className="text-sm text-gray-600">{video.channelTitle}</p>
                    <div className="flex flex-wrap gap-2">
                      <Badge variant="secondary">{parseInt(video.viewCount.toString()).toLocaleString()} views</Badge>
                      <Badge variant="secondary">{video.duration}</Badge>
                    </div>
                    <p className="text-sm text-gray-600 line-clamp-3">{video.description}</p>
                    {video.tags && video.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {video.tags.slice(0, 8).map((tag) => (
                          <Badge key={tag} variant="outline" className="text-xs">
                            {tag}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                <div className="mt-6 pt-6 border-t">
                  <Button
                    onClick={() => handleAnalyzeAndOptimize()}
                    disabled={isGenerating || isAnalyzing}
                    className="w-full"
                  >
                    {isGenerating ? "Generating SEO Package..." : "Generate SEO Package"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* SEO Package Output */}
          {isGenerating && !isAnalyzing && (
            <Card>
              <CardContent className="p-6 space-y-4">
                <Skeleton className="h-8 w-1/4" />
                <Skeleton className="h-32 w-full" />
                <Skeleton className="h-32 w-full" />
              </CardContent>
            </Card>
          )}

          {seoPackage && !isGenerating && !isAnalyzing && (
            <>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle>SEO Package Ready</CardTitle>
                  <Button size="sm" variant="outline" onClick={handleCopyAll}>
                    Copy All
                  </Button>
                </CardHeader>
                <CardContent>
                  <Tabs value={activeTab} onValueChange={setActiveTab}>
                    <TabsList className="grid w-full grid-cols-6">
                      <TabsTrigger value="titles">Titles</TabsTrigger>
                      <TabsTrigger value="description">Description</TabsTrigger>
                      <TabsTrigger value="tags">Tags</TabsTrigger>
                      <TabsTrigger value="thumbnails">Thumbnails</TabsTrigger>
                      <TabsTrigger value="chapters">Chapters</TabsTrigger>
                      <TabsTrigger value="comment">Comment</TabsTrigger>
                    </TabsList>

                    {/* Titles Tab */}
                    <TabsContent value="titles" className="mt-4 space-y-3">
                      <p className="text-sm text-gray-500 mb-3">Ranked by estimated CTR potential</p>
                      {seoPackage.titles.map((title, index) => (
                        <div
                          key={index}
                          className={`flex items-center justify-between border rounded-lg p-4 cursor-pointer transition-colors ${
                            selectedTitleIndex === index ? "border-blue-500 bg-blue-50" : "hover:bg-gray-50"
                          }`}
                          onClick={() => setSelectedTitleIndex(index)}
                        >
                          <div className="flex items-start gap-3 flex-1">
                            <span className="text-sm font-medium text-gray-500 mt-0.5">#{title.rank}</span>
                            <div className="flex-1">
                              <p className="text-sm font-medium">{title.text}</p>
                              <div className="flex gap-2 mt-1 text-xs text-gray-500">
                                <span>{title.char_count} chars</span>
                                {title.power_word_used && (
                                  <Badge variant="outline" className="text-xs">{title.power_word_used}</Badge>
                                )}
                              </div>
                              {title.ctr_rationale && (
                                <p className="text-xs text-gray-600 mt-1">{title.ctr_rationale}</p>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            {selectedTitleIndex === index && (
                              <Badge className="bg-green-100 text-green-700">Selected</Badge>
                            )}
                            <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); handleCopy(title.text); }}>
                              Copy
                            </Button>
                          </div>
                        </div>
                      ))}
                    </TabsContent>

                    {/* Description Tab */}
                    <TabsContent value="description" className="mt-4">
                      <div className="border rounded-lg p-4">
                        <div className="flex justify-between mb-3">
                          <Badge variant="secondary">Optimized Description</Badge>
                          <div className="flex gap-2">
                            <Button size="sm" variant="outline" onClick={() => handleCopy(seoPackage.description.full_text)}>
                              Copy
                            </Button>
                          </div>
                        </div>
                        <div className="text-sm whitespace-pre-wrap bg-gray-50 p-4 rounded-lg">
                          {seoPackage.description.full_text}
                        </div>
                        <div className="flex gap-4 mt-3 text-xs text-gray-500">
                          <span>{seoPackage.description.word_count} words</span>
                          <span>
                            {seoPackage.description.primary_keyword_in_first_25_words
                              ? "Keyword in first 25 words"
                              : "Keyword placement needs attention"}
                          </span>
                        </div>
                      </div>
                    </TabsContent>

                    {/* Tags Tab */}
                    <TabsContent value="tags" className="mt-4">
                      <div className="border rounded-lg p-4">
                        <div className="flex justify-between mb-3">
                          <Badge variant="secondary">Recommended Tags ({seoPackage.tags.length})</Badge>
                          <Button size="sm" variant="outline" onClick={() => handleCopy(seoPackage.tags.map((t) => t.tag).join(", "))}>
                            Copy All
                          </Button>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {seoPackage.tags.map((tag, index) => (
                            <Badge
                              key={index}
                              variant="outline"
                              className={`text-xs ${
                                tag.tier === "broad"
                                  ? "bg-blue-50 text-blue-700"
                                  : tag.tier === "medium"
                                    ? "bg-green-50 text-green-700"
                                    : "bg-purple-50 text-purple-700"
                              }`}
                            >
                              {tag.tag}
                              <span className="ml-1 text-xs opacity-60">({tag.tier})</span>
                            </Badge>
                          ))}
                        </div>
                        <div className="flex gap-4 mt-3 text-xs text-gray-500">
                          <span>{seoPackage.tags.filter((t) => t.tier === "broad").length} broad</span>
                          <span>{seoPackage.tags.filter((t) => t.tier === "medium").length} medium</span>
                          <span>{seoPackage.tags.filter((t) => t.tier === "niche").length} niche</span>
                        </div>
                      </div>
                    </TabsContent>

                    {/* Thumbnails Tab */}
                    <TabsContent value="thumbnails" className="mt-4 space-y-3">
                      {seoPackage.thumbnail_concepts.map((concept, index) => (
                        <div key={index} className="border rounded-lg p-4">
                          <div className="flex items-center gap-3 mb-3">
                            <span className="text-sm font-medium text-gray-500">#{concept.concept_number}</span>
                            <Badge variant="secondary">Concept {concept.concept_number}</Badge>
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                            <div>
                              <p className="font-medium text-gray-700">Text Overlay</p>
                              <p className="text-gray-600">{concept.text_overlay}</p>
                            </div>
                            <div>
                              <p className="font-medium text-gray-700">Visual Composition</p>
                              <p className="text-gray-600">{concept.visual_composition}</p>
                            </div>
                            <div>
                              <p className="font-medium text-gray-700">Colour Recommendation</p>
                              <p className="text-gray-600">{concept.colour_recommendation}</p>
                            </div>
                            <div>
                              <p className="font-medium text-gray-700">Emotional Trigger</p>
                              <p className="text-gray-600">{concept.emotional_trigger}</p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </TabsContent>

                    {/* Chapters Tab */}
                    <TabsContent value="chapters" className="mt-4">
                      <div className="border rounded-lg p-4">
                        <div className="flex justify-between mb-3">
                          <Badge variant="secondary">Video Chapters</Badge>
                          <Button size="sm" variant="outline" onClick={() => handleCopy(seoPackage.chapters.map((c) => `${c.timestamp} ${c.title}`).join("\n"))}>
                            Copy All
                          </Button>
                        </div>
                        <div className="space-y-2">
                          {seoPackage.chapters.map((chapter, index) => (
                            <div key={index} className="flex items-center gap-4 p-2 rounded hover:bg-gray-50">
                              <span className="text-sm font-mono text-gray-500 w-16">{chapter.timestamp}</span>
                              <span className="text-sm">{chapter.title}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </TabsContent>

                    {/* Comment Tab */}
                    <TabsContent value="comment" className="mt-4">
                      <div className="border rounded-lg p-4">
                        <div className="flex justify-between mb-3">
                          <Badge variant="secondary">Pinned Comment Suggestion</Badge>
                          <Button size="sm" variant="outline" onClick={() => handleCopy(seoPackage.pinned_comment)}>
                            Copy
                          </Button>
                        </div>
                        <p className="text-sm whitespace-pre-wrap bg-gray-50 p-4 rounded-lg">
                          {seoPackage.pinned_comment}
                        </p>
                      </div>
                    </TabsContent>
                  </Tabs>
                </CardContent>
              </Card>

              {scoredOutput && (
                <ScoreCard
                  scoredOutput={scoredOutput}
                  onRegenerate={handleAnalyzeAndOptimize}
                />
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default function OptimizePage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-gray-50 flex items-center justify-center">Loading...</div>}>
      <OptimizePageContent />
    </Suspense>
  );
}
