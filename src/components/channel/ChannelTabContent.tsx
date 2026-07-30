"use client";

import { useState } from "react";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import type { ChannelAnalyticsState } from "@/hooks/useChannelAnalyticsState";
import { StatCard } from "./StatCard";
import { HealthScoreCard } from "./HealthScoreCard";
import { CompareModal } from "./CompareModal";
import { FixVideoModal } from "./FixVideoModal";
import { ChannelVideoTable } from "./ChannelVideoCard";
import { ChannelVideoDetailModal } from "./ChannelVideoDetailModal";
import { InsightsCharts, ViewsOverTimeChart, PerformanceDistributionChart } from "./ChannelCharts";
import { exportToCSV, type ChannelVideo } from "@/lib/channel-analytics";
import { formatCompactNumber } from "@/lib/format";

const FILTER_OPTIONS = [
  { value: "all", label: "All Content" },
  { value: "videos", label: "Videos" },
  { value: "shorts", label: "Shorts" },
] as const;

const SORT_OPTIONS = [
  { value: "recent", label: "Most Recent" },
  { value: "topLiked", label: "Top Liked" },
  { value: "topViewed", label: "Top Viewed" },
  { value: "topOutlier", label: "Top Outlier" },
] as const;

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface ChannelTabContentProps {
  state: ChannelAnalyticsState;
  channelUrl: string;
  setChannelUrl: (v: string) => void;
  isAnalyzing: boolean;
  onAnalyze: () => void;
  isMyChannel?: boolean;
  onConnectChannel?: () => void;
  isConnecting?: boolean;
  isConnected?: boolean;
}

function getTopVideos(videos: ChannelVideo[], count = 5): ChannelVideo[] {
  return [...videos].sort((a, b) => b.outlierScore - a.outlierScore).slice(0, count);
}

function getLowVideos(videos: ChannelVideo[], count = 3): ChannelVideo[] {
  return [...videos].sort((a, b) => a.outlierScore - b.outlierScore).slice(-count);
}

export function ChannelTabContent({
  state,
  channelUrl,
  setChannelUrl,
  isAnalyzing,
  onAnalyze,
  isMyChannel = false,
  onConnectChannel,
  isConnecting = false,
  isConnected = false,
}: ChannelTabContentProps) {
  const {
    channelName, setChannelName, channelThumbnail, setChannelThumbnail,
    subscriberCount, videoCount, videos, setVideos, stats, setStats,
    isLoading, selectedVideo, setSelectedVideo, filter, setFilter,
    sort, setSort, searchQuery, setSearchQuery, isCompareMode, setIsCompareMode,
    compareSelection, setCompareSelection, isCompareModalOpen, setIsCompareModalOpen,
    filteredAndSortedVideos,
  } = state;

  const topVideos = getTopVideos(videos);
  const lowVideos = getLowVideos(videos);

  const [fixVideo, setFixVideo] = useState<ChannelVideo | null>(null);
  const [isFixModalOpen, setIsFixModalOpen] = useState(false);

  function handleExportCSV() {
    exportToCSV(videos, channelName);
  }

  function handleOpenCompare() {
    const selected = videos.filter((v) => compareSelection.has(v.id));
    if (selected.length !== 2) {
      toast.error("Select exactly 2 videos to compare");
      return;
    }
    setIsCompareModalOpen(true);
  }

  function toggleCompare(id: string) {
    const next = new Set(compareSelection);
    if (next.has(id)) {
      next.delete(id);
    } else if (next.size < 2) {
      next.add(id);
    } else {
      toast.error("Select up to 2 videos to compare");
      return;
    }
    setCompareSelection(next);
  }

  const compareVideos = videos.filter((v) => compareSelection.has(v.id));

  // Empty state
  if (!channelName) {
    return (
      <div className="max-w-xl space-y-4 rounded-xl border border-[#2a2a2a] bg-[#1a1a1a] p-6">
        <div className="space-y-1">
          <h3 className="text-lg font-semibold text-white">
            {isMyChannel ? "Connect your channel" : "Analyze a channel"}
          </h3>
          <p className="text-sm text-[#888]">
            {isMyChannel
              ? "Connect your YouTube channel to get personalized analytics and AI-powered improvement suggestions."
              : "Enter a YouTube channel URL or handle to analyze its performance."}
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-3">
          <Input
            placeholder="e.g. @MrBeast or youtube.com/@mkbhd"
            value={channelUrl}
            onChange={(e) => setChannelUrl(e.target.value)}
            className="bg-[#101010] border-[#2a2a2a] text-white focus-visible:ring-1 focus-visible:ring-[#3a3a3a]"
            onKeyDown={(e) => e.key === "Enter" && onAnalyze()}
          />
          <Button
            onClick={onAnalyze}
            disabled={isAnalyzing || !channelUrl.trim()}
            className="bg-white text-black hover:bg-[#ccc] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isAnalyzing ? "Analyzing..." : "Analyze"}
          </Button>
        </div>
        {isMyChannel && onConnectChannel && (
          <Button
            onClick={onConnectChannel}
            disabled={isConnecting}
            variant="outline"
            className="border-[#2a2a2a] text-[#888] hover:text-white hover:border-[#3a3a3a] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isConnecting ? "Connecting..." : isConnected ? "Reconnect YouTube Account" : "Connect YouTube Account"}
          </Button>
        )}
      </div>
    );
  }

  // Loading state
  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4 p-4 bg-[#1a1a1a] rounded-xl border border-[#2a2a2a]">
          <div className="w-12 h-12 rounded-full bg-[#2a2a2a] animate-pulse" />
          <div className="space-y-2">
            <div className="h-4 w-40 bg-[#2a2a2a] rounded animate-pulse" />
            <div className="h-3 w-28 bg-[#2a2a2a] rounded animate-pulse" />
          </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-24 bg-[#1a1a1a] rounded-xl border border-[#2a2a2a] animate-pulse" />
          ))}
        </div>
        <div className="h-40 bg-[#1a1a1a] rounded-xl border border-[#2a2a2a] animate-pulse" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-56 bg-[#1a1a1a] rounded-xl border border-[#2a2a2a] animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  // Loaded state
  return (
    <>
      <div className="flex items-center gap-4 p-4 bg-[#1a1a1a] rounded-xl border border-[#2a2a2a]">
        {channelThumbnail && (
          <Image src={channelThumbnail} alt={channelName} width={48} height={48} className="w-12 h-12 rounded-full object-cover" />
        )}
        <div className="min-w-0">
          <h2 className="text-lg font-semibold text-white truncate">{channelName}</h2>
          <p className="text-sm text-[#888]">
            {formatCompactNumber(subscriberCount)} subscribers · {videoCount} videos
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => {
          setChannelName(""); setChannelThumbnail(""); setVideos([]); setStats(null);
          setChannelUrl("");
        }} className="ml-auto border-[#2a2a2a] text-[#888] hover:text-white hover:border-[#3a3a3a] transition-colors">
          Change Channel
        </Button>
      </div>

      <div className="space-y-6">
        {/* Stats */}
        {stats && (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <StatCard label="Total Videos" value={String(stats.totalVideos)} sub={`${stats.videoCount} videos, ${stats.shortCount} shorts`} />
              <StatCard label="Total Views" value={formatCompactNumber(stats.totalViews)} />
              <StatCard label="Avg Views" value={formatCompactNumber(stats.avgViews)} />
              <StatCard label="Engagement" value={`${stats.engagementRate}%`} sub={`${formatCompactNumber(stats.totalLikes)} likes, ${formatCompactNumber(stats.totalComments)} comments`} />
            </div>

            <HealthScoreCard score={stats.healthScore} breakdown={stats.healthBreakdown} />

            {/* Insights */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-white">Channel Insights</h3>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                <div className="p-3 bg-[#1a1a1a] rounded-xl border border-[#2a2a2a] text-center">
                  <p className="text-xs text-[#888] mb-1">Best Topic</p>
                  <p className="text-sm font-semibold text-white">#{stats.insights.bestTopic}</p>
                  <p className="text-xs text-emerald-400">{stats.insights.bestTopicAvgOutlier}x avg</p>
                </div>
                <div className="p-3 bg-[#1a1a1a] rounded-xl border border-[#2a2a2a] text-center">
                  <p className="text-xs text-[#888] mb-1">Best Hook</p>
                  <p className="text-sm font-semibold text-white">{stats.insights.bestHook}</p>
                </div>
                <div className="p-3 bg-[#1a1a1a] rounded-xl border border-[#2a2a2a] text-center">
                  <p className="text-xs text-[#888] mb-1">Best Length</p>
                  <p className="text-sm font-semibold text-white">{stats.insights.bestLength}</p>
                </div>
                <div className="p-3 bg-[#1a1a1a] rounded-xl border border-[#2a2a2a] text-center">
                  <p className="text-xs text-[#888] mb-1">Best Day</p>
                  <p className="text-sm font-semibold text-white">{stats.insights.bestDay}</p>
                </div>
                <div className="p-3 bg-[#1a1a1a] rounded-xl border border-[#2a2a2a] text-center">
                  <p className="text-xs text-[#888] mb-1">Avg Performance</p>
                  <p className="text-sm font-semibold text-white">{stats.avgPerformance}%</p>
                </div>
              </div>

              <div className="space-y-4">
                <InsightsCharts insights={stats.insights} />
                <div className="grid md:grid-cols-2 gap-4">
                  <ViewsOverTimeChart videos={videos} />
                  <PerformanceDistributionChart videos={videos} />
                </div>
              </div>
            </div>

            {/* Top & Low Performers */}
            <div className="grid md:grid-cols-2 gap-4">
              {topVideos.length > 0 && (
                <div className="p-4 bg-[#1a1a1a] rounded-xl border border-[#2a2a2a]">
                  <h4 className="text-sm font-semibold text-emerald-400 mb-3">Top Performers</h4>
                  <div className="space-y-2">
                    {topVideos.map((v) => (
                      <div key={v.id} className="flex items-center justify-between p-2 hover:bg-[#2a2a2a] rounded-lg cursor-pointer transition-colors" onClick={() => setSelectedVideo(v)}>
                        <span className="text-sm text-white truncate max-w-[200px]">{v.title}</span>
                        <span className="text-xs text-emerald-400 font-medium">{v.outlierScore}x</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {lowVideos.length > 0 && (
                <div className="p-4 bg-[#1a1a1a] rounded-xl border border-[#2a2a2a]">
                  <h4 className="text-sm font-semibold text-red-400 mb-3">Needs Improvement</h4>
                  <div className="space-y-2">
                    {lowVideos.map((v) => (
                      <div key={v.id} className="flex items-center justify-between p-2 hover:bg-[#2a2a2a] rounded-lg cursor-pointer transition-colors" onClick={() => setSelectedVideo(v)}>
                        <span className="text-sm text-white truncate max-w-[200px]">{v.title}</span>
                        <span className="text-xs text-red-400 font-medium">{v.outlierScore}x</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </>
        )}

        {/* Video List Controls */}
        <div className="flex flex-wrap items-center gap-3">
          {isMyChannel && (
            <Input
              placeholder="Search videos..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="max-w-xs bg-[#101010] border-[#2a2a2a] text-white focus-visible:ring-1 focus-visible:ring-[#3a3a3a]"
            />
          )}
          <Select value={filter} onValueChange={(v) => setFilter(v as "all" | "videos" | "shorts")}>
            <SelectTrigger className="w-36 bg-[#101010] border-[#2a2a2a] text-white">
              <SelectValue placeholder="Filter" />
            </SelectTrigger>
            <SelectContent className="bg-[#101010] border-[#2a2a2a] text-white">
              {FILTER_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value} className="hover:bg-[#1a1a1a]">{opt.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={sort} onValueChange={(v) => setSort(v as "recent" | "topLiked" | "topViewed" | "topOutlier")}>
            <SelectTrigger className="w-40 bg-[#101010] border-[#2a2a2a] text-white">
              <SelectValue placeholder="Sort" />
            </SelectTrigger>
            <SelectContent className="bg-[#101010] border-[#2a2a2a] text-white">
              {SORT_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value} className="hover:bg-[#1a1a1a]">{opt.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="flex items-center gap-2 ml-auto">
            <Button variant="outline" size="sm" onClick={() => setIsCompareMode(!isCompareMode)} className={`border-[#2a2a2a] transition-colors ${isCompareMode ? "bg-[#2a2a2a] text-white border-[#3a3a3a]" : "bg-transparent text-[#ccc] hover:text-black hover:bg-white hover:border-white"}`}>
              {isCompareMode ? "Exit Compare" : "Compare"}
            </Button>
            {compareSelection.size === 2 && (
              <Button size="sm" onClick={handleOpenCompare} className="bg-white text-black hover:bg-[#ccc] transition-colors">Compare ({compareSelection.size})</Button>
            )}
            {videos.length > 0 && (
              <Button variant="outline" size="sm" onClick={handleExportCSV} className="border-[#2a2a2a] bg-transparent text-[#ccc] hover:text-black hover:bg-white hover:border-white transition-colors">
                Export CSV
              </Button>
            )}
          </div>
        </div>

        {/* Video Grid */}
        <ChannelVideoTable
          videos={filteredAndSortedVideos}
          selectedVideo={selectedVideo}
          setSelectedVideo={setSelectedVideo}
          onFixVideo={(v) => { setFixVideo(v); setIsFixModalOpen(true); }}
          isCompareMode={isCompareMode}
          compareSelection={compareSelection}
          onToggleCompare={toggleCompare}
        />

        {/* Fix Video Modal */}
        <FixVideoModal video={fixVideo} isOpen={isFixModalOpen} onClose={() => setIsFixModalOpen(false)} />

        {/* Compare Modal */}
        <CompareModal videos={compareVideos} isOpen={isCompareModalOpen} onClose={() => setIsCompareModalOpen(false)} />

        {/* Video Detail Modal */}
        <ChannelVideoDetailModal
          video={selectedVideo}
          isOpen={!!selectedVideo}
          onClose={() => setSelectedVideo(null)}
          channelStats={stats}
        />
      </div>
    </>
  );
}
