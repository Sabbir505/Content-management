"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { authFetch } from "@/lib/authFetch";

interface ChatSession {
  id: string;
  title: string;
  updatedAt?: string;
}

interface UseChatSessionsResult {
  chatSessions: ChatSession[];
  isLoadingChatSessions: boolean;
}

export function useChatSessions(): UseChatSessionsResult {
  const { user } = useAuth();
  const [chatSessions, setChatSessions] = useState<ChatSession[]>([]);
  const [isLoadingChatSessions, setIsLoadingChatSessions] = useState(false);

  useEffect(() => {
    if (!user) return;

    let cancelled = false;
    async function loadChatSessions() {
      if (!user) return;
      setIsLoadingChatSessions(true);
      try {
        const token = await user.getIdToken();
        const response = await authFetch(`/api/chat/session?userId=${user.uid}`, {}, token);
        const result = await response.json();
        if (!cancelled && result.success) {
          setChatSessions(
            result.data.map((s: { id: string; title: string; updatedAt?: string }) => ({
              id: s.id,
              title: s.title,
              updatedAt: s.updatedAt,
            }))
          );
        }
      } catch (error) {
        console.error("Failed to load chat sessions:", error);
      } finally {
        if (!cancelled) setIsLoadingChatSessions(false);
      }
    }

    loadChatSessions();
    return () => {
      cancelled = true;
    };
  }, [user?.uid]);

  return { chatSessions, isLoadingChatSessions };
}
