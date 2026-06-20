"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
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
  writeBatch,
  updateDoc,
  increment,
} from "firebase/firestore";
import { BoardCanvas } from "@/components/board/BoardCanvas";
import { CardContextMenu } from "@/components/board/CardContextMenu";
import { ChatPanel } from "@/components/chat/ChatPanel";
import type { Board, BoardCard } from "@/types/board";

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

function formatDate(dateString: string): string {
  if (!dateString) return "Unknown";
  const date = new Date(dateString);
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function BoardsContent() {
  const router = useRouter();
  const { user } = useAuth();
  const [boards, setBoards] = useState<Board[]>([]);
  const [cards, setCards] = useState<BoardCard[]>([]);
  const [selectedBoard, setSelectedBoard] = useState<Board | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [newBoardName, setNewBoardName] = useState("");
  const [newBoardDesc, setNewBoardDesc] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [chatOpen, setChatOpen] = useState(false);
  const [chatCard, setChatCard] = useState<BoardCard | undefined>();
  const [editingCard, setEditingCard] = useState<BoardCard | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editContent, setEditContent] = useState("");

  useEffect(() => {
    if (!user) {
      setIsLoading(false);
      return;
    }
    loadBoards();
  }, [user]);

  useEffect(() => {
    if (selectedBoard && user) {
      loadCards(selectedBoard.id);
    }
  }, [selectedBoard, user]);

  async function loadBoards() {
    if (!user) return;
    setIsLoading(true);
    try {
      const boardsSnapshot = await getDocs(
        query(collection(db, "users", user.uid, "boards"), orderBy("updatedAt", "desc"))
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

      // Create default "My Ideas" board if none exists
      const hasDefault = loadedBoards.some((b) => b.isDefault);
      if (!hasDefault && user) {
        const defaultBoardId = "my-ideas";
        await setDoc(doc(db, "users", user.uid, "boards", defaultBoardId), {
          name: "My Ideas",
          description: "Quick ideas and notes",
          isDefault: true,
          itemCount: 0,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        loadedBoards.unshift({
          id: defaultBoardId,
          name: "My Ideas",
          description: "Quick ideas and notes",
          isDefault: true,
          itemCount: 0,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
      }

      setBoards(loadedBoards);
    } catch (error) {
      console.error("Failed to load boards:", error);
      toast.error("Failed to load boards");
    } finally {
      setIsLoading(false);
    }
  }

  async function loadCards(boardId: string) {
    if (!user) return;
    try {
      // Try loading new card format first
      const cardsSnapshot = await getDocs(
        query(collection(db, "users", user.uid, "boards", boardId, "cards"), orderBy("createdAt", "desc"))
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

      // If no cards found, try migrating legacy items
      if (loadedCards.length === 0) {
        const itemsSnapshot = await getDocs(
          query(collection(db, "users", user.uid, "boards", boardId, "items"), orderBy("createdAt", "desc"))
        );

        const legacyItems: BoardItemLegacy[] = [];
        itemsSnapshot.forEach((docSnap) => {
          const data = docSnap.data();
          legacyItems.push({
            id: docSnap.id,
            boardId,
            type: data.type || "video",
            title: data.title,
            thumbnail: data.thumbnail,
            videoId: data.videoId,
            url: data.url,
            channelTitle: data.channelTitle,
            viewCount: data.viewCount,
            outlierScore: data.outlierScore,
            hookType: data.hookType,
            estimatedStructure: data.estimatedStructure,
            duration: data.duration,
            source: data.source,
            score: data.score,
            notes: data.notes || "",
            tags: data.tags || [],
            createdAt: data.createdAt?.toDate?.()?.toISOString() || data.createdAt || "",
          });
        });

        // Migrate legacy items to cards
        for (const item of legacyItems) {
          const cardId = crypto.randomUUID();
          const card: BoardCard = {
            id: cardId,
            boardId,
            type: item.type === "post" ? "article" : "video",
            x: Math.random() * 400,
            y: Math.random() * 300,
            width: 240,
            height: item.thumbnail ? 200 : 120,
            title: item.title,
            content: item.notes || "",
            metadata: {
              channelTitle: item.channelTitle,
              viewCount: item.viewCount,
              outlierScore: item.outlierScore,
              hookType: item.hookType,
              estimatedStructure: item.estimatedStructure,
              duration: item.duration,
              source: item.source,
              score: item.score,
              tags: item.tags,
            },
            thumbnail: item.thumbnail,
            url: item.url,
            videoId: item.videoId,
            createdAt: item.createdAt,
            updatedAt: item.createdAt,
          };

          await setDoc(doc(db, "users", user.uid, "boards", boardId, "cards", cardId), {
            ...card,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });

          loadedCards.push(card);
        }
      }

      setCards(loadedCards);
    } catch (error) {
      console.error("Failed to load cards:", error);
    }
  }

  async function handleCardMove(cardId: string, x: number, y: number) {
    if (!user || !selectedBoard) return;

    setCards((prev) =>
      prev.map((c) => (c.id === cardId ? { ...c, x, y } : c))
    );

    // Debounced save
    try {
      await updateDoc(doc(db, "users", user.uid, "boards", selectedBoard.id, "cards", cardId), {
        x,
        y,
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      console.error("Failed to update card position:", error);
    }
  }

  async function handleDropFromDiscover(e: React.DragEvent) {
    e.preventDefault();
    if (!user || !selectedBoard) return;

    const json = e.dataTransfer.getData("application/json");
    if (!json) return;

    let dragData: Record<string, unknown>;
    try {
      dragData = JSON.parse(json);
    } catch {
      return;
    }

    const type = dragData.type as string;
    if (!type) return;

    const cardId = crypto.randomUUID();
    const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
    const x = Math.max(0, e.clientX - rect.left - 120);
    const y = Math.max(0, e.clientY - rect.top - 80);

    let card: BoardCard;

    if (type === "video") {
      card = {
        id: cardId,
        boardId: selectedBoard.id,
        type: "video",
        x,
        y,
        width: 240,
        height: 200,
        title: (dragData.title as string) || "Video",
        content: (dragData.description as string) || "",
        thumbnail: (dragData.thumbnail as string) || undefined,
        videoId: (dragData.videoId as string) || undefined,
        metadata: {
          channelTitle: dragData.channelTitle as string,
          viewCount: dragData.viewCount as number,
          outlierScore: dragData.outlierScore as number,
          hookType: dragData.hookType as string,
          structure: dragData.structure as string,
        },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
    } else if (type === "article") {
      card = {
        id: cardId,
        boardId: selectedBoard.id,
        type: "article",
        x,
        y,
        width: 240,
        height: 160,
        title: (dragData.title as string) || "Article",
        content: (dragData.content as string) || "",
        thumbnail: (dragData.thumbnail as string) || undefined,
        url: (dragData.url as string) || undefined,
        metadata: {
          author: dragData.author as string,
          source: dragData.source as string,
        },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
    } else {
      return;
    }

    try {
      await setDoc(doc(db, "users", user.uid, "boards", selectedBoard.id, "cards", cardId), {
        ...card,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      await updateDoc(doc(db, "users", user.uid, "boards", selectedBoard.id), {
        itemCount: increment(1),
        updatedAt: serverTimestamp(),
      });
      setCards((prev) => [...prev, card]);
      toast.success("Added to board");
    } catch {
      toast.error("Failed to add to board");
    }
  }

  async function handleCreateBoard() {
    if (!newBoardName.trim()) {
      toast.error("Please enter a board name");
      return;
    }
    if (!user) {
      toast.error("Please sign in to create boards");
      return;
    }

    const boardId = crypto.randomUUID();
    const newBoard: Board = {
      id: boardId,
      name: newBoardName.trim(),
      description: newBoardDesc.trim(),
      isDefault: false,
      itemCount: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    try {
      await setDoc(doc(db, "users", user.uid, "boards", boardId), {
        name: newBoard.name,
        description: newBoard.description,
        isDefault: false,
        itemCount: 0,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      setBoards((prev) => [newBoard, ...prev]);
      setNewBoardName("");
      setNewBoardDesc("");
      setIsCreating(false);
      toast.success("Board created!");
    } catch (error) {
      console.error("Failed to save board:", error);
      toast.error("Failed to save board");
    }
  }

  async function handleDeleteBoard(boardId: string) {
    if (!user) return;

    try {
      const cardsSnapshot = await getDocs(collection(db, "users", user.uid, "boards", boardId, "cards"));
      const batch = writeBatch(db);
      cardsSnapshot.forEach((docSnap) => {
        batch.delete(doc(db, "users", user.uid, "boards", boardId, "cards", docSnap.id));
      });
      await batch.commit();
      await deleteDoc(doc(db, "users", user.uid, "boards", boardId));

      setBoards((prev) => prev.filter((b) => b.id !== boardId));
      setCards((prev) => prev.filter((c) => c.boardId !== boardId));
      if (selectedBoard?.id === boardId) {
        setSelectedBoard(null);
      }
      toast.success("Board deleted");
    } catch (error) {
      console.error("Failed to delete board:", error);
      toast.error("Failed to delete board");
    }
  }

  async function handleRemoveCard(cardId: string) {
    if (!user || !selectedBoard) return;
    try {
      await deleteDoc(doc(db, "users", user.uid, "boards", selectedBoard.id, "cards", cardId));
      await updateDoc(doc(db, "users", user.uid, "boards", selectedBoard.id), {
        itemCount: increment(-1),
        updatedAt: serverTimestamp(),
      });
      setCards((prev) => prev.filter((c) => c.id !== cardId));
      toast.success("Card removed");
    } catch {
      toast.error("Failed to remove card");
    }
  }

  async function handleDuplicateCard(card: BoardCard) {
    if (!user || !selectedBoard) return;
    const newCardId = crypto.randomUUID();
    const newCard: BoardCard = {
      ...card,
      id: newCardId,
      x: card.x + 20,
      y: card.y + 20,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    try {
      await setDoc(doc(db, "users", user.uid, "boards", selectedBoard.id, "cards", newCardId), {
        ...newCard,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      await updateDoc(doc(db, "users", user.uid, "boards", selectedBoard.id), {
        itemCount: increment(1),
        updatedAt: serverTimestamp(),
      });
      setCards((prev) => [...prev, newCard]);
      toast.success("Card duplicated");
    } catch {
      toast.error("Failed to duplicate card");
    }
  }

  async function handleAddNoteCard() {
    if (!user || !selectedBoard) return;
    const cardId = crypto.randomUUID();
    const card: BoardCard = {
      id: cardId,
      boardId: selectedBoard.id,
      type: "note",
      x: 100 + Math.random() * 200,
      y: 100 + Math.random() * 200,
      width: 240,
      height: 160,
      title: "New Note",
      content: "",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    try {
      await setDoc(doc(db, "users", user.uid, "boards", selectedBoard.id, "cards", cardId), {
        ...card,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      await updateDoc(doc(db, "users", user.uid, "boards", selectedBoard.id), {
        itemCount: increment(1),
        updatedAt: serverTimestamp(),
      });
      setCards((prev) => [...prev, card]);
      setEditingCard(card);
      setEditTitle(card.title);
      setEditContent(card.content);
    } catch {
      toast.error("Failed to add note");
    }
  }

  async function handleSaveEdit() {
    if (!user || !selectedBoard || !editingCard) return;
    try {
      await updateDoc(doc(db, "users", user.uid, "boards", selectedBoard.id, "cards", editingCard.id), {
        title: editTitle,
        content: editContent,
        updatedAt: serverTimestamp(),
      });
      setCards((prev) =>
        prev.map((c) =>
          c.id === editingCard.id ? { ...c, title: editTitle, content: editContent } : c
        )
      );
      setEditingCard(null);
      toast.success("Note updated");
    } catch {
      toast.error("Failed to update note");
    }
  }

  function filteredBoards() {
    if (!searchQuery.trim()) return boards;
    const q = searchQuery.toLowerCase();
    return boards.filter(
      (b) => b.name.toLowerCase().includes(q) || b.description.toLowerCase().includes(q)
    );
  }

  function handleOpenChat(card?: BoardCard) {
    setChatCard(card);
    setChatOpen(true);
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <div className="w-full max-w-md mx-4 bg-[#1a1a1a] rounded-lg border border-[#2a2a2a] p-6 text-center">
          <h2 className="text-xl font-semibold mb-2 text-white">Sign In Required</h2>
          <p className="text-[#888] mb-4">Please sign in to access your boards.</p>
          <Button onClick={() => router.push("/auth/login")}>Sign In</Button>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] flex">
      {/* Left Sidebar */}
      <div className="w-64 bg-[#0a0a0a] border-r border-[#1a1a1a] flex flex-col">
        {/* Search */}
        <div className="p-3">
          <div className="relative">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#666]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <Input
              placeholder="Search boards..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-[#1a1a1a] border-[#2a2a2a] pl-9 text-sm text-white placeholder-[#666] focus:border-[#3a3a3a]"
            />
          </div>
        </div>

        {/* Boards List */}
        <div className="flex-1 overflow-y-auto px-3 pb-3">
          <div className="space-y-1">
            {filteredBoards().map((board) => (
              <button
                key={board.id}
                onClick={() => {
                  setSelectedBoard(board);
                  setCards([]);
                }}
                className={`w-full text-left px-3 py-2 rounded-md text-sm transition-colors ${
                  selectedBoard?.id === board.id
                    ? "bg-[#1a1a1a] text-white"
                    : "text-[#888] hover:bg-[#1a1a1a] hover:text-white"
                }`}
              >
                <div className="flex items-center gap-2">
                  <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                  </svg>
                  <span className="truncate">{board.name}</span>
                  <span className="text-xs text-[#666] ml-auto">{board.itemCount}</span>
                </div>
              </button>
            ))}
          </div>

          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsCreating(true)}
            className="mt-3 w-full text-[#888] hover:text-white hover:bg-[#1a1a1a] justify-start"
          >
            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4v16m8-8H4" />
            </svg>
            New Board
          </Button>
        </div>

        {/* Bottom Actions */}
        <div className="p-3 border-t border-[#1a1a1a] space-y-1">
          <button className="w-full text-left px-3 py-2 rounded-md text-sm text-[#888] hover:bg-[#1a1a1a] hover:text-white transition-colors flex items-center gap-2">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
            </svg>
            Academy
          </button>
          <button className="w-full text-left px-3 py-2 rounded-md text-sm text-[#888] hover:bg-[#1a1a1a] hover:text-white transition-colors flex items-center gap-2">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Help & Support
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col">
        {!selectedBoard ? (
          // Board Grid View
          <div className="flex-1 p-8">
            <div className="mb-8">
              <h1 className="text-3xl font-bold mb-2 text-white">Workspace</h1>
              <p className="text-[#888]">Organize your content and ideas</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredBoards().map((board) => (
                <div
                  key={board.id}
                  className="bg-[#1a1a1a] rounded-lg border border-[#2a2a2a] overflow-hidden hover:border-[#3a3a3a] transition-colors cursor-pointer"
                  onClick={() => {
                    setSelectedBoard(board);
                    setCards([]);
                  }}
                >
                  <div className="p-5">
                    <h3 className="font-semibold text-lg text-white">{board.name}</h3>
                    <p className="text-sm text-[#888] mt-1 line-clamp-2">{board.description}</p>
                    <div className="flex items-center justify-between mt-4">
                      <span className="text-xs text-[#666]">{board.itemCount} items</span>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-red-400 hover:text-red-300 hover:bg-red-900/20"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteBoard(board.id);
                        }}
                      >
                        Delete
                      </Button>
                    </div>
                    {board.updatedAt && (
                      <p className="text-xs text-[#666] mt-2">
                        Updated {formatDate(board.updatedAt)}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          // Board Canvas View
          <>
            {/* Top Bar */}
            <div className="h-14 border-b border-[#1a1a1a] flex items-center justify-between px-4">
              <div className="flex items-center gap-3">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setSelectedBoard(null);
                    setCards([]);
                  }}
                  className="text-[#888] hover:text-white"
                >
                  <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 19l-7-7 7-7" />
                  </svg>
                  Back
                </Button>
                <h2 className="text-lg font-semibold text-white">{selectedBoard.name}</h2>
                <span className="text-xs text-[#666]">{cards.length} items</span>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleAddNoteCard}
                  className="text-[#888] hover:text-white"
                >
                  <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4v16m8-8H4" />
                  </svg>
                  Add Note
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleOpenChat()}
                  className="text-[#888] hover:text-white"
                >
                  <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 14.583 3 13.303 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                  </svg>
                  Chat
                </Button>
              </div>
            </div>

            {/* Canvas */}
            <div className="flex-1 relative">
              <BoardCanvas
                cards={cards}
                onCardMove={handleCardMove}
                onCardClick={(card) => {
                  if (card.type === "note" || card.type === "idea") {
                    setEditingCard(card);
                    setEditTitle(card.title);
                    setEditContent(card.content);
                  }
                }}
                onChatWith={(card) => handleOpenChat(card)}
                onDownload={(card) => {
                  const blob = new Blob([JSON.stringify(card, null, 2)], { type: "application/json" });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement("a");
                  a.href = url;
                  a.download = `${card.title.replace(/\s+/g, "_")}.json`;
                  a.click();
                  URL.revokeObjectURL(url);
                }}
                onRemove={(card) => handleRemoveCard(card.id)}
                onDuplicate={(card) => handleDuplicateCard(card)}
                onDrop={handleDropFromDiscover}
              />
            </div>
          </>
        )}
      </div>

      {/* Create Board Dialog */}
      <Dialog open={isCreating} onOpenChange={setIsCreating}>
        <DialogContent className="bg-[#1a1a1a] border-[#2a2a2a]">
          <DialogHeader>
            <DialogTitle className="text-white">Create New Board</DialogTitle>
            <DialogDescription className="text-[#888]">Give your board a name and description</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <Input
              placeholder="Board name..."
              value={newBoardName}
              onChange={(e) => setNewBoardName(e.target.value)}
              className="bg-[#0a0a0a] border-[#2a2a2a] text-white placeholder-[#666]"
            />
            <Input
              placeholder="Description (optional)..."
              value={newBoardDesc}
              onChange={(e) => setNewBoardDesc(e.target.value)}
              className="bg-[#0a0a0a] border-[#2a2a2a] text-white placeholder-[#666]"
            />
            <div className="flex gap-3">
              <Button onClick={handleCreateBoard} className="flex-1 bg-blue-600 hover:bg-blue-700">
                Create Board
              </Button>
              <Button variant="outline" onClick={() => setIsCreating(false)} className="border-[#2a2a2a] text-white hover:bg-[#2a2a2a]">
                Cancel
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Card Editor Dialog */}
      <Dialog open={!!editingCard} onOpenChange={(open) => !open && setEditingCard(null)}>
        <DialogContent className="bg-[#1a1a1a] border-[#2a2a2a] max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-white">Edit Note</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <Input
              placeholder="Title..."
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              className="bg-[#0a0a0a] border-[#2a2a2a] text-white placeholder-[#666]"
            />
            <textarea
              placeholder="Content..."
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
              className="w-full min-h-[200px] bg-[#0a0a0a] border border-[#2a2a2a] rounded-md p-3 text-sm text-white placeholder-[#666] focus:outline-none focus:border-[#3a3a3a] resize-none"
            />
            <div className="flex gap-3">
              <Button onClick={handleSaveEdit} className="flex-1 bg-blue-600 hover:bg-blue-700">
                Save
              </Button>
              <Button variant="outline" onClick={() => setEditingCard(null)} className="border-[#2a2a2a] text-white hover:bg-[#2a2a2a]">
                Cancel
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Chat Panel */}
      <ChatPanel
        isOpen={chatOpen}
        onClose={() => setChatOpen(false)}
        boardId={selectedBoard?.id}
        card={chatCard}
        onAddToBoard={(artifact) => {
          if (!selectedBoard || !user) return;
          const cardId = crypto.randomUUID();
          const newCard: BoardCard = {
            id: cardId,
            boardId: selectedBoard.id,
            type: artifact.type === "script" ? "script" : "social",
            x: 100 + Math.random() * 200,
            y: 100 + Math.random() * 200,
            width: 240,
            height: 160,
            title: artifact.type === "script" ? "Generated Script" : "Social Post",
            content: artifact.content,
            platform: artifact.platform as BoardCard["platform"],
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };
          setDoc(doc(db, "users", user.uid, "boards", selectedBoard.id, "cards", cardId), {
            ...newCard,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          }).then(() => {
            updateDoc(doc(db, "users", user.uid, "boards", selectedBoard.id), {
              itemCount: increment(1),
              updatedAt: serverTimestamp(),
            });
            setCards((prev) => [...prev, newCard]);
            toast.success("Added to board");
          }).catch(() => {
            toast.error("Failed to add to board");
          });
        }}
      />
    </div>
  );
}

export default function BoardsPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white" /></div>}>
      <BoardsContent />
    </Suspense>
  );
}
