"use client";

import { useState, Suspense, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { collection, doc, setDoc, deleteDoc, getDocs, query, orderBy } from "firebase/firestore";
import { db } from "@/lib/firebase";

interface Board {
  id: string;
  name: string;
  description: string;
  itemCount: number;
  createdAt: string;
}

interface BoardItem {
  id: string;
  boardId: string;
  type: "video" | "script" | "post";
  title: string;
  thumbnail?: string;
  platform?: string;
  createdAt: string;
}

function BoardsContent() {
  const router = useRouter();
  const { user } = useAuth();
  const [boards, setBoards] = useState<Board[]>([]);
  const [items, setItems] = useState<BoardItem[]>([]);
  const [selectedBoard, setSelectedBoard] = useState<Board | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [newBoardName, setNewBoardName] = useState("");
  const [newBoardDesc, setNewBoardDesc] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  // Load boards and items from Firestore on mount
  useEffect(() => {
    if (!user) {
      setIsLoading(false);
      return;
    }

    async function loadBoards() {
      try {
        const boardsSnapshot = await getDocs(
          query(collection(db, "users", user!.uid, "boards"), orderBy("createdAt", "desc"))
        );
        const loadedBoards: Board[] = [];
        boardsSnapshot.forEach((docSnap) => {
          const data = docSnap.data();
          loadedBoards.push({
            id: docSnap.id,
            name: data.name,
            description: data.description || "",
            itemCount: data.itemCount || 0,
            createdAt: data.createdAt,
          });
        });
        setBoards(loadedBoards);

        const itemsSnapshot = await getDocs(
          query(collection(db, "users", user!.uid, "boardItems"), orderBy("createdAt", "desc"))
        );
        const loadedItems: BoardItem[] = [];
        itemsSnapshot.forEach((docSnap) => {
          const data = docSnap.data();
          loadedItems.push({
            id: docSnap.id,
            boardId: data.boardId,
            type: data.type,
            title: data.title,
            thumbnail: data.thumbnail,
            platform: data.platform,
            createdAt: data.createdAt,
          });
        });
        setItems(loadedItems);
      } catch (error) {
        console.error("Failed to load boards:", error);
        toast.error("Failed to load boards");
      } finally {
        setIsLoading(false);
      }
    }

    loadBoards();
  }, [user]);

  function filteredBoards() {
    if (!searchQuery.trim()) return boards;
    const q = searchQuery.toLowerCase();
    return boards.filter(
      (b) =>
        b.name.toLowerCase().includes(q) ||
        b.description.toLowerCase().includes(q)
    );
  }

  function filteredItems() {
    if (!searchQuery.trim() || !selectedBoard) return getBoardItems(selectedBoard?.id || "");
    const q = searchQuery.toLowerCase();
    return getBoardItems(selectedBoard.id).filter(
      (item) => item.title.toLowerCase().includes(q)
    );
  }

  function getBoardItems(boardId: string): BoardItem[] {
    return items.filter((item) => item.boardId === boardId);
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

    const boardId = Date.now().toString();
    const newBoard: Board = {
      id: boardId,
      name: newBoardName,
      description: newBoardDesc,
      itemCount: 0,
      createdAt: new Date().toISOString().split("T")[0],
    };

    try {
      await setDoc(doc(db, "users", user.uid, "boards", boardId), {
        name: newBoard.name,
        description: newBoard.description,
        itemCount: newBoard.itemCount,
        createdAt: newBoard.createdAt,
      });
    } catch (error) {
      console.error("Failed to save board:", error);
      toast.error("Failed to save board");
      return;
    }

    setBoards((prev) => [...prev, newBoard]);
    setNewBoardName("");
    setNewBoardDesc("");
    setIsCreating(false);
    toast.success("Board created!");
  }

  async function handleDeleteBoard(boardId: string) {
    if (!user) return;

    try {
      await deleteDoc(doc(db, "users", user.uid, "boards", boardId));
    } catch (error) {
      console.error("Failed to delete board:", error);
      toast.error("Failed to delete board");
      return;
    }

    setBoards((prev) => prev.filter((b) => b.id !== boardId));
    setItems((prev) => prev.filter((item) => item.boardId !== boardId));
    if (selectedBoard?.id === boardId) {
      setSelectedBoard(null);
    }
    toast.success("Board deleted");
  }

  function getItemTypeLabel(type: string) {
    switch (type) {
      case "video": return "Video";
      case "script": return "Script";
      case "post": return "Social Post";
      default: return type;
    }
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Card className="w-full max-w-md mx-4">
          <CardContent className="p-6 text-center">
            <h2 className="text-xl font-semibold mb-2">Sign In Required</h2>
            <p className="text-gray-600 mb-4">Please sign in to access your swipe files.</p>
            <Button onClick={() => { router.push("/auth/login") }}>Sign In</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Swipe Files</h1>
          <p className="text-gray-600">Save and organize your favorite videos, scripts, and posts</p>
        </div>

        <div className="grid gap-6">
          {/* Search & Actions */}
          <div className="flex gap-3">
            <Input
              placeholder="Search boards and items..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="flex-1"
            />
            <Button onClick={() => setIsCreating(true)}>New Board</Button>
          </div>

          {/* Create Board Dialog */}
          <Dialog open={isCreating} onOpenChange={setIsCreating}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create New Board</DialogTitle>
                <DialogDescription>Give your board a name and description</DialogDescription>
              </DialogHeader>
              <div className="space-y-4 pt-4">
                <Input
                  placeholder="Board name..."
                  value={newBoardName}
                  onChange={(e) => setNewBoardName(e.target.value)}
                />
                <Input
                  placeholder="Description (optional)..."
                  value={newBoardDesc}
                  onChange={(e) => setNewBoardDesc(e.target.value)}
                />
                <div className="flex gap-3">
                  <Button onClick={handleCreateBoard} className="flex-1">
                    Create Board
                  </Button>
                  <Button variant="outline" onClick={() => setIsCreating(false)}>
                    Cancel
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>

          {/* Board Grid */}
          {!selectedBoard && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredBoards().map((board) => (
                <Card
                  key={board.id}
                  className="cursor-pointer hover:shadow-lg transition-shadow"
                  onClick={() => setSelectedBoard(board)}
                >
                  <CardContent className="p-5">
                    <div className="flex items-start justify-between">
                      <div>
                        <h3 className="font-semibold text-lg">{board.name}</h3>
                        <p className="text-sm text-gray-600 mt-1">{board.description}</p>
                      </div>
                    </div>
                    <div className="flex items-center justify-between mt-4">
                      <Badge variant="secondary">{board.itemCount} items</Badge>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteBoard(board.id);
                        }}
                      >
                        Delete
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {/* Board Detail View */}
          {selectedBoard && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-bold">{selectedBoard.name}</h2>
                  <p className="text-gray-600">{selectedBoard.description}</p>
                </div>
                <Button variant="outline" onClick={() => setSelectedBoard(null)}>
                  Back to Boards
                </Button>
              </div>

              {filteredItems().length === 0 ? (
                <Card>
                  <CardContent className="p-8 text-center">
                    <p className="text-gray-500">No items in this board yet.</p>
                    <p className="text-sm text-gray-400 mt-1">
                      Save videos from the Discover feed to get started.
                    </p>
                  </CardContent>
                </Card>
              ) : (
                <div className="grid gap-3">
                  {filteredItems().map((item) => (
                    <Card key={item.id}>
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <Badge variant="outline">{getItemTypeLabel(item.type)}</Badge>
                            <p className="font-medium">{item.title}</p>
                            {item.platform && (
                              <Badge variant="secondary" className="text-xs">
                                {item.platform}
                              </Badge>
                            )}
                          </div>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              setItems((prev) => prev.filter((i) => i.id !== item.id));
                              setBoards((prev) =>
                                prev.map((b) =>
                                  b.id === selectedBoard.id
                                    ? { ...b, itemCount: b.itemCount - 1 }
                                    : b
                                )
                              );
                              toast.success("Item removed");
                            }}
                          >
                            Remove
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function BoardsPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-gray-50 flex items-center justify-center">Loading...</div>}>
      <BoardsContent />
    </Suspense>
  );
}
