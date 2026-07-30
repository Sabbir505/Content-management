"use client";

import { useState, useCallback, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { getUserKey, loadFromStorage, saveToStorage, syncCreatorToFirestore } from "@/lib/local-creator-helpers";
import type { TrackedCreator } from "@/types/creator";

// Re-export for backward compatibility
export { useLocalCreatorLists } from "@/hooks/useLocalCreatorLists";
export type { UseLocalCreatorListsReturn } from "@/hooks/useLocalCreatorLists";
export { autoAddToAllFollowing } from "@/lib/local-creator-helpers";

const LS_CREATORS_KEY = "tubeforge_creators";

export interface UseLocalCreatorsReturn {
  creators: TrackedCreator[];
  isLoading: boolean;
  addCreator: (creator: Omit<TrackedCreator, "id" | "createdAt" | "updatedAt">) => TrackedCreator;
  removeCreator: (channelId: string) => void;
  refresh: () => void;
}

export function useLocalCreators(): UseLocalCreatorsReturn {
  const { user } = useAuth();
  const uid = user?.uid;

  const load = useCallback(() => {
    const key = getUserKey(LS_CREATORS_KEY, uid);
    return loadFromStorage<TrackedCreator>(key);
  }, [uid]);

  const [creators, setCreators] = useState<TrackedCreator[]>(load);
  // Reload from storage when the signed-in user changes (render-phase reset)
  const [lastUid, setLastUid] = useState(uid);
  if (uid !== lastUid) {
    setLastUid(uid);
    setCreators(load());
  }

  // Another instance of this hook (e.g. the Creators tab) may have written to
  // storage — refresh when it signals. Mirrors the blocklist-event pattern.
  useEffect(() => {
    const handleUpdate = () => setCreators(load());
    window.addEventListener("tubeforge-creators-updated", handleUpdate);
    return () => window.removeEventListener("tubeforge-creators-updated", handleUpdate);
  }, [load]);

  const addCreator = useCallback(
    (creatorData: Omit<TrackedCreator, "id" | "createdAt" | "updatedAt">): TrackedCreator => {
      const key = getUserKey(LS_CREATORS_KEY, user?.uid);
      const existing = loadFromStorage<TrackedCreator>(key);
      const now = new Date().toISOString();

      const newCreator: TrackedCreator = {
        ...creatorData,
        id: creatorData.channelId,
        createdAt: now,
        updatedAt: now,
      };

      const updated = [newCreator, ...existing.filter((c) => c.channelId !== creatorData.channelId)];
      saveToStorage(key, updated);
      setCreators(updated);
      window.dispatchEvent(new Event("tubeforge-creators-updated"));

      // Also sync to Firestore in background if possible
      syncCreatorToFirestore(user?.uid, newCreator).catch(() => {
        // Silently fail — localStorage is the source of truth
      });

      return newCreator;
    },
    [user?.uid]
  );

  const removeCreator = useCallback(
    (channelId: string) => {
      const key = getUserKey(LS_CREATORS_KEY, user?.uid);
      const updated = loadFromStorage<TrackedCreator>(key).filter((c) => c.channelId !== channelId);
      saveToStorage(key, updated);
      setCreators(updated);
      window.dispatchEvent(new Event("tubeforge-creators-updated"));
    },
    [user?.uid]
  );

  return { creators, isLoading: false, addCreator, removeCreator, refresh: () => setCreators(load()) };
}
