"use client";

import { useState, Suspense, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import Image from "next/image";
import { Skeleton } from "@/components/ui/skeleton";
import { ScoreCard } from "@/components/quality/ScoreCard";
import { toast } from "sonner";
import { useVoiceProfile } from "@/hooks/useVoiceProfile";
import { useAuth } from "@/hooks/useAuth";
import { doc, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { ScoredOutput } from "@/lib/quality/types";
import type { VideoWithOutlier } from "@/types/video";

type Tab = "script" | "social";
type Step = "idea" | "similar" | "structure" | "script" | "social";

interface ScriptSection {
  type: string;
  content: string;
}

interface SimilarVideo {
  id: string;
  title: string;
  channelTitle: string;
  viewCount: number;
  outlierScore: number;
  duration: string;
  hookType: string;
  structure: string;
  thumbnail: string;
}

interface StructureBreakdown {
  hook: string;
  intro: string;
  beats: string[];
  outro: string;
  transcriptAvailable: boolean;
  transcriptWordCount: number;
}

function CreatePageContent() {
  const router = useRouter();
  const { user } = useAuth();
  const { formatVoiceForPrompt, voiceProfile } = useVoiceProfile();

  // Navigation
  const [activeTab, setActiveTab] = useState<Tab>("script");

  // AbortController refs for cancelling in-flight requests
  const abortControllerRef = useRef<AbortController | null>(null);

  // Flow B state
  const [step, setStep] = useState<Step>("idea");
  const [idea, setIdea] = useState("");
  const [similarVideos, setSimilarVideos] = useState<SimilarVideo[]>([]);
  const [selectedVideo, setSelectedVideo] = useState<SimilarVideo | null>(null);
  const [structure, setStructure] = useState<StructureBreakdown | null>(null);

  // Script generation state
  const [script, setScript] = useState("");
  const [sections, setSections] = useState<ScriptSection[]>([]);
  const [scoredOutput, setScoredOutput] = useState<ScoredOutput<string> | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isRegenerating, setIsRegenerating] = useState<string | null>(null);

  // Social posts state
  const [socialIdea, setSocialIdea] = useState("");
  const [socialDescription, setSocialDescription] = useState("");
  const [socialPosts, setSocialPosts] = useState<Record<string, string>>({});
  const [isGeneratingSocial, setIsGeneratingSocial] = useState(false);
  const [hasGeneratedSocial, setHasGeneratedSocial] = useState(false);

  // ── Step 1: Find similar videos ──
  async function handleFindSimilarVideos() {
    if (!idea.trim()) {
      toast.error("Please describe your video idea");
      return;
    }

    // Cancel any previous request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();

    setIsLoading(true);
    try {
      // Search YouTube for similar videos
      const response = await fetch(`/api/youtube/search?query=${encodeURIComponent(idea)}&timeRange=year`, {
        signal: abortControllerRef.current.signal,
      });
      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || "Failed to find similar videos");
      }

      const videos: SimilarVideo[] = (result.data.videos || []).slice(0, 8).map((v: VideoWithOutlier) => ({
        id: v.id,
        title: v.title,
        channelTitle: v.channelTitle,
        viewCount: v.viewCount,
        outlierScore: v.outlierScore,
        duration: v.duration,
        hookType: v.hookType,
        structure: v.estimatedStructure,
        thumbnail: v.thumbnail,
      }));

      setSimilarVideos(videos);
      setStep("similar");
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") return;
      toast.error(error instanceof Error ? error.message : "Failed to find similar videos");
    } finally {
      setIsLoading(false);
    }
  }

  // ── Step 2: Select structure ──
  async function handleSelectVideo(video: SimilarVideo) {
    setSelectedVideo(video);
    setIsLoading(true);

    try {
      // Fetch transcript from YouTube
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000);
      const transcriptResponse = await fetch(`/api/youtube/transcript?videoId=${video.id}`, {
        signal: controller.signal,
      });
      const transcriptResult = await transcriptResponse.json();
      clearTimeout(timeoutId);

      let breakdown: StructureBreakdown;

      if (transcriptResult.success && transcriptResult.data) {
        const transcriptText = transcriptResult.data.transcript;
        const wordCount = transcriptResult.data.wordCount;
        const segments = transcriptResult.data.segments;

        // Analyze the actual transcript to build structure
        breakdown = analyzeTranscriptStructure(transcriptText, segments, video);
        breakdown.transcriptAvailable = true;
        breakdown.transcriptWordCount = wordCount;
      } else {
        // Fallback to metadata-based structure if transcript unavailable
        breakdown = buildMetadataStructure(video);
        breakdown.transcriptAvailable = false;
        breakdown.transcriptWordCount = 0;
      }

      setStructure(breakdown);
      setStep("structure");
    } catch (error) {
      console.error("Failed to analyze structure:", error);
      // Fallback to metadata-based structure
      const fallback = buildMetadataStructure(video);
      setStructure(fallback);
      setStep("structure");
    } finally {
      setIsLoading(false);
    }
  }

  // Analyze transcript to extract real structure
  function analyzeTranscriptStructure(
    transcript: string,
    segments: Array<{ text: string; offset: number; duration: number }>,
    video: SimilarVideo
  ): StructureBreakdown {
    const words = transcript.split(/\s+/);
    const totalWords = words.length;

    // Estimate sections based on word distribution
    // Hook: first ~2% of words (typically first 30-60 seconds)
    const hookWords = Math.max(30, Math.floor(totalWords * 0.02));
    const hookText = words.slice(0, hookWords).join(" ");

    // Intro: next ~5% of words
    const introWords = Math.floor(totalWords * 0.05);
    const introText = words.slice(hookWords, hookWords + introWords).join(" ");

    // Outro: last ~5% of words
    const outroWords = Math.floor(totalWords * 0.05);
    const outroText = words.slice(-outroWords).join(" ");

    // Middle content split into 3 beats
    const middleStart = hookWords + introWords;
    const middleEnd = totalWords - outroWords;
    const middleWords = words.slice(middleStart, middleEnd);
    const beatSize = Math.floor(middleWords.length / 3);

    const beats = [
      middleWords.slice(0, beatSize).join(" "),
      middleWords.slice(beatSize, beatSize * 2).join(" "),
      middleWords.slice(beatSize * 2).join(" "),
    ];

    // Extract key phrases for each beat (first 10 words as summary)
    const beatSummaries = beats.map((beat) => {
      const summary = beat.split(" ").slice(0, 10).join(" ");
      return summary + (beat.split(" ").length > 10 ? "..." : "");
    });

    return {
      hook: extractHookDescription(hookText, video.hookType),
      intro: summarizeSection(introText, "intro"),
      beats: beatSummaries,
      outro: summarizeSection(outroText, "outro"),
      transcriptAvailable: true,
      transcriptWordCount: totalWords,
    };
  }

  function extractHookDescription(hookText: string, hookType: string): string {
    const cleanHook = hookText.replace(/^\s+/, "").slice(0, 200);
    const typeLabel = hookType !== "Unknown" ? ` (${hookType} hook)` : "";
    return `Opens with: "${cleanHook}..."${typeLabel}`;
  }

  function summarizeSection(text: string, sectionType: string): string {
    const clean = text.replace(/^\s+/, "").slice(0, 150);
    const summaries: Record<string, string> = {
      intro: `Sets up the premise: "${clean}..."`,
      outro: `Wraps up with: "${clean}..."`,
    };
    return summaries[sectionType] || clean;
  }

  // Build structure from metadata when transcript is unavailable
  function buildMetadataStructure(video: SimilarVideo): StructureBreakdown {
    return {
      hook:
        video.hookType === "Question"
          ? "Opens with a counter-intuitive question"
          : video.hookType === "Statistic"
            ? "Opens with a shocking statistic"
            : video.hookType === "Story"
              ? "Opens with a personal story"
              : video.hookType === "Bold Claim"
                ? "Opens with a bold, controversial claim"
                : "Opens with a strong hook",
      intro: "Validates the viewer's struggle and sets up the premise",
      beats: [
        "The core problem or concept explained",
        "Key mistakes or misconceptions addressed",
        "The solution or framework presented",
      ],
      outro: "Wraps up with a summary and strong CTA",
      transcriptAvailable: false,
      transcriptWordCount: 0,
    };
  }

  // ── Step 3: Generate script ──
  async function handleGenerateScript() {
    if (!selectedVideo || !structure) return;

    // Cancel any previous request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();

    setIsLoading(true);
    try {
      const response = await fetch("/api/generate/script", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          videoTitle: idea,
          videoDescription: "",
          tone: "educational",
          userVoice: formatVoiceForPrompt(voiceProfile),
          structure: selectedVideo.structure,
          hookType: selectedVideo.hookType,
        }),
        signal: abortControllerRef.current.signal,
      });

      const result = await response.json();
      if (!result.success) {
        throw new Error(result.error || "Failed to generate script");
      }

      const scored = result.data as ScoredOutput<string>;
      setScript(scored.output);
      setScoredOutput(scored);
      parseSections(scored.output);

      // Save draft
      await saveDraft("script", scored.output);

      setStep("script");
      toast.success("Script generated!");
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") return;
      toast.error(error instanceof Error ? error.message : "Failed to generate script");
    } finally {
      setIsLoading(false);
    }
  }

  async function saveDraft(type: string, content: string) {
    if (!user) return;
    try {
      await setDoc(
        doc(db, "users", user.uid, "drafts", `${type}-${Date.now()}`),
        {
          type,
          title: idea,
          content,
          createdAt: new Date().toISOString(),
        }
      );
    } catch (error) {
      console.error("Failed to save draft:", error);
    }
  }

  function parseSections(fullScript: string) {
    const sectionRegex = /\[(HOOK|INTRO|MAIN BEAT \d+|BEAT \d+|OUTRO|CTA).*?\]/gi;
    const matches = fullScript.match(sectionRegex);

    if (!matches) {
      setSections([{ type: "Full Script", content: fullScript }]);
      return;
    }

    const parsedSections: ScriptSection[] = [];
    let lastIndex = 0;

    matches.forEach((match, index) => {
      const startIndex = fullScript.indexOf(match, lastIndex);
      const endIndex = index < matches.length - 1
        ? fullScript.indexOf(matches[index + 1], startIndex)
        : fullScript.length;

      const content = fullScript.slice(startIndex + match.length, endIndex).trim();
      parsedSections.push({
        type: match.replace(/[\[\]]/g, ""),
        content,
      });
      lastIndex = startIndex;
    });

    setSections(parsedSections);
  }

  async function handleRegenerateSection(sectionType: string) {
    setIsRegenerating(sectionType);
    try {
      const response = await fetch("/api/generate/regenerate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sectionType,
          currentScript: script,
          userVoice: formatVoiceForPrompt(voiceProfile),
          instruction: `Only rewrite the [${sectionType}] section. Keep all other sections exactly as they are.`,
        }),
      });

      const result = await response.json();
      if (!result.success) {
        throw new Error(result.error || "Failed to regenerate section");
      }

      const newSection = result.data;
      const sectionRegex = new RegExp(`\\[${sectionType}.*?\\].*?(?=\\[|$)`, "is");
      const updatedScript = script.replace(sectionRegex, `[${sectionType}]\n\n${newSection}`);
      setScript(updatedScript);
      parseSections(updatedScript);
      toast.success(`${sectionType} regenerated!`);
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") return;
      toast.error(error instanceof Error ? error.message : "Failed to regenerate section");
    } finally {
      setIsRegenerating(null);
    }
  }

  // ── Generate social posts (standalone or from script) ──
  async function handleGenerateSocialPosts() {
    const topic = socialIdea.trim() || idea.trim();
    if (!topic) {
      toast.error("Please enter a topic for your social posts");
      return;
    }

    setIsGeneratingSocial(true);
    try {
      const platforms = ["x", "instagram", "facebook"];
      const posts: Record<string, string> = {};

      const results = await Promise.allSettled(
        platforms.map(async (platform) => {
          const response = await fetch("/api/generate/social", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              videoTitle: topic,
              videoDescription: socialDescription || (script ? script.slice(0, 500) : ""),
              platform,
              userVoice: formatVoiceForPrompt(voiceProfile),
            }),
          });

          const result = await response.json();
          if (result.success) {
            const scored = result.data as ScoredOutput<string>;
            return { platform, content: typeof scored.output === "string" ? scored.output : JSON.stringify(scored.output) };
          }
          return { platform, content: "" };
        })
      );

      results.forEach((result) => {
        if (result.status === "fulfilled" && result.value.content) {
          posts[result.value.platform] = result.value.content;
        }
      });

      setSocialPosts(posts);
      setHasGeneratedSocial(true);
      toast.success("Social posts generated!");
    } catch (error) {
      toast.error("Failed to generate social posts");
    } finally {
      setIsGeneratingSocial(false);
    }
  }

  function handleCopyToClipboard() {
    navigator.clipboard.writeText(script);
    toast.success("Script copied to clipboard!");
  }

  function handleCopyPost(content: string) {
    navigator.clipboard.writeText(content);
    toast.success("Post copied to clipboard!");
  }

  function formatViews(viewCount: number): string {
    if (viewCount >= 1000000) return `${(viewCount / 1000000).toFixed(1)}M`;
    if (viewCount >= 1000) return `${(viewCount / 1000).toFixed(1)}K`;
    return viewCount.toString();
  }

  // ── Render ──
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Create</h1>
          <p className="text-gray-600">Generate scripts and social posts from your ideas</p>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6">
          <Button
            variant={activeTab === "script" ? "default" : "outline"}
            size="sm"
            onClick={() => setActiveTab("script")}
          >
            Script Generator
          </Button>
          <Button
            variant={activeTab === "social" ? "default" : "outline"}
            size="sm"
            onClick={() => setActiveTab("social")}
          >
            Social Posts
          </Button>
        </div>

        {/* Script Generator Tab */}
        {activeTab === "script" && (
          <div className="space-y-6">
            {/* Step 1: Idea Input */}
            {step === "idea" && (
              <Card>
                <CardHeader>
                  <CardTitle>What's your video about?</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <Textarea
                    placeholder="I want to make a video about why most people fail at building habits and how to fix it..."
                    value={idea}
                    onChange={(e) => setIdea(e.target.value)}
                    className="min-h-[120px]"
                  />
                  <Button
                    onClick={handleFindSimilarVideos}
                    disabled={isLoading}
                    className="w-full"
                  >
                    {isLoading ? "Finding similar videos..." : "Find Similar Top Videos"}
                  </Button>
                </CardContent>
              </Card>
            )}

            {/* Step 2: Similar Videos */}
            {step === "similar" && (
              <>
                <Card>
                  <CardHeader>
                    <CardTitle>Top Similar Videos ({similarVideos.length} results)</CardTitle>
                    <p className="text-sm text-gray-500">Select a video to see its structure breakdown</p>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {similarVideos.map((video) => (
                      <div
                        key={video.id}
                        className="flex items-center gap-4 p-4 border rounded-lg hover:bg-gray-50 cursor-pointer transition-colors"
                        onClick={() => handleSelectVideo(video)}
                      >
                        <Image
                          src={video.thumbnail}
                          alt={video.title}
                          width={96}
                          height={64}
                          className="w-24 h-16 object-cover rounded flex-shrink-0"
                          unoptimized
                        />
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm line-clamp-1">{video.title}</p>
                          <p className="text-xs text-gray-600">{video.channelTitle}</p>
                          <div className="flex gap-2 mt-1">
                            <Badge variant="outline" className="text-xs">
                              {formatViews(video.viewCount)} views
                            </Badge>
                            <Badge variant="outline" className="text-xs text-orange-600">
                              {video.outlierScore}x outlier
                            </Badge>
                            <Badge variant="outline" className="text-xs">
                              {video.hookType}
                            </Badge>
                          </div>
                        </div>
                        <Button size="sm" variant="outline">
                          Select
                        </Button>
                      </div>
                    ))}
                  </CardContent>
                </Card>
                <Button variant="outline" onClick={() => setStep("idea")} className="w-full">
                  Back to Idea
                </Button>
              </>
            )}

            {/* Step 3: Structure Breakdown */}
            {step === "structure" && selectedVideo && structure && (
              <>
                <Card>
                  <CardHeader>
                    <CardTitle>Structure Breakdown</CardTitle>
                    <p className="text-sm text-gray-500">
                      Based on: "{selectedVideo.title}" ({selectedVideo.outlierScore}x outlier)
                    </p>
                    {structure.transcriptAvailable && (
                      <Badge variant="outline" className="text-xs text-green-600 bg-green-50 mt-2">
                        Transcript analyzed ({structure.transcriptWordCount.toLocaleString()} words)
                      </Badge>
                    )}
                    {!structure.transcriptAvailable && (
                      <Badge variant="outline" className="text-xs text-amber-600 bg-amber-50 mt-2">
                        Transcript unavailable — using metadata estimate
                      </Badge>
                    )}
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-3">
                      <div className="flex gap-3">
                        <Badge className="bg-blue-100 text-blue-700 shrink-0">Hook</Badge>
                        <p className="text-sm">{structure.hook}</p>
                      </div>
                      <div className="flex gap-3">
                        <Badge className="bg-green-100 text-green-700 shrink-0">Intro</Badge>
                        <p className="text-sm">{structure.intro}</p>
                      </div>
                      {structure.beats.map((beat, i) => (
                        <div key={i} className="flex gap-3">
                          <Badge className="bg-yellow-100 text-yellow-700 shrink-0">Beat {i + 1}</Badge>
                          <p className="text-sm">{beat}</p>
                        </div>
                      ))}
                      <div className="flex gap-3">
                        <Badge className="bg-purple-100 text-purple-700 shrink-0">Outro</Badge>
                        <p className="text-sm">{structure.outro}</p>
                      </div>
                    </div>
                    <div className="flex gap-3 pt-4">
                      <Button onClick={handleGenerateScript} disabled={isLoading} className="flex-1">
                        {isLoading ? "Generating..." : "Use This Structure"}
                      </Button>
                      <Button variant="outline" onClick={() => setStep("similar")}>
                        Try Another
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </>
            )}

            {/* Step 4: Generated Script */}
            {step === "script" && script && (
              <>
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between">
                    <CardTitle>Generated Script</CardTitle>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" onClick={handleCopyToClipboard}>
                        Copy All
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setSocialIdea(idea);
                          setSocialDescription(script.slice(0, 500));
                          setActiveTab("social");
                        }}
                      >
                        Generate Social Posts
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {sections.map((section, index) => (
                      <div key={index} className="border rounded-lg p-4">
                        <div className="flex items-center justify-between mb-3">
                          <Badge variant="secondary">{section.type}</Badge>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleRegenerateSection(section.type)}
                            disabled={isRegenerating === section.type}
                          >
                            {isRegenerating === section.type ? "Regenerating..." : "Regenerate"}
                          </Button>
                        </div>
                        <p className="text-sm whitespace-pre-wrap">{section.content}</p>
                      </div>
                    ))}
                  </CardContent>
                </Card>

                {scoredOutput && (
                  <ScoreCard
                    scoredOutput={scoredOutput}
                    onRegenerate={handleGenerateScript}
                  />
                )}

                <div className="flex gap-3">
                  <Button variant="outline" onClick={() => setStep("idea")} className="flex-1">
                    Start Over
                  </Button>
                  <Button onClick={() => {
                    setSocialIdea(idea);
                    setSocialDescription(script.slice(0, 500));
                    setActiveTab("social");
                  }} className="flex-1">
                    Generate Social Posts
                  </Button>
                </div>
              </>
            )}
          </div>
        )}

        {/* Social Posts Tab */}
        {activeTab === "social" && (
          <div className="space-y-6">
            {/* Input Card — always visible */}
            <Card>
              <CardHeader>
                <CardTitle>Social Post Generator</CardTitle>
                <p className="text-sm text-gray-500">
                  Generate platform-optimized posts for X, Instagram, and Facebook
                </p>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="text-sm font-medium mb-2 block">Topic / Title</label>
                  <Textarea
                    placeholder="Enter your video title or topic..."
                    value={socialIdea}
                    onChange={(e) => setSocialIdea(e.target.value)}
                    className="min-h-[60px]"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium mb-2 block">Description (optional)</label>
                  <Textarea
                    placeholder="Add any details, key points, or context..."
                    value={socialDescription}
                    onChange={(e) => setSocialDescription(e.target.value)}
                    className="min-h-[80px]"
                  />
                </div>
                <Button
                  onClick={handleGenerateSocialPosts}
                  disabled={isGeneratingSocial}
                  className="w-full"
                >
                  {isGeneratingSocial ? "Generating..." : "Generate All Social Posts"}
                </Button>
              </CardContent>
            </Card>

            {/* Generated Posts */}
            {hasGeneratedSocial && Object.keys(socialPosts).length > 0 && (
              <div className="space-y-4">
                {Object.entries(socialPosts).map(([platform, content]) => (
                  <Card key={platform}>
                    <CardHeader className="flex flex-row items-center justify-between">
                      <CardTitle className="capitalize">
                        {platform === "x" ? "X / Twitter" : platform}
                      </CardTitle>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleCopyPost(content)}
                      >
                        Copy
                      </Button>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm whitespace-pre-wrap">{content}</p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default function CreatePage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-gray-50 flex items-center justify-center">Loading...</div>}>
      <CreatePageContent />
    </Suspense>
  );
}
