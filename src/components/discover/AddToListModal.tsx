"use client";

import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { useLocalCreatorLists, useLocalCreators, autoAddToAllFollowing } from "@/hooks/useLocalCreators";
import type { TrackedCreator } from "@/types/creator";

export interface AddToListModalCreator {
  channelId: string;
  channelTitle: string;
  thumbnail?: string;
  description?: string;
  subscriberCount?: number;
  videoCount?: number;
  customUrl?: string;
}

interface AddToListModalProps {
  isOpen: boolean;
  onClose: () => void;
  creator: AddToListModalCreator | null;
}

export function AddToListModal({ isOpen, onClose, creator }: AddToListModalProps) {
  const { user } = useAuth();
  const { creators, addCreator } = useLocalCreators();
  const { lists, addList, addCreatorToList } = useLocalCreatorLists();
  const [searchQuery, setSearchQuery] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [newListName, setNewListName] = useState("");
  const [addingToListIds, setAddingToListIds] = useState<Set<string>>(new Set());
  const [justAddedListIds, setJustAddedListIds] = useState<Set<string>>(new Set());

  // Reset form state when the modal opens (render-phase reset keyed on isOpen,
  // not an effect, to avoid cascading renders flagged by react-hooks/set-state-in-effect)
  const [wasOpen, setWasOpen] = useState(isOpen);
  if (isOpen && !wasOpen) {
    setWasOpen(true);
    setSearchQuery("");
    setIsCreating(false);
    setNewListName("");
    setAddingToListIds(new Set());
    setJustAddedListIds(new Set());
  } else if (!isOpen && wasOpen) {
    setWasOpen(false);
  }

  const filteredLists = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return lists;
    return lists.filter((list) => list.name.toLowerCase().includes(query));
  }, [lists, searchQuery]);

  const sortedLists = useMemo(() => {
    return [...filteredLists].sort(
      (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    );
  }, [filteredLists]);

  async function ensureCreatorTracked(): Promise<TrackedCreator | null> {
    if (!user || !creator) return null;

    const existing = creators.find((c) => c.channelId === creator.channelId);
    if (existing) return existing;

    try {
      const response = await fetch(
        `/api/youtube/channel?channelId=${encodeURIComponent(creator.channelId)}`
      );
      const result = await response.json();
      if (!result.success) {
        toast.error(result.error || "Failed to fetch channel details");
        return null;
      }
      const channel = result.data;

      return addCreator({
        userId: user.uid,
        channelId: creator.channelId,
        channelTitle: channel.title || creator.channelTitle,
        thumbnail: channel.thumbnail || creator.thumbnail || "",
        subscriberCount: channel.subscriberCount || creator.subscriberCount || 0,
        videoCount: channel.videoCount || creator.videoCount || 0,
        description: channel.description || creator.description || "",
        customUrl: channel.customUrl || creator.customUrl || "",
      });
    } catch {
      toast.error("Failed to add creator");
      return null;
    }
  }

  async function handleAddToList(listId: string): Promise<void> {
    if (!creator) return;

    const list = lists.find((l) => l.id === listId);
    if (!list) return;

    const alreadyInList = (list.creatorIds || []).includes(creator.channelId);
    if (alreadyInList || justAddedListIds.has(listId)) return;

    setAddingToListIds((prev) => new Set(prev).add(listId));
    try {
      const tracked = await ensureCreatorTracked();
      if (!tracked) return;

      addCreatorToList(listId, tracked.channelId);
      autoAddToAllFollowing(user?.uid, tracked.channelId);
      setJustAddedListIds((prev) => new Set(prev).add(listId));
      toast.success("Added to list");
    } finally {
      setAddingToListIds((prev) => {
        const next = new Set(prev);
        next.delete(listId);
        return next;
      });
    }
  }

  async function handleCreateAndAdd(): Promise<void> {
    if (!creator || !newListName.trim()) return;

    const newList = addList(newListName.trim());
    setNewListName("");
    setIsCreating(false);
    await handleAddToList(newList.id);
  }

  function handleToggleList(listId: string): void {
    const list = lists.find((l) => l.id === listId);
    if (!list || !creator) return;

    const alreadyInList = (list.creatorIds || []).includes(creator.channelId);
    if (!alreadyInList && !justAddedListIds.has(listId)) {
      void handleAddToList(listId);
    }
  }

  function isInList(list: { creatorIds: string[] }): boolean {
    if (!creator) return false;
    return list.creatorIds.includes(creator.channelId);
  }

  const isTopRecent = (index: number): boolean => index < 3;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="w-[420px] max-w-[95vw] bg-[#1a1a1a] border-[#2a2a2a] p-0 gap-0 overflow-hidden">
        <DialogHeader className="p-5 pb-3">
          <DialogTitle className="text-white text-base font-medium">Add to list</DialogTitle>
          <DialogDescription className="text-[#888] text-sm">
            Pick lists for this creator — click as many as you like.
          </DialogDescription>
        </DialogHeader>

        <div className="px-5 pb-4 space-y-4">
          <div className="relative">
            <svg
              className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#666]"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
            <Input
              placeholder="Find a list..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 bg-[#111] border-[#2a2a2a] text-white placeholder:text-[#666] focus-visible:border-[#3a3a3a] focus-visible:ring-0"
            />
          </div>

          <div className="max-h-[280px] overflow-y-auto space-y-2 pr-1">
            {sortedLists.length === 0 ? (
              <div className="text-center py-6 text-[#666] text-sm">
                {searchQuery ? "No lists match your search." : "No lists yet. Create one below."}
              </div>
            ) : (
              sortedLists.map((list, index) => {
                const inList = isInList(list);
                const justAdded = justAddedListIds.has(list.id);
                const isAdded = inList || justAdded;
                const isAdding = addingToListIds.has(list.id);
                const creatorCount = (list.creatorIds || []).length;

                return (
                  <div
                    key={list.id}
                    role="button"
                    tabIndex={isAdding || isAdded ? -1 : 0}
                    aria-disabled={isAdding || isAdded}
                    onClick={() => handleToggleList(list.id)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        handleToggleList(list.id);
                      }
                    }}
                    className="w-full flex items-center gap-3 p-3 rounded-xl bg-[#111] border border-[#2a2a2a] hover:border-[#3a3a3a] transition-colors aria-disabled:opacity-70 text-left outline-none focus-visible:border-[#3a3a3a] focus-visible:ring-2 focus-visible:ring-[#3a3a3a]/50"
                  >
                    <Checkbox
                      checked={isAdded}
                      disabled={isAdding || isAdded}
                      className="border-[#3a3a3a] data-checked:bg-white data-checked:text-black data-checked:border-white"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-white truncate">{list.name}</span>
                        {isTopRecent(index) && (
                          <span className="text-[10px] font-medium text-[#888] bg-[#2a2a2a] px-1.5 py-0.5 rounded">
                            RECENT
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-[#666]">{creatorCount} creators</p>
                    </div>
                    <Button
                      size="sm"
                      disabled={isAdding || isAdded}
                      onClick={(e) => {
                        e.stopPropagation();
                        void handleAddToList(list.id);
                      }}
                      className={
                        isAdded
                          ? "bg-[#2a2a2a] text-emerald-400 hover:bg-[#2a2a2a] border border-[#3a3a3a] cursor-default"
                          : "bg-[#2a2a2a] text-white hover:bg-[#3a3a3a] cursor-pointer"
                      }
                    >
                      {isAdded ? "Added" : isAdding ? "Adding..." : "Add"}
                    </Button>
                  </div>
                );
              })
            )}
          </div>
        </div>

        <div className="border-t border-[#2a2a2a] p-4 bg-[#111]">
          {isCreating ? (
            <div className="space-y-3">
              <Input
                placeholder="List name..."
                value={newListName}
                onChange={(e) => setNewListName(e.target.value)}
                autoFocus
                className="bg-[#1a1a1a] border-[#2a2a2a] text-white placeholder:text-[#666] focus-visible:border-[#3a3a3a] focus-visible:ring-0"
              />
              <div className="flex items-center justify-between gap-3">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setIsCreating(false);
                    setNewListName("");
                  }}
                  className="text-[#888] hover:text-white hover:bg-[#2a2a2a]"
                >
                  Cancel
                </Button>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    disabled={!newListName.trim() || !creator}
                    onClick={() => void handleCreateAndAdd()}
                    className="bg-white text-black hover:bg-[#e5e5e5]"
                  >
                    Create & add
                  </Button>
                  <Button
                    size="sm"
                    onClick={onClose}
                    className="bg-[#2a2a2a] text-white hover:bg-[#3a3a3a]"
                  >
                    Done
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-between gap-3">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsCreating(true)}
                className="text-[#888] hover:text-white hover:bg-[#2a2a2a]"
              >
                <svg
                  className="w-4 h-4 mr-1.5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M12 4v16m8-8H4"
                  />
                </svg>
                New list...
              </Button>
              <Button
                size="sm"
                onClick={onClose}
                className="bg-[#2a2a2a] text-white hover:bg-[#3a3a3a]"
              >
                Done
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
