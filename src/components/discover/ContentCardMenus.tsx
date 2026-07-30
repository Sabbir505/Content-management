import React from "react";
import { toast } from "sonner";
import { blockLanguage, blockCreator, detectLanguage } from "@/lib/blocklist";
import type { ContentItem } from "@/types/content";

export interface ContextMenuItem {
  id: string;
  label: string;
  icon: React.ReactNode;
  onClick: () => void;
}

export interface BoostItem {
  id: string;
  label: string;
  description: string;
  icon: React.ReactNode;
  onClick: () => void;
}

export function buildContentContextMenuItems(
  item: ContentItem,
  onSave: ((item: ContentItem) => void) | undefined,
  openBoost: () => void,
): ContextMenuItem[] {
  return [
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
      onClick: () => openBoost(),
    },
    {
      id: "not-language",
      label: "Not in my language",
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 5h12M9 3v2m1.048 9.448L8.5 15.5m-3.464-3.536L4.5 12m11.964-4.036L17.5 8.5m-3.464 3.536L15.5 12m-6.964-4.036L9.5 8.5m-3.464 3.536L8.5 12M12 21a9 9 0 110-18 9 9 0 010 18z" />
        </svg>
      ),
      onClick: () => {
        const lang = detectLanguage(item.title + " " + (item.description || ""));
        blockLanguage(lang);
        toast.success(`Hid ${lang.toUpperCase()} language content`);
        window.dispatchEvent(new Event("tubeforge-blocklist-updated"));
      },
    },
    {
      id: "hide-creator",
      label: "Hide this creator",
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
        </svg>
      ),
      onClick: () => {
        if (item.author) {
          blockCreator(item.author);
          toast.success(`Hid creator: ${item.author}`);
          window.dispatchEvent(new Event("tubeforge-blocklist-updated"));
        }
      },
    },
  ];
}

export function buildContentBoostItems(
  item: ContentItem,
  onChatOpen: ((item: ContentItem, initialPrompt?: string) => void) | undefined,
  closeBoost: () => void,
): BoostItem[] {
  return [
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
        onChatOpen?.(item);
        closeBoost();
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
        const prompt = `Generate headline variations for: "${item.title}"`;
        onChatOpen?.(item, prompt);
        closeBoost();
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
        const prompt = `Expand this article into a full long-form piece. Use the article as the foundation and develop it into a complete draft with a strong opening, clear sections, and a satisfying conclusion.`;
        onChatOpen?.(item, prompt);
        closeBoost();
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
        const prompt = `Reverse engineer this article. Analyze why it works — the angle, structure, pacing, and framing — and explain the method so I can apply the same approach to write my own post on this topic.`;
        onChatOpen?.(item, prompt);
        closeBoost();
      },
    },
  ];
}
