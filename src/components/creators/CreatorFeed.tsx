"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { CreatorVideo, TrackedCreator } from "@/types/creator";

interface CreatorFeedProps {
  creator: TrackedCreator;
  onVideoSelect?: (video: CreatorVideo) => void;
}

export function CreatorFeed({ creator, onVideoSelect }: CreatorFeedProps) {
  const [videos, setVideos] = useState<CreatorVideo[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadVideos();
  }, [creator.id]);

  async function loadVideos() {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/creators/${creator.channelId}/videos`);
      const result = await response.json();
      if (result.success) {
        setVideos(result.data.videos);
      }
    } catch (error) {
      console.error("Failed to load creator videos:", error);
    } finally {
      setIsLoading(false);
    }
  }

  function formatViews(viewCount: number): string {
    if (viewCount >= 1000000) {
      return `${(viewCount / 1000000).toFixed(1)}M`;
    }
    if (viewCount >= 1000) {
      return `${(viewCount / 1000).toFixed(1)}K`;
    }
    return viewCount.toString();
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Creator Header */}
      <div className="flex items-center gap-3 p-3 bg-[#1a1a1a] rounded-lg border border-[#2a2a2a]">
        {creator.thumbnail ? (
          <img src={creator.thumbnail} alt={creator.channelTitle} className="w-12 h-12 rounded-full object-cover" />
        ) : (
          <div className="w-12 h-12 rounded-full bg-[#2a2a2a] flex items-center justify-center">
            <svg className="w-6 h-6 text-[#666]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
          </div>
        )}
        <div>
          <h3 className="text-sm font-medium text-white">{creator.channelTitle}</h3>
          <p className="text-xs text-[#888]">
            {creator.subscriberCount?.toLocaleString()} subscribers · {creator.videoCount?.toLocaleString()} videos
          </p>
        </div>
      </div>

      {/* Videos Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {videos.map((video) => (
          <button
            key={video.id}
            onClick={() => onVideoSelect?.(video)}
            className="text-left bg-[#1a1a1a] rounded-lg border border-[#2a2a2a] overflow-hidden hover:border-[#3a3a3a] transition-colors"
          >
            <div className="relative h-32 w-full">
              {video.thumbnail ? (
                <img src={video.thumbnail} alt={video.title} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full bg-[#252525] flex items-center justify-center">
                  <svg className="w-8 h-8 text-[#4a4a4a]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
              )}
              {video.outlierScore > 0 && (
                <Badge className="absolute top-2 left-2 bg-orange-500 text-white text-xs">
                  {video.outlierScore}x outlier
                </Badge>
              )}
            </div>
            <div className="p-3">
              <h4 className="text-sm font-medium text-white line-clamp-2">{video.title}</h4>
              <div className="flex items-center gap-2 mt-2">
                <Badge variant="outline" className="text-xs border-[#2a2a2a] text-[#888]">
                  {formatViews(video.viewCount)} views
                </Badge>
                <Badge variant="outline" className="text-xs border-[#2a2a2a] text-[#888]">
                  {video.hookType}
                </Badge>
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
