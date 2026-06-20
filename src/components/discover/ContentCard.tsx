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

      {/* Article Detail Modal */}
      {isModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          onClick={() => setIsModalOpen(false)}
        >
          <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" />
          <div
            className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto scrollbar-hide bg-[#0a0a0a] border border-[#2a2a2a] rounded-2xl shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Thumbnail */}
            {item.thumbnail && (
              <div className="relative w-full">
                <img
                  src={item.thumbnail}
                  alt={item.title}
                  className="w-full h-auto object-cover"
                />
              </div>
            )}

            {/* Content */}
            <div className="p-6 space-y-4">
              {/* Title */}
              <h2 className="text-xl font-semibold text-white">{item.title}</h2>

              {/* Author & Date */}
              <div className="flex items-center gap-2 text-sm text-[#888]">
                <span>{item.author || getSourceLabel(item.source)}</span>
                <span>·</span>
                <span>{formatDate(item.publishedAt)}</span>
              </div>

              {/* Stats */}
              <div className="flex items-center gap-4 py-3 border-y border-[#2a2a2a]">
                <div className="text-center">
                  <p className="text-lg font-semibold text-white">{formatScore(item.score)}</p>
                  <p className="text-xs text-[#888]">Score</p>
                </div>
                {item.commentCount !== undefined && (
                  <div className="text-center">
                    <p className="text-lg font-semibold text-white">{item.commentCount}</p>
                    <p className="text-xs text-[#888]">Comments</p>
                  </div>
                )}
              </div>

              {/* Description */}
              {(item.description || fullDescription || isLoadingDescription) && (
                <div>
                  <h3 className="text-sm font-medium text-white mb-2">Description</h3>
                  {isLoadingDescription ? (
                    <div className="w-full h-4 bg-[#1a1a1a] animate-pulse rounded" />
                  ) : (
                    <p className="text-sm text-[#888] whitespace-pre-wrap">
                      {fullDescription || item.description}
                    </p>
                  )}
                </div>
              )}

              {/* Actions */}
              <div className="flex items-center gap-3 pt-4">
                <button
                  onClick={() => {
                    setIsModalOpen(false);
                    onSave?.(item);
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
                  href={item.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-4 py-2 border border-[#2a2a2a] hover:border-[#3a3a3a] text-white text-sm font-medium rounded-lg transition-colors"
                >
                  Read Original
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
