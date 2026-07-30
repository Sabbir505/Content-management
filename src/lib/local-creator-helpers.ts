import type { TrackedCreator, CreatorList } from "@/types/creator";

const LS_LISTS_KEY = "tubeforge_creator_lists";

export function getUserKey(baseKey: string, userId: string | undefined): string {
  return userId ? `${baseKey}_${userId}` : baseKey;
}

export function loadFromStorage<T>(key: string): T[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveToStorage<T>(key: string, data: T[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch {
    // Storage full or unavailable
  }
}

export async function syncCreatorToFirestore(userId: string | undefined, creator: TrackedCreator): Promise<void> {
  if (!userId) return;
  try {
    await fetch("/api/creators", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, channelId: creator.channelId }),
    });
  } catch {
    // Ignore — localStorage is source of truth
  }
}

export function autoAddToAllFollowing(
  userId: string | undefined,
  channelId: string
): void {
  const key = getUserKey(LS_LISTS_KEY, userId);
  const existing = loadFromStorage<CreatorList>(key);
  const now = new Date().toISOString();

  let allFollowing = existing.find((l) => l.name === "All following");
  let updated: CreatorList[];

  if (!allFollowing) {
    allFollowing = {
      id: "all-following",
      userId: userId || "",
      name: "All following",
      description: "Creators you are tracking",
      creatorIds: [channelId],
      createdAt: now,
      updatedAt: now,
    };
    updated = [allFollowing, ...existing];
  } else {
    updated = existing.map((list) => {
      if (list.name !== "All following") return list;
      const ids = list.creatorIds || [];
      if (ids.includes(channelId)) return list;
      return { ...list, creatorIds: [...ids, channelId], updatedAt: now };
    });
  }

  saveToStorage(key, updated);
}
