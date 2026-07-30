"use client";

import { useState, useEffect } from "react";
import { db } from "@/lib/firebase";
import {
  collection,
  query,
  orderBy,
  limit,
  getDocs,
} from "firebase/firestore";
import { useLocalCreators } from "@/hooks/useLocalCreators";
import type { Board } from "@/types/board";

export interface RecentChat {
  id: string;
  title: string;
  boardName?: string;
  updatedAt: string;
}

export interface CreatorPost {
  id: string;
  title: string;
  thumbnail?: string;
  channelTitle: string;
  publishedAt: string;
}

export function formatChatDate(dateString: string): string {
  if (!dateString) return "Recently";
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffMinutes = Math.floor(diffMs / (1000 * 60));

  if (diffMinutes < 1) return "Just now";
  if (diffMinutes < 60) return `${diffMinutes}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function useHomePage(userId: string | undefined) {
  const [boards, setBoards] = useState<Board[]>([]);
  const [recentChats, setRecentChats] = useState<RecentChat[]>([]);
  const { creators, isLoading: creatorsLoading } = useLocalCreators();
  const [creatorPosts] = useState<CreatorPost[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [onboardingStep, setOnboardingStep] = useState(0);
  const [dailyStreak, setDailyStreak] = useState(0);

  const chatSessions = recentChats.map((chat) => ({ id: chat.id, title: chat.title }));

  async function loadData() {
    if (!userId) return;
    setIsLoading(true);

    try {
      const boardsSnapshot = await getDocs(
        query(collection(db, "users", userId, "boards"), orderBy("updatedAt", "desc"), limit(5))
      );
      const loadedBoards: Board[] = [];
      boardsSnapshot.forEach((docSnap) => {
        const data = docSnap.data();
        loadedBoards.push({
          id: docSnap.id,
          name: data.name,
          description: data.description || "",
          isDefault: data.isDefault || false,
          itemCount: data.itemCount || 0,
          createdAt: data.createdAt?.toDate?.()?.toISOString() || data.createdAt || "",
          updatedAt: data.updatedAt?.toDate?.()?.toISOString() || data.updatedAt || "",
        });
      });
      setBoards(loadedBoards);

      const chatsSnapshot = await getDocs(
        query(collection(db, "users", userId, "chatSessions"), orderBy("updatedAt", "desc"), limit(5))
      );
      const loadedChats: RecentChat[] = [];
      chatsSnapshot.forEach((docSnap) => {
        const data = docSnap.data();
        loadedChats.push({
          id: docSnap.id,
          title: data.title || "Untitled Chat",
          boardName: data.boardName,
          updatedAt: data.updatedAt?.toDate?.()?.toISOString() || data.updatedAt || "",
        });
      });
      setRecentChats(loadedChats);

      let step = 0;
      if (loadedBoards.length > 0) step = 1;
      if (loadedChats.length > 0) step = 2;
      try {
        const savedCreators = localStorage.getItem("tubeforge_local_creators");
        if (savedCreators) {
          const parsed = JSON.parse(savedCreators);
          if (Array.isArray(parsed) && parsed.length > 0) step = 3;
        }
      } catch { /* ignore */ }
      setOnboardingStep(step);

      const streakKey = "tubeforge_daily_streak";
      const todayKey = `tubeforge_activity_${new Date().toDateString()}`;
      const lastActivityDay = localStorage.getItem("tubeforge_last_activity_day");
      const today = new Date().toDateString();
      if (lastActivityDay !== today) {
        const yesterday = new Date(Date.now() - 86400000).toDateString();
        const wasActiveYesterday = localStorage.getItem(`tubeforge_activity_${yesterday}`) === "true";
        const currentStreak = parseInt(localStorage.getItem(streakKey) || "0");
        const newStreak = wasActiveYesterday ? currentStreak + 1 : 1;
        localStorage.setItem(streakKey, String(newStreak));
        localStorage.setItem("tubeforge_last_activity_day", today);
        setDailyStreak(newStreak);
      } else {
        const currentStreak = parseInt(localStorage.getItem(streakKey) || "1");
        setDailyStreak(currentStreak);
      }
      localStorage.setItem(todayKey, "true");
    } catch (error) {
      console.error("Failed to load homepage data:", error);
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    if (userId) {
      // Defer so setState inside loadData doesn't run synchronously in the effect
      queueMicrotask(() => void loadData());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  return {
    boards,
    recentChats,
    chatSessions,
    creators,
    creatorsLoading,
    creatorPosts,
    isLoading,
    onboardingStep,
    dailyStreak,
  };
}
