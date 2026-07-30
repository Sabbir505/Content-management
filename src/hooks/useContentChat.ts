"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useVoiceProfile } from "@/hooks/useVoiceProfile";
import { toast } from "sonner";
import { VideoWithOutlier } from "@/types/video";
import { ContentItem } from "@/types/content";
import type { ChatMessage, ChatArtifact, ChatAttachment } from "@/types/chat";
import type { BoardCard } from "@/types/board";
import { ensureLocalBoard, addLocalCard } from "@/lib/local-board";
import { authFetch } from "@/lib/authFetch";

export function isVideo(item: VideoWithOutlier | ContentItem): item is VideoWithOutlier {
  return "channelId" in item;
}

function isHeadlineVariationsPrompt(text: string): boolean {
  return text.includes("headline variation") || text.includes("compelling headline");
}

function detectIntent(text: string): "script" | "social" | "chat" {
  const lower = text.toLowerCase();
  if (lower.includes("script") || lower.includes("write a script")) return "script";
  if (/\b(social|tweet|x post|instagram post|facebook post|social media post)\b/.test(lower)) return "social";
  return "chat";
}

function buildVoicePromptSection(voiceProfile: ReturnType<typeof useVoiceProfile>["voiceProfile"]): string {
  if (!voiceProfile) return "";
  const v = voiceProfile;
  return [
    `VOICE PROFILE`,
    `-------------`,
    `Tone:                 ${v.tone || "conversational, direct"}`,
    `Avg sentence length:  ${v.sentenceLength || "12-15"} words`,
    `Vocabulary level:     ${v.vocabulary || "accessible"}`,
    `Hook style:           ${v.hookStyle || "pattern interrupt"}`,
    `Humor level:          ${v.humorLevel || "moderate"}`,
    `CTA style:            ${v.ctaPattern || "soft question-based"}`,
    "",
    "Write all output matching this voice profile exactly.",
  ].join("\n");
}

interface UseContentChatOptions {
  item?: VideoWithOutlier | ContentItem;
  itemType?: "video" | "article";
  isOpen: boolean;
  initialPrompt?: string;
  onClose?: () => void;
  userId?: string;
  sessionId?: string;
  card?: BoardCard;
  boardId?: string;
  model?: string;
}

export function useContentChat(options: UseContentChatOptions) {
  const { item, itemType, isOpen, initialPrompt, onClose, userId, sessionId: initialSessionId, card, boardId, model } = options;
  const { user } = useAuth();
  const resolvedUserId = userId || user?.uid;
  const { voiceProfile } = useVoiceProfile();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const messagesRef = useRef<ChatMessage[]>(messages);
  const [inputText, setInputText] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [savingBoard, setSavingBoard] = useState(false);
  const [sessionId, setSessionId] = useState<string | undefined>(initialSessionId);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const hasAutoSentRef = useRef(false);
  // Sessions created by this hook instance — their messages live in local
  // state, so they must not be re-fetched from the server.
  const localSessionIdsRef = useRef<Set<string>>(new Set());

  async function getToken(): Promise<string | null> {
    if (!user) return null;
    try {
      return await user.getIdToken();
    } catch {
      return null;
    }
  }

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  const title = item?.title;
  const author = item ? (isVideo(item) ? item.channelTitle : item.author) : undefined;
  const description = item ? (isVideo(item) ? item.description : item.description) : undefined;

  const systemContext = item
    ? `You are TubeForge's content strategist. The user is analyzing ${itemType === "video" ? "a YouTube video" : "an article"} titled "${title}" by ${author || "Unknown"}. ${itemType === "video" ? "Video" : "Article"} description: ${description?.slice(0, 500) || "No description"}. Help them brainstorm, analyze, or create content inspired by this.`
    : card
      ? `You are TubeForge's content strategist. The user is working with a saved ${card.type} card titled "${card.title}". ${card.content ? `Card content: ${card.content.slice(0, 500)}.` : "No additional content."} Help them expand, refine, or create content from this idea.`
      : `You are TubeForge's AI assistant. Help creators with their content strategy, scriptwriting, and social media. Be conversational, helpful, and specific.`;

  function buildItemAttachment(): ChatAttachment[] {
    if (!item) return [];
    if (isVideo(item)) {
      return [{
        type: "video",
        videoId: item.id,
        title: item.title,
        description: item.description,
        hookType: item.hookType,
        structure: item.estimatedStructure,
        thumbnail: item.thumbnail,
      }];
    }
    return [{
      type: "article",
      title: item.title,
      url: item.url,
      content: item.description,
    }];
  }

  async function fetchItemAttachment(): Promise<ChatAttachment[]> {
    if (!item) return [];
    const base = buildItemAttachment()[0];

    if (isVideo(item)) {
      const [desc, transcript] = await Promise.all([
        fetch(`/api/youtube/video?videoId=${item.id}`)
          .then((r) => r.json())
          .then((res) => (res.success && res.data?.description ? res.data.description : ""))
          .catch(() => ""),
        fetch(`/api/youtube/transcript?videoId=${item.id}`)
          .then((r) => r.json())
          .then((res) => (res.success && res.data?.transcript ? res.data.transcript : ""))
          .catch(() => ""),
      ]);
      const fullText = [transcript, desc].filter(Boolean).join("\n\n");
      return [{
        ...base,
        description: (fullText || item.description || "").slice(0, 6000),
      }];
    }

    const article = await fetch(`/api/content/article?url=${encodeURIComponent(item.url)}`)
      .then((r) => r.json())
      .then((res) => (res.success && res.data?.content ? res.data.content : ""))
      .catch(() => "");
    return [{
      ...base,
      content: (article || item.description || "").slice(0, 6000),
    }];
  }

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose?.();
    }
    if (isOpen) {
      document.addEventListener("keydown", handleKeyDown);
    }
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, onClose]);

  async function loadMessages(sid: string) {
    if (!resolvedUserId) return;
    try {
      const token = await getToken();
      const response = await authFetch(`/api/chat/session?userId=${resolvedUserId}&sessionId=${sid}`, {}, token);
      const result = await response.json();
      if (result.success) {
        setMessages(result.data.messages);
      }
    } catch (error) {
      console.error("Failed to load messages:", error);
    }
  }

  useEffect(() => {
    // Locally-created sessions would race their own persistence POST and the
    // fetch could wipe messages already in state — skip them.
    if (sessionId && resolvedUserId && !localSessionIdsRef.current.has(sessionId)) {
      queueMicrotask(() => void loadMessages(sessionId));
    }
  }, [sessionId, resolvedUserId]);

  async function createSession(): Promise<string | undefined> {
    if (!resolvedUserId) return undefined;
    // Generate the ID client-side so sending a message never blocks on
    // session persistence — the POST below is fire-and-forget.
    const newSessionId = crypto.randomUUID();
    localSessionIdsRef.current.add(newSessionId);
    setSessionId(newSessionId);

    const token = await getToken();
    authFetch("/api/chat/session", {
      method: "POST",
      body: JSON.stringify({
        userId: resolvedUserId,
        sessionId: newSessionId,
        title: card ? `Chat about ${card.title}` : item ? `Chat about ${item.title}` : "New Chat",
        boardId,
        cardId: card?.id,
      }),
    }, token)
      .then(async (response) => {
        const result = await response.json().catch(() => null);
        if (!result?.success) console.error("Failed to create session:", result?.error);
      })
      .catch((error) => console.error("Failed to create session:", error));

    return newSessionId;
  }

  const handleHeadlineVariations = useCallback(async (promptText: string) => {
    if (!item) return;
    const userMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      text: promptText,
      attachments: [],
      createdAt: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, userMessage]);
    setIsLoading(true);

    try {
      const response = await fetch("/api/chat/headline-variations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: item.title,
          type: itemType,
          description: description?.slice(0, 500),
        }),
      });

      const result = await response.json();
      if (result.success) {
        const artifact: ChatArtifact = {
          type: "headline_variations",
          content: `${result.data.variations.length} variations for "${item.title}"`,
          headlineVariations: result.data.variations,
          sourceTitle: result.data.sourceTitle,
        };
        const assistantMessage: ChatMessage = {
          id: crypto.randomUUID(),
          role: "assistant",
          text: `Here are ${result.data.variations.length} headline variations for "${item.title}":`,
          attachments: [],
          artifact,
          createdAt: new Date().toISOString(),
        };
        setMessages((prev) => [...prev, assistantMessage]);
      } else {
        throw new Error(result.error || "Failed to generate headline variations");
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to generate headline variations");
    } finally {
      setIsLoading(false);
    }
  }, [item, itemType, description]);

  const handleSaveAllToBoard = useCallback(async (variations: { label: string; headline: string }[], sourceTitle: string) => {
    setSavingBoard(true);
    try {
      ensureLocalBoard("my-ideas", "My Ideas", "Quick ideas and notes", true);
      for (const variation of variations) {
        addLocalCard("my-ideas", {
          type: "idea",
          title: variation.headline,
          content: `${variation.label}: ${variation.headline}\n\nInspired by: ${sourceTitle}`,
          metadata: { variationLabel: variation.label, sourceTitle },
        });
      }
      toast.success(`Saved ${variations.length} headlines to My Ideas!`);
    } catch {
      toast.error("Failed to save headlines");
    } finally {
      setSavingBoard(false);
    }
  }, []);

  const handleGenerateLink = useCallback(async () => {
    const linkId = `chat-${Date.now()}`;
    const context = {
      id: linkId,
      itemTitle: item?.title,
      itemType,
      messages: messages.map((m) => ({ role: m.role, text: m.text })),
      createdAt: new Date().toISOString(),
    };
    try {
      ensureLocalBoard("my-ideas", "My Ideas", "Quick ideas and notes", true);
      addLocalCard("my-ideas", {
        type: "idea",
        title: `Chat link: ${(item?.title || "Chat").slice(0, 40)}`,
        content: JSON.stringify(context, null, 2),
        metadata: { kind: "chat-link", linkId, sourceTitle: item?.title, messageCount: messages.length },
      });
      const shareUrl = `${window.location.origin}/discover?chatLink=${linkId}`;
      await navigator.clipboard.writeText(shareUrl);
      toast.success("Share link copied to clipboard and saved to My Ideas");
    } catch {
      toast.error("Failed to generate link");
    }
  }, [item, itemType, messages]);

  const handleSendMessage = useCallback(async (textOverride?: string) => {
    const text = textOverride?.trim() || inputText.trim();
    if (!text) return;

    let currentSessionId = sessionId;
    if (!currentSessionId && resolvedUserId) {
      currentSessionId = await createSession();
    }

    const userMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      text,
      attachments: card ? [{
        type: "board_card",
        cardId: card.id,
        title: card.title,
        content: card.content,
      }, ...buildItemAttachment()] : buildItemAttachment(),
      createdAt: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputText("");
    setIsLoading(true);

    try {
      if (currentSessionId && resolvedUserId) {
        const token = await getToken();
        authFetch("/api/chat/message", {
          method: "POST",
          body: JSON.stringify({ userId: resolvedUserId, sessionId: currentSessionId, message: userMessage }),
        }, token).catch((err) => console.error("Failed to persist user message:", err));
      }

      // Fetch the full content (transcript/description for videos, body for
      // articles) so the model has real context, not just the card snippet.
      const itemAttachment = await fetchItemAttachment();

      // Build the outgoing array inline so rapid consecutive sends each
      // carry the freshest messages, avoiding stale-closure loss.
      const outgoingMessages = [
        { role: "system", text: systemContext },
        ...messagesRef.current.map((m) => ({ role: m.role, text: m.text })),
        { role: "user", text, attachments: card ? [{ type: "board_card" as const, cardId: card.id, title: card.title, content: card.content }, ...itemAttachment] : itemAttachment },
      ];

      const response = await fetch("/api/chat/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: currentSessionId,
          messages: outgoingMessages,
          intent: detectIntent(text),
          userVoice: buildVoicePromptSection(voiceProfile),
          ...(model ? { model } : {}),
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

        if (currentSessionId && resolvedUserId) {
          const token = await getToken();
          authFetch("/api/chat/message", {
            method: "POST",
            body: JSON.stringify({ userId: resolvedUserId, sessionId: currentSessionId, message: assistantMessage }),
          }, token).catch((err) => console.error("Failed to persist assistant message:", err));
        }
      } else {
        throw new Error(result.error || "Failed to generate response");
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to generate response");
    } finally {
      setIsLoading(false);
    }
  }, [inputText, messages, systemContext, sessionId, resolvedUserId, card, boardId, voiceProfile, item]);

  useEffect(() => {
    if (isOpen && initialPrompt && !hasAutoSentRef.current) {
      hasAutoSentRef.current = true;
      queueMicrotask(() => {
        if (isHeadlineVariationsPrompt(initialPrompt)) {
          void handleHeadlineVariations(initialPrompt);
        } else {
          void handleSendMessage(initialPrompt);
        }
      });
    }
    if (!isOpen) {
      hasAutoSentRef.current = false;
    }
  }, [isOpen, initialPrompt, handleHeadlineVariations, handleSendMessage]);

  const resetChat = useCallback(() => {
    setMessages([]);
    hasAutoSentRef.current = false;
  }, []);

  return {
    messages,
    inputText,
    setInputText,
    isLoading,
    savingBoard,
    messagesEndRef,
    systemContext,
    handleSendMessage,
    handleHeadlineVariations,
    handleSaveAllToBoard,
    handleGenerateLink,
    resetChat,
  };
}
