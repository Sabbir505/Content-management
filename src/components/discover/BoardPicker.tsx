"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { db } from "@/lib/firebase";
import { collection, doc, setDoc, addDoc, getDocs, query, orderBy, serverTimestamp, updateDoc, increment } from "firebase/firestore";
import { useAuth } from "@/hooks/useAuth";

interface Board {
  id: string;
  name: string;
  description: string;
  itemCount: number;
}

interface BoardPickerProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (boardId: string) => void;
  itemTitle: string;
}

export function BoardPicker({ isOpen, onClose, onSave, itemTitle }: BoardPickerProps) {
  const { user } = useAuth();
  const [boards, setBoards] = useState<Board[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");

  useEffect(() => {
    if (!isOpen || !user) return;
    loadBoards();
  }, [isOpen, user]);

  async function loadBoards() {
    if (!user) return;
    setIsLoading(true);
    try {
      const snapshot = await getDocs(
        query(collection(db, "users", user.uid, "boards"), orderBy("updatedAt", "desc"))
      );
      const loaded: Board[] = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        loaded.push({
          id: docSnap.id,
          name: data.name,
          description: data.description || "",
          itemCount: data.itemCount || 0,
        });
      });
      setBoards(loaded);
    } catch {
      toast.error("Failed to load boards");
    } finally {
      setIsLoading(false);
    }
  }

  async function handleCreateBoard() {
    if (!user || !newName.trim()) return;
    const boardId = Date.now().toString();
    try {
      await setDoc(doc(db, "users", user.uid, "boards", boardId), {
        name: newName.trim(),
        description: newDesc.trim(),
        itemCount: 0,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      setBoards((prev) => [
        { id: boardId, name: newName.trim(), description: newDesc.trim(), itemCount: 0 },
        ...prev,
      ]);
      setNewName("");
      setNewDesc("");
      setIsCreating(false);
      toast.success("Board created!");
    } catch {
      toast.error("Failed to create board");
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="w-[400px] max-w-[95vw]">
        <DialogHeader>
          <DialogTitle>Save to Board</DialogTitle>
          <DialogDescription className="line-clamp-1">{itemTitle}</DialogDescription>
        </DialogHeader>

        <div className="space-y-3 pt-2">
          {isLoading ? (
            <div className="flex justify-center py-4">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-gray-900" />
            </div>
          ) : boards.length === 0 ? (
            <div className="text-center py-4 text-sm text-gray-500">
              No boards yet. Create one to get started.
            </div>
          ) : (
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {boards.map((board) => (
                <button
                  key={board.id}
                  className="w-full text-left p-3 rounded-lg border hover:bg-gray-50 transition-colors"
                  onClick={() => onSave(board.id)}
                >
                  <div className="font-medium text-sm">{board.name}</div>
                  <div className="text-xs text-gray-500">{board.itemCount} items</div>
                </button>
              ))}
            </div>
          )}

          {!isCreating ? (
            <Button variant="outline" className="w-full" size="sm" onClick={() => setIsCreating(true)}>
              + Create New Board
            </Button>
          ) : (
            <div className="space-y-2">
              <Input
                placeholder="Board name..."
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                autoFocus
              />
              <Input
                placeholder="Description (optional)..."
                value={newDesc}
                onChange={(e) => setNewDesc(e.target.value)}
              />
              <div className="flex gap-2">
                <Button size="sm" className="flex-1" onClick={handleCreateBoard}>Create</Button>
                <Button size="sm" variant="outline" className="flex-1" onClick={() => setIsCreating(false)}>Cancel</Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
