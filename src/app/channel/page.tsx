"use client";

import { useState, Suspense, useCallback, useEffect, useMemo, useRef } from "react";
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
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { parseDuration, formatDuration } from "@/lib/youtube";
import { YouTubeVideo } from "@/types/video";
import { useAuth } from "@/hooks/useAuth";
import { useConnectChannel } from "@/hooks/useConnectChannel";
import Link from "next/link";
import Image from "next/image";
import {
  calculateOutlierScore,
  estimateHookType,
  calculatePerformanceScore,
  calculateImprovementPotential,
  calculateHealthScore,
  isShortVideo,
} from "@/lib/outlier";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
} from "recharts";

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
  viewsPerDay: number;
}

interface ChannelInsights {
  bestTopic: string;
  bestTopicAvgOutlier: number;
  bestLength: string;
  bestDay: string;
  bestHook: string;
  hookPerformance: Record<string, number>;
  dayPerformance: Record<string, number>;
  lengthPerformance: Record<string, number>;
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
  healthBreakdown: { avgPerf: number; consistency: number; topRatio: number };
  insights: ChannelInsights;
}

// ---- Helpers ----

function generateSuggestions(video: ChannelVideo, topVideos: ChannelVideo[]): string[] {
  const suggestions: string[] = [];
  const titleLower = video.title.toLowerCase();
  const descLower = (video.description || "").toLowerCase();

  const topTitles = topVideos.slice(0, 5).map((v) => v.title.toLowerCase());
  const topHooks = topVideos.map((v) => v.hookType);
  const hookScores: Record<string, number> = {};
  topVideos.forEach((v) => {
    hookScores[v.hookType] = (hookScores[v.hookType] || 0) + v.outlierScore;
  });
  const bestHook = Object.entries(hookScores).sort((a, b) => b[1] - a[1])[0]?.[0] || "Pattern Interrupt";

  if (video.isShort) {
    if (video.title.length < 10) {
      suggestions.push("Short titles work best when punchy but descriptive. Add a hook.");
    }
    if (!video.description || video.description.length < 30) {
      suggestions.push("Add hashtags in the description to boost Shorts discoverability.");
    }
  } else {
    if (video.title.length < 30) {
      const avgTitleLen = Math.round(topVideos.reduce((s, v) => s + v.title.length, 0) / topVideos.length);
      suggestions.push(`Title is too short (${video.title.length} chars). Top performers average ${avgTitleLen} chars.`);
    }
    if (video.title.length > 60) {
      suggestions.push("Title may be truncated in search results. Keep under 60 characters.");
    }
    if (!video.description || video.description.length < 100) {
      suggestions.push("Description is too short. Aim for 200+ words with timestamps and links.");
    }
    if (video.tags.length < 5) {
      const avgTags = Math.round(topVideos.reduce((s, v) => s + v.tags.length, 0) / topVideos.length);
      suggestions.push(`Add more relevant tags (aim for 10-15). Top performers use an average of ${avgTags} tags.`);
    }
  }

  if (video.hookType !== bestHook && video.outlierScore < 1.2) {
    suggestions.push(`Your hook type is "${video.hookType}" but your top videos use "${bestHook}". Consider testing ${bestHook.toLowerCase()} openings.`);
  }

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

  if (!video.isShort && video.description) {
    const titleWords = video.title.toLowerCase().split(/\s+/).filter((w) => w.length > 3);
    const missingInDesc = titleWords.filter((w) => !descLower.includes(w));
    if (missingInDesc.length > 0) {
      suggestions.push(`Description missing keywords from title: "${missingInDesc.slice(0, 3).join(", ")}". Include these for better SEO.`);
    }
  }

  if (video.performanceScore < 50) {
    suggestions.push("Consider updating the thumbnail with a more engaging visual (high contrast, clear face, or bold text).");
  }
  if (video.viewCount < video.channelAvgViews * 0.5) {
    suggestions.push("Hook needs work. First 30 seconds are critical — consider a stronger pattern interrupt or curiosity gap.");
  }
  if (video.outlierScore < 0.8 && video.durationSeconds > 600) {
    suggestions.push("This video is underperforming for its length. Consider cutting to 8-10 minutes or adding more value per minute.");
  }

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
    return { bestTopic: "N/A", bestTopicAvgOutlier: 0, bestLength: "N/A", bestDay: "N/A", bestHook: "N/A", hookPerformance: {}, dayPerformance: {}, lengthPerformance: {} };
  }

  const hookScores: Record<string, number[]> = {};
  videos.forEach((v) => {
    if (!hookScores[v.hookType]) hookScores[v.hookType] = [];
    hookScores[v.hookType].push(v.outlierScore);
  });
  const hookPerformance: Record<string, number> = {};
  Object.entries(hookScores).forEach(([hook, scores]) => {
    hookPerformance[hook] = Math.round((scores.reduce((s, v) => s + v, 0) / scores.length) * 10) / 10;
  });
  const bestHook = Object.entries(hookPerformance).sort((a, b) => b[1] - a[1])[0]?.[0] || "N/A";

  const lengthBuckets: Record<string, number[]> = {};
  videos.forEach((v) => {
    const bucket = v.durationSeconds < 300 ? "Under 5 min" :
      v.durationSeconds < 600 ? "5–10 min" :
      v.durationSeconds < 900 ? "10–15 min" :
      v.durationSeconds < 1200 ? "15–20 min" : "20+ min";
    if (!lengthBuckets[bucket]) lengthBuckets[bucket] = [];
    lengthBuckets[bucket].push(v.outlierScore);
  });
  const lengthPerformance: Record<string, number> = {};
  Object.entries(lengthBuckets).forEach(([bucket, scores]) => {
    lengthPerformance[bucket] = Math.round((scores.reduce((s, v) => s + v, 0) / scores.length) * 10) / 10;
  });
  const bestLength = Object.entries(lengthPerformance).sort((a, b) => b[1] - a[1])[0]?.[0] || "N/A";

  const dayCounts: Record<string, number[]> = {};
  const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  videos.forEach((v) => {
    const day = days[new Date(v.publishedAt).getDay()];
    if (!dayCounts[day]) dayCounts[day] = [];
    dayCounts[day].push(v.outlierScore);
  });
  const dayPerformance: Record<string, number> = {};
  Object.entries(dayCounts).forEach(([day, scores]) => {
    dayPerformance[day] = Math.round((scores.reduce((s, v) => s + v, 0) / scores.length) * 10) / 10;
  });
  const bestDay = Object.entries(dayPerformance).sort((a, b) => b[1] - a[1])[0]?.[0] || "N/A";

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

  return { bestTopic, bestTopicAvgOutlier, bestLength, bestDay, bestHook, hookPerformance, dayPerformance, lengthPerformance };
}

// ---- UI Helpers ----

function extractChannelId(url: string): string | null {
  // If it's already a channel ID (starts with UC)
  if (/^UC[a-zA-Z0-9_-]{22}$/.test(url)) {
    return url;
  }

  // Handle full URLs
  const patterns = [
    /youtube\.com\/(?:c\/|channel\/|@)([a-zA-Z0-9_-]+)/,
    /youtube\.com\/(?:user\/)?([a-zA-Z0-9_-]+)/,
  ];
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }

  // Handle bare handles like @MrBeast or channel names
  if (/^[a-zA-Z0-9_-]+$/.test(url) && url.length > 0) {
    return url;
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

function exportToCSV(videos: ChannelVideo[], channelName: string) {
  const headers = ["Title", "Views", "Likes", "Comments", "Duration", "Published", "Performance Score", "Outlier Score", "Hook Type", "Improvement Potential", "Tags"];
  const rows = videos.map((v) => [
    `"${v.title.replace(/"/g, '""')}"`,
    v.viewCount,
    v.likeCount,
    v.commentCount,
    v.duration,
    v.publishedAt,
    v.performanceScore,
    v.outlierScore,
    v.hookType,
    v.improvementPotential,
    `"${v.tags.join(", ")}"`,
  ]);
  const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${channelName.replace(/\s+/g, "_")}_analytics.csv`;
  a.click();
  URL.revokeObjectURL(url);
  toast.success("Exported to CSV");
}

// ---- Components ----

type ContentFilter = "all" | "videos" | "shorts";
type SortOption = "newest" | "mostViews" | "bestPerformance" | "highestPotential" | "viewsPerDay";

function StatCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="text-center p-4 bg-gray-50 rounded-xl border border-gray-100">
      <p className="text-2xl font-bold text-gray-900">{value}</p>
      <p className="text-sm text-gray-500">{label}</p>
      {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
    </div>
  );
}

function HealthScoreCard({ score, breakdown }: { score: number; breakdown: { avgPerf: number; consistency: number; topRatio: number } }) {
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
        <div className="mt-4 grid grid-cols-3 gap-2 text-center">
          <div className="bg-white/60 rounded-lg p-2">
            <p className="text-xs text-gray-500">Avg Performance</p>
            <p className="text-sm font-semibold text-gray-900">{breakdown.avgPerf}%</p>
          </div>
          <div className="bg-white/60 rounded-lg p-2">
            <p className="text-xs text-gray-500">Consistency</p>
            <p className="text-sm font-semibold text-gray-900">{breakdown.consistency}%</p>
          </div>
          <div className="bg-white/60 rounded-lg p-2">
            <p className="text-xs text-gray-500">Top Performers</p>
            <p className="text-sm font-semibold text-gray-900">{breakdown.topRatio}%</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function InsightsCharts({ insights }: { insights: ChannelInsights }) {
  const hookData = Object.entries(insights.hookPerformance).map(([name, value]) => ({ name, value }));
  const dayData = Object.entries(insights.dayPerformance).map(([name, value]) => ({ name: name.slice(0, 3), value }));
  const lengthData = Object.entries(insights.lengthPerformance).map(([name, value]) => ({ name, value }));

  return (
    <div className="grid md:grid-cols-3 gap-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Hook Performance</CardTitle>
          <p className="text-xs text-gray-500">Avg outlier score by hook type. Higher = performs better vs channel average.</p>
        </CardHeader>
        <CardContent>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%" minWidth={200} minHeight={192}>
              <BarChart data={hookData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} label={{ value: "Outlier Score", angle: -90, position: "insideLeft", style: { fontSize: 10, fill: "#6b7280" } }} />
                <Tooltip formatter={(value) => [`${value}x avg views`, "Outlier Score"]} />
                <Bar dataKey="value" fill="#3b82f6" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Upload Day Performance</CardTitle>
          <p className="text-xs text-gray-500">Avg outlier score by upload day. Higher = better performance on that day.</p>
        </CardHeader>
        <CardContent>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%" minWidth={200} minHeight={192}>
              <BarChart data={dayData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} label={{ value: "Outlier Score", angle: -90, position: "insideLeft", style: { fontSize: 10, fill: "#6b7280" } }} />
                <Tooltip formatter={(value) => [`${value}x avg views`, "Outlier Score"]} />
                <Bar dataKey="value" fill="#10b981" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Duration Performance</CardTitle>
          <p className="text-xs text-gray-500">Avg outlier score by video length. Higher = better performance for that duration.</p>
        </CardHeader>
        <CardContent>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%" minWidth={200} minHeight={192}>
              <BarChart data={lengthData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} label={{ value: "Outlier Score", angle: -90, position: "insideLeft", style: { fontSize: 10, fill: "#6b7280" } }} />
                <Tooltip formatter={(value) => [`${value}x avg views`, "Outlier Score"]} />
                <Bar dataKey="value" fill="#f59e0b" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function ViewsOverTimeChart({ videos }: { videos: ChannelVideo[] }) {
  const data = useMemo(() => {
    return [...videos]
      .sort((a, b) => new Date(a.publishedAt).getTime() - new Date(b.publishedAt).getTime())
      .map((v) => ({
        date: new Date(v.publishedAt).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
        views: v.viewCount,
        performance: v.performanceScore,
      }));
  }, [videos]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">Views Over Time</CardTitle>
        <p className="text-xs text-gray-500">Total view count for each video by publish date.</p>
      </CardHeader>
      <CardContent>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%" minWidth={300} minHeight={256}>
            <LineChart data={data}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => formatNumber(v)} />
              <Tooltip formatter={(value) => formatNumber(Number(value))} />
              <Line type="monotone" dataKey="views" stroke="#3b82f6" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}

function PerformanceDistributionChart({ videos }: { videos: ChannelVideo[] }) {
  const data = useMemo(() => {
    const buckets: Record<string, number> = { "0-20": 0, "21-40": 0, "41-60": 0, "61-80": 0, "81-100": 0 };
    videos.forEach((v) => {
      if (v.performanceScore <= 20) buckets["0-20"]++;
      else if (v.performanceScore <= 40) buckets["21-40"]++;
      else if (v.performanceScore <= 60) buckets["41-60"]++;
      else if (v.performanceScore <= 80) buckets["61-80"]++;
      else buckets["81-100"]++;
    });
    return Object.entries(buckets).map(([name, value]) => ({ name, value }));
  }, [videos]);

  const COLORS = ["#ef4444", "#f97316", "#f59e0b", "#84cc16", "#22c55e"];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">Performance Distribution</CardTitle>
        <p className="text-xs text-gray-500">How videos are spread across performance tiers. Green = top performers.</p>
      </CardHeader>
      <CardContent>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%" minWidth={300} minHeight={256}>
            <PieChart>
              <Pie data={data} cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value" nameKey="name">
                {data.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip formatter={(value, name) => [`${value} videos`, `${name} Performance`]} />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div className="flex flex-wrap justify-center gap-x-4 gap-y-1 mt-2">
          {data.map((entry, index) => (
            <div key={entry.name} className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length] }} />
              <span className="text-xs text-gray-600">{entry.name} ({entry.value})</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function VideoCard({
  video,
  onClick,
  onFixVideo,
  isCompareMode,
  isInCompareSelection,
  onToggleCompare,
}: {
  video: ChannelVideo;
  onClick: () => void;
  onFixVideo?: (video: ChannelVideo) => void;
  isCompareMode?: boolean;
  isInCompareSelection?: boolean;
  onToggleCompare?: (id: string) => void;
}) {
  const router = useRouter();

  return (
    <Card
      className="cursor-pointer hover:shadow-md transition-shadow"
      onClick={onClick}
    >
      <CardContent className="p-3">
        {/* Thumbnail */}
        <div className="relative mb-3 w-full h-36">
          <Image
            src={video.thumbnail}
            alt={video.title}
            width={320}
            height={180}
            className="object-cover rounded-lg w-full h-36"
            unoptimized
          />
          <span className="absolute bottom-2 right-2 bg-black/85 text-white text-xs px-1.5 py-0.5 rounded font-medium">
            {video.duration}
          </span>
          {video.isShort && (
            <Badge variant="secondary" className="absolute top-2 left-2 text-xs">Short</Badge>
          )}
          {isCompareMode && (
            <div className="absolute top-2 right-2" onClick={(e) => { e.stopPropagation(); onToggleCompare?.(video.id); }}>
              <div className={`w-5 h-5 rounded border-2 flex items-center justify-center cursor-pointer ${isInCompareSelection ? "bg-blue-500 border-blue-500" : "bg-white/90 border-white"}`}>
                {isInCompareSelection && <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
              </div>
            </div>
          )}
        </div>

        {/* Title */}
        <h4 className="font-semibold text-sm line-clamp-2 leading-snug text-gray-900 mb-2">
          {video.title}
        </h4>

        {/* Stats row */}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-500 mb-2">
          <span>{formatNumber(video.viewCount)} views</span>
          <span>{formatDate(video.publishedAt)}</span>
        </div>

        {/* Performance bar */}
        <div className="mb-2">
          <div className="flex justify-between text-xs text-gray-500 mb-1">
            <span>Performance</span>
            <span>{video.performanceScore}%</span>
          </div>
          <Progress value={video.performanceScore} className="h-1.5" />
        </div>

        {/* Badges */}
        <div className="flex flex-wrap gap-1.5">
          {video.outlierScore > 1.5 && (
            <Badge variant="outline" className="text-xs text-green-600 border-green-200">
              {video.outlierScore}x outlier
            </Badge>
          )}
          {video.outlierScore < 0.5 && video.outlierScore > 0 && (
            <Badge variant="outline" className="text-xs text-red-600 border-red-200">
              {video.outlierScore}x below avg
            </Badge>
          )}
          <Badge variant="outline" className="text-xs">
            {video.hookType}
          </Badge>
          {video.improvementPotential > 40 && (
            <Badge variant="destructive" className="text-xs">
              +{video.improvementPotential}%
            </Badge>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function VideoTable({
  videos,
  selectedVideo,
  setSelectedVideo,
  onFixVideo,
  isCompareMode,
  compareSelection,
  onToggleCompare,
}: {
  videos: ChannelVideo[];
  selectedVideo: ChannelVideo | null;
  setSelectedVideo: (video: ChannelVideo | null) => void;
  onFixVideo?: (video: ChannelVideo) => void;
  isCompareMode?: boolean;
  compareSelection?: Set<string>;
  onToggleCompare?: (id: string) => void;
}) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      {videos.map((video) => (
        <VideoCard
          key={video.id}
          video={video}
          onClick={() => setSelectedVideo(video)}
          onFixVideo={onFixVideo}
          isCompareMode={isCompareMode}
          isInCompareSelection={compareSelection?.has(video.id)}
          onToggleCompare={onToggleCompare}
        />
      ))}
      {videos.length === 0 && <div className="text-center py-12 text-gray-500 col-span-full">No videos found</div>}
    </div>
  );
}

function VideoDetailModal({
  video,
  isOpen,
  onClose,
  onFixVideo,
  channelStats,
}: {
  video: ChannelVideo | null;
  isOpen: boolean;
  onClose: () => void;
  onFixVideo?: (video: ChannelVideo) => void;
  channelStats?: ChannelStats | null;
}) {
  const router = useRouter();

  if (!video) return null;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="w-[700px] max-w-[95vw] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl">{video.title}</DialogTitle>
          <DialogDescription>
            {video.channelTitle} • {formatDate(video.publishedAt)}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          <div className="relative w-full h-52">
            <Image
              src={video.thumbnail}
              alt={video.title}
              width={640}
              height={360}
              className="object-cover rounded-lg w-full h-52"
              unoptimized
            />
            <span className="absolute bottom-2 right-2 bg-black/85 text-white text-xs px-2 py-1 rounded font-medium">
              {video.duration}
            </span>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-4 gap-3">
            <div className="text-center p-3 bg-gray-50 rounded-lg">
              <p className="text-lg font-bold">{formatNumber(video.viewCount)}</p>
              <p className="text-xs text-gray-600">Views</p>
            </div>
            <div className="text-center p-3 bg-gray-50 rounded-lg">
              <p className="text-lg font-bold">{video.performanceScore}%</p>
              <p className="text-xs text-gray-600">Performance</p>
            </div>
            <div className="text-center p-3 bg-gray-50 rounded-lg">
              <p className="text-lg font-bold">{video.outlierScore}x</p>
              <p className="text-xs text-gray-600">Outlier</p>
            </div>
            <div className="text-center p-3 bg-gray-50 rounded-lg">
              <p className="text-lg font-bold text-orange-600">+{video.improvementPotential}%</p>
              <p className="text-xs text-gray-600">Potential</p>
            </div>
          </div>

          {/* Channel Context Stats */}
          {channelStats && (
            <div className="p-4 bg-blue-50 rounded-lg border border-blue-100">
              <h4 className="text-sm font-semibold text-blue-900 mb-2">Channel Context</h4>
              <div className="grid grid-cols-3 gap-3 text-sm">
                <div className="text-center">
                  <p className="font-bold text-blue-900">{formatNumber(channelStats.avgViews)}</p>
                  <p className="text-xs text-blue-700">Avg Views</p>
                </div>
                <div className="text-center">
                  <p className="font-bold text-blue-900">{channelStats.avgPerformance}%</p>
                  <p className="text-xs text-blue-700">Avg Performance</p>
                </div>
                <div className="text-center">
                  <p className="font-bold text-blue-900">{channelStats.healthScore}</p>
                  <p className="text-xs text-blue-700">Health Score</p>
                </div>
              </div>
            </div>
          )}

          {/* Video Details */}
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="flex justify-between border-b pb-2">
              <span className="text-gray-500">Views/Day</span>
              <span className="font-medium">{video.viewsPerDay > 0 ? formatNumber(video.viewsPerDay) : "Just published"}</span>
            </div>
            <div className="flex justify-between border-b pb-2">
              <span className="text-gray-500">Duration</span>
              <span className="font-medium">{video.duration}</span>
            </div>
            <div className="flex justify-between border-b pb-2">
              <span className="text-gray-500">Hook Type</span>
              <span className="font-medium">{video.hookType}</span>
            </div>
            <div className="flex justify-between border-b pb-2">
              <span className="text-gray-500">Tags</span>
              <span className="font-medium">{video.tags.length}</span>
            </div>
          </div>

          {/* Suggestions */}
          <div>
            <h5 className="font-semibold text-sm text-gray-900 mb-2">Suggestions to Improve</h5>
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
          <div className="flex gap-2 pt-2">
            <Button variant="outline" size="sm" className="flex-1 text-xs" onClick={() => window.open(`https://youtube.com/watch?v=${video.id}`, "_blank")}>
              View on YouTube
            </Button>
            <Button
              size="sm"
              className="flex-1 text-xs bg-blue-600 hover:bg-blue-700"
              onClick={() => router.push(`/optimize?videoId=${video.id}&title=${encodeURIComponent(video.title)}`)}>
              Optimize
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function CompareModal({
  videos,
  isOpen,
  onClose,
}: {
  videos: ChannelVideo[];
  isOpen: boolean;
  onClose: () => void;
}) {
  if (videos.length < 2) return null;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="w-[900px] max-w-[95vw] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl">Compare Videos</DialogTitle>
          <DialogDescription>Side-by-side comparison of selected videos</DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {videos.map((video) => (
            <div key={video.id} className="space-y-3 border rounded-lg p-4">
              <Image src={video.thumbnail} alt={video.title} width={300} height={180} className="w-full h-32 object-cover rounded-lg" unoptimized />
              <h4 className="font-semibold text-sm line-clamp-2">{video.title}</h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between"><span className="text-gray-500">Views</span><span className="font-medium">{formatNumber(video.viewCount)}</span></div>
                <div className="flex justify-between"><span className="text-gray-500">Performance</span><span className="font-medium">{video.performanceScore}%</span></div>
                <div className="flex justify-between"><span className="text-gray-500">Outlier</span><span className="font-medium">{video.outlierScore}x</span></div>
                <div className="flex justify-between"><span className="text-gray-500">Hook</span><span className="font-medium">{video.hookType}</span></div>
                <div className="flex justify-between"><span className="text-gray-500">Duration</span><span className="font-medium">{video.duration}</span></div>
                <div className="flex justify-between"><span className="text-gray-500">Tags</span><span className="font-medium">{video.tags.length}</span></div>
                <div className="flex justify-between"><span className="text-gray-500">Published</span><span className="font-medium">{formatDate(video.publishedAt)}</span></div>
              </div>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
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
  const [isFullScreen, setIsFullScreen] = useState(false);

  if (!video) return null;

  async function handleRunSeoAnalysis() {
    if (!video) return;
    setIsAnalyzing(true);
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
      if (!result.success) throw new Error(result.error || "Failed to generate SEO package");
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
      <DialogContent className={`${isFullScreen ? "fixed inset-4 z-50 max-w-none w-auto h-auto max-h-none" : "w-[700px] max-w-[95vw] max-h-[90vh]"} overflow-y-auto`}>
        <DialogHeader>
          <DialogTitle className="text-xl">Fix This Video</DialogTitle>
          <DialogDescription>{video.title}</DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          <div className="relative">
            <Image src={video.thumbnail} alt={video.title} width={600} height={338} className="w-full h-48 object-cover rounded-lg" unoptimized />
          </div>

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

          <div className="flex flex-col gap-3 pt-4 border-t">
            <Button
              className="w-full"
              onClick={() => {
                onClose();
                router.push(`/optimize?videoId=${video.id}`);
              }}
            >
              Open SEO Optimizer
            </Button>

            <Button variant="outline" className="w-full" onClick={() => { onClose(); router.push(`/boards?action=chat&videoId=${video.id}&title=${encodeURIComponent(video.title)}&description=${encodeURIComponent(video.description || "")}&type=video`); }}>
              Generate New Script
            </Button>
            <Button variant="outline" className="w-full" onClick={() => { onClose(); router.push(`/boards?action=chat&videoId=${video.id}&title=${encodeURIComponent(video.title)}&description=${encodeURIComponent(video.description || "")}&type=video&intent=social`); }}>
              Create Social Posts
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ---- Channel Analysis ----

async function analyzeChannelById(channelId: string): Promise<{
  channelName: string;
  channelThumbnail: string;
  videos: ChannelVideo[];
  stats: ChannelStats;
}> {
  const response = await fetch(`/api/youtube/channel-videos?channelId=${channelId}`);
  if (!response.ok) throw new Error("Failed to fetch channel videos");

  const result = await response.json();
  if (!result.success) throw new Error(result.error || "Failed to fetch channel videos");

  const channel = result.data.channel;
  const videoDetails = result.data.videos;
  if (videoDetails.length === 0) throw new Error("No videos found on this channel");

  const totalViews = videoDetails.reduce((sum: number, v: { statistics: { viewCount: string } }) => sum + parseInt(v.statistics.viewCount || "0"), 0);
  const totalLikes = videoDetails.reduce((sum: number, v: { statistics: { likeCount: string } }) => sum + parseInt(v.statistics.likeCount || "0"), 0);
  const totalComments = videoDetails.reduce((sum: number, v: { statistics: { commentCount: string } }) => sum + parseInt(v.statistics.commentCount || "0"), 0);
  const avgViews = Math.round(totalViews / videoDetails.length);

  const now = new Date().getTime();

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
    const publishedTime = new Date(item.snippet.publishedAt).getTime();
    const daysSincePublish = Math.max(1, Math.floor((now - publishedTime) / (1000 * 60 * 60 * 24)));

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
    const outlierScore = calculateOutlierScore(video.viewCount, avgViews);
    const hookType = estimateHookType(video.title);
    // Only calculate views/day if video is at least 1 day old
    const viewsPerDay = daysSincePublish >= 1 ? Math.round(video.viewCount / daysSincePublish) : 0;

    const channelVideo: ChannelVideo = {
      ...video,
      channelAvgViews: avgViews,
      performanceScore,
      improvementPotential: 0,
      ctrEstimate: Math.round(performanceScore * 0.8),
      suggestions: [],
      isShort: short,
      outlierScore,
      hookType,
      durationSeconds,
      viewsPerDay,
    };

    return channelVideo;
  });

  const perfVideos = [...channelVideos].sort((a, b) => b.performanceScore - a.performanceScore);
  channelVideos.forEach((v) => {
    v.improvementPotential = calculateImprovementPotential(v.performanceScore);
    v.suggestions = generateSuggestions(v, perfVideos);
  });
  channelVideos.sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime());

  const shorts = channelVideos.filter((v) => v.isShort);
  const longForm = channelVideos.filter((v) => !v.isShort);
  const insights = generateInsights(channelVideos);
  const health = calculateHealthScore(channelVideos);

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
    healthScore: health.score,
    healthBreakdown: health.breakdown,
    insights,
  };

  return { channelName: channel.title, channelThumbnail: channel.thumbnail, videos: channelVideos, stats };
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
  const [sort, setSort] = useState<SortOption>("newest");
  const [searchQuery, setSearchQuery] = useState("");
  const [isCompareMode, setIsCompareMode] = useState(false);
  const [compareSelection, setCompareSelection] = useState<Set<string>>(new Set());
  const [isCompareModalOpen, setIsCompareModalOpen] = useState(false);

  const [myChannelName, setMyChannelName] = useState("");
  const [myChannelThumbnail, setMyChannelThumbnail] = useState("");
  const [myChannelVideos, setMyChannelVideos] = useState<ChannelVideo[]>([]);
  const [myChannelStats, setMyChannelStats] = useState<ChannelStats | null>(null);
  const [isMyChannelLoading, setIsMyChannelLoading] = useState(false);
  const [myChannelSelectedVideo, setMyChannelSelectedVideo] = useState<ChannelVideo | null>(null);
  const [myChannelFilter, setMyChannelFilter] = useState<ContentFilter>("all");
  const [myChannelSort, setMyChannelSort] = useState<SortOption>("newest");
  const [myChannelSearch, setMyChannelSearch] = useState("");
  const [myIsCompareMode, setMyIsCompareMode] = useState(false);
  const [myCompareSelection, setMyCompareSelection] = useState<Set<string>>(new Set());
  const [myIsCompareModalOpen, setMyIsCompareModalOpen] = useState(false);

  const [fixModalVideo, setFixModalVideo] = useState<ChannelVideo | null>(null);
  const [isFixModalOpen, setIsFixModalOpen] = useState(false);

  // Persistence
  useEffect(() => {
    const saved = localStorage.getItem("channel_analyzer_state");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed.channelName) setChannelName(parsed.channelName);
        if (parsed.channelThumbnail) setChannelThumbnail(parsed.channelThumbnail);
        if (parsed.videos) setVideos(parsed.videos);
        if (parsed.stats) setStats(parsed.stats);
      } catch { /* ignore */ }
    }
  }, []);

  useEffect(() => {
    if (channelName && videos.length > 0) {
      localStorage.setItem("channel_analyzer_state", JSON.stringify({ channelName, channelThumbnail, videos, stats }));
    }
  }, [channelName, channelThumbnail, videos, stats]);

  const filteredAndSortedVideos = useMemo(() => {
    let result = [...videos];
    if (filter === "shorts") result = result.filter((v) => v.isShort);
    if (filter === "videos") result = result.filter((v) => !v.isShort);
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter((v) => v.title.toLowerCase().includes(q));
    }
    switch (sort) {
      case "mostViews": result.sort((a, b) => b.viewCount - a.viewCount); break;
      case "bestPerformance": result.sort((a, b) => b.performanceScore - a.performanceScore); break;
      case "highestPotential": result.sort((a, b) => b.improvementPotential - a.improvementPotential); break;
      case "viewsPerDay": result.sort((a, b) => b.viewsPerDay - a.viewsPerDay); break;
      default: result.sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime());
    }
    return result;
  }, [videos, filter, sort, searchQuery]);

  const myFilteredAndSortedVideos = useMemo(() => {
    let result = [...myChannelVideos];
    if (myChannelFilter === "shorts") result = result.filter((v) => v.isShort);
    if (myChannelFilter === "videos") result = result.filter((v) => !v.isShort);
    if (myChannelSearch.trim()) {
      const q = myChannelSearch.toLowerCase();
      result = result.filter((v) => v.title.toLowerCase().includes(q));
    }
    switch (myChannelSort) {
      case "mostViews": result.sort((a, b) => b.viewCount - a.viewCount); break;
      case "bestPerformance": result.sort((a, b) => b.performanceScore - a.performanceScore); break;
      case "highestPotential": result.sort((a, b) => b.improvementPotential - a.improvementPotential); break;
      case "viewsPerDay": result.sort((a, b) => b.viewsPerDay - a.viewsPerDay); break;
      default: result.sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime());
    }
    return result;
  }, [myChannelVideos, myChannelFilter, myChannelSort, myChannelSearch]);

  async function handleAnalyzeChannel() {
    const channelId = extractChannelId(channelUrl);
    if (!channelId) { toast.error("Please enter a valid YouTube channel URL"); return; }

    setIsLoading(true);
    setVideos([]); setStats(null); setSelectedVideo(null); setFilter("all"); setSort("newest"); setSearchQuery("");

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
    setMyChannelVideos([]); setMyChannelStats(null); setMyChannelSelectedVideo(null); setMyChannelFilter("all"); setMyChannelSort("newest"); setMyChannelSearch("");

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

  const hasLoadedRef = useRef(false);
  useEffect(() => {
    if (isConnected && connectedChannel?.channelId && !hasLoadedRef.current) {
      hasLoadedRef.current = true;
      loadMyChannel();
    }
  }, [isConnected, connectedChannel, loadMyChannel]);

  const topVideos = useMemo(() => [...videos].sort((a, b) => b.performanceScore - a.performanceScore).slice(0, 3), [videos]);
  const lowVideos = useMemo(() => [...videos].sort((a, b) => a.performanceScore - b.performanceScore).slice(0, 3), [videos]);
  const myTopVideos = useMemo(() => [...myChannelVideos].sort((a, b) => b.performanceScore - a.performanceScore).slice(0, 3), [myChannelVideos]);
  const myLowVideos = useMemo(() => [...myChannelVideos].sort((a, b) => a.performanceScore - b.performanceScore).slice(0, 3), [myChannelVideos]);

  const toggleCompare = (id: string, current: Set<string>, setter: (s: Set<string>) => void) => {
    const next = new Set(current);
    if (next.has(id)) next.delete(id);
    else if (next.size < 3) next.add(id);
    setter(next);
  };

  const renderVideoList = (
    listVideos: ChannelVideo[],
    listStats: ChannelStats,
    listChannelName: string,
    listChannelThumbnail: string,
    listSelectedVideo: ChannelVideo | null,
    setListSelectedVideo: (v: ChannelVideo | null) => void,
    listFilter: ContentFilter,
    setListFilter: (f: ContentFilter) => void,
    listSort: SortOption,
    setListSort: (s: SortOption) => void,
    listSearch: string,
    setListSearch: (s: string) => void,
    listIsCompareMode: boolean,
    setListIsCompareMode: (b: boolean) => void,
    listCompareSelection: Set<string>,
    setListCompareSelection: (s: Set<string>) => void,
    listIsCompareModalOpen: boolean,
    setListIsCompareModalOpen: (b: boolean) => void,
    listTopVideos: ChannelVideo[],
    listLowVideos: ChannelVideo[],
    isMyChannel = false,
  ) => {
    const filtered = listVideos;

    return (
      <div className="space-y-6">
        {/* Only show header for "Any Channel" tab - My Channel already has the connected channel card */}
        {!isMyChannel && (
          <div className="flex items-center gap-5">
            {listChannelThumbnail && (
              <Image src={listChannelThumbnail} alt={listChannelName} width={64} height={64} className="w-16 h-16 rounded-full object-cover ring-2 ring-gray-200" unoptimized />
            )}
            <div>
              <h2 className="text-xl font-bold text-gray-900">{listChannelName}</h2>
              <p className="text-gray-500 text-sm">{formatNumber(listStats.totalViews)} views · {listStats.totalVideos} total uploads</p>
            </div>
          </div>
        )}

        <HealthScoreCard score={listStats.healthScore} breakdown={listStats.healthBreakdown} />

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard label="Videos" value={String(listStats.videoCount)} sub={`${listStats.shortCount} Shorts`} />
          <StatCard label="Avg. Views" value={formatNumber(listStats.avgViews)} />
          <StatCard label="Engagement" value={`${listStats.engagementRate}%`} />
          <StatCard label="Avg. Score" value={`${listStats.avgPerformance}/100`} />
        </div>

        <div className="grid md:grid-cols-2 gap-4">
          <ViewsOverTimeChart videos={listVideos} />
          <PerformanceDistributionChart videos={listVideos} />
        </div>

        <InsightsCharts insights={listStats.insights} />

        <Tabs defaultValue="overview" className="w-full">
          <TabsList className="mb-4">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="all">All Videos</TabsTrigger>
            <TabsTrigger value="opportunities">Opportunities</TabsTrigger>
            <TabsTrigger value="best-practices">Best Practices</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6 mt-0">
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-3">Top Performing Videos</h3>
              <div className="space-y-3">
                {listTopVideos.map((video) => (
                  <VideoCard key={video.id} video={video} onClick={() => setListSelectedVideo(video)} onFixVideo={(v) => { setFixModalVideo(v); setIsFixModalOpen(true); }} />
                ))}
              </div>
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-3">Biggest Opportunities</h3>
              <p className="text-sm text-gray-500 mb-3">Lowest performers with the most room for improvement</p>
              <div className="space-y-3">
                {listLowVideos.map((video) => (
                  <VideoCard key={video.id} video={video} onClick={() => setListSelectedVideo(video)} onFixVideo={(v) => { setFixModalVideo(v); setIsFixModalOpen(true); }} />
                ))}
              </div>
            </div>
          </TabsContent>

          <TabsContent value="all" className="space-y-4 mt-0">
            <div className="sticky top-0 z-10 bg-gray-50 pb-4 space-y-3">
              <div className="flex flex-wrap items-center gap-3">
                <Input placeholder="Search videos..." value={listSearch} onChange={(e) => setListSearch(e.target.value)} className="w-64" />
                <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
                  {(["all", "videos", "shorts"] as ContentFilter[]).map((key) => (
                    <button key={key} onClick={() => setListFilter(key)} className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${listFilter === key ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}>
                      {key === "all" ? "All" : key === "videos" ? "Videos" : "Shorts"}
                    </button>
                  ))}
                </div>
                <select value={listSort} onChange={(e) => setListSort(e.target.value as SortOption)} className="px-3 py-1.5 rounded-md text-sm border bg-white">
                  <option value="newest">Newest First</option>
                  <option value="mostViews">Most Views</option>
                  <option value="bestPerformance">Best Performance</option>
                  <option value="highestPotential">Highest Potential</option>
                  <option value="viewsPerDay">Views Per Day</option>
                </select>
                <Button variant="outline" size="sm" onClick={() => exportToCSV(filtered, listChannelName)}>Export CSV</Button>
                <Button variant={listIsCompareMode ? "default" : "outline"} size="sm" onClick={() => { setListIsCompareMode(!listIsCompareMode); setListCompareSelection(new Set()); }}>
                  {listIsCompareMode ? "Done" : "Compare"}
                </Button>
                {listIsCompareMode && listCompareSelection.size >= 2 && (
                  <Button size="sm" onClick={() => setListIsCompareModalOpen(true)}>Compare ({listCompareSelection.size})</Button>
                )}
              </div>
              <p className="text-sm text-gray-500">{filtered.length} items</p>
            </div>
            <VideoTable
              videos={filtered}
              selectedVideo={listSelectedVideo}
              setSelectedVideo={setListSelectedVideo}
              onFixVideo={(v) => { setFixModalVideo(v); setIsFixModalOpen(true); }}
              isCompareMode={listIsCompareMode}
              compareSelection={listCompareSelection}
              onToggleCompare={(id) => toggleCompare(id, listCompareSelection, setListCompareSelection)}
            />
            <VideoDetailModal
              video={listSelectedVideo}
              isOpen={!!listSelectedVideo}
              onClose={() => setListSelectedVideo(null)}
              onFixVideo={(v) => { setFixModalVideo(v); setIsFixModalOpen(true); }}
              channelStats={listStats}
            />
            <CompareModal
              videos={listVideos.filter((v) => listCompareSelection.has(v.id))}
              isOpen={listIsCompareModalOpen}
              onClose={() => setListIsCompareModalOpen(false)}
            />
          </TabsContent>

          <TabsContent value="opportunities" className="space-y-4 mt-0">
            <p className="text-sm text-gray-500">Videos performing below channel average with actionable fixes</p>
            <div className="space-y-3">
              {[...listVideos].sort((a, b) => a.performanceScore - b.performanceScore).map((video) => (
                <VideoCard key={video.id} video={video} onClick={() => setListSelectedVideo(video)} onFixVideo={(v) => { setFixModalVideo(v); setIsFixModalOpen(true); }} />
              ))}
            </div>
          </TabsContent>

          <TabsContent value="best-practices" className="space-y-6 mt-0">
            <InsightsCharts insights={listStats.insights} />
            <Card>
              <CardHeader><CardTitle className="text-lg">Insights Summary</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-start gap-3">
                  <span className="text-gray-400 mt-0.5">•</span>
                  <div><span className="text-sm font-medium text-gray-700">Best topic:</span><span className="text-sm text-gray-600 ml-1">{listStats.insights.bestTopic} (avg {listStats.insights.bestTopicAvgOutlier}x outlier)</span></div>
                </div>
                <div className="flex items-start gap-3">
                  <span className="text-gray-400 mt-0.5">•</span>
                  <div><span className="text-sm font-medium text-gray-700">Best length:</span><span className="text-sm text-gray-600 ml-1">{listStats.insights.bestLength}</span></div>
                </div>
                <div className="flex items-start gap-3">
                  <span className="text-gray-400 mt-0.5">•</span>
                  <div><span className="text-sm font-medium text-gray-700">Best day:</span><span className="text-sm text-gray-600 ml-1">{listStats.insights.bestDay} uploads perform best</span></div>
                </div>
                <div className="flex items-start gap-3">
                  <span className="text-gray-400 mt-0.5">•</span>
                  <div><span className="text-sm font-medium text-gray-700">Best hook:</span><span className="text-sm text-gray-600 ml-1">{listStats.insights.bestHook} openings outperform others</span></div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
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
                  <Link href="/auth/login"><Button>Sign In</Button></Link>
                </CardContent>
              </Card>
            ) : !isConnected ? (
              <Card>
                <CardContent className="p-12 text-center space-y-4">
                  <p className="text-gray-600 text-lg">Connect Your YouTube Channel</p>
                  <p className="text-gray-500 text-sm">Get real-time analytics, video performance scores, and optimization tips</p>
                  <Button onClick={connectChannel} disabled={isConnecting}>{isConnecting ? "Connecting..." : "Connect My Channel"}</Button>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-6">
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        {connectedChannel?.thumbnail && (
                          <Image src={connectedChannel.thumbnail} alt={connectedChannel.title} width={48} height={48} className="w-12 h-12 rounded-full object-cover ring-2 ring-gray-200" unoptimized />
                        )}
                        <div>
                          <h3 className="font-semibold text-gray-900">{connectedChannel?.title}</h3>
                          <p className="text-sm text-gray-500">{formatNumber(connectedChannel?.subscriberCount || 0)} subscribers · {connectedChannel?.videoCount || 0} videos</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button variant="ghost" size="sm" onClick={async () => { await refreshChannel(); await loadMyChannel(); toast.success("Channel data refreshed"); }} disabled={isMyChannelLoading}>
                          {isMyChannelLoading ? "Refreshing..." : "Refresh"}
                        </Button>
                        <Button variant="outline" size="sm" onClick={disconnectChannel}>Disconnect</Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {isMyChannelLoading && (
                  <div className="space-y-6">
                    <Skeleton className="h-32 w-full" />
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      {Array.from({ length: 4 }).map((_, i) => (<Skeleton key={i} className="h-24 w-full" />))}
                    </div>
                    {Array.from({ length: 5 }).map((_, i) => (<Skeleton key={i} className="h-28 w-full" />))}
                  </div>
                )}

                {myChannelStats && renderVideoList(
                  myFilteredAndSortedVideos,
                  myChannelStats,
                  myChannelName,
                  myChannelThumbnail,
                  myChannelSelectedVideo,
                  setMyChannelSelectedVideo,
                  myChannelFilter,
                  setMyChannelFilter,
                  myChannelSort,
                  setMyChannelSort,
                  myChannelSearch,
                  setMyChannelSearch,
                  myIsCompareMode,
                  setMyIsCompareMode,
                  myCompareSelection,
                  setMyCompareSelection,
                  myIsCompareModalOpen,
                  setMyIsCompareModalOpen,
                  myTopVideos,
                  myLowVideos,
                  true,
                )}
              </div>
            )}
          </TabsContent>

          <TabsContent value="analyze" className="space-y-6 mt-0">
            <Card>
              <CardContent className="p-4">
                <div className="flex gap-3">
                  <Input placeholder="Paste YouTube channel URL (e.g., @MrBeast)..." value={channelUrl} onChange={(e) => setChannelUrl(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleAnalyzeChannel()} className="flex-1" />
                  <Button onClick={handleAnalyzeChannel} disabled={isLoading}>{isLoading ? "Analyzing..." : "Analyze"}</Button>
                </div>
              </CardContent>
            </Card>

            {isLoading && (
              <div className="space-y-6">
                <Skeleton className="h-32 w-full" />
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {Array.from({ length: 4 }).map((_, i) => (<Skeleton key={i} className="h-24 w-full" />))}
                </div>
                {Array.from({ length: 5 }).map((_, i) => (<Skeleton key={i} className="h-28 w-full" />))}
              </div>
            )}

            {stats && renderVideoList(
              filteredAndSortedVideos,
              stats,
              channelName,
              channelThumbnail,
              selectedVideo,
              setSelectedVideo,
              filter,
              setFilter,
              sort,
              setSort,
              searchQuery,
              setSearchQuery,
              isCompareMode,
              setIsCompareMode,
              compareSelection,
              setCompareSelection,
              isCompareModalOpen,
              setIsCompareModalOpen,
              topVideos,
              lowVideos,
            )}
          </TabsContent>
        </Tabs>
      </div>

      <FixVideoModal video={fixModalVideo} isOpen={isFixModalOpen} onClose={() => { setIsFixModalOpen(false); setFixModalVideo(null); }} />
    </div>
  );
}

export default function ChannelAnalyzerPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-gray-50 flex items-center justify-center"><p className="text-gray-400">Loading...</p></div>}>
      <ChannelAnalyzerContent />
    </Suspense>
  );
}
