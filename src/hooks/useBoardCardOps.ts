"use client";

import { useCallback } from "react";
import { toast } from "sonner";
import { db } from "@/lib/firebase";
import {
  collection,
  doc,
  setDoc,
  deleteDoc,
  getDocs,
  query,
  orderBy,
  serverTimestamp,
  updateDoc,
  increment,
} from "firebase/firestore";
import type { BoardCard } from "@/types/board";

interface BoardItemLegacy {
  id: string;
  boardId: string;
  type: "video" | "post";
  title: string;
  thumbnail?: string;
  videoId?: string;
  url?: string;
  channelTitle?: string;
  viewCount?: number;
  outlierScore?: number;
  hookType?: string;
  estimatedStructure?: string;
  duration?: string;
  source?: string;
  score?: number;
  notes?: string;
  tags?: string[];
  createdAt: string;
}

interface UseBoardCardOpsArgs {
  userId: string | undefined;
  boardId: string | undefined;
}

interface UseBoardCardOpsResult {
  loadCards: () => Promise<BoardCard[]>;
  removeCard: (cardId: string) => Promise<void>;
  duplicateCard: (card: BoardCard) => Promise<void>;
  addNoteCard: () => Promise<BoardCard | null>;
  updateCard: (cardId: string, updates: Partial<BoardCard>) => Promise<void>;
  addCard: (card: BoardCard) => Promise<void>;
  saveCardPosition: (cardId: string, x: number, y: number) => Promise<void>;
}

async function migrateLegacyItems(userId: string, boardId: string): Promise<BoardCard[]> {
  const itemsSnapshot = await getDocs(
    query(collection(db, "users", userId, "boards", boardId, "items"), orderBy("createdAt", "desc"))
  );

  const migrated: BoardCard[] = [];
  for (const docSnap of itemsSnapshot.docs) {
    const data = docSnap.data() as BoardItemLegacy;
    const cardId = crypto.randomUUID();
    const card: BoardCard = {
      id: cardId,
      boardId,
      type: data.type === "post" ? "article" : "video",
      x: Math.random() * 400,
      y: Math.random() * 300,
      width: 240,
      height: data.thumbnail ? 200 : 120,
      title: data.title,
      content: data.notes || "",
      metadata: {
        channelTitle: data.channelTitle,
        viewCount: data.viewCount,
        outlierScore: data.outlierScore,
        hookType: data.hookType,
        estimatedStructure: data.estimatedStructure,
        duration: data.duration,
        source: data.source,
        score: data.score,
        tags: data.tags,
      },
      thumbnail: data.thumbnail,
      url: data.url,
      videoId: data.videoId,
      createdAt: data.createdAt,
      updatedAt: data.createdAt,
    };

    await setDoc(doc(db, "users", userId, "boards", boardId, "cards", cardId), {
      ...card,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    migrated.push(card);
  }
  return migrated;
}

export function useBoardCardOps({ userId, boardId }: UseBoardCardOpsArgs): UseBoardCardOpsResult {
  const loadCards = useCallback(async (): Promise<BoardCard[]> => {
    if (!userId || !boardId) return [];
    try {
      const cardsSnapshot = await getDocs(
        query(collection(db, "users", userId, "boards", boardId, "cards"), orderBy("createdAt", "desc"))
      );

      const loadedCards: BoardCard[] = [];
      cardsSnapshot.forEach((docSnap) => {
        const data = docSnap.data();
        loadedCards.push({
          id: docSnap.id,
          boardId: data.boardId,
          type: data.type || "note",
          x: data.x ?? Math.random() * 400,
          y: data.y ?? Math.random() * 300,
          width: data.width ?? 240,
          height: data.height ?? 160,
          title: data.title,
          content: data.content || "",
          metadata: data.metadata,
          thumbnail: data.thumbnail,
          url: data.url,
          videoId: data.videoId,
          artifactType: data.artifactType,
          platform: data.platform,
          scoredOutput: data.scoredOutput,
          createdAt: data.createdAt?.toDate?.()?.toISOString() || data.createdAt || "",
          updatedAt: data.updatedAt?.toDate?.()?.toISOString() || data.updatedAt || "",
        });
      });

      if (loadedCards.length === 0) {
        const migrated = await migrateLegacyItems(userId, boardId);
        loadedCards.push(...migrated);
      }

      return loadedCards;
    } catch (error) {
      console.error("Failed to load cards:", error);
      return [];
    }
  }, [userId, boardId]);

  const saveCardPosition = useCallback(async (cardId: string, x: number, y: number) => {
    if (!userId || !boardId) return;
    try {
      await updateDoc(doc(db, "users", userId, "boards", boardId, "cards", cardId), {
        x, y, updatedAt: serverTimestamp(),
      });
    } catch (error) {
      console.error("Failed to update card position:", error);
    }
  }, [userId, boardId]);

  const removeCard = useCallback(async (cardId: string) => {
    if (!userId || !boardId) return;
    try {
      await deleteDoc(doc(db, "users", userId, "boards", boardId, "cards", cardId));
      await updateDoc(doc(db, "users", userId, "boards", boardId), {
        itemCount: increment(-1), updatedAt: serverTimestamp(),
      });
    } catch {
      toast.error("Failed to remove card");
    }
  }, [userId, boardId]);

  const duplicateCard = useCallback(async (card: BoardCard) => {
    if (!userId || !boardId) return;
    const newCardId = crypto.randomUUID();
    const newCard: BoardCard = {
      ...card, id: newCardId, x: card.x + 20, y: card.y + 20,
      createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    };
    try {
      await setDoc(doc(db, "users", userId, "boards", boardId, "cards", newCardId), {
        ...newCard, createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
      });
      await updateDoc(doc(db, "users", userId, "boards", boardId), {
        itemCount: increment(1), updatedAt: serverTimestamp(),
      });
    } catch {
      toast.error("Failed to duplicate card");
    }
  }, [userId, boardId]);

  const addNoteCard = useCallback(async (): Promise<BoardCard | null> => {
    if (!userId || !boardId) return null;
    const cardId = crypto.randomUUID();
    const card: BoardCard = {
      id: cardId, boardId, type: "note",
      x: 100 + Math.random() * 200, y: 100 + Math.random() * 200,
      width: 240, height: 160, title: "New Note", content: "",
      createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    };
    try {
      await setDoc(doc(db, "users", userId, "boards", boardId, "cards", cardId), {
        ...card, createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
      });
      await updateDoc(doc(db, "users", userId, "boards", boardId), {
        itemCount: increment(1), updatedAt: serverTimestamp(),
      });
      return card;
    } catch {
      toast.error("Failed to add note");
      return null;
    }
  }, [userId, boardId]);

  const updateCard = useCallback(async (cardId: string, updates: Partial<BoardCard>) => {
    if (!userId || !boardId) return;
    try {
      await updateDoc(doc(db, "users", userId, "boards", boardId, "cards", cardId), {
        ...updates, updatedAt: serverTimestamp(),
      });
    } catch {
      toast.error("Failed to update card");
    }
  }, [userId, boardId]);

  const addCard = useCallback(async (card: BoardCard) => {
    if (!userId || !boardId) return;
    try {
      await setDoc(doc(db, "users", userId, "boards", boardId, "cards", card.id), {
        ...card, createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
      });
      await updateDoc(doc(db, "users", userId, "boards", boardId), {
        itemCount: increment(1), updatedAt: serverTimestamp(),
      });
    } catch {
      toast.error("Failed to add card");
    }
  }, [userId, boardId]);

  return { loadCards, removeCard, duplicateCard, addNoteCard, updateCard, addCard, saveCardPosition };
}
