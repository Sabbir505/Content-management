"use client";

import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import type { ChatMessage, ChatSession, ChatAttachment } from "@/types/chat";
import type { BoardCard } from "@/types/board";

interface ChatPanelProps {
  isOpen: boolean;
  onClose: () => void;
  boardId?: string;
  card?: BoardCard;
  sessionId?: string;
  onAddToBoard?: (artifact: { type: string; content: string; platform?: string }) => void;
}

export function ChatPanel({ isOpen, onClose, boardId, card, sessionId: initialSessionId, onAddToBoard }: ChatPanelProps) {
  const { user } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [sessionId, setSessionId] = useState<string | undefined>(initialSessionId);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen && sessionId && user) {
      loadMessages();
    }
  }, [isOpen, sessionId, user]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function loadMessages() {
    if (!user || !sessionId) return;
    try {
      const response = await fetch(`/api/chat/session?userId=${user.uid}&sessionId=${sessionId}`);
      const result = await response.json();
      if (result.success) {
        setMessages(result.data.messages);
      }
    } catch (error) {
      console.error("Failed to load messages:", error);
    }
  }

  async function createSession() {
    if (!user) return;
    try {
      const response = await fetch("/api/chat/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: user.uid,
          title: card ? `Chat about ${card.title}` : "Board Chat",
          boardId,
          cardId: card?.id,
        }),
      });
      const result = await response.json();
      if (result.success) {
        setSessionId(result.data.id);
      }
    } catch (error) {
      console.error("Failed to create session:", error);
    }
  }

  async function handleSendMessage() {
    if (!inputText.trim() || !user) return;

    let currentSessionId = sessionId;
    if (!currentSessionId) {
      await createSession();
      currentSessionId = sessionId;
      if (!currentSessionId) return;
    }

    const userMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      text: inputText,
      attachments: card ? [{
        type: "board_card",
        cardId: card.id,
        title: card.title,
        content: card.content,
      }] : [],
      createdAt: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputText("");
    setIsLoading(true);

    try {
      // Save user message
      await fetch("/api/chat/message", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: user.uid,
          sessionId: currentSessionId,
          message: userMessage,
        }),
      });

      // Generate assistant response
      const response = await fetch("/api/chat/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: currentSessionId,
          messages: [...messages, userMessage].map((m) => ({
            role: m.role,
            text: m.text,
            attachments: m.attachments,
          })),
          intent: detectIntent(inputText),
          userVoice: "Conversational, direct, slightly informal",
        }),
      });

      const result = await response.json();
      if (result.success) {
        const assistantMessage: ChatMessage = {
          id: crypto.randomUUID(),
          role: "assistant",
          text: result.data.text,
          attachments: [],
          artifact: result.data.artifact,
          createdAt: new Date().toISOString(),
        };

        setMessages((prev) => [...prev, assistantMessage]);

        // Save assistant message
        await fetch("/api/chat/message", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            userId: user.uid,
            sessionId: currentSessionId,
            message: assistantMessage,
          }),
        });
      }
    } catch (error) {
      toast.error("Failed to generate response");
      console.error("Chat generation error:", error);
    } finally {
      setIsLoading(false);
    }
  }

  function detectIntent(text: string): "script" | "social" | "chat" {
    const lower = text.toLowerCase();
    if (lower.includes("script") || lower.includes("write a script")) return "script";
    if (lower.includes("social") || lower.includes("post") || lower.includes("tweet")) return "social";
    return "chat";
  }

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <SheetContent
        side="right"
        className="w-[480px] bg-[#0a0a0a] border-l border-[#1a1a1a] p-0 flex flex-col"
      >
        <SheetHeader className="px-4 py-3 border-b border-[#1a1a1a]">
          <SheetTitle className="text-white text-sm font-medium">
            {card ? `Chat: ${card.title}` : "Board Chat"}
          </SheetTitle>
        </SheetHeader>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.length === 0 && (
            <div className="text-center text-[#666] text-sm py-8">
              <p>Start a conversation about this content.</p>
              <p className="mt-1">You can ask me to generate scripts, social posts, or analyze content.</p>
            </div>
          )}

          {messages.map((message) => (
            <div
              key={message.id}
              className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[85%] rounded-lg px-3 py-2 text-sm ${
                  message.role === "user"
                    ? "bg-blue-600 text-white"
                    : "bg-[#1a1a1a] text-white border border-[#2a2a2a]"
                }`}
              >
                <p className="whitespace-pre-wrap">{message.text}</p>
                {message.artifact && (
                  <div className="mt-2 p-3 bg-[#0a0a0a] rounded border border-[#2a2a2a]">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-xs text-[#888]">Generated {message.artifact.type}</p>
                      {onAddToBoard && (
                        <button
                          onClick={() => onAddToBoard(message.artifact!)}
                          className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1"
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

        {/* Input */}
        <div className="p-3 border-t border-[#1a1a1a]">
          <div className="flex gap-2">
            <input
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSendMessage()}
              placeholder="Ask me anything..."
              className="flex-1 bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg px-3 py-2 text-sm text-white placeholder-[#666] focus:outline-none focus:border-[#3a3a3a]"
            />
            <Button
              onClick={handleSendMessage}
              disabled={isLoading || !inputText.trim()}
              size="sm"
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
