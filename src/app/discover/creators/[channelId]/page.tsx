"use client";

import { useState, useEffect, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { CreatorVideo } from "@/types/creator";
import { toast } from "sonner";
import { formatCompactNumber } from "@/lib/format";
import { cn } from "@/lib/utils";

type VideoFilter = "recent" | "topLiked" | "topViewed" | "topOutlier";

export default function CreatorDetailPage() {
  const params = useParams();
  const channelId = params.channelId as string;
  const [videos, setVideos] = useState<CreatorVideo[]>([]);
  const [channelTitle, setChannelTitle] = useState("");
  const [channelThumbnail, setChannelThumbnail] = useState("");
  const [subscriberCount, setSubscriberCount] = useState(0);
  const [videoCount, setVideoCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [activeFilter, setActiveFilter] = useState<VideoFilter>("recent");
  const router = useRouter();

  function loadData() {
    if (!channelId) return;
    setIsLoading(true);
    setHasError(false);
    fetch(`/api/creators/${channelId}/videos?channelId=${channelId}`)
      .then((r) => r.json())
      .then((result) => {
        if (result.success) {
          setVideos(result.data.videos);
          setChannelTitle(result.data.channel.title);
          setChannelThumbnail(result.data.channel.thumbnail);
          setSubscriberCount(result.data.channel.subscriberCount);
          setVideoCount(result.data.channel.videoCount);
        } else {
          setHasError(true);
          toast.error(result.error || "Failed to load videos");
        }
      })
      .catch(() => {
        setHasError(true);
        toast.error("Failed to load videos");
      })
      .finally(() => setIsLoading(false));
  }

  useEffect(() => {
    // Defer so setState inside loadData doesn't run synchronously in the effect
    queueMicrotask(() => loadData());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channelId]);

  const filteredVideos = useMemo(() => {
    const sorted = [...videos];
    switch (activeFilter) {
      case "recent":
        sorted.sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime());
        break;
      case "topLiked":
        sorted.sort((a, b) => (b.likeCount || 0) - (a.likeCount || 0));
        break;
      case "topViewed":
        sorted.sort((a, b) => b.viewCount - a.viewCount);
        break;
      case "topOutlier":
        sorted.sort((a, b) => b.outlierScore - a.outlierScore);
        break;
    }
    return sorted;
  }, [videos, activeFilter]);

  const filters: { id: VideoFilter; label: string }[] = [
    { id: "recent", label: "Recent" },
    { id: "topLiked", label: "Top liked" },
    { id: "topViewed", label: "Top viewed" },
    { id: "topOutlier", label: "Top outlier" },
  ];



  return (
    <div className="min-h-screen bg-[#0a0a0a] p-4 md:p-6">
      {/* Back navigation */}
      <button
        onClick={() => router.back()}
        className="inline-flex items-center gap-1.5 text-sm text-[#888] hover:text-white transition-colors mb-4 outline-none focus-visible:ring-2 focus-visible:ring-[#3a3a3a]/50 rounded-md px-1 py-0.5"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 19l-7-7 7-7" />
        </svg>
        Back
      </button>

      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        {channelThumbnail ? (
          <Image src={channelThumbnail} alt={channelTitle} width={56} height={56} className="w-14 h-14 rounded-full object-cover border border-[#2a2a2a] flex-shrink-0" />
        ) : (
          <div className="w-14 h-14 rounded-full bg-[#1a1a1a] border border-[#2a2a2a] flex-shrink-0 animate-pulse" />
        )}
        <div className="min-w-0">
          <h1 className="text-xl font-semibold text-white truncate">{channelTitle || "Loading…"}</h1>
          <p className="text-sm text-[#888]">
            {subscriberCount.toLocaleString()} subscribers · {videoCount.toLocaleString()} videos
          </p>
        </div>
      </div>

      {/* Filter chips */}
      <div className="flex flex-wrap items-center gap-2 mb-6">
        {filters.map((f) => (
          <button
            key={f.id}
            onClick={() => setActiveFilter(f.id)}
            disabled={isLoading}
            className={cn(
              "px-4 py-1.5 rounded-full text-sm font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-[#3a3a3a]/50 disabled:opacity-50 disabled:cursor-not-allowed",
              activeFilter === f.id
                ? "bg-white text-black"
                : "bg-[#1a1a1a] text-[#ccc] hover:text-white hover:border-[#3a3a3a] border border-[#2a2a2a]"
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Video grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div
              key={i}
              className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg overflow-hidden"
            >
              <div className="h-32 w-full bg-[#222] animate-pulse" />
              <div className="p-3 space-y-2">
                <div className="h-3.5 bg-[#222] rounded animate-pulse" />
                <div className="h-3.5 w-2/3 bg-[#222] rounded animate-pulse" />
                <div className="flex gap-2 pt-1">
                  <div className="h-5 w-16 bg-[#222] rounded-full animate-pulse" />
                  <div className="h-5 w-16 bg-[#222] rounded-full animate-pulse" />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : hasError ? (
        <div className="flex flex-col items-center justify-center text-center py-16 px-4">
          <div className="w-12 h-12 rounded-full bg-[#1a1a1a] border border-[#2a2a2a] flex items-center justify-center mb-4">
            <svg className="w-6 h-6 text-[#888]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01M5 19h14a2 2 0 001.732-3l-7-12a2 2 0 00-3.464 0l-7 12A2 2 0 005 19z" />
            </svg>
          </div>
          <p className="text-sm text-white mb-1">Couldn&apos;t load videos</p>
          <p className="text-xs text-[#888] mb-4">Something went wrong while fetching this creator&apos;s videos.</p>
          <Button onClick={loadData} variant="outline" className="bg-[#1a1a1a] border-[#2a2a2a] text-white hover:border-[#3a3a3a] hover:bg-[#1a1a1a]">
            Try again
          </Button>
        </div>
      ) : filteredVideos.length === 0 ? (
        <div className="flex flex-col items-center justify-center text-center py-16 px-4">
          <div className="w-12 h-12 rounded-full bg-[#1a1a1a] border border-[#2a2a2a] flex items-center justify-center mb-4">
            <svg className="w-6 h-6 text-[#888]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
          </div>
          <p className="text-sm text-white mb-1">No videos yet</p>
          <p className="text-xs text-[#888]">This creator doesn&apos;t have any videos to show right now.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredVideos.map((video) => (
            <div
              key={video.id}
              className="group bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg overflow-hidden hover:border-[#3a3a3a] transition-colors cursor-pointer"
            >
              <div className="relative h-32 w-full bg-[#252525]">
                {video.thumbnail ? (
                  <Image src={video.thumbnail} alt={video.title} fill sizes="320px" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <svg className="w-8 h-8 text-[#4a4a4a]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                )}
                {video.outlierScore > 1.5 && (
                  <Badge className="absolute top-2 left-2 text-xs text-emerald-400 border border-emerald-500/30 bg-[#0a0a0a]/80 backdrop-blur-sm">
                    {video.outlierScore}x outlier
                  </Badge>
                )}
              </div>
              <div className="p-3">
                <h4 className="text-sm font-medium text-white line-clamp-2 group-hover:text-white">{video.title}</h4>
                <div className="flex items-center flex-wrap gap-2 mt-2">
                  <Badge variant="outline" className="text-xs border-[#2a2a2a] text-[#888]">
                    {formatCompactNumber(video.viewCount)} views
                  </Badge>
                  {video.hookType && (
                    <Badge variant="outline" className="text-xs border-[#2a2a2a] text-[#888]">
                      {video.hookType}
                    </Badge>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
