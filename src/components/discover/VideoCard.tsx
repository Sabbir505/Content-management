"use client";

import { useState, useEffect } from "react";
import { VideoWithOutlier } from "@/types/video";
import { useRouter } from "next/navigation";
import React from "react";
import { ContextMenu, useContextMenu } from "./CardContextMenu";

// Deduplicate concurrent fetches for the same channelId
const channelFetchCache = new Map<string, Promise<string | null>>();

function fetchChannelThumbnail(channelId: string): Promise<string | null> {
  const cached = localStorage.getItem(`channel_thumb_${channelId}`);
  if (cached) return Promise.resolve(cached);

  if (channelFetchCache.has(channelId)) {
    return channelFetchCache.get(channelId)!;
  }

  const promise = fetch(`/api/youtube/channel?channelId=${channelId}`)
    .then((res) => res.json())
    .then((result) => {
      if (result.success && result.data?.thumbnail) {
        localStorage.setItem(`channel_thumb_${channelId}`, result.data.thumbnail);
        return result.data.thumbnail as string;
      }
      return null;
    })
    .catch(() => null)
    .finally(() => {
      channelFetchCache.delete(channelId);
    });

  channelFetchCache.set(channelId, promise);
  return promise;
}

interface VideoCardProps {
  video: VideoWithOutlier;
  onSave?: (video: VideoWithOutlier) => void;
}

export const VideoCard = React.memo(function VideoCard({ video, onSave }: VideoCardProps) {
  const router = useRouter();
  const [imageError, setImageError] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isBoostOpen, setIsBoostOpen] = useState(false);
  const [fullDescription, setFullDescription] = useState<string | null>(null);
  const [isLoadingDescription, setIsLoadingDescription] = useState(false);
  const [channelThumbnail, setChannelThumbnail] = useState<string | null>(null);
  const { isOpen, position, openMenu, closeMenu } = useContextMenu();

  // Fetch channel thumbnail with deduplication
  useEffect(() => {
    if (!video.channelId || channelThumbnail) return;
    let cancelled = false;
    fetchChannelThumbnail(video.channelId).then((url) => {
      if (!cancelled && url) setChannelThumbnail(url);
    });
    return () => { cancelled = true; };
  }, [video.channelId, channelThumbnail]);

  function handleDragStart(e: React.DragEvent) {
    const dragData = {
      type: "video",
      videoId: video.id,
      title: video.title,
      description: video.description,
      hookType: video.hookType,
      structure: video.estimatedStructure,
      thumbnail: video.thumbnail,
      channelTitle: video.channelTitle,
      viewCount: video.viewCount,
      outlierScore: video.outlierScore,
    };
    e.dataTransfer.setData("application/json", JSON.stringify(dragData));
    e.dataTransfer.effectAllowed = "copy";
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

  function formatDate(dateString: string): string {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffHours < 1) return "Just now";
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  }

  async function fetchFullDescription() {
    if (!video.id || fullDescription) return;
    setIsLoadingDescription(true);
    try {
      const response = await fetch(`/api/youtube/video?videoId=${video.id}`);
      const result = await response.json();
      if (result.success && result.data?.description) {
        setFullDescription(result.data.description);
      }
    } catch (error) {
      console.error("Failed to fetch video description:", error);
    } finally {
      setIsLoadingDescription(false);
    }
  }

  function openModal() {
    setIsModalOpen(true);
    fetchFullDescription();
  }

  const contextMenuItems = [
    {
      id: "add-to-board",
      label: "Add to board",
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
        </svg>
      ),
      onClick: () => onSave?.(video),
    },
    {
      id: "boost",
      label: "Boost",
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
        </svg>
      ),
      onClick: () => setIsBoostOpen(true),
    },
    {
      id: "not-language",
      label: "Not in my language",
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 5h12M9 3v2m1.048 9.448L8.5 15.5m-3.464-3.536L4.5 12m11.964-4.036L17.5 8.5m-3.464 3.536L15.5 12m-6.964-4.036L9.5 8.5m-3.464 3.536L8.5 12M12 21a9 9 0 110-18 9 9 0 010 18z" />
        </svg>
      ),
      onClick: () => {},
    },
    {
      id: "hide-creator",
      label: "Hide this creator",
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
        </svg>
      ),
      onClick: () => {},
    },
  ];

  const boostItems = [
    {
      id: "chat",
      label: "Chat with this post",
      description: "Open a new chat to riff on it",
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-4.72C3.512 14.042 3 12.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
        </svg>
      ),
      onClick: () => {
        router.push(`/boards?action=chat&videoId=${video.id}&title=${encodeURIComponent(video.title)}&description=${encodeURIComponent(video.description || "")}&type=video`);
        setIsBoostOpen(false);
      },
    },
    {
      id: "headline",
      label: "Headline Variations",
      description: "Brainstorm titles for your niche",
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      ),
      onClick: () => {
        router.push(`/boards?action=chat&videoId=${video.id}&title=${encodeURIComponent(video.title)}&intent=headlines&type=video`);
        setIsBoostOpen(false);
      },
    },
    {
      id: "post-ideas",
      label: "Break into Post Ideas",
      description: "Mine 5 short-post angles from this",
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
        </svg>
      ),
      onClick: () => {
        router.push(`/boards?action=chat&videoId=${video.id}&title=${encodeURIComponent(video.title)}&intent=post-ideas&type=video`);
        setIsBoostOpen(false);
      },
    },
    {
      id: "reverse-engineer",
      label: "Reverse Engineer",
      description: "Break down why it works",
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
      ),
      onClick: () => {
        router.push(`/boards?action=chat&videoId=${video.id}&title=${encodeURIComponent(video.title)}&intent=reverse-engineer&type=video`);
        setIsBoostOpen(false);
      },
    },
    {
      id: "replicate",
      label: "Replicate",
      description: "Use the structure yourself",
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-4 10h6a2 2 0 002-2v-8a2 2 0 00-2-2h-6a2 2 0 00-2 2v8a2 2 0 002 2z" />
        </svg>
      ),
      onClick: () => {
        router.push(`/boards?action=chat&videoId=${video.id}&title=${encodeURIComponent(video.title)}&intent=replicate&type=video`);
        setIsBoostOpen(false);
      },
    },
  ];

  return (
    <>
      <div
        className="group relative bg-[#101010] rounded-xl overflow-hidden border border-[#2a2a2a] hover:border-[#3a3a3a] transition-all duration-200 cursor-grab active:cursor-grabbing"
        draggable
        onDragStart={handleDragStart}
        onClick={openModal}
        onContextMenu={openMenu}
      >
        {/* Thumbnail */}
        {video.thumbnail && !imageError ? (
          <div className="relative w-full">
            <img
              src={video.thumbnail}
              alt={video.title || "Video thumbnail"}
              className="w-full h-auto object-cover"
              onError={() => setImageError(true)}
            />
            {/* Duration overlay */}
            {video.duration && (
              <div className="absolute bottom-2 right-2 bg-black/80 text-white text-xs px-1.5 py-0.5 rounded">
                {video.duration}
              </div>
            )}
          </div>
        ) : (
          <div className="w-full aspect-video bg-gradient-to-br from-[#252525] to-[#1a1a1a] flex items-center justify-center">
            <span className="text-3xl">▶️</span>
          </div>
        )}

        {/* Content */}
        <div className="p-3">
          {/* Title */}
          <h3 className="text-sm font-medium text-white leading-snug line-clamp-2 mb-2 group-hover:text-blue-400 transition-colors">
            {video.title}
          </h3>

          {/* Meta row: Profile pic + channel + views + time + outlier */}
          <div className="flex items-center gap-2">
            {/* Channel Profile Picture */}
            <div className="w-7 h-7 rounded-full overflow-hidden bg-[#2a2a2a] flex-shrink-0">
              {channelThumbnail ? (
                <img
                  src={channelThumbnail}
                  alt={video.channelTitle}
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = "none";
                  }}
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-[10px] text-[#888] font-medium">
                  {(video.channelTitle || "?")[0].toUpperCase()}
                </div>
              )}
            </div>

            {/* Channel name */}
            <span className="text-xs text-[#888] truncate max-w-[100px]">
              {video.channelTitle}
            </span>
          </div>

          {/* Stats row: views · time · outlier */}
          <div className="flex items-center gap-1.5 mt-1.5 text-xs text-[#666]">
            <span>{formatViews(video.viewCount)} views</span>
            <span>·</span>
            <span>{formatDate(video.publishedAt)}</span>
            {video.outlierScore > 1 && (
              <>
                <span>·</span>
                <span className="text-orange-400 font-medium">{video.outlierScore}x</span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Context Menu */}
      <ContextMenu items={contextMenuItems} isOpen={isOpen} position={position} onClose={closeMenu} />

      {/* Video Detail Modal */}
      {isModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          onClick={() => setIsModalOpen(false)}
        >
          <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" />
          <div
            className="relative w-full max-w-3xl max-h-[90vh] overflow-y-auto scrollbar-hide bg-[#0a0a0a] border border-[#2a2a2a] rounded-2xl shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Video Player */}
            <div className="relative w-full aspect-video bg-black">
              <iframe
                src={`https://www.youtube.com/embed/${video.id}?autoplay=0`}
                title={video.title}
                className="w-full h-full"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            </div>

            {/* Content */}
            <div className="p-6 space-y-4">
              {/* Title */}
              <h2 className="text-xl font-semibold text-white">{video.title}</h2>

              {/* Channel & Date */}
              <div className="flex items-center gap-2 text-sm text-[#888]">
                <span>{video.channelTitle}</span>
                <span>·</span>
                <span>{formatDate(video.publishedAt)}</span>
              </div>

              {/* Stats */}
              <div className="flex items-center gap-4 py-3 border-y border-[#2a2a2a]">
                <div className="text-center flex-1">
                  <p className="text-lg font-semibold text-white">{formatViews(video.viewCount)}</p>
                  <p className="text-xs text-[#888]">Views</p>
                </div>
                <div className="text-center flex-1">
                  <p className="text-lg font-semibold text-white">{video.outlierScore}x</p>
                  <p className="text-xs text-[#888]">Outlier</p>
                </div>
                <div className="text-center flex-1">
                  <p className="text-lg font-semibold text-white">{video.duration}</p>
                  <p className="text-xs text-[#888]">Duration</p>
                </div>
                <div className="text-center flex-1">
                  <p className="text-lg font-semibold text-white">{video.hookType}</p>
                  <p className="text-xs text-[#888]">Hook</p>
                </div>
              </div>

              {/* Description */}
              {(video.description || fullDescription || isLoadingDescription) && (
                <div>
                  <h3 className="text-sm font-medium text-white mb-2">Description</h3>
                  {isLoadingDescription ? (
                    <div className="w-full h-4 bg-[#1a1a1a] animate-pulse rounded" />
                  ) : (
                    <p className="text-sm text-[#888] whitespace-pre-wrap">
                      {fullDescription || video.description}
                    </p>
                  )}
                </div>
              )}

              {/* Actions */}
              <div className="flex items-center gap-3 pt-4">
                <button
                  onClick={() => {
                    setIsModalOpen(false);
                    onSave?.(video);
                  }}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors"
                >
                  Add to Board
                </button>
                <button
                  onClick={() => {
                    setIsModalOpen(false);
                    setIsBoostOpen(true);
                  }}
                  className="px-4 py-2 bg-[#2a2a2a] hover:bg-[#3a3a3a] text-white text-sm font-medium rounded-lg transition-colors"
                >
                  Boost
                </button>
                <a
                  href={`https://youtube.com/watch?v=${video.id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-4 py-2 border border-[#2a2a2a] hover:border-[#3a3a3a] text-white text-sm font-medium rounded-lg transition-colors"
                >
                  Watch on YouTube
                </a>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Boost Modal */}
      {isBoostOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          onClick={() => setIsBoostOpen(false)}
        >
          <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" />
          <div
            className="relative w-full max-w-sm bg-[#1a1a1a] border border-[#2a2a2a] rounded-2xl shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="p-4 border-b border-[#2a2a2a]">
              <h3 className="text-lg font-semibold text-white">Boost</h3>
            </div>

            {/* Boost Options */}
            <div className="p-2">
              {boostItems.map((item) => (
                <button
                  key={item.id}
                  onClick={item.onClick}
                  className="w-full flex items-start gap-3 p-3 rounded-lg hover:bg-[#2a2a2a] transition-colors text-left"
                >
                  <span className="text-[#888] mt-0.5">{item.icon}</span>
                  <div>
                    <p className="text-sm font-medium text-white">{item.label}</p>
                    <p className="text-xs text-[#888]">{item.description}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
});
