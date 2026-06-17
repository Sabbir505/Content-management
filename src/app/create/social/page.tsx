"use client";

import { useState, Suspense, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ScoreCard } from "@/components/quality/ScoreCard";
import { toast } from "sonner";
import { useVoiceProfile } from "@/hooks/useVoiceProfile";
import { useAuth } from "@/hooks/useAuth";
import { doc, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { ScoredOutput } from "@/lib/quality/types";

type Platform = "x" | "instagram" | "facebook";

interface GeneratedPost {
  platform: Platform;
  content: string;
  scoredOutput?: ScoredOutput<string>;
  isLoading: boolean;
  error?: string;
}

const PLATFORM_LABELS: Record<Platform, string> = {
  x: "X / Twitter",
  instagram: "Instagram",
  facebook: "Facebook",
};

function SocialPostGeneratorContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useAuth();
  const { formatVoiceForPrompt, voiceProfile } = useVoiceProfile();
  const videoId = searchParams.get("videoId");

  const [videoTitle, setVideoTitle] = useState(searchParams.get("title") || "");
  const [videoDescription, setVideoDescription] = useState(cleanDescription(searchParams.get("description") || ""));
  const [posts, setPosts] = useState<Record<Platform, GeneratedPost>>({
    x: { platform: "x", content: "", isLoading: false },
    instagram: { platform: "instagram", content: "", isLoading: false },
    facebook: { platform: "facebook", content: "", isLoading: false },
  });
  const [activeTab, setActiveTab] = useState<Platform>("x");

  // AbortController ref for cancelling in-flight requests
  const abortControllerRef = useRef<AbortController | null>(null);

  async function generateSinglePost(platform: Platform) {
    setPosts((prev) => ({
      ...prev,
      [platform]: { ...prev[platform], isLoading: true, error: undefined },
    }));

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000);

      const response = await fetch("/api/generate/social", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          videoTitle,
          videoDescription,
          platform,
          userVoice: formatVoiceForPrompt(voiceProfile),
        }),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      const result = await response.json();
      if (!result.success) {
        throw new Error(result.error || `Failed to generate ${platform} post`);
      }

      const scored = result.data as ScoredOutput<string>;
      const content = scored.output || "";

      setPosts((prev) => ({
        ...prev,
        [platform]: {
          platform,
          content,
          scoredOutput: scored,
          isLoading: false,
        },
      }));

      // Auto-save draft
      await saveDraft(platform, content);

      toast.success(`${PLATFORM_LABELS[platform]} post generated!`);
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") return;
      setPosts((prev) => ({
        ...prev,
        [platform]: {
          ...prev[platform],
          isLoading: false,
          error: error instanceof Error ? error.message : "Generation failed",
        },
      }));
      toast.error(error instanceof Error ? error.message : `Failed to generate ${platform} post`);
    }
  }

  async function handleGenerateAllPosts() {
    if (!videoTitle.trim()) {
      toast.error("Please enter a video title or topic");
      return;
    }

    // Generate all three in parallel with allSettled so one failure doesn't block others
    const platforms: Platform[] = ["x", "instagram", "facebook"];
    await Promise.allSettled(platforms.map((platform) => generateSinglePost(platform)));
  }

  async function saveDraft(platform: string, content: string) {
    if (!user) return;
    try {
      await setDoc(
        doc(db, "users", user.uid, "drafts", `social-${platform}-${Date.now()}`),
        {
          type: "social",
          platform,
          title: videoTitle,
          content,
          createdAt: new Date().toISOString(),
        }
      );
    } catch (error) {
      console.error("Failed to save draft:", error);
    }
  }

  function handleCopyPost(content: string) {
    navigator.clipboard.writeText(content);
    toast.success("Post copied to clipboard!");
  }

  function cleanDescription(raw: string): string {
    if (!raw) return "";
    // If it looks like HTML, strip tags and decode entities
    if (raw.includes("<") && raw.includes(">")) {
      const tmp = document.createElement("div");
      tmp.innerHTML = raw;
      let text = tmp.textContent || tmp.innerText || "";
      // Collapse multiple whitespace
      text = text.replace(/\s+/g, " ").trim();
      // Limit to reasonable length for API
      return text.slice(0, 2000);
    }
    return raw.slice(0, 2000);
  }

  function getPostForPlatform(platform: Platform): GeneratedPost {
    return posts[platform];
  }

  const hasAnyPosts = Object.values(posts).some((p) => p.content && !p.isLoading);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Social Post Generator</h1>
          <p className="text-gray-600">Generate platform-optimized social posts from your video</p>
        </div>

        <div className="grid gap-6">
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
                onClick={handleGenerateAllPosts}
                disabled={Object.values(posts).some((p) => p.isLoading)}
                className="w-full"
              >
                {Object.values(posts).some((p) => p.isLoading)
                  ? "Generating..."
                  : "Generate All Social Posts"}
              </Button>
            </CardContent>
          </Card>

          {/* Posts Output */}
          {hasAnyPosts && (
            <Card>
              <CardHeader>
                <CardTitle>Generated Posts</CardTitle>
              </CardHeader>
              <CardContent>
                <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as Platform)}>
                  <TabsList className="grid w-full grid-cols-3">
                    <TabsTrigger value="x">X / Twitter</TabsTrigger>
                    <TabsTrigger value="instagram">Instagram</TabsTrigger>
                    <TabsTrigger value="facebook">Facebook</TabsTrigger>
                  </TabsList>

                  {(["x", "instagram", "facebook"] as Platform[]).map((platform) => {
                    const post = getPostForPlatform(platform);
                    return (
                      <TabsContent key={platform} value={platform} className="mt-4">
                        <div className="border rounded-lg p-4">
                          <div className="flex items-center justify-between mb-4">
                            <Badge variant="secondary">
                              {PLATFORM_LABELS[platform]}
                            </Badge>
                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => post.content && handleCopyPost(post.content)}
                                disabled={!post.content || post.isLoading}
                              >
                                Copy
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => generateSinglePost(platform)}
                                disabled={post.isLoading}
                              >
                                {post.isLoading ? "Generating..." : "Regenerate"}
                              </Button>
                            </div>
                          </div>

                          {post.isLoading ? (
                            <div className="space-y-3">
                              <Skeleton className="h-4 w-full" />
                              <Skeleton className="h-4 w-5/6" />
                              <Skeleton className="h-4 w-4/6" />
                              <Skeleton className="h-20 w-full" />
                            </div>
                          ) : post.error ? (
                            <div className="text-sm text-red-600 bg-red-50 p-3 rounded">
                              {post.error}
                            </div>
                          ) : post.content ? (
                            <div className="space-y-4">
                              <p className="text-sm whitespace-pre-wrap">{post.content}</p>
                              {post.scoredOutput && (
                                <ScoreCard
                                  scoredOutput={post.scoredOutput}
                                  onRegenerate={() => generateSinglePost(platform)}
                                />
                              )}
                            </div>
                          ) : (
                            <p className="text-sm text-gray-500">Click "Generate All" or "Regenerate" to create a post.</p>
                          )}
                        </div>
                      </TabsContent>
                    );
                  })}
                </Tabs>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

export default function SocialPostGeneratorPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-gray-50 flex items-center justify-center">Loading...</div>}>
      <SocialPostGeneratorContent />
    </Suspense>
  );
}
