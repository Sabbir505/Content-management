import { toast } from "sonner";
import { YouTubeVideo } from "@/types/video";
export type { SeoPackage } from "@/lib/optimize-types";

export interface ChannelVideo extends YouTubeVideo {
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

export interface VideoAnalysisResult {
  summary: string;
  strengths: string[];
  weaknesses: string[];
  opportunities: string[];
  title_analysis: { score: number; feedback: string; suggestions: string[] };
  thumbnail_analysis: { score: number; feedback: string; suggestions: string[] };
  hook_analysis: { score: number; feedback: string; suggestions: string[] };
  retention_analysis: { score: number; feedback: string; suggestions: string[] };
  seo_analysis: { score: number; feedback: string; suggestions: string[] };
  overall_score: number;
  overall_grade: "A" | "B+" | "B" | "C" | "D" | "F";
  action_items: string[];
}

export interface ChannelInsights {
  bestTopic: string;
  bestTopicAvgOutlier: number;
  bestLength: string;
  bestDay: string;
  bestHook: string;
  hookPerformance: Record<string, number>;
  dayPerformance: Record<string, number>;
  lengthPerformance: Record<string, number>;
}

export interface ChannelStats {
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

export { getScoreColorClass, getGrade, getHealthScoreColor, getHealthScoreBg } from "@/lib/scoring-utils";

export function generateSuggestions(video: ChannelVideo, topVideos: ChannelVideo[]): string[] {
  const suggestions: string[] = [];
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

  void topHooks;
  return suggestions;
}

export function generateInsights(videos: ChannelVideo[]): ChannelInsights {
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

export function extractChannelId(url: string): string | null {
  if (/^UC[a-zA-Z0-9_-]{22}$/.test(url)) return url;
  const patterns = [
    /youtube\.com\/(?:c\/|channel\/|@)([a-zA-Z0-9_-]+)/,
    /youtube\.com\/(?:user\/)?([a-zA-Z0-9_-]+)/,
  ];
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  if (/^[a-zA-Z0-9_-]+$/.test(url) && url.length > 0) return url;
  return null;
}

export function exportToCSV(videos: ChannelVideo[], channelName: string): void {
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
