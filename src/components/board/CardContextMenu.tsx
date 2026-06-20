"use client";

import { useState } from "react";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import type { BoardCard } from "@/types/board";

interface CardContextMenuProps {
  children: React.ReactNode;
  card: BoardCard;
  onOpenInPane: (card: BoardCard) => void;
  onChatWith: (card: BoardCard) => void;
  onDownload: (card: BoardCard) => void;
  onRemove: (card: BoardCard) => void;
  onDuplicate: (card: BoardCard) => void;
  onMove: (card: BoardCard) => void;
  onReferenceToBoard: (card: BoardCard) => void;
}

export function CardContextMenu({
  children,
  card,
  onOpenInPane,
  onChatWith,
  onDownload,
  onRemove,
  onDuplicate,
  onMove,
  onReferenceToBoard,
}: CardContextMenuProps) {
  return (
    <ContextMenu>
      <ContextMenuTrigger className="w-full h-full">{children}</ContextMenuTrigger>
      <ContextMenuContent className="w-56 bg-[#1a1a1a] border-[#2a2a2a]">
        <ContextMenuItem
          onClick={() => onOpenInPane(card)}
          className="text-white hover:bg-[#2a2a2a] cursor-pointer"
        >
          <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
          Open in Pane
        </ContextMenuItem>
        <ContextMenuItem
          onClick={() => onChatWith(card)}
          className="text-white hover:bg-[#2a2a2a] cursor-pointer"
        >
          <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 14.583 3 13.303 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
          </svg>
          Chat with
        </ContextMenuItem>
        <ContextMenuSeparator className="bg-[#2a2a2a]" />
        <ContextMenuItem
          onClick={() => onDownload(card)}
          className="text-white hover:bg-[#2a2a2a] cursor-pointer"
        >
          <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
          Download
        </ContextMenuItem>
        <ContextMenuItem
          onClick={() => onDuplicate(card)}
          className="text-white hover:bg-[#2a2a2a] cursor-pointer"
        >
          <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
          </svg>
          Duplicate to Board
        </ContextMenuItem>
        <ContextMenuItem
          onClick={() => onMove(card)}
          className="text-white hover:bg-[#2a2a2a] cursor-pointer"
        >
          <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
          </svg>
          Move to Board
        </ContextMenuItem>
        <ContextMenuItem
          onClick={() => onReferenceToBoard(card)}
          className="text-white hover:bg-[#2a2a2a] cursor-pointer"
        >
          <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
          </svg>
          Reference to Board
        </ContextMenuItem>
        <ContextMenuSeparator className="bg-[#2a2a2a]" />
        <ContextMenuItem
          onClick={() => onRemove(card)}
          className="text-red-400 hover:bg-[#2a2a2a] cursor-pointer"
        >
          <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
          Remove
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}
