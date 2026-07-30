"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { toast } from "sonner";
import { VideoWithOutlier } from "@/types/video";
import { ContentItem } from "@/types/content";
import { formatCompactNumber } from "@/lib/format";
import { useContentChat, isVideo } from "@/hooks/useContentChat";
import type { BoardCard } from "@/types/board";
import { LLM_PROVIDERS, getSavedLlmConfig } from "@/lib/llm-config";

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function safeHref(url: string): string {
  const trimmed = url.trim();
  // Allow http(s) and relative links only; block javascript:, data:, vbscript:, etc.
  if (/^(https?:\/\/|\/|#|mailto:)/i.test(trimmed)) return trimmed;
  return "#";
}

function renderMarkdown(text: string): string {
  // Convert literal <br>/<br/> BEFORE escaping so they act as real line breaks
  // rather than rendering as visible "&lt;br&gt;" text.
  const debr = text.replace(/<br\s*\/?>/gi, "\n");
  // Escape first so no raw HTML/JS from the source can reach the DOM.
  const escaped = escapeHtml(debr);

  const html = escaped
    .replace(/```(\w*)\n([\s\S]*?)```/g, '<pre class="bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg p-3 my-2 overflow-x-auto text-xs"><code>$2</code></pre>')
    .replace(/`([^`]+)`/g, '<code class="bg-[#2a2a2a] px-1 py-0.5 rounded text-xs text-emerald-400">$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong class="font-bold text-white">$1</strong>')
    .replace(/~~([^~]+)~~/g, '<del class="text-[#888]">$1</del>')
    .replace(/\*([^*]+)\*/g, '<em>$1</em>')
    .replace(/^### (.+)$/gm, '<h3 class="text-base font-semibold text-white mt-3 mb-1">$1</h3>')
    .replace(/^## (.+)$/gm, '<h2 class="text-lg font-semibold text-white mt-3 mb-1">$1</h2>')
    .replace(/^# (.+)$/gm, '<h1 class="text-xl font-bold text-white mt-4 mb-2">$1</h1>')
    // Tables: header row, optional alignment row, then body rows.
    .replace(/^(\|[^\n]*\|)\n(\|[\s:|-]+\|)\n((?:\|[^\n]*\|\n?)+)/gm, (_m, headerRow: string, _alignRow: string, body: string) => {
      const headers = headerRow.split("|").map((h) => h.trim()).filter(Boolean);
      const headCells = headers.map((h) => `<th class="border border-[#2a2a2a] px-3 py-1.5 text-left text-white font-semibold">${h}</th>`).join("");
      const rows = body.trim().split("\n").filter((r) => r.trim()).map((row) => {
        const cells = row.replace(/^\||\|$/g, "").split("|").map((c) => c.trim());
        const rowCells = headers.map((_, i) => `<td class="border border-[#2a2a2a] px-3 py-1.5 text-[#ccc]">${cells[i] ?? ""}</td>`).join("");
        return `<tr>${rowCells}</tr>`;
      }).join("");
      return `<div class="overflow-x-auto my-2"><table class="min-w-full border-collapse text-xs"><thead><tr>${headCells}</tr></thead><tbody>${rows}</tbody></table></div>`;
    })
    // Numbered-keycap emoji lists (1️⃣ 2️⃣ 3️⃣) — common from LLMs, not standard markdown.
    .replace(/^\d️?⃣\s+(.+?)\s*$/gm, '<li class="ml-4 list-decimal text-[#ccc]">$1</li>')
    .replace(/^- (.+?)\s*$/gm, '<li class="ml-4 list-disc text-[#ccc]">$1</li>')
    .replace(/^\d+\. (.+?)\s*$/gm, '<li class="ml-4 list-decimal text-[#ccc]">$1</li>')
    // Wrap consecutive <li> runs in <ul>, dropping inter-item whitespace so it
    // isn't later converted to a <br/> between list items.
    .replace(/((?:\s*<li[^>]*>[\s\S]*?<\/li>\s*)+)/g, (m) => {
      const items = m.match(/<li[^>]*>[\s\S]*?<\/li>/g) || [];
      return `<ul class="my-1">${items.join("")}</ul>`;
    })
    .replace(/^&gt; (.+)$/gm, '<blockquote class="border-l-2 border-[#3a3a3a] pl-3 text-[#999] my-2">$1</blockquote>')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_m, label, url) => `<a href="${safeHref(url)}" target="_blank" rel="noopener noreferrer" class="text-emerald-400 underline hover:text-emerald-300">${label}</a>`)
    .replace(/^(?:-{3,}|\*{3,}|_{3,})$/gm, '<hr class="border-[#2a2a2a] my-3" />')
    .replace(/\n\n/g, '</p><p class="mb-2">')
    .replace(/\n/g, '<br/>');

  return `<p class="mb-2">${html}</p>`;
}

const CONTENT_SUGGESTIONS = {
  video: [
    { label: "Analyze the hook", icon: "M15 12a3 3 0 11-6 0 3 3 0 016 0z M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" },
    { label: "Generate title ideas", icon: "M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" },
    { label: "Break down the structure", icon: "M4 6h16M4 12h16M4 18h16" },
    { label: "Create a script inspired by this", icon: "M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" },
  ],
  article: [
    { label: "Research this", icon: "M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" },
    { label: "Analyze this", icon: "M15 12a3 3 0 11-6 0 3 3 0 016 0z M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" },
    { label: "Create a script", icon: "M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" },
    { label: "Brainstorm angles", icon: "M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" },
  ],
};

const GENERIC_SUGGESTIONS = [
  { label: "Generate a script", icon: "M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" },
  { label: "Brainstorm ideas", icon: "M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" },
  { label: "Analyze structure", icon: "M4 6h16M4 12h16M4 18h16" },
  { label: "Write social posts", icon: "M13 10V3L4 14h7v7l9-11h-7z" },
];

interface ContentChatPanelProps {
  isOpen: boolean;
  onClose: () => void;
  item?: VideoWithOutlier | ContentItem;
  itemType?: "video" | "article";
  initialPrompt?: string;
  userId?: string;
  sessionId?: string;
  card?: BoardCard;
  boardId?: string;
  onAddToBoard?: (artifact: { type: string; content: string; platform?: string }) => void;
  inline?: boolean;
}

export function ContentChatPanel({
  isOpen,
  onClose,
  item,
  itemType = "video",
  initialPrompt,
  userId,
  sessionId,
  card,
  boardId,
  onAddToBoard,
  inline = false,
}: ContentChatPanelProps) {
  const [chatModelSearch, setChatModelSearch] = useState("");
  const [chatAvailableModels, setChatAvailableModels] = useState<{ id: string }[]>([]);
  const [chatModel, setChatModel] = useState("");
  const [showModelSelector, setShowModelSelector] = useState(false);

  useEffect(() => {
    const saved = getSavedLlmConfig();
    if (saved?.model) setChatModel(saved.model);
  }, []);

  const {
    messages,
    inputText,
    setInputText,
    isLoading,
    savingBoard,
    messagesEndRef,
    handleSendMessage,
    handleSaveAllToBoard,
    handleGenerateLink,
    resetChat,
  } = useContentChat({ item, itemType, isOpen, initialPrompt, onClose, userId, sessionId, card, boardId, model: chatModel });

  async function handleFetchChatModels() {
    try {
      const saved = getSavedLlmConfig();
      const res = await fetch("/api/llm/models", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider: saved?.provider || "kimi",
          apiKey: saved?.apiKey || "",
          endpoint: saved?.apiEndpoint,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setChatAvailableModels(data.data || []);
        setShowModelSelector(true);
      }
    } catch {
      toast.error("Failed to fetch models");
    }
  }

  if (!isOpen) return null;

  const suggestions = item
    ? (CONTENT_SUGGESTIONS[itemType] || CONTENT_SUGGESTIONS.video)
    : GENERIC_SUGGESTIONS;

  const containerClass = inline
    ? "w-full h-full border-l border-[#1a1a1a] bg-[#0a0a0a] flex flex-col overflow-hidden"
    : "fixed top-0 right-0 bottom-0 z-[9999] w-full lg:w-[480px] max-w-[720px] border-l border-[#1a1a1a] bg-[#0a0a0a] flex flex-col shadow-2xl animate-in slide-in-from-right duration-200";

  return (
    <div className={containerClass}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[#1a1a1a] flex-shrink-0 min-h-[52px]">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-sm text-white font-medium truncate">
            {card ? "New chat" : item ? "Content chat" : "New chat"}
          </span>
          <svg className="w-3 h-3 text-[#666] flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          <button
            onClick={resetChat}
            className="w-7 h-7 flex items-center justify-center rounded-md text-[#888] hover:text-white hover:bg-[#2a2a2a] transition-colors cursor-pointer"
            title="New chat"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
          </button>
          <button
            onClick={handleGenerateLink}
            className="w-7 h-7 flex items-center justify-center rounded-md text-[#888] hover:text-white hover:bg-[#2a2a2a] transition-colors cursor-pointer"
            title="Generate share link"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.172 13.828a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.102 1.101" />
            </svg>
          </button>
          <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-md text-[#888] hover:text-white hover:bg-[#2a2a2a] transition-colors cursor-pointer">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto scrollbar-hide p-4 space-y-4 min-h-0">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full px-6">
            {item && (
              <div className="w-full max-w-md bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-4 mb-6">
                <div className="flex items-start gap-3">
                  {item.thumbnail && (
                    <Image src={item.thumbnail} alt={item.title} width={64} height={48} className="w-16 h-12 object-cover rounded-lg bg-[#1a1a1a] flex-shrink-0" />
                  )}
                  <div className="min-w-0">
                    <p className="text-sm text-white font-medium line-clamp-2">{item.title}</p>
                    <p className="text-xs text-[#666] mt-1">
                      {isVideo(item) ? item.channelTitle : item.author}
                      {isVideo(item) && item.viewCount > 0 && <> · {formatCompactNumber(item.viewCount)} views</>}
                    </p>
                  </div>
                </div>
                <p className="text-xs text-[#666] text-center mt-4">Ask a question or pick a suggestion below to get started.</p>
              </div>
            )}

            {card && (
              <div className="w-full max-w-md bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-4 mb-6">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-lg bg-[#252525] flex items-center justify-center flex-shrink-0">
                    <svg className="w-5 h-5 text-[#666]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm text-white font-medium line-clamp-2">{card.title}</p>
                    <p className="text-xs text-[#666] mt-1">{card.type} · {new Date(card.updatedAt).toLocaleDateString()}</p>
                  </div>
                </div>
                <p className="text-xs text-[#666] text-center mt-4">Ask a question or pick a suggestion below to get started.</p>
              </div>
            )}

            {!item && !card && (
              <div className="w-full max-w-md text-center mb-6">
                <div className="w-12 h-12 rounded-full bg-[#1a1a1a] border border-[#2a2a2a] flex items-center justify-center mx-auto mb-3">
                  <svg className="w-6 h-6 text-[#666]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                  </svg>
                </div>
                <p className="text-sm text-white font-medium">Start a conversation</p>
                <p className="text-xs text-[#666] mt-1">Ask me to generate scripts, analyze content, or brainstorm ideas.</p>
              </div>
            )}
          </div>
        )}

        {messages.map((message) => (
          <div key={message.id} className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}>
            <div
              className={`max-w-[85%] rounded-xl px-4 py-3 text-sm ${
                message.role === "user"
                  ? "bg-[#2a2a2a] text-white border border-[#3a3a3a]"
                  : "bg-[#141414] text-[#ccc] border border-[#222]"
              }`}
            >
              <div
                dangerouslySetInnerHTML={{ __html: renderMarkdown(message.text) }}
                className="text-sm leading-relaxed"
              />

              {/* Artifact (script, social, analysis) */}
              {message.artifact && message.artifact.type !== "headline_variations" && (
                <div className="mt-2 p-3 bg-[#0a0a0a] rounded border border-[#2a2a2a]">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs text-[#888]">Generated {message.artifact.type}</p>
                    {onAddToBoard && (
                      <button
                        onClick={() => onAddToBoard(message.artifact!)}
                        className="text-xs text-[#888] hover:text-[#ccc] flex items-center gap-1 cursor-pointer"
                      >
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                        </svg>
                        Add to Board
                      </button>
                    )}
                  </div>
                  <p className="text-xs line-clamp-3">{message.artifact.content}</p>
                </div>
              )}

              {/* Headline Variations Artifact */}
              {message.artifact?.headlineVariations && message.artifact.headlineVariations.length > 0 && (
                <div className="mt-3 space-y-2">
                  {message.artifact.headlineVariations.map((v, i) => (
                    <div
                      key={i}
                      className="group bg-[#0f0f0f] border border-[#2a2a2a] rounded-lg p-3 hover:border-[#3a3a3a] transition-colors"
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[10px] font-semibold tracking-widest text-[#666] uppercase">
                          {v.label}
                        </span>
                        <button
                          onClick={() => {
                            if (navigator.clipboard?.writeText) {
                              navigator.clipboard.writeText(v.headline)
                                .then(() => toast.success("Copied headline"))
                                .catch(() => toast.error("Copy failed"));
                            }
                          }}
                          className="opacity-0 group-hover:opacity-100 p-1 hover:bg-[#2a2a2a] rounded transition-all cursor-pointer"
                          title="Copy headline"
                        >
                          <svg className="w-3.5 h-3.5 text-[#888]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                          </svg>
                        </button>
                      </div>
                      <p className="text-sm text-white font-medium">{v.headline}</p>
                    </div>
                  ))}

                  <button
                    onClick={() => handleSaveAllToBoard(message.artifact!.headlineVariations!, message.artifact!.sourceTitle || item?.title || "Chat")}
                    disabled={savingBoard}
                    className="w-full flex items-center justify-center gap-2 py-2.5 mt-3 bg-emerald-400 hover:bg-emerald-500 text-black disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium rounded-lg transition-colors cursor-pointer"
                  >
                    {savingBoard ? (
                      <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                    ) : (
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4v16m8-8H4" />
                      </svg>
                    )}
                    {savingBoard ? "Saving..." : "Save all to board"}
                  </button>
                </div>
              )}
            </div>
          </div>
        ))}

        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg px-3 py-2">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-[#666] rounded-full animate-bounce" />
                <div className="w-2 h-2 bg-[#666] rounded-full animate-bounce [animation-delay:0.1s]" />
                <div className="w-2 h-2 bg-[#666] rounded-full animate-bounce [animation-delay:0.2s]" />
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input + Suggestions */}
      <div className="p-3 border-t border-[#1a1a1a] flex-shrink-0">
        <div className="w-full">
          <div className="relative">
            <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-3">
              <div className="flex items-end gap-2">
                <textarea
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      handleSendMessage();
                    }
                  }}
                  placeholder="Ask anything..."
                  rows={1}
                  className="flex-1 bg-transparent text-sm text-white placeholder-[#666] resize-none focus:outline-none min-h-[40px] max-h-[140px] py-1.5 w-full"
                />

                {/* Model selector — name only, right side of the input */}
                <div className="relative flex-shrink-0 self-end pb-1">
                  <button
                    onClick={() => {
                      if (chatAvailableModels.length === 0) {
                        handleFetchChatModels();
                      } else {
                        setShowModelSelector(!showModelSelector);
                      }
                    }}
                    className="flex items-center gap-1 px-1.5 py-0.5 rounded-md text-xs text-[#aaa] hover:text-white transition-colors cursor-pointer max-w-[160px]"
                    title="Select model"
                  >
                    <span className="truncate">{chatModel || "Select model"}</span>
                    <svg className={`w-3 h-3 text-[#666] flex-shrink-0 transition-transform ${showModelSelector ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>

                  {showModelSelector && (
                    <div className="absolute bottom-full right-0 mb-2 w-64 bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg shadow-xl z-50 p-3">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs text-[#888] font-medium">Select Model</span>
                        <button onClick={() => setShowModelSelector(false)} className="text-[#666] hover:text-white cursor-pointer">
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                        </button>
                      </div>
                      <input
                        type="text"
                        placeholder="Search models..."
                        value={chatModelSearch}
                        onChange={(e) => setChatModelSearch(e.target.value)}
                        className="w-full bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg px-3 py-1.5 text-xs text-white placeholder:text-[#555] focus:outline-none focus:border-[#3a3a3a] transition-colors font-mono mb-2"
                      />
                      <div className="max-h-48 overflow-y-auto scrollbar-hide space-y-0.5">
                        {chatAvailableModels.length === 0 && (
                          <p className="text-xs text-[#666] text-center py-2">No models loaded. Check your API key in settings.</p>
                        )}
                        {chatAvailableModels
                          .filter((m) => m.id.toLowerCase().includes(chatModelSearch.toLowerCase()))
                          .map((m) => (
                            <button
                              key={m.id}
                              onClick={() => { setChatModel(m.id); setShowModelSelector(false); toast.success(`Model: ${m.id}`); }}
                              className={`w-full text-left px-2 py-1.5 rounded text-xs font-mono transition-colors cursor-pointer ${chatModel === m.id ? "bg-[#2a2a2a] text-white" : "text-[#888] hover:bg-[#252525] hover:text-white"}`}
                            >
                              {m.id}
                            </button>
                          ))}
                      </div>
                    </div>
                  )}
                </div>

                <button
                  onClick={() => handleSendMessage()}
                  disabled={isLoading || !inputText.trim()}
                  className={`w-8 h-8 flex items-center justify-center rounded-full transition-colors cursor-pointer flex-shrink-0 self-end ${
                    inputText.trim()
                      ? "bg-emerald-400 text-[#0a0a0a] hover:bg-emerald-300"
                      : "bg-[#2a2a2a] text-[#888] hover:bg-[#3a3a3a] hover:text-white"
                  } disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19V5m0 0l-7 7m7-7l7 7" />
                  </svg>
                </button>
              </div>
            </div>
          </div>

          {/* Suggestion chips */}
          {messages.length === 0 && (
            <div className="flex flex-wrap items-center justify-center gap-2 mt-3">
              {suggestions.map((suggestion) => (
                <button
                  key={suggestion.label}
                  onClick={() => handleSendMessage(suggestion.label)}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-[#888] bg-[#1a1a1a] border border-[#2a2a2a] rounded-full hover:border-[#3a3a3a] hover:text-white transition-colors cursor-pointer whitespace-nowrap"
                >
                  <svg className="w-3 h-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={suggestion.icon} />
                  </svg>
                  <span className="truncate">{suggestion.label}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
