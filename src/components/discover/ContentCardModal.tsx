"use client";

import Image from "next/image";
import type { ContentItem } from "@/types/content";
import { blockItem } from "@/lib/blocklist";
import { formatCompactNumber } from "@/lib/format";
import { getSourceIcon, getSourceLabel } from "@/lib/content/sources";
import { toast } from "sonner";

interface ContentCardModalProps {
  item: ContentItem;
  fullDescription: string | null;
  isLoadingDescription: boolean;
  onClose: () => void;
  onBoost: () => void;
  onSave?: (item: ContentItem) => void;
}

export function ContentCardModal({
  item,
  fullDescription,
  isLoadingDescription,
  onClose,
  onBoost,
  onSave,
}: ContentCardModalProps) {
  function handleHide() {
    blockItem(item.id);
    toast.success("Hid this item");
    window.dispatchEvent(new Event("tubeforge-blocklist-updated"));
    onClose();
  }

  function handleSave() {
    onClose();
    onSave?.({ ...item, description: fullDescription || item.description });
  }

  function handleDownloadThumbnail() {
    if (!item.thumbnail) return;
    const a = document.createElement("a");
    a.href = item.thumbnail;
    a.download = `${item.title || "thumbnail"}.jpg`;
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
            <span className="text-base">{getSourceIcon(item.source)}</span>
            <span className="text-sm text-white font-medium truncate max-w-[400px]">{item.title}</span>
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
            <a href={item.url} target="_blank" rel="noopener noreferrer" className="p-2 hover:bg-[#2a2a2a] rounded-lg transition-colors" title="Open">
              <svg className="w-4 h-4 text-[#888]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
            </a>
            <button onClick={onClose} className="p-2 hover:bg-[#2a2a2a] rounded-lg transition-colors" title="Close">
              <svg className="w-4 h-4 text-[#888]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>
        </div>

        {item.thumbnail && (
          <div className="relative w-full bg-[#0a0a0a] flex items-center justify-center">
            <Image
              src={item.thumbnail}
              alt={item.title}
              width={800}
              height={400}
              className="max-w-full max-h-[400px] object-contain"
            />
          </div>
        )}

        <div className="flex items-center justify-between px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full overflow-hidden bg-[#2a2a2a] flex-shrink-0 flex items-center justify-center">
              <span className="text-lg">{getSourceIcon(item.source)}</span>
            </div>
            <div>
              <p className="text-sm font-medium text-white">{item.author || getSourceLabel(item.source)}</p>
              <p className="text-xs text-[#666]">@{(item.author || item.source || "").toLowerCase().replace(/\s+/g, "")} · {new Date(item.publishedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}, {new Date(item.publishedAt).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}</p>
            </div>
          </div>
          {item.thumbnail && (
            <button
              onClick={handleDownloadThumbnail}
              className="flex items-center gap-1.5 px-3 py-1.5 border border-[#2a2a2a] rounded-lg text-xs text-[#888] hover:text-white hover:border-[#3a3a3a] transition-colors"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
              Thumbnail
            </button>
          )}
        </div>

        <div className="flex items-center gap-4 px-5 py-3 border-y border-[#1a1a1a] bg-[#0a0a0a]">
          {item.outlierScore && item.outlierScore > 1 && (
            <span className="flex items-center gap-1 text-xs">
              <svg className="w-3.5 h-3.5 text-emerald-400" fill="currentColor" viewBox="0 0 24 24"><path d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
              <span className="text-emerald-400 font-semibold">{item.outlierScore}x</span>
              <span className="text-[#666]">vs likes</span>
            </span>
          )}
          {item.score > 0 && (
            <span className="flex items-center gap-1 text-xs text-[#888]">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" /></svg>
              <span className="font-semibold text-white">{formatCompactNumber(item.score)}</span> likes
            </span>
          )}
          {item.commentCount !== undefined && item.commentCount > 0 && (
            <span className="flex items-center gap-1 text-xs text-[#888]">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-4.72C3.512 14.042 3 12.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>
              <span className="font-semibold text-white">{item.commentCount}</span> comments
            </span>
          )}
          {item.shareCount !== undefined && item.shareCount > 0 && (
            <span className="flex items-center gap-1 text-xs text-[#888]">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8M16 6l-4-4-4 4M12 2v13" /></svg>
              <span className="font-semibold text-white">{item.shareCount}</span> shares
            </span>
          )}
          {item.score > 0 && item.commentCount !== undefined && item.commentCount > 0 && (
            <span className="flex items-center gap-1 text-xs text-[#888]">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" /></svg>
              <span className="font-semibold text-white">{((item.commentCount / item.score) * 100).toFixed(2)}%</span> eng. rate
            </span>
          )}
        </div>

        <div className="mx-5 my-5 bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[10px] font-semibold tracking-widest text-[#666] uppercase">Note</span>
            <button
              onClick={() => {
                const text = fullDescription || item.description || "";
                if (navigator.clipboard?.writeText) {
                  navigator.clipboard.writeText(text).then(() => toast.success("Copied")).catch(() => toast.error("Copy failed"));
                }
              }}
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
              <div className="w-5/6 h-3 bg-[#252525] animate-pulse rounded" />
            </div>
          ) : (
            <p className="text-sm text-[#ccc] whitespace-pre-wrap leading-relaxed">
              {fullDescription || item.description || "No content available."}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
