"use client";

import { useState, useCallback, useRef } from "react";
import { cn } from "@/lib/utils";
import type { BoardCard } from "@/types/board";
import { CardContextMenu } from "./CardContextMenu";

interface BoardCanvasProps {
  cards: BoardCard[];
  onCardMove: (cardId: string, x: number, y: number) => void;
  onCardClick: (card: BoardCard) => void;
  onCardContextMenu?: (e: React.MouseEvent, card: BoardCard) => void;
  onChatWith?: (card: BoardCard) => void;
  onDownload?: (card: BoardCard) => void;
  onRemove?: (card: BoardCard) => void;
  onDuplicate?: (card: BoardCard) => void;
  onDrop?: (e: React.DragEvent) => void;
  className?: string;
}

export function BoardCanvas({ cards, onCardMove, onCardClick, onCardContextMenu, onChatWith, onDownload, onRemove, onDuplicate, onDrop, className }: BoardCanvasProps) {
  const canvasRef = useRef<HTMLDivElement>(null);
  const [draggingCard, setDraggingCard] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [isDragOver, setIsDragOver] = useState(false);

  const handleMouseDown = useCallback((e: React.MouseEvent, card: BoardCard) => {
    if (e.button !== 0) return;
    e.preventDefault();
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;

    setDraggingCard(card.id);
    setDragOffset({
      x: e.clientX - rect.left - card.x,
      y: e.clientY - rect.top - card.y,
    });
  }, []);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!draggingCard || !canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const newX = e.clientX - rect.left - dragOffset.x;
    const newY = e.clientY - rect.top - dragOffset.y;
    onCardMove(draggingCard, Math.max(0, newX), Math.max(0, newY));
  }, [draggingCard, dragOffset, onCardMove]);

  const handleMouseUp = useCallback(() => {
    setDraggingCard(null);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    onDrop?.(e);
  }, [onDrop]);

  return (
    <div
      ref={canvasRef}
      className={cn(
        "relative w-full h-full overflow-hidden bg-[#0a0a0a]",
        isDragOver && "ring-2 ring-blue-500/50 ring-inset",
        className
      )}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Grid background */}
      <div
        className="absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage: `linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px),
                           linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)`,
          backgroundSize: "40px 40px",
        }}
      />

      {/* Drop zone indicator */}
      {isDragOver && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-50">
          <div className="bg-blue-500/10 border-2 border-dashed border-blue-500/50 rounded-lg p-8">
            <p className="text-blue-400 text-sm font-medium">Drop here to add to board</p>
          </div>
        </div>
      )}

      {cards.map((card) => (
        <div
          key={card.id}
          className={cn(
            "absolute cursor-grab active:cursor-grabbing select-none",
            draggingCard === card.id && "z-50"
          )}
          style={{
            left: card.x,
            top: card.y,
            width: card.width,
            height: card.height,
          }}
          onMouseDown={(e) => handleMouseDown(e, card)}
          onClick={() => onCardClick(card)}
        >
          <CardContextMenu
            card={card}
            onOpenInPane={(c) => onCardClick(c)}
            onChatWith={(c) => onChatWith?.(c)}
            onDownload={(c) => onDownload?.(c)}
            onRemove={(c) => onRemove?.(c)}
            onDuplicate={(c) => onDuplicate?.(c)}
            onMove={() => {}}
            onReferenceToBoard={() => {}}
          >
            <BoardCardPreview card={card} />
          </CardContextMenu>
        </div>
      ))}
    </div>
  );
}

function BoardCardPreview({ card }: { card: BoardCard }) {
  switch (card.type) {
    case "video":
      return <VideoCardPreview card={card} />;
    case "article":
      return <ArticleCardPreview card={card} />;
    case "script":
      return <ScriptCardPreview card={card} />;
    case "social":
      return <SocialCardPreview card={card} />;
    case "note":
    case "idea":
    default:
      return <NoteCardPreview card={card} />;
  }
}

function VideoCardPreview({ card }: { card: BoardCard }) {
  return (
    <div className="w-full h-full bg-[#1a1a1a] rounded-lg border border-[#2a2a2a] overflow-hidden hover:border-[#3a3a3a] transition-colors">
      {card.thumbnail ? (
        <div className="relative h-24 w-full">
          <img
            src={card.thumbnail}
            alt={card.title}
            className="w-full h-full object-cover"
          />
        </div>
      ) : (
        <div className="h-24 w-full bg-[#252525] flex items-center justify-center">
          <svg className="w-8 h-8 text-[#4a4a4a]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
      )}
      <div className="p-3">
        <h4 className="text-sm font-medium text-white line-clamp-2">{card.title}</h4>
        {card.metadata?.channelTitle ? (
          <p className="text-xs text-[#888] mt-1">{String(card.metadata.channelTitle)}</p>
        ) : null}
      </div>
    </div>
  );
}

function ArticleCardPreview({ card }: { card: BoardCard }) {
  return (
    <div className="w-full h-full bg-[#1a1a1a] rounded-lg border border-[#2a2a2a] overflow-hidden hover:border-[#3a3a3a] transition-colors p-3">
      <div className="flex items-start gap-2">
        <svg className="w-5 h-5 text-[#4a4a4a] shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2v12a2 2 0 01-2 2z" />
        </svg>
        <div className="min-w-0">
          <h4 className="text-sm font-medium text-white line-clamp-2">{card.title}</h4>
          {card.url && (
            <p className="text-xs text-[#888] mt-1 truncate">{card.url}</p>
          )}
        </div>
      </div>
    </div>
  );
}

function ScriptCardPreview({ card }: { card: BoardCard }) {
  return (
    <div className="w-full h-full bg-[#1a1a1a] rounded-lg border border-[#2a2a2a] overflow-hidden hover:border-[#3a3a3a] transition-colors p-3">
      <div className="flex items-center gap-2 mb-2">
        <svg className="w-4 h-4 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
        <span className="text-xs text-blue-400 font-medium">Script</span>
      </div>
      <h4 className="text-sm font-medium text-white line-clamp-2">{card.title}</h4>
      <p className="text-xs text-[#888] mt-1 line-clamp-3">{card.content}</p>
    </div>
  );
}

function SocialCardPreview({ card }: { card: BoardCard }) {
  return (
    <div className="w-full h-full bg-[#1a1a1a] rounded-lg border border-[#2a2a2a] overflow-hidden hover:border-[#3a3a3a] transition-colors p-3">
      <div className="flex items-center gap-2 mb-2">
        <svg className="w-4 h-4 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
        </svg>
        <span className="text-xs text-green-400 font-medium">Social Post</span>
        {card.platform && (
          <span className="text-xs text-[#888] capitalize">{card.platform}</span>
        )}
      </div>
      <h4 className="text-sm font-medium text-white line-clamp-2">{card.title}</h4>
      <p className="text-xs text-[#888] mt-1 line-clamp-3">{card.content}</p>
    </div>
  );
}

function NoteCardPreview({ card }: { card: BoardCard }) {
  return (
    <div className="w-full h-full bg-[#1a1a1a] rounded-lg border border-[#2a2a2a] overflow-hidden hover:border-[#3a3a3a] transition-colors p-3">
      <h4 className="text-sm font-medium text-white line-clamp-2">{card.title}</h4>
      <p className="text-xs text-[#888] mt-1 line-clamp-4 whitespace-pre-wrap">{card.content}</p>
    </div>
  );
}
