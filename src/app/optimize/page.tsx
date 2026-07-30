"use client";

import { Suspense } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScoreCard } from "@/components/quality/ScoreCard";
import Image from "next/image";
import { cn } from "@/lib/utils";
import { useOptimizePage } from "@/hooks/useOptimizePage";

function OptimizePageContent() {
  const {
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
  } = useOptimizePage();

  // Analysis steps for the loading state
  const analysisSteps = [
    { label: "Extracting transcript", icon: "📝" },
    { label: "Identifying topic & keywords", icon: "🔍" },
    { label: "Analyzing competitor titles", icon: "📊" },
    { label: "Pulling search volume data", icon: "📈" },
    { label: "Building SEO package", icon: "✨" },
  ];

  return (
    <div className="min-h-screen bg-[#0a0a0a]">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2 text-white">SEO Optimizer</h1>
          <p className="text-[#888]">Paste a YouTube video URL to generate optimized metadata</p>
        </div>

        <div className="grid gap-6">
          {/* URL Input */}
          <Card className="bg-[#1a1a1a] border-[#2a2a2a]">
            <CardContent className="p-6">
              <div className="flex flex-col sm:flex-row gap-3">
                <Input
                  placeholder="https://youtube.com/watch?v=..."
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleFetchVideo()}
                  className="flex-1 bg-[#0a0a0a] border-[#2a2a2a] text-white placeholder:text-[#666] focus-visible:ring-1 focus-visible:ring-[#3a3a3a] focus-visible:border-[#3a3a3a] disabled:opacity-50 disabled:cursor-not-allowed"
                />
                <Button
                  onClick={handleFetchVideo}
                  disabled={isLoading || isAnalyzing || isGenerating || isAutoRunning}
                  className="disabled:cursor-not-allowed"
                >
                  {(isAnalyzing || isLoading) && (
                    <span className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                  )}
                  {isAnalyzing ? "Analyzing..." : isLoading ? "Fetching..." : "Analyze & Optimize"}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Empty State */}
          {!video && !isLoading && !isAnalyzing && !isGenerating && !isAutoRunning && !seoPackage && (
            <Card className="bg-[#1a1a1a] border-[#2a2a2a]">
              <CardContent className="p-12 flex flex-col items-center text-center">
                <div className="w-12 h-12 rounded-full bg-[#2a2a2a] flex items-center justify-center mb-4">
                  <span className="text-xl">🎬</span>
                </div>
                <h3 className="text-lg font-semibold text-white mb-1">No video analyzed yet</h3>
                <p className="text-sm text-[#888] max-w-md">
                  Paste a YouTube URL above and hit Analyze to generate titles, description, tags, thumbnails, chapters, and a pinned comment.
                </p>
              </CardContent>
            </Card>
          )}

          {/* Analyzing State */}
          {isAnalyzing && (
            <Card className="bg-[#1a1a1a] border-[#2a2a2a]">
              <CardHeader>
                <CardTitle className="text-white">Analyzing Video...</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {analysisSteps.map((step, index) => (
                  <div key={index} className="flex items-center gap-3">
                    <span className="text-lg">{step.icon}</span>
                    <span className="text-sm text-[#ccc]">{step.label}</span>
                    {index === analysisSteps.length - 1 ? (
                      <span className="ml-auto text-xs text-[#888] animate-pulse">In progress</span>
                    ) : (
                      <span className="ml-auto text-xs text-emerald-400">Done</span>
                    )}
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Video Preview */}
          {isLoading && !isAnalyzing && (
            <Card className="bg-[#1a1a1a] border-[#2a2a2a]">
              <CardContent className="p-6 space-y-4">
                <Skeleton className="h-64 w-full bg-[#2a2a2a]" />
                <Skeleton className="h-8 w-3/4 bg-[#2a2a2a]" />
                <Skeleton className="h-4 w-1/2 bg-[#2a2a2a]" />
              </CardContent>
            </Card>
          )}

          {video && showVideoPreview && (
            <Card className="bg-[#1a1a1a] border-[#2a2a2a]">
              <CardContent className="p-6">
                <div className="flex flex-col sm:flex-row gap-6">
                  <Image
                    src={video.thumbnail}
                    alt={video.title}
                    width={256}
                    height={144}
                    className="w-full sm:w-64 h-36 object-cover rounded-lg flex-shrink-0"
                    unoptimized
                  />
                  <div className="flex-1 space-y-3">
                    <h3 className="font-semibold text-lg text-white">{video.title}</h3>
                    <p className="text-sm text-[#888]">{video.channelTitle}</p>
                    <div className="flex flex-wrap gap-2">
                      <Badge variant="secondary">{parseInt(video.viewCount.toString()).toLocaleString()} views</Badge>
                      <Badge variant="secondary">{video.duration}</Badge>
                    </div>
                    <p className="text-sm text-[#888] line-clamp-3">{video.description}</p>
                    {video.tags && video.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {video.tags.slice(0, 8).map((tag) => (
                          <Badge key={tag} variant="outline" className="text-xs text-[#ccc] border-[#3a3a3a]">
                            {tag}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                <div className="mt-6 pt-6 border-t border-[#2a2a2a]">
                  <Button
                    onClick={() => handleAnalyzeAndOptimize()}
                    disabled={isGenerating || isAnalyzing}
                    className="w-full disabled:cursor-not-allowed"
                  >
                    {isGenerating && (
                      <span className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                    )}
                    {isGenerating ? "Generating SEO Package..." : "Generate SEO Package"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* SEO Package Output */}
          {isGenerating && !isAnalyzing && (
            <Card className="bg-[#1a1a1a] border-[#2a2a2a]">
              <CardContent className="p-6 space-y-4">
                <Skeleton className="h-8 w-1/4 bg-[#2a2a2a]" />
                <Skeleton className="h-32 w-full bg-[#2a2a2a]" />
                <Skeleton className="h-32 w-full bg-[#2a2a2a]" />
              </CardContent>
            </Card>
          )}

          {seoPackage && !isGenerating && !isAnalyzing && (
            <>
              <Card className="bg-[#1a1a1a] border-[#2a2a2a]">
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle className="text-white">SEO Package Ready</CardTitle>
                  <Button size="sm" variant="outline" onClick={handleCopyAll} className="border-[#3a3a3a] hover:bg-[#2a2a2a] hover:text-white">
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
                      <p className="text-sm text-[#888] mb-3">Ranked by estimated CTR potential</p>
                      {seoPackage.titles.map((title, index) => (
                        <div
                          key={index}
                          className={cn(
                            "flex items-center justify-between border rounded-lg p-4 cursor-pointer transition-colors",
                            selectedTitleIndex === index
                              ? "border-[#3a3a3a] bg-[#2a2a2a]"
                              : "border-[#2a2a2a] hover:bg-[#2a2a2a]/60"
                          )}
                          onClick={() => setSelectedTitleIndex(index)}
                        >
                          <div className="flex items-start gap-3 flex-1">
                            <span className="text-sm font-medium text-[#888] mt-0.5">#{title.rank}</span>
                            <div className="flex-1">
                              <p className="text-sm font-medium text-white">{title.text}</p>
                              <div className="flex gap-2 mt-1 text-xs text-[#888]">
                                <span>{title.char_count} chars</span>
                                {title.power_word_used && (
                                  <Badge variant="outline" className="text-xs text-[#ccc] border-[#3a3a3a]">{title.power_word_used}</Badge>
                                )}
                              </div>
                              {title.ctr_rationale && (
                                <p className="text-xs text-[#888] mt-1">{title.ctr_rationale}</p>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            {selectedTitleIndex === index && (
                              <Badge className="bg-emerald-400/15 text-emerald-400 border border-emerald-400/30">Selected</Badge>
                            )}
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={(e) => { e.stopPropagation(); handleCopy(title.text); }}
                              className="border-[#3a3a3a] hover:bg-[#2a2a2a] hover:text-white"
                            >
                              Copy
                            </Button>
                          </div>
                        </div>
                      ))}
                    </TabsContent>

                    {/* Description Tab */}
                    <TabsContent value="description" className="mt-4">
                      <div className="border border-[#2a2a2a] rounded-lg p-4">
                        <div className="flex justify-between mb-3">
                          <Badge variant="secondary">Optimized Description</Badge>
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleCopy(seoPackage.description.full_text)}
                              className="border-[#3a3a3a] hover:bg-[#2a2a2a] hover:text-white"
                            >
                              Copy
                            </Button>
                          </div>
                        </div>
                        <div className="text-sm whitespace-pre-wrap bg-[#0a0a0a] text-[#ccc] p-4 rounded-lg border border-[#2a2a2a]">
                          {seoPackage.description.full_text}
                        </div>
                        <div className="flex gap-4 mt-3 text-xs text-[#888]">
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
                      <div className="border border-[#2a2a2a] rounded-lg p-4">
                        <div className="flex justify-between mb-3">
                          <Badge variant="secondary">Recommended Tags ({seoPackage.tags.length})</Badge>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleCopy(seoPackage.tags.map((t) => t.tag).join(", "))}
                            className="border-[#3a3a3a] hover:bg-[#2a2a2a] hover:text-white"
                          >
                            Copy All
                          </Button>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {seoPackage.tags.map((tag, index) => (
                            <Badge
                              key={index}
                              variant="outline"
                              className={cn(
                                "text-xs border",
                                tag.tier === "broad"
                                  ? "border-[#3a3a3a] bg-[#2a2a2a] text-[#ccc]"
                                  : tag.tier === "medium"
                                    ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-400"
                                    : "border-[#3a3a3a] bg-[#0a0a0a] text-[#888]"
                              )}
                            >
                              {tag.tag}
                              <span className="ml-1 text-xs opacity-60">({tag.tier})</span>
                            </Badge>
                          ))}
                        </div>
                        <div className="flex gap-4 mt-3 text-xs text-[#888]">
                          <span>{seoPackage.tags.filter((t) => t.tier === "broad").length} broad</span>
                          <span>{seoPackage.tags.filter((t) => t.tier === "medium").length} medium</span>
                          <span>{seoPackage.tags.filter((t) => t.tier === "niche").length} niche</span>
                        </div>
                      </div>
                    </TabsContent>

                    {/* Thumbnails Tab */}
                    <TabsContent value="thumbnails" className="mt-4 space-y-3">
                      {seoPackage.thumbnail_concepts.map((concept, index) => (
                        <div key={index} className="border border-[#2a2a2a] rounded-lg p-4">
                          <div className="flex items-center gap-3 mb-3">
                            <span className="text-sm font-medium text-[#888]">#{concept.concept_number}</span>
                            <Badge variant="secondary">Concept {concept.concept_number}</Badge>
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                            <div>
                              <p className="font-medium text-[#ccc]">Text Overlay</p>
                              <p className="text-[#888]">{concept.text_overlay}</p>
                            </div>
                            <div>
                              <p className="font-medium text-[#ccc]">Visual Composition</p>
                              <p className="text-[#888]">{concept.visual_composition}</p>
                            </div>
                            <div>
                              <p className="font-medium text-[#ccc]">Colour Recommendation</p>
                              <p className="text-[#888]">{concept.colour_recommendation}</p>
                            </div>
                            <div>
                              <p className="font-medium text-[#ccc]">Emotional Trigger</p>
                              <p className="text-[#888]">{concept.emotional_trigger}</p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </TabsContent>

                    {/* Chapters Tab */}
                    <TabsContent value="chapters" className="mt-4">
                      <div className="border border-[#2a2a2a] rounded-lg p-4">
                        <div className="flex justify-between mb-3">
                          <Badge variant="secondary">Video Chapters</Badge>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleCopy(seoPackage.chapters.map((c) => `${c.timestamp} ${c.title}`).join("\n"))}
                            className="border-[#3a3a3a] hover:bg-[#2a2a2a] hover:text-white"
                          >
                            Copy All
                          </Button>
                        </div>
                        <div className="space-y-2">
                          {seoPackage.chapters.map((chapter, index) => (
                            <div key={index} className="flex items-center gap-4 p-2 rounded hover:bg-[#2a2a2a]/60 transition-colors">
                              <span className="text-sm font-mono text-[#888] w-16">{chapter.timestamp}</span>
                              <span className="text-sm text-[#ccc]">{chapter.title}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </TabsContent>

                    {/* Comment Tab */}
                    <TabsContent value="comment" className="mt-4">
                      <div className="border border-[#2a2a2a] rounded-lg p-4">
                        <div className="flex justify-between mb-3">
                          <Badge variant="secondary">Pinned Comment Suggestion</Badge>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleCopy(seoPackage.pinned_comment)}
                            className="border-[#3a3a3a] hover:bg-[#2a2a2a] hover:text-white"
                          >
                            Copy
                          </Button>
                        </div>
                        <p className="text-sm whitespace-pre-wrap bg-[#0a0a0a] text-[#ccc] p-4 rounded-lg border border-[#2a2a2a]">
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
    <Suspense fallback={<div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center"><div className="w-8 h-8 rounded-full border-2 border-[#2a2a2a] border-t-white animate-spin" /></div>}>
      <OptimizePageContent />
    </Suspense>
  );
}
