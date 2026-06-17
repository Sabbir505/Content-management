interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

const MAX_SIZE = 1000;
const store = new Map<string, CacheEntry<unknown>>();

export function get<T>(key: string): T | null {
  const entry = store.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    store.delete(key);
    return null;
  }
  // Move to end to mark as recently used (LRU)
  store.delete(key);
  store.set(key, entry);
  return entry.data as T;
}

export function set<T>(key: string, data: T, ttlMs: number): void {
  // Remove existing key to update insertion order
  if (store.has(key)) {
    store.delete(key);
  }
  // Evict oldest entries if at capacity
  while (store.size >= MAX_SIZE) {
    const firstKey = store.keys().next().value;
    if (firstKey !== undefined) {
      store.delete(firstKey);
    }
  }
  store.set(key, {
    data,
    expiresAt: Date.now() + ttlMs,
  });
}

export function has(key: string): boolean {
  return get(key) !== null;
}

export function deleteKey(key: string): void {
  store.delete(key);
}

export function clear(): void {
  store.clear();
}

export function size(): number {
  return store.size;
}