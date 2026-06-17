"use client";

import { useState, Suspense, useCallback, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { parseDuration, formatDuration } from "@/lib/youtube";
import { YouTubeVideo } from "@/types/video";
import { useAuth } from "@/hooks/useAuth";
import { useConnectChannel } from "@/hooks/useConnectChannel";
import Link from "next/link";
import Image from "next/image";

// ---- Types ----

interface ChannelVideo extends YouTubeVideo {
  performanceScore: number;
  improvementPotential: number;
  ctrEstimate: number;
  suggestions: string[];
  channelAvgViews: number;
  isShort: boolean;
  outlierScore: number;
  hookType: string;
  durationSeconds: number;
}

interface ChannelInsights {
  bestTopic: string;
  bestTopicAvgOutlier: number;
  bestLength: string;
  bestDay: string;
  bestHook: string;
}

interface ChannelStats {
  totalVideos: number;
  totalViews: number;
  avgViews: number;
  avgPerformance: number;
  topVideo: ChannelVideo | null;
  worstVideo: ChannelVideo | null;
  totalLikes: number;
  totalComments: number;
  engagementRate: number;
  shortCount: number;
  videoCount: number;
  healthScore: number;
  insights: ChannelInsights;
}

// ---- Helpers ----

function calculateOutlierScore(video: YouTubeVideo, channelAvgViews: number): number {
  if (channelAvgViews === 0) return 1;
  return Math.round((video.viewCount / channelAvgViews) * 10) / 10;
}

function estimateHookType(title: string): string {
  const t = title.toLowerCase();
  if (/\?/.test(t)) return "Question";
  if (/\d+%?|\d+\s*(million|billion|thousand)/.test(t)) return "Statistic";
  if (/\b(i |my |we |our )/.test(t)) return "Story";
  if (/\b(never|always|secret|truth|nobody|everyone|stop|why\s+\w+\s+(don't|doesn't|won't|can't))/.test(t)) return "Bold Claim";
  if (/\b(how to|tutorial|guide|steps|ways)/.test(t)) return "How-To";
  return "Pattern Interrupt";
}

function calculatePerformanceScore(video: YouTubeVideo, avgViews: number): number {
  if (avgViews === 0) return 50;
  const ratio = video.viewCount / avgViews;
  const score = Math.min(100, Math.max(0, ratio * 50));
  return Math.round(score);
}

function calculateImprovementPotential(video: ChannelVideo): number {
  if (video.performanceScore >= 80) return Math.max(5, 100 - video.performanceScore);
  if (video.performanceScore >= 50) return 100 - video.performanceScore;
  // Smooth transition: linearly scale the bonus from +20 at score=0 to +0 at score=50
  const bonus = 20 * (1 - video.performanceScore / 50);
  return Math.min(95, 100 - video.performanceScore + bonus);
}

function generateSuggestions(video: ChannelVideo, topVideos: ChannelVideo[]): string[] {
  const suggestions: string[] = [];
  const titleLower = video.title.toLowerCase();
  const descLower = (video.description || "").toLowerCase();

  // Compare against top performers in the same channel
  const topTitles = topVideos.slice(0, 5).map((v) => v.title.toLowerCase());
  const topHooks = topVideos.map((v) => v.hookType);
  const bestHook = topHooks
    .sort((a, b) => topHooks.filter((h) => h === a).length - topHooks.filter((h) => h === b).length)
    .pop() || "Pattern Interrupt";

  // Title analysis
  if (video.isShort) {
    if (video.title.length < 10) {
      suggestions.push("Short titles work best when punchy but descriptive. Add a hook.");
    }
    if (!video.description || video.description.length < 30) {
      suggestions.push("Add hashtags in the description to boost Shorts discoverability.");
    }
  } else {
    if (video.title.length < 30) {
      suggestions.push(`Title is too short (${video.title.length} chars). Top performers average ${Math.round(topVideos.reduce((s, v) => s + v.title.length, 0) / topVideos.length)} chars.`);
    }
    if (video.title.length > 60) {
      suggestions.push("Title may be truncated in search results. Keep under 60 characters.");
    }
    if (!video.description || video.description.length < 100) {
      suggestions.push("Description is too short. Aim for 200+ words with timestamps and links.");
    }
    if (video.tags.length < 5) {
      suggestions.push("Add more relevant tags (aim for 10-15). Top performers use an average of " +
        `${Math.round(topVideos.reduce((s, v) => s + v.tags.length, 0) / topVideos.length)} tags.`);
    }
  }

  // Hook type comparison
  if (video.hookType !== bestHook && video.outlierScore < 1.2) {
    suggestions.push(`Your hook type is "${video.hookType}" but your top videos use "${bestHook}". Consider testing ${bestHook.toLowerCase()} openings.`);
  }

  // Title pattern comparison
  const hasNumber = /\d/.test(video.title);
  const topHasNumber = topTitles.filter((t) => /\d/.test(t)).length / topTitles.length;
  if (!hasNumber && topHasNumber > 0.5) {
    suggestions.push("Top performers use numbers in titles. Consider adding a specific statistic or year.");
  }

  const hasQuestion = /\?/.test(video.title);
  const topHasQuestion = topTitles.filter((t) => /\?/.test(t)).length / topTitles.length;
  if (!hasQuestion && topHasQuestion > 0.5) {
    suggestions.push("Top performers use question-based titles. Consider framing your topic as a question.");
  }

  // Description keyword coverage
  if (!video.isShort && video.description) {
    const titleWords = video.title.toLowerCase().split(/\s+/).filter((w) => w.length > 3);
    const missingInDesc = titleWords.filter((w) => !descLower.includes(w));
    if (missingInDesc.length > 0) {
      suggestions.push(`Description missing keywords from title: "${missingInDesc.slice(0, 3).join(", ")}". Include these for better SEO.`);
    }
  }

  // Performance-based suggestions
  if (video.performanceScore < 50) {
    suggestions.push("Consider updating the thumbnail with a more engaging visual (high contrast, clear face, or bold text).");
  }
  if (video.viewCount < video.channelAvgViews * 0.5) {
    suggestions.push("Hook needs work. First 30 seconds are critical — consider a stronger pattern interrupt or curiosity gap.");
  }
  if (video.outlierScore < 0.8 && video.durationSeconds > 600) {
    suggestions.push("This video is underperforming for its length. Consider cutting to 8-10 minutes or adding more value per minute.");
  }

  // Engagement suggestions
  const engagementRate = video.viewCount > 0 ? ((video.likeCount + video.commentCount) / video.viewCount) * 100 : 0;
  if (engagementRate < 2) {
    suggestions.push("Engagement rate is low. Add a direct question in the first 2 minutes to drive comments.");
  }

  if (suggestions.length === 0) {
    suggestions.push("Content is performing well. Consider creating a follow-up or sequel to capitalize on momentum.");
  }

  return suggestions;
}

function generateInsights(videos: ChannelVideo[]): ChannelInsights {
  if (videos.length === 0) {
    return { bestTopic: "N/A", bestTopicAvgOutlier: 0, bestLength: "N/A", bestDay: "N/A", bestHook: "N/A" };
  }

  // Best hook type
  const hookCounts: Record<string, number> = {};
  videos.forEach((v) => {
    hookCounts[v.hookType] = (hookCounts[v.hookType] || 0) + v.outlierScore;
  });
  const bestHook = Object.entries(hookCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || "N/A";

  // Best length bucket
  const lengthBuckets: Record<string, number[]> = {};
  videos.forEach((v) => {
    const bucket = v.durationSeconds < 300 ? "Under 5 min" :
      v.durationSeconds < 600 ? "5–10 min" :
      v.durationSeconds < 900 ? "10–15 min" :
      v.durationSeconds < 1200 ? "15–20 min" : "20+ min";
    if (!lengthBuckets[bucket]) lengthBuckets[bucket] = [];
    lengthBuckets[bucket].push(v.outlierScore);
  });
  const bestLength = Object.entries(lengthBuckets)
    .sort((a, b) => {
      const avgA = a[1].reduce((s, v) => s + v, 0) / a[1].length;
      const avgB = b[1].reduce((s, v) => s + v, 0) / b[1].length;
      return avgB - avgA;
    })[0]?.[0] || "N/A";

  // Best day
  const dayCounts: Record<string, number[]> = {};
  const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  videos.forEach((v) => {
    const day = days[new Date(v.publishedAt).getDay()];
    if (!dayCounts[day]) dayCounts[day] = [];
    dayCounts[day].push(v.outlierScore);
  });
  const bestDay = Object.entries(dayCounts)
    .sort((a, b) => {
      const avgA = a[1].reduce((s, v) => s + v, 0) / a[1].length;
      const avgB = b[1].reduce((s, v) => s + v, 0) / b[1].length;
      return avgB - avgA;
    })[0]?.[0] || "N/A";

  // Best topic from tags
  const tagScores: Record<string, number[]> = {};
  videos.forEach((v) => {
    v.tags.slice(0, 3).forEach((tag) => {
      if (!tagScores[tag]) tagScores[tag] = [];
      tagScores[tag].push(v.outlierScore);
    });
  });
  const bestTopicEntry = Object.entries(tagScores)
    .sort((a, b) => {
      const avgA = a[1].reduce((s, v) => s + v, 0) / a[1].length;
      const avgB = b[1].reduce((s, v) => s + v, 0) / b[1].length;
      return avgB - avgA;
    })[0];
  const bestTopic = bestTopicEntry?.[0] || "N/A";
  const bestTopicAvgOutlier = bestTopicEntry
    ? Math.round((bestTopicEntry[1].reduce((s, v) => s + v, 0) / bestTopicEntry[1].length) * 10) / 10
    : 0;

  return { bestTopic, bestTopicAvgOutlier, bestLength, bestDay, bestHook };
}

function calculateHealthScore(videos: ChannelVideo[]): number {
  if (videos.length === 0) return 0;
  const avgPerf = videos.reduce((sum, v) => sum + v.performanceScore, 0) / videos.length;
  const consistency = 100 - (videos.reduce((sum, v) => sum + Math.abs(v.performanceScore - avgPerf), 0) / videos.length);
  const topRatio = videos.filter((v) => v.performanceScore >= 80).length / videos.length;
  return Math.round((avgPerf * 0.5 + consistency * 0.3 + topRatio * 100 * 0.2));
}

function isShortVideo(durationSeconds: number): boolean {
  return durationSeconds <= 60;
}

// ---- Channel Analysis ----

async function analyzeChannelById(channelId: string): Promise<{
  channelName: string;
  channelThumbnail: string;
  videos: ChannelVideo[];
  stats: ChannelStats;
}> {
  // Use server-side API route to avoid exposing API key on client
  const response = await fetch(`/api/youtube/channel-videos?channelId=${channelId}`);

  if (!response.ok) {
    throw new Error("Failed to fetch channel videos");
  }

  const result = await response.json();
  if (!result.success) {
    throw new Error(result.error || "Failed to fetch channel videos");
  }

  const channel = result.data.channel;
  const channelName = channel.title;
  const channelThumbnail = channel.thumbnail;
  const videoDetails = result.data.videos;

  if (videoDetails.length === 0) {
    throw new Error("No videos found on this channel");
  }

  const totalViews = videoDetails.reduce((sum: number, v: { statistics: { viewCount: string } }) => sum + parseInt(v.statistics.viewCount || "0"), 0);
  const totalLikes = videoDetails.reduce((sum: number, v: { statistics: { likeCount: string } }) => sum + parseInt(v.statistics.likeCount || "0"), 0);
  const totalComments = videoDetails.reduce((sum: number, v: { statistics: { commentCount: string } }) => sum + parseInt(v.statistics.commentCount || "0"), 0);
  const avgViews = Math.round(totalViews / videoDetails.length);

  const channelVideos: ChannelVideo[] = videoDetails.map((item: {
    id: string;
    snippet: {
      title: string;
      channelTitle: string;
      channelId: string;
      publishedAt: string;
      description: string;
      tags?: string[];
      thumbnails: { high?: { url: string }; default?: { url: string }; maxres?: { url: string } };
    };
    statistics: { viewCount: string; likeCount: string; commentCount: string };
    contentDetails: { duration: string };
  }) => {
    const durationSeconds = parseDuration(item.contentDetails.duration);
    const short = isShortVideo(durationSeconds);

    const video: YouTubeVideo = {
      id: item.id,
      title: item.snippet.title,
      channelTitle: item.snippet.channelTitle,
      channelId: item.snippet.channelId,
      viewCount: parseInt(item.statistics.viewCount || "0"),
      likeCount: parseInt(item.statistics.likeCount || "0"),
      commentCount: parseInt(item.statistics.commentCount || "0"),
      thumbnail: item.snippet.thumbnails.maxres?.url || item.snippet.thumbnails.high?.url || item.snippet.thumbnails.default?.url || "",
      publishedAt: item.snippet.publishedAt,
      duration: formatDuration(durationSeconds),
      description: item.snippet.description || "",
      tags: item.snippet.tags || [],
    };

    const performanceScore = calculatePerformanceScore(video, avgViews);
    const outlierScore = calculateOutlierScore(video, avgViews);
    const hookType = estimateHookType(video.title);

    const channelVideo: ChannelVideo = {
      ...video,
      channelAvgViews: avgViews,
      performanceScore,
      improvementPotential: 0,
      ctrEstimate: Math.round(performanceScore * 0.8 + Math.random() * 10),
      suggestions: [],
      isShort: short,
      outlierScore,
      hookType,
      durationSeconds,
    };

    return channelVideo;
  });

  // Sort by performance for top videos reference BEFORE generating suggestions
  const perfVideos = [...channelVideos].sort((a, b) => b.performanceScore - a.performanceScore);

  channelVideos.forEach((channelVideo) => {
    channelVideo.improvementPotential = calculateImprovementPotential(channelVideo);
    channelVideo.suggestions = generateSuggestions(channelVideo, perfVideos);
  });

  // Sort by date - newest first for display
  channelVideos.sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime());

  const shorts = channelVideos.filter((v) => v.isShort);
  const longForm = channelVideos.filter((v) => !v.isShort);
  const insights = generateInsights(channelVideos);
  const healthScore = calculateHealthScore(channelVideos);

  const stats: ChannelStats = {
    totalVideos: channelVideos.length,
    totalViews,
    avgViews,
    avgPerformance: Math.round(channelVideos.reduce((sum, v) => sum + v.performanceScore, 0) / channelVideos.length),
    topVideo: perfVideos[0] || null,
    worstVideo: perfVideos[perfVideos.length - 1] || null,
    totalLikes,
    totalComments,
    engagementRate: totalViews > 0 ? Math.round(((totalLikes + totalComments) / totalViews) * 1000) / 10 : 0,
    shortCount: shorts.length,
    videoCount: longForm.length,
    healthScore,
    insights,
  };

  return { channelName, channelThumbnail, videos: channelVideos, stats };
}

// ---- UI Helpers ----

function extractChannelId(url: string): string | null {
  const patterns = [
    /youtube\.com\/(?:c\/|channel\/|@)([a-zA-Z0-9_-]+)/,
    /youtube\.com\/(?:user\/)?([a-zA-Z0-9_-]+)/,
  ];
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  return null;
}

function formatNumber(num: number): string {
  if (num >= 1000000000) return `${(num / 1000000000).toFixed(1)}B`;
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
  if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
  return num.toString();
}

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays} days ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
  if (diffDays < 365) return `${Math.floor(diffDays / 30)} months ago`;
  return `${Math.floor(diffDays / 365)} years ago`;
}

function formatFullDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function getHealthScoreColor(score: number): string {
  if (score >= 80) return "text-green-600";
  if (score >= 60) return "text-yellow-600";
  if (score >= 40) return "text-orange-600";
  return "text-red-600";
}

function getHealthScoreBg(score: number): string {
  if (score >= 80) return "bg-green-50 border-green-200";
  if (score >= 60) return "bg-yellow-50 border-yellow-200";
  if (score >= 40) return "bg-orange-50 border-orange-200";
  return "bg-red-50 border-red-200";
}

// ---- Components ----

type ContentFilter = "all" | "videos" | "shorts";

function StatCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="text-center p-4 bg-gray-50 rounded-xl border border-gray-100">
      <p className="text-2xl font-bold text-gray-900">{value}</p>
      <p className="text-sm text-gray-500">{label}</p>
      {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
    </div>
  );
}

function HealthScoreCard({ score }: { score: number }) {
  const colorClass = getHealthScoreColor(score);
  const bgClass = getHealthScoreBg(score);

  return (
    <Card className={`${bgClass}`}>
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-600 mb-1">Channel Health Score</p>
            <p className={`text-4xl font-bold ${colorClass}`}>{score} <span className="text-lg text-gray-400">/ 100</span></p>
          </div>
          <div className="text-right">
            <div className={`text-2xl ${score >= 60 ? "text-green-500" : score >= 40 ? "text-yellow-500" : "text-red-500"}`}>
              {score >= 80 ? "🟢" : score >= 60 ? "🟡" : score >= 40 ? "🟠" : "🔴"}
            </div>
            <p className="text-xs text-gray-500 mt-1">
              {score >= 80 ? "Excellent" : score >= 60 ? "Good" : score >= 40 ? "Needs Work" : "Critical"}
            </p>
          </div>
        </div>
        <div className="mt-4">
          <Progress value={score} className="h-2" />
        </div>
      </CardContent>
    </Card>
  );
}

function InsightsPanel({ insights }: { insights: ChannelInsights }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Insights</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-start gap-3">
          <span className="text-gray-400 mt-0.5">•</span>
          <div>
            <span className="text-sm font-medium text-gray-700">Best topic:</span>
            <span className="text-sm text-gray-600 ml-1">
              {insights.bestTopic} (avg {insights.bestTopicAvgOutlier}x outlier)
            </span>
          </div>
        </div>
        <div className="flex items-start gap-3">
          <span className="text-gray-400 mt-0.5">•</span>
          <div>
            <span className="text-sm font-medium text-gray-700">Best length:</span>
            <span className="text-sm text-gray-600 ml-1">{insights.bestLength}</span>
          </div>
        </div>
        <div className="flex items-start gap-3">
          <span className="text-gray-400 mt-0.5">•</span>
          <div>
            <span className="text-sm font-medium text-gray-700">Best day:</span>
            <span className="text-sm text-gray-600 ml-1">{insights.bestDay} uploads perform best</span>
          </div>
        </div>
        <div className="flex items-start gap-3">
          <span className="text-gray-400 mt-0.5">•</span>
          <div>
            <span className="text-sm font-medium text-gray-700">Best hook:</span>
            <span className="text-sm text-gray-600 ml-1">{insights.bestHook} openings outperform others</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function VideoCard({
  video,
  isSelected,
  onClick,
  onFixVideo,
}: {
  video: ChannelVideo;
  isSelected: boolean;
  onClick: () => void;
  onFixVideo?: (video: ChannelVideo) => void;
}) {
  const router = useRouter();

  return (
    <Card
      className={`cursor-pointer hover:shadow-md transition-shadow ${isSelected ? "ring-2 ring-blue-500" : ""}`}
      onClick={onClick}
    >
      <CardContent className="p-4">
        <div className="flex items-start gap-4">
          {/* Thumbnail */}
          <div className="relative flex-shrink-0">
            <Image
              src={video.thumbnail}
              alt={video.title}
              width={160}
              height={96}
              className="w-40 h-24 object-cover rounded-lg"
              unoptimized
            />
            <span className="absolute bottom-1 right-1 bg-black/85 text-white text-xs px-1.5 py-0.5 rounded font-medium">
              {video.duration}
            </span>
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h4 className="font-semibold text-sm line-clamp-2 leading-snug text-gray-900">
                {video.title}
              </h4>
              {video.isShort && (
                <Badge variant="secondary" className="flex-shrink-0 text-xs">Short</Badge>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-3 text-xs text-gray-500 mb-3">
              <span>{formatNumber(video.viewCount)} views</span>
              <span>{formatNumber(video.likeCount)} likes</span>
              <span>{formatNumber(video.commentCount)} comments</span>
              <span>{formatDate(video.publishedAt)}</span>
            </div>

            {/* Performance & Outlier */}
            <div className="flex items-center gap-3">
              <div className="flex-1 max-w-[200px]">
                <div className="flex justify-between text-xs text-gray-500 mb-1">
                  <span>Performance</span>
                  <span>{video.performanceScore}%</span>
                </div>
                <Progress value={video.performanceScore} className="h-1.5" />
              </div>
              <Badge variant="outline" className="text-xs text-orange-600">
                {video.outlierScore}x outlier
              </Badge>
              <Badge variant="outline" className="text-xs">
                {video.hookType}
              </Badge>
              {video.improvementPotential > 40 && (
                <Badge variant="destructive" className="text-xs">
                  +{video.improvementPotential}% potential
                </Badge>
              )}
            </div>
          </div>

          {/* Date column */}
          <div className="text-right flex-shrink-0 text-xs text-gray-400">
            {formatFullDate(video.publishedAt)}
          </div>
        </div>

        {/* Expanded Details */}
        {isSelected && (
          <div className="mt-4 pt-4 border-t space-y-4">
            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <h5 className="font-semibold text-sm text-gray-900 mb-2">Suggestions</h5>
                <ul className="space-y-1.5">
                  {video.suggestions.map((suggestion, index) => (
                    <li key={index} className="flex items-start gap-2 text-sm text-gray-600">
                      <span className="text-blue-500 mt-0.5 flex-shrink-0">•</span>
                      <span>{suggestion}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <h5 className="font-semibold text-sm text-gray-900 mb-2">Quick Stats</h5>
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-gray-50 rounded-lg p-3">
                    <p className="text-xs text-gray-500">Views vs Avg</p>
                    <p className="text-gray-900 font-semibold text-sm">
                      {video.channelAvgViews > 0
                        ? `${Math.round((video.viewCount / video.channelAvgViews) * 100)}%`
                        : "N/A"}
                    </p>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-3">
                    <p className="text-xs text-gray-500">Engagement</p>
                    <p className="text-gray-900 font-semibold text-sm">
                      {video.viewCount > 0
                        ? `${Math.round(((video.likeCount + video.commentCount) / video.viewCount) * 1000) / 10}%`
                        : "0%"}
                    </p>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-3">
                    <p className="text-xs text-gray-500">Type</p>
                    <p className="text-gray-900 font-semibold text-sm">
                      {video.isShort ? "Short" : "Video"}
                    </p>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-3">
                    <p className="text-xs text-gray-500">Tags</p>
                    <p className="text-gray-900 font-semibold text-sm">{video.tags.length}</p>
                  </div>
                </div>
              </div>
            </div>
            <div className="flex gap-3">
              <Button
                variant="outline"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  window.open(`https://youtube.com/watch?v=${video.id}`, "_blank");
                }}
              >
                View on YouTube
              </Button>
              {video.performanceScore >= 70 ? (
                <Button
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    router.push(`/create?videoId=${video.id}&title=${encodeURIComponent(video.title)}`);
                  }}
                >
                  Make Another Like This
                </Button>
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    onFixVideo?.(video);
                  }}
                >
                  Fix This Video
                </Button>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ---- Fix Video Modal ----

interface SeoPackage {
  titles: Array<{ text: string; char_count: number; ctr_rationale?: string }>;
  description: { full_text: string; word_count: number };
  tags: Array<{ tag: string; tier: string }>;
  thumbnail_concepts: Array<{ concept_number: number; text_overlay: string }>;
  chapters: Array<{ timestamp: string; title: string }>;
  pinned_comment: string;
}

function FixVideoModal({
  video,
  isOpen,
  onClose,
}: {
  video: ChannelVideo | null;
  isOpen: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [seoPackage, setSeoPackage] = useState<SeoPackage | null>(null);
  const [activeResultTab, setActiveResultTab] = useState<"titles" | "description" | "tags" | "thumbnails">("titles");

  if (!video) return null;

  async function handleRunSeoAnalysis() {
    if (!video) return;
    setIsAnalyzing(true);

    // Skip transcript fetch to avoid rate limiting — use existing metadata
    const transcriptText = video.description || "";

    setIsAnalyzing(false);
    setIsGenerating(true);

    try {
      const response = await fetch("/api/generate/seo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          videoTitle: video.title,
          videoDescription: video.description || "",
          existingTags: video.tags || [],
          topic: video.title,
          niche: "general",
          primaryKeyword: video.title.split(" ").slice(0, 3).join(" "),
          secondaryKeywords: (video.tags || []).slice(0, 5),
          transcript: transcriptText,
        }),
      });

      const result = await response.json();
      if (!result.success) {
        throw new Error(result.error || "Failed to generate SEO package");
      }

      setSeoPackage(result.data.output);
      toast.success("SEO analysis complete!");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to generate SEO package");
    } finally {
      setIsGenerating(false);
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="w-[700px] max-w-[95vw] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl">Fix This Video</DialogTitle>
          <DialogDescription>
            {video.title}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Thumbnail */}
          <div className="relative">
            <Image
              src={video.thumbnail}
              alt={video.title}
              width={600}
              height={338}
              className="w-full h-48 object-cover rounded-lg"
              unoptimized
            />
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-4">
            <div className="text-center p-3 bg-gray-50 rounded-lg">
              <p className="text-2xl font-bold">{formatNumber(video.viewCount)}</p>
              <p className="text-xs text-gray-600">Views</p>
            </div>
            <div className="text-center p-3 bg-gray-50 rounded-lg">
              <p className="text-2xl font-bold">{video.performanceScore}%</p>
              <p className="text-xs text-gray-600">Performance</p>
            </div>
            <div className="text-center p-3 bg-gray-50 rounded-lg">
              <p className="text-2xl font-bold text-orange-600">+{video.improvementPotential}%</p>
              <p className="text-xs text-gray-600">Potential</p>
            </div>
          </div>

          {/* Suggestions */}
          <div>
            <h5 className="font-semibold text-sm text-gray-900 mb-2">Suggestions</h5>
            <ul className="space-y-2">
              {video.suggestions.map((suggestion, index) => (
                <li key={index} className="flex items-start gap-2 text-sm text-gray-600">
                  <span className="text-blue-500 mt-0.5 flex-shrink-0">•</span>
                  <span>{suggestion}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Actions */}
          <div className="flex flex-col gap-3 pt-4 border-t">
            {!seoPackage && !isAnalyzing && !isGenerating && (
              <Button
                className="w-full"
                onClick={handleRunSeoAnalysis}
              >
                Run SEO Analysis
              </Button>
            )}

            {(isAnalyzing || isGenerating) && (
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-gray-900" />
                  <span className="text-sm text-gray-600">
                    {isAnalyzing ? "Analyzing video metadata..." : "Generating SEO package..."}
                  </span>
                </div>
                <Skeleton className="h-8 w-full" />
                <Skeleton className="h-8 w-5/6" />
                <Skeleton className="h-8 w-4/6" />
              </div>
            )}

            {seoPackage && (
              <div className="space-y-4">
                <div className="flex gap-2">
                  {(["titles", "description", "tags", "thumbnails"] as const).map((tab) => (
                    <button
                      key={tab}
                      onClick={() => setActiveResultTab(tab)}
                      className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                        activeResultTab === tab
                          ? "bg-blue-100 text-blue-700"
                          : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                      }`}
                    >
                      {tab.charAt(0).toUpperCase() + tab.slice(1)}
                    </button>
                  ))}
                </div>

                <div className="border rounded-lg p-4 space-y-3">
                  {activeResultTab === "titles" && (
                    <div className="space-y-2">
                      <h5 className="font-semibold text-sm">Suggested Titles</h5>
                      {seoPackage.titles.slice(0, 3).map((title, i) => (
                        <div key={i} className="flex items-start gap-2 text-sm">
                          <span className="text-gray-400 mt-0.5">{i + 1}.</span>
                          <div>
                            <p className="font-medium">{title.text}</p>
                            <p className="text-xs text-gray-500">{title.char_count} chars</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {activeResultTab === "description" && (
                    <div className="space-y-2">
                      <h5 className="font-semibold text-sm">Optimized Description</h5>
                      <p className="text-sm text-gray-600 whitespace-pre-wrap">{seoPackage.description.full_text}</p>
                      <p className="text-xs text-gray-500">{seoPackage.description.word_count} words</p>
                    </div>
                  )}

                  {activeResultTab === "tags" && (
                    <div className="space-y-2">
                      <h5 className="font-semibold text-sm">Recommended Tags</h5>
                      <div className="flex flex-wrap gap-2">
                        {seoPackage.tags.slice(0, 10).map((tag, i) => (
                          <Badge key={i} variant="outline" className="text-xs">
                            {tag.tag}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}

                  {activeResultTab === "thumbnails" && (
                    <div className="space-y-2">
                      <h5 className="font-semibold text-sm">Thumbnail Concepts</h5>
                      {seoPackage.thumbnail_concepts.slice(0, 3).map((concept, i) => (
                        <div key={i} className="text-sm">
                          <p className="font-medium">Concept {concept.concept_number}</p>
                          <p className="text-gray-600">{concept.text_overlay}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => {
                    // Expand modal to full screen instead of navigating away
                    const dialogContent = document.querySelector('[role="dialog"] > div');
                    if (dialogContent) {
                      dialogContent.classList.add('fixed', 'inset-4', 'z-50', 'max-w-none', 'w-auto', 'h-auto', 'max-h-none');
                    }
                  }}
                >
                  Expand Full Screen
                </Button>
              </div>
            )}

            <Button
              variant="outline"
              className="w-full"
              onClick={() => {
                onClose();
                router.push(`/create/script?videoId=${video.id}&title=${encodeURIComponent(video.title)}&description=${encodeURIComponent(video.description || "")}`);
              }}
            >
              Generate New Script
            </Button>
            <Button
              variant="outline"
              className="w-full"
              onClick={() => {
                onClose();
                router.push(`/create/social?videoId=${video.id}&title=${encodeURIComponent(video.title)}&description=${encodeURIComponent(video.description || "")}`);
              }}
            >
              Create Social Posts
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function VideoList({
  videos,
  stats,
  channelName,
  channelThumbnail,
  selectedVideo,
  setSelectedVideo,
  filter,
  setFilter,
}: {
  videos: ChannelVideo[];
  stats: ChannelStats;
  channelName: string;
  channelThumbnail: string;
  selectedVideo: ChannelVideo | null;
  setSelectedVideo: (video: ChannelVideo | null) => void;
  filter: ContentFilter;
  setFilter: (filter: ContentFilter) => void;
}) {
  const [fixModalVideo, setFixModalVideo] = useState<ChannelVideo | null>(null);
  const [isFixModalOpen, setIsFixModalOpen] = useState(false);

  const filteredVideos = useMemo(() => {
    if (filter === "shorts") return videos.filter((v) => v.isShort);
    if (filter === "videos") return videos.filter((v) => !v.isShort);
    return videos;
  }, [videos, filter]);

  const topVideos = useMemo(() => {
    return [...videos].sort((a, b) => b.performanceScore - a.performanceScore).slice(0, 3);
  }, [videos]);

  const lowVideos = useMemo(() => {
    return [...videos].sort((a, b) => a.performanceScore - b.performanceScore).slice(0, 3);
  }, [videos]);

  return (
    <div className="space-y-6">
      {/* Channel Header */}
      <div className="flex items-center gap-5">
        {channelThumbnail && (
          <Image
            src={channelThumbnail}
            alt={channelName}
            width={64}
            height={64}
            className="w-16 h-16 rounded-full object-cover ring-2 ring-gray-200"
            unoptimized
          />
        )}
        <div>
          <h2 className="text-xl font-bold text-gray-900">{channelName}</h2>
          <p className="text-gray-500 text-sm">
            {formatNumber(stats.totalViews)} views · {stats.totalVideos} total uploads
          </p>
        </div>
      </div>

      {/* Health Score */}
      <HealthScoreCard score={stats.healthScore} />

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Videos" value={String(stats.videoCount)} sub={`${stats.shortCount} Shorts`} />
        <StatCard label="Avg. Views" value={formatNumber(stats.avgViews)} />
        <StatCard label="Engagement" value={`${stats.engagementRate}%`} />
        <StatCard label="Avg. Score" value={`${stats.avgPerformance}/100`} />
      </div>

      {/* Insights Panel */}
      <InsightsPanel insights={stats.insights} />

      {/* Top Performing Videos */}
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-3">Top Performing Videos</h3>
        <div className="space-y-3">
          {topVideos.map((video) => (
            <VideoCard
              key={video.id}
              video={video}
              isSelected={selectedVideo?.id === video.id}
              onClick={() => setSelectedVideo(selectedVideo?.id === video.id ? null : video)}
              onFixVideo={(v) => {
                setFixModalVideo(v);
                setIsFixModalOpen(true);
              }}
            />
          ))}
        </div>
      </div>

      {/* Highest Improvement Potential */}
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-3">Highest Improvement Potential</h3>
        <div className="space-y-3">
          {lowVideos.map((video) => (
            <VideoCard
              key={video.id}
              video={video}
              isSelected={selectedVideo?.id === video.id}
              onClick={() => setSelectedVideo(selectedVideo?.id === video.id ? null : video)}
              onFixVideo={(v) => {
                setFixModalVideo(v);
                setIsFixModalOpen(true);
              }}
            />
          ))}
        </div>
      </div>

      {/* All Videos */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-semibold text-gray-900">All Videos</h3>
          <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
            {([
              ["all", "All"],
              ["videos", "Videos"],
              ["shorts", "Shorts"],
            ] as [ContentFilter, string][]).map(([key, label]) => (
              <button
                key={key}
                onClick={() => setFilter(key)}
                className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  filter === key
                    ? "bg-white text-gray-900 shadow-sm"
                    : "text-gray-500 hover:text-gray-700"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        <p className="text-sm text-gray-500 mb-3">{filteredVideos.length} items</p>
        <div className="space-y-3">
          {filteredVideos.map((video) => (
            <VideoCard
              key={video.id}
              video={video}
              isSelected={selectedVideo?.id === video.id}
              onClick={() => setSelectedVideo(selectedVideo?.id === video.id ? null : video)}
              onFixVideo={(v) => {
                setFixModalVideo(v);
                setIsFixModalOpen(true);
              }}
            />
          ))}
          {filteredVideos.length === 0 && (
            <div className="text-center py-12 text-gray-500">No {filter} found</div>
          )}
        </div>
      </div>

      <FixVideoModal
        video={fixModalVideo}
        isOpen={isFixModalOpen}
        onClose={() => {
          setIsFixModalOpen(false);
          setFixModalVideo(null);
        }}
      />
    </div>
  );
}

// ---- Main Page Component ----

function ChannelAnalyzerContent() {
  const { isAuthenticated } = useAuth();
  const { channel: connectedChannel, isConnecting, isConnected, connectChannel, disconnectChannel, refreshChannel } = useConnectChannel();

  const [activeTab, setActiveTab] = useState("my-channel");
  const [channelUrl, setChannelUrl] = useState("");
  const [channelName, setChannelName] = useState("");
  const [channelThumbnail, setChannelThumbnail] = useState("");
  const [videos, setVideos] = useState<ChannelVideo[]>([]);
  const [stats, setStats] = useState<ChannelStats | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedVideo, setSelectedVideo] = useState<ChannelVideo | null>(null);
  const [filter, setFilter] = useState<ContentFilter>("all");

  const [myChannelName, setMyChannelName] = useState("");
  const [myChannelThumbnail, setMyChannelThumbnail] = useState("");
  const [myChannelVideos, setMyChannelVideos] = useState<ChannelVideo[]>([]);
  const [myChannelStats, setMyChannelStats] = useState<ChannelStats | null>(null);
  const [isMyChannelLoading, setIsMyChannelLoading] = useState(false);
  const [myChannelSelectedVideo, setMyChannelSelectedVideo] = useState<ChannelVideo | null>(null);
  const [myChannelFilter, setMyChannelFilter] = useState<ContentFilter>("all");

  async function handleAnalyzeChannel() {
    const channelId = extractChannelId(channelUrl);
    if (!channelId) {
      toast.error("Please enter a valid YouTube channel URL");
      return;
    }

    setIsLoading(true);
    setVideos([]);
    setStats(null);
    setSelectedVideo(null);
    setFilter("all");

    try {
      const result = await analyzeChannelById(channelId);
      setChannelName(result.channelName);
      setChannelThumbnail(result.channelThumbnail);
      setVideos(result.videos);
      setStats(result.stats);
      toast.success("Channel analyzed!");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to analyze channel");
    } finally {
      setIsLoading(false);
    }
  }

  const loadMyChannel = useCallback(async () => {
    if (!connectedChannel?.channelId) return;

    setIsMyChannelLoading(true);
    setMyChannelVideos([]);
    setMyChannelStats(null);
    setMyChannelSelectedVideo(null);
    setMyChannelFilter("all");

    try {
      const result = await analyzeChannelById(connectedChannel.channelId);
      setMyChannelName(result.channelName);
      setMyChannelThumbnail(result.channelThumbnail);
      setMyChannelVideos(result.videos);
      setMyChannelStats(result.stats);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to load your channel");
    } finally {
      setIsMyChannelLoading(false);
    }
  }, [connectedChannel]);

  useEffect(() => {
    if (isConnected && connectedChannel?.channelId) {
      loadMyChannel();
    }
  }, [isConnected, connectedChannel, loadMyChannel]);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-1">Channel Analytics</h1>
          <p className="text-gray-500 text-sm">YouTube Studio-style performance insights</p>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="mb-8">
            <TabsTrigger value="my-channel">My Channel</TabsTrigger>
            <TabsTrigger value="analyze">Any Channel</TabsTrigger>
          </TabsList>

          <TabsContent value="my-channel" className="space-y-6 mt-0">
            {!isAuthenticated ? (
              <Card>
                <CardContent className="p-12 text-center">
                  <p className="text-gray-600 text-lg mb-2">Sign in to connect your channel</p>
                  <p className="text-gray-500 text-sm mb-6">Link your YouTube channel to get personalized analytics</p>
                  <Link href="/auth/login">
                    <Button>Sign In</Button>
                  </Link>
                </CardContent>
              </Card>
            ) : !isConnected ? (
              <Card>
                <CardContent className="p-12 text-center space-y-4">
                  <p className="text-gray-600 text-lg">Connect Your YouTube Channel</p>
                  <p className="text-gray-500 text-sm">Get real-time analytics, video performance scores, and optimization tips</p>
                  <Button onClick={connectChannel} disabled={isConnecting}>
                    {isConnecting ? "Connecting..." : "Connect My Channel"}
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-6">
                {/* Connected Channel Header */}
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        {connectedChannel?.thumbnail && (
                          <Image
                            src={connectedChannel.thumbnail}
                            alt={connectedChannel.title}
                            width={48}
                            height={48}
                            className="w-12 h-12 rounded-full object-cover ring-2 ring-gray-200"
                            unoptimized
                          />
                        )}
                        <div>
                          <h3 className="font-semibold text-gray-900">{connectedChannel?.title}</h3>
                          <p className="text-sm text-gray-500">
                            {formatNumber(connectedChannel?.subscriberCount || 0)} subscribers · {connectedChannel?.videoCount || 0} videos
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={async () => {
                            await refreshChannel();
                            await loadMyChannel();
                            toast.success("Channel data refreshed");
                          }}
                          disabled={isMyChannelLoading}
                        >
                          {isMyChannelLoading ? "Refreshing..." : "Refresh"}
                        </Button>
                        <Button variant="outline" size="sm" onClick={disconnectChannel}>
                          Disconnect
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {isMyChannelLoading && (
                  <div className="space-y-6">
                    <Skeleton className="h-32 w-full" />
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      {Array.from({ length: 4 }).map((_, i) => (
                        <Skeleton key={i} className="h-24 w-full" />
                      ))}
                    </div>
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Skeleton key={i} className="h-28 w-full" />
                    ))}
                  </div>
                )}

                {myChannelStats && (
                  <VideoList
                    videos={myChannelVideos}
                    stats={myChannelStats}
                    channelName={myChannelName}
                    channelThumbnail={myChannelThumbnail}
                    selectedVideo={myChannelSelectedVideo}
                    setSelectedVideo={setMyChannelSelectedVideo}
                    filter={myChannelFilter}
                    setFilter={setMyChannelFilter}
                  />
                )}
              </div>
            )}
          </TabsContent>

          <TabsContent value="analyze" className="space-y-6 mt-0">
            <Card>
              <CardContent className="p-4">
                <div className="flex gap-3">
                  <Input
                    placeholder="Paste YouTube channel URL (e.g., @MrBeast)..."
                    value={channelUrl}
                    onChange={(e) => setChannelUrl(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleAnalyzeChannel()}
                    className="flex-1"
                  />
                  <Button onClick={handleAnalyzeChannel} disabled={isLoading}>
                    {isLoading ? "Analyzing..." : "Analyze"}
                  </Button>
                </div>
              </CardContent>
            </Card>

            {isLoading && (
              <div className="space-y-6">
                <Skeleton className="h-32 w-full" />
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <Skeleton key={i} className="h-24 w-full" />
                  ))}
                </div>
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="h-28 w-full" />
                ))}
              </div>
            )}

            {stats && (
              <VideoList
                videos={videos}
                stats={stats}
                channelName={channelName}
                channelThumbnail={channelThumbnail}
                selectedVideo={selectedVideo}
                setSelectedVideo={setSelectedVideo}
                filter={filter}
                setFilter={setFilter}
              />
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

export default function ChannelAnalyzerPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <p className="text-gray-400">Loading...</p>
    </div>}>
      <ChannelAnalyzerContent />
    </Suspense>
  );
}
