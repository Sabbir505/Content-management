"use client";

import { X, MessageSquare } from "lucide-react";

interface ChatSession {
  id: string;
  title: string;
  updatedAt?: string;
}

interface ChatSessionsModalProps {
  isOpen: boolean;
  onClose: () => void;
  sessions: ChatSession[];
  onSessionClick: (sessionId: string) => void;
}

function formatDate(dateString?: string): string {
  if (!dateString) return "";
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function ChatSessionsModal({ isOpen, onClose, sessions, onSessionClick }: ChatSessionsModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" />
      <div
        className="relative w-full max-w-md max-h-[80vh] bg-[#1a1a1a] border border-[#2a2a2a] rounded-2xl shadow-2xl flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#2a2a2a]">
          <div className="flex items-center gap-2">
            <MessageSquare className="w-4 h-4 text-[#888]" />
            <h3 className="text-base font-semibold text-white">All Chat Sessions</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-[#888] hover:text-white hover:bg-[#2a2a2a] transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-2">
          {sessions.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-sm text-[#666]">No chat sessions yet</p>
            </div>
          ) : (
            <div className="space-y-0.5">
              {sessions.map((session) => (
                <button
                  key={session.id}
                  onClick={() => {
                    onSessionClick(session.id);
                    onClose();
                  }}
                  className="w-full text-left px-4 py-3 rounded-lg hover:bg-[#252525] transition-colors cursor-pointer group"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-[#0a0a0a] border border-[#2a2a2a] flex items-center justify-center shrink-0 group-hover:border-[#3a3a3a] transition-colors">
                      <MessageSquare className="w-3.5 h-3.5 text-[#666]" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-white truncate">{session.title}</p>
                      {session.updatedAt && (
                        <p className="text-xs text-[#666] mt-0.5">{formatDate(session.updatedAt)}</p>
                      )}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
