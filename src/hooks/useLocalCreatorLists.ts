"use client";

import { useState, useCallback } from "react";
import { useAuth } from "@/hooks/useAuth";
import { getUserKey, loadFromStorage, saveToStorage } from "@/lib/local-creator-helpers";
import type { CreatorList } from "@/types/creator";

const LS_LISTS_KEY = "tubeforge_creator_lists";

export interface UseLocalCreatorListsReturn {
  lists: CreatorList[];
  isLoading: boolean;
  addList: (name: string, description?: string) => CreatorList;
  addCreatorToList: (listId: string, channelId: string) => void;
  removeCreatorFromList: (listId: string, channelId: string) => void;
  removeList: (listId: string) => void;
  refresh: () => void;
}

export function useLocalCreatorLists(): UseLocalCreatorListsReturn {
  const { user } = useAuth();
  const uid = user?.uid;

  const load = useCallback((): CreatorList[] => {
    const key = getUserKey(LS_LISTS_KEY, uid);
    const data = loadFromStorage<CreatorList>(key);

    // Ensure "All following" list exists
    const hasAllFollowing = data.some((l) => l.name === "All following");
    if (!hasAllFollowing && data.length > 0) {
      const now = new Date().toISOString();
      const allFollowing: CreatorList = {
        id: "all-following",
        userId: uid || "",
        name: "All following",
        description: "Creators you are tracking",
        creatorIds: data.flatMap((l) => l.creatorIds),
        createdAt: now,
        updatedAt: now,
      };
      const updated = [allFollowing, ...data];
      saveToStorage(key, updated);
      return updated;
    }

    return data;
  }, [uid]);

  const [lists, setLists] = useState<CreatorList[]>(load);
  // Reload from storage when the signed-in user changes (render-phase reset)
  const [lastUid, setLastUid] = useState(uid);
  if (uid !== lastUid) {
    setLastUid(uid);
    setLists(load());
  }

  const addList = useCallback(
    (name: string, description?: string): CreatorList => {
      const key = getUserKey(LS_LISTS_KEY, user?.uid);
      const existing = loadFromStorage<CreatorList>(key);
      const now = new Date().toISOString();

      const newList: CreatorList = {
        id: crypto.randomUUID(),
        userId: user?.uid || "",
        name: name.trim(),
        description: description?.trim() || "",
        creatorIds: [],
        createdAt: now,
        updatedAt: now,
      };

      const updated = [newList, ...existing];
      saveToStorage(key, updated);
      setLists(updated);
      return newList;
    },
    [user?.uid]
  );

  const addCreatorToList = useCallback(
    (listId: string, channelId: string) => {
      const key = getUserKey(LS_LISTS_KEY, user?.uid);
      const existing = loadFromStorage<CreatorList>(key);
      const updated = existing.map((list) => {
        if (list.id !== listId) return list;
        const ids = list.creatorIds || [];
        if (ids.includes(channelId)) return list;
        return { ...list, creatorIds: [...ids, channelId], updatedAt: new Date().toISOString() };
      });
      saveToStorage(key, updated);
      setLists(updated);
    },
    [user?.uid]
  );

  const removeCreatorFromList = useCallback(
    (listId: string, channelId: string) => {
      const key = getUserKey(LS_LISTS_KEY, user?.uid);
      const existing = loadFromStorage<CreatorList>(key);
      const updated = existing.map((list) => {
        if (list.id !== listId) return list;
        return {
          ...list,
          creatorIds: (list.creatorIds || []).filter((id) => id !== channelId),
          updatedAt: new Date().toISOString(),
        };
      });
      saveToStorage(key, updated);
      setLists(updated);
    },
    [user?.uid]
  );

  const removeList = useCallback(
    (listId: string) => {
      const key = getUserKey(LS_LISTS_KEY, user?.uid);
      const updated = loadFromStorage<CreatorList>(key).filter((l) => l.id !== listId);
      saveToStorage(key, updated);
      setLists(updated);
    },
    [user?.uid]
  );

  return { lists, isLoading: false, addList, addCreatorToList, removeCreatorFromList, removeList, refresh: () => setLists(load()) };
}
