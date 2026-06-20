"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import type { ContentItem } from "@/types/content";
import { useRouter } from "next/navigation";
import React from "react";
import { ContextMenu, useContextMenu } from "./CardContextMenu";

interface ContentCardProps {
  item: ContentItem;
  onSave?: (item: ContentItem) => void;
}

export const ContentCard = React.memo(function ContentCard({ item, onSave }: ContentCardProps) {
  const router = useRouter();
  const [imageError, setImageError] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isBoostOpen, setIsBoostOpen] = useState(false);
  const [fullDescription, setFullDescription] = useState<string | null>(null);
  const [isLoadingDescription, setIsLoadingDescription] = useState(false);
  const { isOpen, position, openMenu, closeMenu } = useContextMenu();

  function handleDragStart(e: React.DragEvent) {
    const dragData = {
      type: "article",
      title: item.title,
      url: item.url,
      content: item.description || "",
      author: item.author,
      thumbnail: item.thumbnail,
      source: item.source,
    };
    e.dataTransfer.setData("application/json", JSON.stringify(dragData));
    e.dataTransfer.effectAllowed = "copy";
  }

  function formatScore(score: number): string {
    if (score >= 1000) {
      return `${(score / 1000).toFixed(1)}K`;
    }
    return score.toString();
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

  function getSourceIcon(source: string): string {
    switch (source) {
      case "hackernews":
        return "🟠";
      case "reddit":
        return "🔴";
      case "devto":
        return "🟣";
      case "googlenews":
        return "🔵";
      case "x":
        return "𝕏";
      case "substack":
        return "📰";
      case "instagram":
        return "📷";
      case "tiktok":
        return "🎵";
      case "linkedin":
        return "💼";
      default:
        return "📄";
    }
  }

  function getSourceLabel(source: string): string {
    switch (source) {
      case "hackernews":
        return "Hacker News";
      case "reddit":
        return "Reddit";
      case "devto":
        return "DEV.to";
      case "googlenews":
        return "Google News";
      case "x":
        return "X/Twitter";
      case "substack":
        return "Substack";
      case "instagram":
        return "Instagram";
      case "tiktok":
        return "TikTok";
      case "linkedin":
        return "LinkedIn";
      default:
        return source;
    }
  }

  async function fetchFullDescription() {
    if (!item.url || fullDescription) return;
    setIsLoadingDescription(true);
    try {
      const response = await fetch(`/api/content/article?url=${encodeURIComponent(item.url)}`);
      const result = await response.json();
      if (result.success && result.data?.content) {
        setFullDescription(result.data.content);
      }
    } catch (error) {
      console.error("Failed to fetch article description:", error);
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
      onClick: () => onSave?.(item),
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
        router.push(`/boards?action=chat&url=${encodeURIComponent(item.url)}&title=${encodeURIComponent(item.title)}&type=article`);
        setIsBoostOpen(false);
      },
    },
    {
      id: "post-card",
      label: "Make a Post Card",
      description: "Turn it into a quote-card image",
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-4 10h6a2 2 0 002-2v-8a2 2 0 00-2-2h-6a2 2 0 00-2 2v8a2 2 0 002 2z" />
        </svg>
      ),
      onClick: () => {
        router.push(`/boards?action=chat&url=${encodeURIComponent(item.url)}&title=${encodeURIComponent(item.title)}&intent=post-card&type=article`);
        setIsBoostOpen(false);
      },
    },
    {
      id: "expand-longform",
      label: "Expand to Longform",
      description: "Draft a full piece from this",
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      ),
      onClick: () => {
        router.push(`/boards?action=chat&url=${encodeURIComponent(item.url)}&title=${encodeURIComponent(item.title)}&intent=longform&type=article`);
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
        router.push(`/boards?action=chat&url=${encodeURIComponent(item.url)}&title=${encodeURIComponent(item.title)}&intent=reverse-engineer&type=article`);
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
        router.push(`/boards?action=chat&url=${encodeURIComponent(item.url)}&title=${encodeURIComponent(item.title)}&intent=replicate&type=article`);
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
        {item.thumbnail && !imageError ? (
          <div className="relative w-full">
            <img
              src={item.thumbnail}
              alt={item.title || "Content thumbnail"}
              className="w-full h-auto object-cover"
              onError={() => setImageError(true)}
            />
            {/* Duration overlay if available */}
            <div className="absolute bottom-2 right-2 bg-black/80 text-white text-xs px-1.5 py-0.5 rounded">
              {formatDate(item.publishedAt)}
            </div>
          </div>
        ) : (
          <div className="w-full aspect-video bg-gradient-to-br from-[#252525] to-[#1a1a1a] flex items-center justify-center">
            <span className="text-3xl">{getSourceIcon(item.source)}</span>
          </div>
        )}

        {/* Content */}
        <div className="p-3">
          {/* Title */}
          <h3 className="text-sm font-medium text-white leading-snug line-clamp-2 mb-2 group-hover:text-blue-400 transition-colors">
            {item.title}
          </h3>

          {/* Meta row */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {/* Source icon */}
              <span className="text-xs">{getSourceIcon(item.source)}</span>
              {/* Author */}
              <span className="text-xs text-[#888] truncate max-w-[120px]">
                {item.author || getSourceLabel(item.source)}
              </span>
            </div>

            {/* Score */}
            {item.score > 0 && (
              <span className="text-xs text-[#666]">
                {formatScore(item.score)} pts
              </span>
            )}
          </div>

          {/* Tags row */}
          <div className="flex items-center gap-1.5 mt-2">
            <Badge variant="outline" className="text-[10px] border-[#2a2a2a] text-[#888] px-1.5 py-0.5">
              {getSourceLabel(item.source)}
            </Badge>
            {item.commentCount !== undefined && item.commentCount > 0 && (
              <Badge variant="outline" className="text-[10px] border-[#2a2a2a] text-[#888] px-1.5 py-0.5">
                {item.commentCount} comments
              </Badge>
            )}
          </div>
        </div>
      </div>

      {/* Context Menu */}
      <ContextMenu items={contextMenuItems} isOpen={isOpen} position={position} onClose={closeMenu} />

      {/* Article Detail Modal — Eden style */}
      {isModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          onClick={() => setIsModalOpen(false)}
        >
          <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" />
          <div
            className="relative w-full max-w-3xl max-h-[90vh] overflow-y-auto scrollbar-hide bg-[#0f0f0f] border border-[#2a2a2a] rounded-2xl shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header bar */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-[#1a1a1a]">
              <div className="flex items-center gap-2">
                <span className="text-base">{getSourceIcon(item.source)}</span>
                <span className="text-sm text-white font-medium truncate max-w-[400px]">{item.title}</span>
              </div>
              <div className="flex items-center gap-1">
                <button onClick={() => { setIsModalOpen(false); setIsBoostOpen(true); }} className="p-2 hover:bg-[#2a2a2a] rounded-lg transition-colors" title="Boost">
                  <svg className="w-4 h-4 text-[#888]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                </button>
                <button className="p-2 hover:bg-[#2a2a2a] rounded-lg transition-colors" title="Hide">
                  <svg className="w-4 h-4 text-[#888]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M3 3l18 18" /></svg>
                </button>
                <button onClick={() => { setIsModalOpen(false); onSave?.(item); }} className="p-2 hover:bg-[#2a2a2a] rounded-lg transition-colors" title="Save">
                  <svg className="w-4 h-4 text-[#888]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" /></svg>
                </button>
                <a href={item.url} target="_blank" rel="noopener noreferrer" className="p-2 hover:bg-[#2a2a2a] rounded-lg transition-colors" title="Open">
                  <svg className="w-4 h-4 text-[#888]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
                </a>
                <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-[#2a2a2a] rounded-lg transition-colors" title="Close">
                  <svg className="w-4 h-4 text-[#888]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>
            </div>

            {/* Thumbnail */}
            {item.thumbnail && (
              <div className="relative w-full bg-[#0a0a0a] flex items-center justify-center">
                <img
                  src={item.thumbnail}
                  alt={item.title}
                  className="max-w-full max-h-[400px] object-contain"
                />
              </div>
            )}

            {/* Author section */}
            <div className="flex items-center justify-between px-5 py-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full overflow-hidden bg-[#2a2a2a] flex-shrink-0 flex items-center justify-center">
                  <span className="text-lg">{getSourceIcon(item.source)}</span>
                </div>
                <div>
                  <p className="text-sm font-medium text-white">{item.author || getSourceLabel(item.source)}</p>
                  <p className="text-xs text-[#666]">@{(item.author || item.source).toLowerCase().replace(/\s+/g, "")} · {new Date(item.publishedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}, {new Date(item.publishedAt).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}</p>
                </div>
              </div>
              {item.thumbnail && (
                <button
                  onClick={() => { const a = document.createElement("a"); a.href = item.thumbnail!; a.download = `${item.title || "thumbnail"}.jpg`; a.target = "_blank"; a.click(); }}
                  className="flex items-center gap-1.5 px-3 py-1.5 border border-[#2a2a2a] rounded-lg text-xs text-[#888] hover:text-white hover:border-[#3a3a3a] transition-colors"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                  Thumbnail
                </button>
              )}
            </div>

            {/* Stats bar */}
            <div className="flex items-center gap-4 px-5 py-3 border-y border-[#1a1a1a] bg-[#0a0a0a]">
              {item.outlierScore && item.outlierScore > 1 && (
                <span className="flex items-center gap-1 text-xs">
                  <svg className="w-3.5 h-3.5 text-orange-400" fill="currentColor" viewBox="0 0 24 24"><path d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                  <span className="text-orange-400 font-semibold">{item.outlierScore}x</span>
                  <span className="text-[#666]">vs likes</span>
                </span>
              )}
              {item.score > 0 && (
                <span className="flex items-center gap-1 text-xs text-[#888]">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" /></svg>
                  <span className="font-semibold text-white">{formatScore(item.score)}</span> likes
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

            {/* Note / Content section */}
            <div className="mx-5 my-5 bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-4">
              <div className="flex items-center justify-between mb-3">
                <span className="text-[10px] font-semibold tracking-widest text-[#666] uppercase">Note</span>
                <button
                  onClick={() => navigator.clipboard.writeText(fullDescription || item.description || "")}
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
