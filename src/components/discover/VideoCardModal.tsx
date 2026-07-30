"use client";

import Image from "next/image";
import { VideoWithOutlier } from "@/types/video";
import { blockItem } from "@/lib/blocklist";
import { formatCompactNumber } from "@/lib/format";
import { toast } from "sonner";

interface VideoCardModalProps {
  video: VideoWithOutlier;
  channelThumbnail: string | null;
  fullDescription: string | null;
  transcript: string | null;
  isLoadingDescription: boolean;
  isLoadingTranscript: boolean;
  onClose: () => void;
  onBoost: () => void;
  onSave?: (video: VideoWithOutlier) => void;
}

export function VideoCardModal({
  video,
  channelThumbnail,
  fullDescription,
  transcript,
  isLoadingDescription,
  isLoadingTranscript,
  onClose,
  onBoost,
  onSave,
}: VideoCardModalProps) {
  function handleHide() {
    blockItem(video.id);
    toast.success("Hid this video");
    window.dispatchEvent(new Event("tubeforge-blocklist-updated"));
    onClose();
  }

  function handleSave() {
    onClose();
    onSave?.({ ...video, description: fullDescription || video.description, transcript: transcript || video.transcript });
  }

  function handleDownloadThumbnail() {
    if (!video.thumbnail) return;
    const a = document.createElement("a");
    a.href = video.thumbnail;
    a.download = `${video.title || "thumbnail"}.jpg`;
    a.target = "_blank";
    a.click();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" />
      <div
        className="relative w-full max-w-3xl max-h-[90vh] overflow-y-auto scrollbar-hide bg-[#0f0f0f] border border-[#2a2a2a] rounded-2xl shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-[#1a1a1a]">
          <div className="flex items-center gap-2">
            <svg className="w-5 h-5 text-red-500" viewBox="0 0 24 24" fill="currentColor"><path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg>
            <span className="text-sm text-white font-medium truncate max-w-[400px]">{video.title}</span>
          </div>
          <div className="flex items-center gap-1">
            <button onClick={() => { onClose(); onBoost(); }} className="p-2 hover:bg-[#2a2a2a] rounded-lg transition-colors" title="Boost">
              <svg className="w-4 h-4 text-[#888]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
            </button>
            <button onClick={handleHide} className="p-2 hover:bg-[#2a2a2a] rounded-lg transition-colors" title="Hide">
              <svg className="w-4 h-4 text-[#888]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M3 3l18 18" /></svg>
            </button>
            <button onClick={handleSave} className="p-2 hover:bg-[#2a2a2a] rounded-lg transition-colors" title="Save">
              <svg className="w-4 h-4 text-[#888]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" /></svg>
            </button>
            <a href={`https://youtube.com/watch?v=${video.id}`} target="_blank" rel="noopener noreferrer" className="p-2 hover:bg-[#2a2a2a] rounded-lg transition-colors" title="Open">
              <svg className="w-4 h-4 text-[#888]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
            </a>
            <button onClick={onClose} className="p-2 hover:bg-[#2a2a2a] rounded-lg transition-colors" title="Close">
              <svg className="w-4 h-4 text-[#888]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>
        </div>

        <div className="relative w-full aspect-video bg-black">
          <iframe
            src={`https://www.youtube.com/embed/${video.id}?autoplay=0`}
            title={video.title}
            className="w-full h-full"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        </div>

        <div className="flex items-center justify-between px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full overflow-hidden bg-[#2a2a2a] flex-shrink-0">
              {channelThumbnail ? (
                <Image src={channelThumbnail} alt={video.channelTitle} width={40} height={40} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-sm text-[#888] font-medium">
                  {(video.channelTitle || "?")[0].toUpperCase()}
                </div>
              )}
            </div>
            <div>
              <p className="text-sm font-medium text-white">{video.channelTitle}</p>
              <p className="text-xs text-[#666]">@{(video.channelTitle || "").toLowerCase().replace(/\s+/g, "")} · {new Date(video.publishedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}, {new Date(video.publishedAt).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}</p>
            </div>
          </div>
          <button
            onClick={handleDownloadThumbnail}
            className="flex items-center gap-1.5 px-3 py-1.5 border border-[#2a2a2a] rounded-lg text-xs text-[#888] hover:text-white hover:border-[#3a3a3a] transition-colors"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
            Thumbnail
          </button>
        </div>

        <div className="flex items-center gap-4 px-5 py-3 border-y border-[#1a1a1a] bg-[#0a0a0a]">
          {video.outlierScore > 0 && (
            <span className="flex items-center gap-1 text-xs">
              <svg className="w-3.5 h-3.5 text-emerald-400" fill="currentColor" viewBox="0 0 24 24"><path d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
              <span className="text-emerald-400 font-semibold">{video.outlierScore}x</span>
              <span className="text-[#666]">vs views</span>
            </span>
          )}
          {video.subscriberWeightedOutlier && video.subscriberWeightedOutlier > video.outlierScore && (
            <span className="flex items-center gap-1 text-xs" title="Subscriber-weighted outlier (small creator bonus)">
              <svg className="w-3.5 h-3.5 text-emerald-400" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2L2 22h20L12 2zm0 3.5L18.5 20H5.5L12 5.5z"/></svg>
              <span className="text-emerald-400 font-semibold">{video.subscriberWeightedOutlier}x</span>
              <span className="text-[#666]">weighted</span>
            </span>
          )}
          {video.subscriberCount !== undefined && video.subscriberCount > 0 && (
            <span className="flex items-center gap-1 text-xs text-[#888]">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
              <span className="font-semibold text-white">{formatCompactNumber(video.subscriberCount)}</span> subs
            </span>
          )}
          <span className="flex items-center gap-1 text-xs text-[#888]">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
            <span className="font-semibold text-white">{formatCompactNumber(video.viewCount)}</span> views
          </span>
          {video.likeCount !== undefined && video.likeCount > 0 && (
            <span className="flex items-center gap-1 text-xs text-[#888]">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" /></svg>
              <span className="font-semibold text-white">{formatCompactNumber(video.likeCount || 0)}</span> likes
            </span>
          )}
          {video.commentCount !== undefined && video.commentCount > 0 && (
            <span className="flex items-center gap-1 text-xs text-[#888]">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-4.72C3.512 14.042 3 12.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>
              <span className="font-semibold text-white">{video.commentCount}</span> comments
            </span>
          )}
          {video.viewCount > 0 && (video.likeCount || 0) > 0 && (
            <span className="flex items-center gap-1 text-xs text-[#888]">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" /></svg>
              <span className="font-semibold text-white">{(((video.likeCount || 0) + (video.commentCount || 0)) / video.viewCount * 100).toFixed(2)}%</span> eng. rate
            </span>
          )}
          {video.velocityTrend !== undefined && video.velocityTrend !== 0 && (
            <span className="flex items-center gap-1 text-xs" title="Views per hour trend since last fetch">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>
              <span className={video.velocityTrend > 0 ? "text-emerald-400 font-semibold" : "text-red-400 font-semibold"}>
                {video.velocityTrend > 0 ? "↑" : "↓"} {formatCompactNumber(Math.abs(video.velocityTrend))}/h
              </span>
            </span>
          )}
        </div>

        <div className="px-5 pt-5 pb-3">
          <h2 className="text-lg font-semibold text-white">{video.title}</h2>
        </div>

        <div className="mx-5 mb-4 bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[10px] font-semibold tracking-widest text-[#666] uppercase">Description</span>
            <button
              onClick={() => navigator.clipboard.writeText(fullDescription || video.description || "")}
              className="flex items-center gap-1 px-2 py-1 text-xs text-[#888] hover:text-white border border-[#2a2a2a] rounded-md hover:border-[#3a3a3a] transition-colors"
            >
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
              Copy
            </button>
          </div>
          {isLoadingDescription ? (
            <div className="space-y-2">
              <div className="w-full h-3 bg-[#252525] animate-pulse rounded" />
              <div className="w-3/4 h-3 bg-[#252525] animate-pulse rounded" />
            </div>
          ) : (
            <p className="text-sm text-[#ccc] whitespace-pre-wrap leading-relaxed">
              {fullDescription || video.description || "No description available."}
            </p>
          )}
        </div>

        <div className="mx-5 mb-5 bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[10px] font-semibold tracking-widest text-[#666] uppercase">Transcript</span>
            <button
              onClick={() => navigator.clipboard.writeText(transcript || "")}
              className="flex items-center gap-1 px-2 py-1 text-xs text-[#888] hover:text-white border border-[#2a2a2a] rounded-md hover:border-[#3a3a3a] transition-colors"
            >
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
              Copy
            </button>
          </div>
          {isLoadingTranscript ? (
            <div className="space-y-2">
              <div className="w-full h-3 bg-[#252525] animate-pulse rounded" />
              <div className="w-5/6 h-3 bg-[#252525] animate-pulse rounded" />
              <div className="w-2/3 h-3 bg-[#252525] animate-pulse rounded" />
            </div>
          ) : transcript ? (
            <p className="text-sm text-[#ccc] whitespace-pre-wrap leading-relaxed max-h-[300px] overflow-y-auto scrollbar-hide">
              {transcript}
            </p>
          ) : (
            <p className="text-xs text-[#666] italic">Transcript not available for this video.</p>
          )}
        </div>
      </div>
    </div>
  );
}
