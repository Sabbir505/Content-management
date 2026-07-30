"use client";

import { useCallback } from "react";
import { toast } from "sonner";
import type { ChannelVideo, ChannelStats } from "@/lib/channel-analytics";
import {
  extractChannelId,
  generateSuggestions,
  generateInsights,
} from "@/lib/channel-analytics";

interface ChannelDataResult {
  channelName: string;
  channelThumbnail: string;
  subscriberCount: number;
  videoCount: number;
  videos: ChannelVideo[];
  stats: ChannelStats | null;
}

interface UseChannelDataArgs {
  onStart: () => void;
  onSuccess: (data: ChannelDataResult) => void;
  onError: () => void;
}

function getTopVideos(videos: ChannelVideo[], count = 5): ChannelVideo[] {
  return [...videos].sort((a, b) => b.outlierScore - a.outlierScore).slice(0, count);
}

function getLowVideos(videos: ChannelVideo[], count = 3): ChannelVideo[] {
  return [...videos]
    .filter((v) => v.outlierScore < 0.6 && v.outlierScore > 0)
    .sort((a, b) => a.outlierScore - b.outlierScore)
    .slice(0, count);
}

export function useChannelData({ onStart, onSuccess, onError }: UseChannelDataArgs) {
  const analyzeChannel = useCallback(async (channelUrl: string) => {
    const channelId = extractChannelId(channelUrl);
    if (!channelId) {
      toast.error("Invalid channel URL or ID");
      return;
    }

    onStart();
    try {
      const videosRes = await fetch(`/api/creators/${encodeURIComponent(channelId)}/videos?channelId=${encodeURIComponent(channelId)}`);

      // A non-JSON body means the server returned an error page (e.g. the
      // Turbopack dev worker crashing on this route) rather than our route's
      // JSON — don't try to parse it as JSON. Fall through to the channel
      // fallback below so the user still gets channel metadata.
      const videosContentType = videosRes.headers.get("content-type") || "";
      const isVideosJson = videosContentType.includes("application/json");
      const videosData = isVideosJson
        ? await videosRes.json().catch(() => null)
        : null;

      let channelMeta = { title: "", thumbnail: "", subscriberCount: 0, videoCount: 0 };

      if (videosData?.success && videosData.data) {
        const ch = videosData.data.channel || {};
        channelMeta = {
          title: ch.title || "",
          thumbnail: ch.thumbnail || "",
          subscriberCount: ch.subscriberCount || 0,
          videoCount: ch.videoCount || 0,
        };
      } else {
        const channelRes = await fetch(`/api/youtube/channel?channelId=${encodeURIComponent(channelId)}`);
        const channelJson = await channelRes.json().catch(() => null);
        if (channelJson?.success && channelJson.data) {
          const ch = channelJson.data;
          channelMeta = {
            title: ch.title || "",
            thumbnail: ch.thumbnail || "",
            subscriberCount: ch.subscriberCount || 0,
            videoCount: ch.videoCount || 0,
          };
        }
      }

      if (videosData?.success && videosData.data) {
        const rawVideos: ChannelVideo[] = (videosData.data.videos || []).map((v: ChannelVideo) => ({
          ...v,
          tags: v.tags || [],
          commentCount: v.commentCount || 0,
          description: v.description || "",
          performanceScore: v.performanceScore || 50,
          improvementPotential: v.improvementPotential || 0,
          ctrEstimate: v.ctrEstimate || 0,
          durationSeconds: v.durationSeconds || 0,
          viewsPerDay: v.viewsPerDay || 0,
        }));

        const channelAvgViews = rawVideos.length > 0
          ? Math.round(rawVideos.reduce((s: number, rv: ChannelVideo) => s + rv.viewCount, 0) / rawVideos.length)
          : 0;

        const topVids = getTopVideos(rawVideos);

        const videosWithScores: ChannelVideo[] = rawVideos.map((v: ChannelVideo) => {
          const suggestions = generateSuggestions(v, topVids);
          return {
            ...v,
            channelAvgViews,
            isShort: v.durationSeconds < 60,
            suggestions,
          } as ChannelVideo;
        });

        const insights = generateInsights(videosWithScores);
        const avgPerf = Math.round(
          videosWithScores.reduce((s: number, v: ChannelVideo) => s + v.performanceScore, 0) /
            videosWithScores.length
        );
        const healthBreakdown = {
          avgPerf,
          consistency: Math.round(
            100 -
              (videosWithScores.length > 0
                ? videosWithScores.reduce(
                    (s: number, v: ChannelVideo) =>
                      s + Math.abs(v.performanceScore - avgPerf),
                    0
                  ) / videosWithScores.length
                : 0)
          ),
          topRatio: Math.round(
            (getTopVideos(videosWithScores, 3).reduce(
              (s: number, v: ChannelVideo) => s + v.viewCount,
              0
            ) /
              Math.max(
                1,
                videosWithScores.reduce((s: number, v: ChannelVideo) => s + v.viewCount, 0)
              )) *
              100
          ),
        };

        const stats: ChannelStats = {
          totalVideos: videosWithScores.length,
          totalViews: videosWithScores.reduce((s: number, v: ChannelVideo) => s + v.viewCount, 0),
          avgViews: Math.round(
            videosWithScores.reduce((s: number, v: ChannelVideo) => s + v.viewCount, 0) /
              videosWithScores.length
          ),
          avgPerformance: Math.round(
            videosWithScores.reduce((s: number, v: ChannelVideo) => s + v.performanceScore, 0) /
              videosWithScores.length
          ),
          topVideo: getTopVideos(videosWithScores, 1)[0] || null,
          worstVideo: getLowVideos(videosWithScores, 1)[0] || null,
          totalLikes: videosWithScores.reduce((s: number, v: ChannelVideo) => s + v.likeCount, 0),
          totalComments: videosWithScores.reduce(
            (s: number, v: ChannelVideo) => s + v.commentCount,
            0
          ),
          engagementRate: Math.round(
            (videosWithScores.reduce(
              (s: number, v: ChannelVideo) => s + v.likeCount + v.commentCount,
              0
            ) /
              Math.max(
                1,
                videosWithScores.reduce((s: number, v: ChannelVideo) => s + v.viewCount, 0)
              )) *
              100
          ),
          shortCount: videosWithScores.filter((v: ChannelVideo) => v.isShort).length,
          videoCount: videosWithScores.filter((v: ChannelVideo) => !v.isShort).length,
          healthScore: Math.round(
            healthBreakdown.avgPerf * 0.4 +
              healthBreakdown.consistency * 0.3 +
              healthBreakdown.topRatio * 0.3
          ),
          healthBreakdown,
          insights,
        };

        onSuccess({
          channelName: channelMeta.title,
          channelThumbnail: channelMeta.thumbnail,
          subscriberCount: channelMeta.subscriberCount,
          videoCount: channelMeta.videoCount,
          videos: videosWithScores,
          stats,
        });
      } else {
        onSuccess({
          channelName: channelMeta.title,
          channelThumbnail: channelMeta.thumbnail,
          subscriberCount: channelMeta.subscriberCount,
          videoCount: channelMeta.videoCount,
          videos: [],
          stats: null,
        });
      }
    } catch (error) {
      console.error("Failed to analyze channel:", error);
      toast.error("Failed to analyze channel");
      onError();
    }
  }, [onStart, onSuccess, onError]);

  return { analyzeChannel };
}
