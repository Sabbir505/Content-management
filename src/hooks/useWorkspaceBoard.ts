"use client";

import { useState, useCallback } from "react";
import { toast } from "sonner";
import type { User } from "firebase/auth";
import { db } from "@/lib/firebase";
import { getLocalCardsAsBoardCards, ensureLocalBoard, addLocalCard, removeLocalCard } from "@/lib/local-board";
import {
  collection,
  doc,
  setDoc,
  deleteDoc,
  getDoc,
  getDocs,
  query,
  orderBy,
  serverTimestamp,
  updateDoc,
  increment,
} from "firebase/firestore";
import type { BoardCard } from "@/types/board";

type AddCardType = "note" | "link" | "document" | "card" | "section" | "reference";

interface UseWorkspaceBoardArgs {
  user: User | null | undefined;
  initialWorkspace?: string | null;
}

interface UseWorkspaceBoardResult {
  activeWorkspace: string | null;
  setActiveWorkspace: React.Dispatch<React.SetStateAction<string | null>>;
  workspaceCards: BoardCard[];
  setWorkspaceCards: React.Dispatch<React.SetStateAction<BoardCard[]>>;
  isLoadingWorkspace: boolean;
  addMenuOpen: boolean;
  setAddMenuOpen: React.Dispatch<React.SetStateAction<boolean>>;
  cardContextMenu: { card: BoardCard; x: number; y: number } | null;
  setCardContextMenu: React.Dispatch<React.SetStateAction<{ card: BoardCard; x: number; y: number } | null>>;
  rightPane: { type: "info" | "chat"; card?: BoardCard } | null;
  setRightPane: React.Dispatch<React.SetStateAction<{ type: "info" | "chat"; card?: BoardCard } | null>>;
  chatInput: string;
  setChatInput: React.Dispatch<React.SetStateAction<string>>;
  loadWorkspaceCards: (boardId: string) => Promise<void>;
  handleAddCard: (type: AddCardType) => Promise<void>;
  handleDeleteCard: (cardId: string) => Promise<void>;
  handleDuplicateCard: (card: BoardCard) => Promise<void>;
  handleMoveToBoard: (card: BoardCard) => Promise<void>;
  handleReferenceToBoard: (card: BoardCard) => Promise<void>;
}

export function useWorkspaceBoard({ user, initialWorkspace }: UseWorkspaceBoardArgs): UseWorkspaceBoardResult {
  const [activeWorkspace, setActiveWorkspace] = useState<string | null>(initialWorkspace ?? null);
  const [workspaceCards, setWorkspaceCards] = useState<BoardCard[]>([]);
  const [isLoadingWorkspace, setIsLoadingWorkspace] = useState(false);
  const [addMenuOpen, setAddMenuOpen] = useState(false);
  const [cardContextMenu, setCardContextMenu] = useState<{ card: BoardCard; x: number; y: number } | null>(null);
  const [rightPane, setRightPane] = useState<{ type: "info" | "chat"; card?: BoardCard } | null>(null);
  const [chatInput, setChatInput] = useState("");

  const loadWorkspaceCards = useCallback(
    async (boardId: string) => {
      if (!user) {
        setWorkspaceCards(getLocalCardsAsBoardCards(boardId));
        return;
      }
      setIsLoadingWorkspace(true);
      try {
        const loaded: BoardCard[] = [];

        try {
          const boardRef = doc(db, "users", user.uid, "boards", boardId);
          const boardSnap = await getDoc(boardRef);
          if (!boardSnap.exists()) {
            const name = boardId === "my-first-board" ? "My First Board" : "My Ideas";
            await setDoc(boardRef, {
              name,
              description: boardId === "my-first-board" ? "Your notes and references" : "Quick ideas and notes",
              isDefault: boardId === "my-ideas",
              itemCount: 0,
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            });
          }

          const cardsSnapshot = await getDocs(
            query(collection(db, "users", user.uid, "boards", boardId, "cards"), orderBy("createdAt", "desc"))
          );
          cardsSnapshot.forEach((docSnap) => {
            const data = docSnap.data();
            loaded.push({
              id: docSnap.id,
              boardId: data.boardId || boardId,
              type: data.type || "note",
              x: data.x ?? 0,
              y: data.y ?? 0,
              width: data.width ?? 240,
              height: data.height ?? 160,
              title: data.title || "Untitled",
              content: data.content || "",
              metadata: data.metadata,
              thumbnail: data.thumbnail,
              url: data.url,
              videoId: data.videoId,
              createdAt: data.createdAt?.toDate?.()?.toISOString() || data.createdAt || "",
              updatedAt: data.updatedAt?.toDate?.()?.toISOString() || data.updatedAt || "",
            });
          });
        } catch (error) {
          console.warn("Firestore unavailable, using local storage only:", error);
        }

        const localCards = getLocalCardsAsBoardCards(boardId);
        const existingIds = new Set(loaded.map((c) => c.id));
        for (const localCard of localCards) {
          if (!existingIds.has(localCard.id)) {
            loaded.unshift(localCard);
          }
        }

        setWorkspaceCards(loaded);
      } catch (error) {
        console.error("Failed to load workspace cards:", error);
        setWorkspaceCards(getLocalCardsAsBoardCards(boardId));
      } finally {
        setIsLoadingWorkspace(false);
      }
    },
    [user]
  );

  const handleAddCard = useCallback(
    async (type: AddCardType) => {
      if (!user || !activeWorkspace) return;
      const cardId = crypto.randomUUID();
      const titleMap: Record<AddCardType, string> = {
        note: "New Note",
        link: "New Link",
        document: "New Document",
        card: "New Card",
        section: "New Section",
        reference: "New Reference",
      };
      const card: BoardCard = {
        id: cardId,
        boardId: activeWorkspace,
        type: "note",
        x: 0,
        y: 0,
        width: 240,
        height: 160,
        title: titleMap[type],
        content: "",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      try {
        await setDoc(doc(db, "users", user.uid, "boards", activeWorkspace, "cards", cardId), {
          ...card,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        await updateDoc(doc(db, "users", user.uid, "boards", activeWorkspace), {
          itemCount: increment(1),
          updatedAt: serverTimestamp(),
        });
        setWorkspaceCards((prev) => [card, ...prev]);
        toast.success(`${titleMap[type]} created`);
      } catch {
        toast.error("Failed to create item");
      }
      setAddMenuOpen(false);
    },
    [user, activeWorkspace]
  );

  const handleDeleteCard = useCallback(
    async (cardId: string) => {
      if (!activeWorkspace) return;

      let firestoreDeleted = false;
      if (user) {
        try {
          await deleteDoc(doc(db, "users", user.uid, "boards", activeWorkspace, "cards", cardId));
          await updateDoc(doc(db, "users", user.uid, "boards", activeWorkspace), {
            itemCount: increment(-1),
            updatedAt: serverTimestamp(),
          });
          firestoreDeleted = true;
        } catch {
          toast.error("Failed to delete card");
        }
      }

      // Always remove from localStorage so signed-out users and local duplicates
      // are deleted even when Firestore is unavailable.
      removeLocalCard(activeWorkspace, cardId);
      setWorkspaceCards((prev) => prev.filter((c) => c.id !== cardId));

      if (!user || firestoreDeleted) {
        toast.success("Card deleted");
      }
      setCardContextMenu(null);
    },
    [user, activeWorkspace]
  );

  const handleDuplicateCard = useCallback(
    async (card: BoardCard) => {
      if (!user || !activeWorkspace) return;
      const newId = crypto.randomUUID();
      const newCard = { ...card, id: newId, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
      try {
        await setDoc(doc(db, "users", user.uid, "boards", activeWorkspace, "cards", newId), {
          ...newCard,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        await updateDoc(doc(db, "users", user.uid, "boards", activeWorkspace), {
          itemCount: increment(1),
          updatedAt: serverTimestamp(),
        });
        setWorkspaceCards((prev) => [newCard, ...prev]);
        toast.success("Card duplicated");
      } catch {
        toast.error("Failed to duplicate card");
      }
      setCardContextMenu(null);
    },
    [user, activeWorkspace]
  );

  const handleMoveToBoard = useCallback(async (card: BoardCard) => {
    const boardId = `board-${Date.now()}`;
    ensureLocalBoard(boardId, `Board: ${card.title.slice(0, 30)}`, `Board created from "${card.title}"`, false);
    addLocalCard(boardId, {
      type: card.type,
      title: card.title,
      content: card.content,
      metadata: { ...card.metadata, sourceBoardId: card.boardId, movedAt: new Date().toISOString() },
      thumbnail: card.thumbnail,
      url: card.url,
      videoId: card.videoId,
    });
    toast.success(`Created new board with "${card.title.slice(0, 30)}"`);
    setCardContextMenu(null);
  }, []);

  const handleReferenceToBoard = useCallback(async (card: BoardCard) => {
    ensureLocalBoard("my-ideas", "My Ideas", "Quick ideas and notes", true);
    addLocalCard("my-ideas", {
      type: "idea",
      title: `Ref: ${card.title}`,
      content: `Reference to "${card.title}"\n\n${card.content || ""}\n\nSource board: ${card.boardId}`,
      metadata: { referenceBoardId: card.boardId, referenceCardId: card.id, sourceTitle: card.title },
    });
    toast.success(`Added reference to My Ideas`);
    setCardContextMenu(null);
  }, []);

  return {
    activeWorkspace,
    setActiveWorkspace,
    workspaceCards,
    setWorkspaceCards,
    isLoadingWorkspace,
    addMenuOpen,
    setAddMenuOpen,
    cardContextMenu,
    setCardContextMenu,
    rightPane,
    setRightPane,
    chatInput,
    setChatInput,
    loadWorkspaceCards,
    handleAddCard,
    handleDeleteCard,
    handleDuplicateCard,
    handleMoveToBoard,
    handleReferenceToBoard,
  };
}
