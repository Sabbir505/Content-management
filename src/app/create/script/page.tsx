"use client";

import { useState, useEffect, Suspense, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import Image from "next/image";
import { Skeleton } from "@/components/ui/skeleton";
import { ScoreCard } from "@/components/quality/ScoreCard";
import { toast } from "sonner";
import { useVoiceProfile } from "@/hooks/useVoiceProfile";
import { useAuth } from "@/hooks/useAuth";
import { doc, setDoc, collection, query, orderBy, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { ScoredOutput } from "@/lib/quality/types";
import type { VideoWithOutlier } from "@/types/video";

const TONES = [
  { value: "educational", label: "Educational" },
  { value: "opinion", label: "Opinion / Hot Take" },
  { value: "storytelling", label: "Storytelling" },
  { value: "listicle", label: "Listicle" },
  { value: "documentary", label: "Documentary" },
  { value: "reaction", label: "Reaction" },
  { value: "vlog", label: "Vlog" },
  { value: "review", label: "Review" },
  { value: "tutorial", label: "Tutorial" },
  { value: "challenge", label: "Challenge" },
];

const TARGET_DURATIONS = [
  { value: "3", label: "3 minutes (~450 words)" },
  { value: "5", label: "5 minutes (~750 words)" },
  { value: "8", label: "8 minutes (~1,200 words)" },
  { value: "10", label: "10 minutes (~1,500 words)" },
  { value: "15", label: "15 minutes (~2,250 words)" },
  { value: "20", label: "20 minutes (~3,000 words)" },
  { value: "30", label: "30 minutes (~4,500 words)" },
];

interface ScriptSection {
  type: string;
  content: string;
}

interface ScriptData {
  script: {
    title_suggestion: string;
    total_word_count: number;
    estimated_duration_minutes: number;
    sections: {
      label: string;
      word_count: number;
      content: string;
    }[];
    hook_type_used: string;
    cta_used: string;
  };
}

function ScriptGeneratorContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useAuth();
  const { formatVoiceForPrompt, voiceProfile } = useVoiceProfile();
  const videoId = searchParams.get("videoId");

  const [videoTitle, setVideoTitle] = useState(searchParams.get("title") || "");
  const [videoDescription, setVideoDescription] = useState(searchParams.get("description") || "");
  const [tone, setTone] = useState("educational");
  const [targetDuration, setTargetDuration] = useState("10");
  const [script, setScript] = useState("");
  const [sections, setSections] = useState<ScriptSection[]>([]);
  const [scoredOutput, setScoredOutput] = useState<ScoredOutput<string> | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isRegenerating, setIsRegenerating] = useState<string | null>(null);
  const [sourceVideo, setSourceVideo] = useState<VideoWithOutlier | null>(null);
  const [scriptData, setScriptData] = useState<ScriptData | null>(null);

  // AbortController ref for cancelling in-flight requests
  const abortControllerRef = useRef<AbortController | null>(null);

  // Load source video if videoId is provided
  useEffect(() => {
    if (!videoId) return;

    const controller = new AbortController();

    async function fetchVideoDetails() {
      try {
        const response = await fetch(`/api/youtube/search?query=${encodeURIComponent(videoId || "")}`, {
          signal: controller.signal,
        });
        const result = await response.json();
        if (result.success && result.data?.videos?.[0]) {
          setSourceVideo(result.data.videos[0]);
        }
      } catch (error) {
        if (error instanceof Error && error.name === "AbortError") return;
        console.error("Failed to fetch source video:", error);
      }
    }

    fetchVideoDetails();
    return () => controller.abort();
  }, [videoId]);

  async function handleGenerateScript() {
    if (!videoTitle.trim()) {
      toast.error("Please enter a video title or topic");
      return;
    }

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
          videoTitle,
          videoDescription,
          tone,
          userVoice: formatVoiceForPrompt(voiceProfile),
          targetDuration: parseInt(targetDuration),
        }),
        signal: abortControllerRef.current.signal,
      });

      const result = await response.json();
      if (!result.success) {
        throw new Error(result.error || "Failed to generate script");
      }

      const scored = result.data as ScoredOutput<string>;
      const output = scored.output;

      // Try to parse as JSON first (API returns structured script)
      let parsedScript: ScriptData | null = null;
      let scriptText = "";

      if (typeof output === "string") {
        // Try to extract JSON from the string
        try {
          const cleanJson = output.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
          parsedScript = JSON.parse(cleanJson) as ScriptData;
        } catch {
          // Not JSON, treat as plain text
          scriptText = output;
        }
      } else if (output && typeof output === "object") {
        parsedScript = output as ScriptData;
      }

      if (parsedScript?.script) {
        // Build display text from structured sections
        scriptText = parsedScript.script.sections
          .map((s) => `[${s.label}]\n\n${s.content}`)
          .join("\n\n---\n\n");
        setScriptData(parsedScript);
      }

      setScript(scriptText);
      setScoredOutput(scored);
      parseSections(scriptText);

      // Auto-save draft
      await saveDraft(scriptText);

      toast.success("Script generated successfully!");
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") return;
      toast.error(error instanceof Error ? error.message : "Failed to generate script");
    } finally {
      setIsLoading(false);
    }
  }

  async function saveDraft(content: string) {
    if (!user) return;
    try {
      await setDoc(
        doc(db, "users", user.uid, "drafts", `script-${Date.now()}`),
        {
          type: "script",
          title: videoTitle,
          content,
          tone,
          targetDuration,
          createdAt: new Date().toISOString(),
        }
      );
    } catch (error) {
      console.error("Failed to save draft:", error);
    }
  }

  function parseSections(fullScript: string) {
    // More flexible regex that handles various bracket formats
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

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);

    try {
      const response = await fetch("/api/generate/regenerate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sectionType,
          currentScript: script,
          userVoice: formatVoiceForPrompt(voiceProfile),
          // Instruct to only rewrite this section
          instruction: `Only rewrite the [${sectionType}] section. Keep all other sections exactly as they are.`,
        }),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      const result = await response.json();
      if (!result.success) {
        throw new Error(result.error || "Failed to regenerate section");
      }

      const newSection = result.data;

      // Update only the specific section
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

  function handleCopyToClipboard() {
    navigator.clipboard.writeText(script);
    toast.success("Script copied to clipboard!");
  }

  function handleCopySection(content: string) {
    navigator.clipboard.writeText(content);
    toast.success("Section copied to clipboard!");
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Script Generator</h1>
          <p className="text-gray-600">Generate a YouTube script in your voice</p>
        </div>

        <div className="grid gap-6">
          {/* Source Video Card */}
          {sourceVideo && (
            <Card className="bg-blue-50 border-blue-200">
              <CardContent className="p-4 flex items-center gap-4">
                <Image
                  src={sourceVideo.thumbnail}
                  alt={sourceVideo.title}
                  width={96}
                  height={64}
                  className="w-24 h-16 object-cover rounded"
                  unoptimized
                />
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm line-clamp-2">{sourceVideo.title}</p>
                  <p className="text-xs text-gray-600">{sourceVideo.channelTitle}</p>
                  <div className="flex gap-2 mt-1">
                    <Badge variant="outline" className="text-xs">
                      {sourceVideo.viewCount?.toLocaleString()} views
                    </Badge>
                    <Badge variant="outline" className="text-xs">
                      {sourceVideo.hookType}
                    </Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Input Section */}
          <Card>
            <CardHeader>
              <CardTitle>Video Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-sm font-medium mb-2 block">Video Title / Topic</label>
                <Textarea
                  placeholder="Enter the video title or describe your topic..."
                  value={videoTitle}
                  onChange={(e) => setVideoTitle(e.target.value)}
                  className="min-h-[80px]"
                />
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">Description (optional)</label>
                <Textarea
                  placeholder="Enter video description or key points..."
                  value={videoDescription}
                  onChange={(e) => setVideoDescription(e.target.value)}
                  className="min-h-[80px]"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium mb-2 block">Tone</label>
                  <Select value={tone} onValueChange={(value) => value && setTone(value)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {TONES.map((t) => (
                        <SelectItem key={t.value} value={t.value}>
                          {t.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="text-sm font-medium mb-2 block">Target Duration</label>
                  <Select value={targetDuration} onValueChange={(value) => value && setTargetDuration(value)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {TARGET_DURATIONS.map((d) => (
                        <SelectItem key={d.value} value={d.value}>
                          {d.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Voice Profile Indicator */}
              <div className="flex items-center gap-2 text-sm">
                <span className="text-gray-500">Voice:</span>
                {voiceProfile ? (
                  <Badge variant="outline" className="text-green-700 bg-green-50">
                    {voiceProfile.name || "Custom Voice"}
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-gray-500">
                    Default (conversational)
                  </Badge>
                )}
              </div>

              <Button
                onClick={handleGenerateScript}
                disabled={isLoading}
                className="w-full"
              >
                {isLoading ? "Generating..." : "Generate Script"}
              </Button>
            </CardContent>
          </Card>

          {/* Script Stats */}
          {scriptData && (
            <Card>
              <CardHeader>
                <CardTitle>Script Stats</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="text-center p-3 bg-gray-50 rounded-lg">
                    <p className="text-2xl font-bold">{scriptData.script.total_word_count}</p>
                    <p className="text-xs text-gray-600">Words</p>
                  </div>
                  <div className="text-center p-3 bg-gray-50 rounded-lg">
                    <p className="text-2xl font-bold">{scriptData.script.estimated_duration_minutes}m</p>
                    <p className="text-xs text-gray-600">Duration</p>
                  </div>
                  <div className="text-center p-3 bg-gray-50 rounded-lg">
                    <p className="text-2xl font-bold">{scriptData.script.sections.length}</p>
                    <p className="text-xs text-gray-600">Sections</p>
                  </div>
                  <div className="text-center p-3 bg-gray-50 rounded-lg">
                    <p className="text-2xl font-bold">{scriptData.script.hook_type_used || "—"}</p>
                    <p className="text-xs text-gray-600">Hook Type</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Loading skeleton */}
          {isLoading && (
            <Card>
              <CardContent className="p-6 space-y-4">
                <Skeleton className="h-8 w-3/4" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-5/6" />
                <Skeleton className="h-4 w-4/6" />
                <Skeleton className="h-32 w-full" />
              </CardContent>
            </Card>
          )}

          {/* Script Output */}
          {script && !isLoading && (
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
                    onClick={() => router.push(`/create/social?videoId=${videoId || ""}`)}
                  >
                    Generate Social Posts
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {sections.map((section, index) => (
                  <div key={index} className="border rounded-lg p-4 relative group">
                    <div className="flex items-center justify-between mb-3">
                      <Badge variant="secondary">{section.type}</Badge>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleCopySection(section.content)}
                          className="opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          Copy
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleRegenerateSection(section.type)}
                          disabled={isRegenerating === section.type}
                        >
                          {isRegenerating === section.type ? "Regenerating..." : "Regenerate"}
                        </Button>
                      </div>
                    </div>
                    {isRegenerating === section.type ? (
                      <div className="space-y-2">
                        <Skeleton className="h-4 w-full" />
                        <Skeleton className="h-4 w-5/6" />
                        <Skeleton className="h-4 w-4/6" />
                      </div>
                    ) : (
                      <p className="text-sm whitespace-pre-wrap">{section.content}</p>
                    )}
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
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default function ScriptGeneratorPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-gray-50 flex items-center justify-center">Loading...</div>}>
      <ScriptGeneratorContent />
    </Suspense>
  );
}
