"use client";

import Image from "next/image";
import { Badge } from "@/components/ui/badge";
import type { ContentItem } from "@/types/content";
import React, { useState } from "react";
import { ContextMenu, useContextMenu } from "./CardContextMenu";
import { ContentCardModal } from "./ContentCardModal";
import { formatDateRelative, formatCompactNumber } from "@/lib/format";
import { getSourceIcon, getSourceLabel } from "@/lib/content/sources";
import { useCardState } from "@/hooks/useCardState";
import { buildContentContextMenuItems, buildContentBoostItems } from "./ContentCardMenus";
import { BoostModal } from "./BoostModal";

interface ContentCardProps {
  item: ContentItem;
  onSave?: (item: ContentItem) => void;
  onChatOpen?: (item: ContentItem, initialPrompt?: string) => void;
}

export const ContentCard = React.memo(function ContentCard({ item, onSave, onChatOpen }: ContentCardProps) {
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
  } = useCardState({ onModalOpen: fetchFullDescription });
  const { isOpen, position, openMenu, closeMenu } = useContextMenu();
  const [isSaved, setIsSaved] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  async function handleSave(itemToSave: ContentItem = item) {
    if (isSaved || isSaving || !onSave) return;
    setIsSaving(true);

    let saveItem = itemToSave;
    if (!fullDescription && itemToSave.url) {
      const content = await fetchArticleContent(itemToSave.url);
      if (content) {
        saveItem = { ...itemToSave, description: content };
        setFullDescription(content);
      }
    }

    onSave(saveItem);
    setIsSaving(false);
    setIsSaved(true);
  }

  function handleSaveClick() {
    void handleSave();
  }

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

  async function fetchArticleContent(url: string): Promise<string | null> {
    try {
      const response = await fetch(`/api/content/article?url=${encodeURIComponent(url)}`);
      const result = await response.json();
      if (result.success && result.data?.content) {
        return result.data.content;
      }
    } catch (error) {
      console.error("Failed to fetch article description:", error);
    }
    return null;
  }

  async function fetchFullDescription() {
    if (!item.url || fullDescription) return;
    setIsLoadingDescription(true);
    const content = await fetchArticleContent(item.url);
    if (content) setFullDescription(content);
    setIsLoadingDescription(false);
  }

  const contextMenuItems = buildContentContextMenuItems(item, handleSave, openBoost);

  const boostItems = buildContentBoostItems(item, onChatOpen, closeBoost);

  return (
    <>
      <div
        className="group relative bg-[#101010] rounded-xl overflow-hidden border border-[#2a2a2a] hover:border-[#3a3a3a] transition-all duration-200 cursor-grab active:cursor-grabbing"
        draggable
        onDragStart={handleDragStart}
        onClick={openCardModal}
        onContextMenu={openMenu}
      >
        {/* Thumbnail */}
        {item.thumbnail && !imageError ? (
          <div className="relative w-full">
            <Image
              src={item.thumbnail}
              alt={item.title || "Content thumbnail"}
              width={480}
              height={270}
              className="w-full h-auto object-cover"
              onError={() => setImageError(true)}
            />
            {/* Hover action buttons */}
            <div className="absolute top-2 right-2 flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
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
            {/* Duration overlay if available */}
            <div className="absolute bottom-2 right-2 bg-black/80 text-white text-xs px-1.5 py-0.5 rounded">
              {formatDateRelative(item.publishedAt)}
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
          <h3 className="text-sm font-medium text-white leading-snug line-clamp-2 mb-2 group-hover:text-[#ccc] transition-colors">
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
                {formatCompactNumber(item.score)} pts
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
            {item.discoveryScore !== undefined && (
              <Badge variant="outline" className="text-[10px] border-[#2a2a2a] text-[#ccc] px-1.5 py-0.5" title="Discovery score (0-100)">
                {item.discoveryScore}
              </Badge>
            )}
          </div>
        </div>
      </div>

      {/* Context Menu */}
      <ContextMenu items={contextMenuItems} isOpen={isOpen} position={position} onClose={closeMenu} />

      {/* Article Detail Modal */}
      {isModalOpen && (
        <ContentCardModal
          item={item}
          fullDescription={fullDescription}
          isLoadingDescription={isLoadingDescription}
          onClose={closeModal}
          onBoost={openBoost}
          onSave={onSave}
        />
      )}

      <BoostModal isOpen={isBoostOpen} onClose={closeBoost} items={boostItems} />
    </>
  );
});
