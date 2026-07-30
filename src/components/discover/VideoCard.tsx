"use client";

import { useState, useEffect, useRef } from "react";
import Image from "next/image";
import { VideoWithOutlier } from "@/types/video";
import React from "react";
import { ContextMenu, useContextMenu } from "./CardContextMenu";
import { VideoCardModal } from "./VideoCardModal";
import { formatDateRelative, formatCompactNumber } from "@/lib/format";
import { useCardState } from "@/hooks/useCardState";
import { useVideoCardData } from "@/hooks/useVideoCardData";
import { buildContextMenuItems, buildBoostItems } from "./VideoCardMenus";
import { BoostModal } from "./BoostModal";

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
  onChatOpen?: (video: VideoWithOutlier, initialPrompt?: string) => void;
}

export const VideoCard = React.memo(function VideoCard({ video, onSave, onChatOpen }: VideoCardProps) {
  const {
    imageError,
    setImageError,
    isModalOpen,
    isBoostOpen,
    fullDescription,
    setFullDescription,
    isLoadingDescription,
    setIsLoadingDescription,
    openModal: openCardModal,
    closeModal,
    openBoost,
    closeBoost,
  } = useCardState({ onModalOpen: () => { fetchRef.current?.(); } });
  const { transcript, isLoadingTranscript, fetchFullDescription, fetchTranscript } = useVideoCardData({
    videoId: video.id,
    fullDescription,
    setFullDescription,
    setIsLoadingDescription,
  });
  const fetchRef = useRef<() => void>(null);
  fetchRef.current = () => { fetchFullDescription(); fetchTranscript(); };

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

  const [isSaved, setIsSaved] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  async function handleSave(videoToSave: VideoWithOutlier = video) {
    if (isSaved || isSaving || !onSave) return;
    setIsSaving(true);

    let saveVideo = videoToSave;
    if (!fullDescription) {
      const description = await fetchVideoDescription(videoToSave.id);
      if (description) {
        saveVideo = { ...videoToSave, description };
        setFullDescription(description);
      }
    }

    if (!saveVideo.transcript) {
      const transcript = await fetchVideoTranscript(videoToSave.id);
      if (transcript) {
        saveVideo = { ...saveVideo, transcript };
      }
    }

    onSave(saveVideo);
    setIsSaving(false);
    setIsSaved(true);
  }

  function handleSaveClick() {
    void handleSave();
  }

  function handleCardClick(e: React.MouseEvent) {
    const target = e.target as HTMLElement;
    if (target.closest(".card-action-btn")) return;
    openCardModal();
  }

  async function fetchVideoDescription(videoId: string): Promise<string | null> {
    try {
      const response = await fetch(`/api/youtube/video?videoId=${videoId}`);
      const result = await response.json();
      if (result.success && result.data?.description) {
        return result.data.description;
      }
    } catch (error) {
      console.error("Failed to fetch video description for save:", error);
    }
    return null;
  }

  async function fetchVideoTranscript(videoId: string): Promise<string | null> {
    try {
      const response = await fetch(`/api/youtube/transcript?videoId=${videoId}`);
      const result = await response.json();
      if (result.success && result.data?.transcript) {
        return result.data.transcript;
      }
    } catch (error) {
      console.error("Failed to fetch video transcript for save:", error);
    }
    return null;
  }

  const contextMenuItems = buildContextMenuItems(video, handleSave, openBoost);

  const boostItems = buildBoostItems(video, onChatOpen, closeBoost);

  return (
    <>
      <div
        className="group relative bg-[#101010] rounded-xl overflow-hidden border border-[#2a2a2a] hover:border-[#3a3a3a] transition-all duration-200 cursor-grab active:cursor-grabbing"
        draggable
        onDragStart={handleDragStart}
        onClick={handleCardClick}
        onContextMenu={openMenu}
      >
        {/* Thumbnail */}
        {video.thumbnail && !imageError ? (
          <div className="relative w-full">
            <Image
              src={video.thumbnail}
              alt={video.title || "Video thumbnail"}
              width={480}
              height={270}
              className="w-full h-auto object-cover"
              onError={() => setImageError(true)}
            />
            {/* Hover action buttons */}
            <div className="absolute top-2 right-2 flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity duration-200"
            >
              <button
                onClick={(e) => { e.stopPropagation(); void handleSaveClick(); }}
                className="card-action-btn p-1.5 bg-black/70 hover:bg-black/90 rounded-lg backdrop-blur-sm transition-colors disabled:opacity-50"
                title={isSaved ? "Saved to My Ideas" : "Save to My Ideas"}
                disabled={isSaving}
              >
                {isSaving ? (
                  <svg className="w-4 h-4 text-white animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                ) : (
                  <svg className={`w-4 h-4 ${isSaved ? "text-emerald-400 fill-emerald-400" : "text-white"}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
                  </svg>
                )}
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); openBoost(); }}
                className="card-action-btn p-1.5 bg-black/70 hover:bg-black/90 rounded-lg backdrop-blur-sm transition-colors"
                title="Boost"
              >
                <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </button>
            </div>
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
          <h3 className="text-sm font-medium text-white leading-snug line-clamp-2 mb-2 group-hover:text-[#ccc] transition-colors">
            {video.title}
          </h3>

          {/* Meta row: Profile pic + channel + views + time + outlier */}
          <div className="flex items-center gap-2">
            {/* Channel Profile Picture */}
            <div className="w-7 h-7 rounded-full overflow-hidden bg-[#2a2a2a] flex-shrink-0">
              {channelThumbnail ? (
                <Image
                  src={channelThumbnail}
                  alt={video.channelTitle}
                  width={28}
                  height={28}
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

          {/* Stats row: views · time · outlier · subscriber-weighted */}
          <div className="flex items-center gap-1.5 mt-1.5 text-xs text-[#666]">
            <span>{formatCompactNumber(video.viewCount)} views</span>
            <span>·</span>
            <span>{formatDateRelative(video.publishedAt)}</span>
            {video.outlierScore > 0 && (
              <>
                <span>·</span>
                <span className="text-emerald-400 font-medium">{video.outlierScore}x</span>
              </>
            )}
            {video.subscriberWeightedOutlier && video.subscriberWeightedOutlier > video.outlierScore && (
              <>
                <span>·</span>
                <span className="text-emerald-400 font-medium" title="Subscriber-weighted outlier (small creator bonus)">
                  {video.subscriberWeightedOutlier}x
                </span>
              </>
            )}
            {video.velocityTrend !== undefined && video.velocityTrend !== 0 && (
              <>
                <span>·</span>
                <span className={video.velocityTrend > 0 ? "text-emerald-400" : "text-red-400"} title="Views per hour trend">
                  {video.velocityTrend > 0 ? "↑" : "↓"}
                </span>
              </>
            )}
            {video.discoveryScore !== undefined && (
              <>
                <span>·</span>
                <span className="text-[#ccc] font-medium" title="Discovery score (0-100)">
                  {video.discoveryScore}
                </span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Context Menu */}
      <ContextMenu items={contextMenuItems} isOpen={isOpen} position={position} onClose={closeMenu} />

      {/* Video Detail Modal */}
      {isModalOpen && (
        <VideoCardModal
          video={video}
          channelThumbnail={channelThumbnail}
          fullDescription={fullDescription}
          transcript={transcript}
          isLoadingDescription={isLoadingDescription}
          isLoadingTranscript={isLoadingTranscript}
          onClose={closeModal}
          onBoost={openBoost}
          onSave={onSave}
        />
      )}

      <BoostModal isOpen={isBoostOpen} onClose={closeBoost} items={boostItems} />
    </>
  );
});
