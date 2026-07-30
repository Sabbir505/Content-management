// LocalStorage-based blocklist for hiding content by language, creator, or specific item

const BLOCKED_LANGUAGES_KEY = "tubeforge_blocked_languages";
const BLOCKED_CREATORS_KEY = "tubeforge_blocked_creators";
const BLOCKED_ITEMS_KEY = "tubeforge_blocked_items";

function readArray(key: string): string[] {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function writeArray(key: string, values: string[]): void {
  localStorage.setItem(key, JSON.stringify(values));
}

export function getBlockedLanguages(): string[] {
  return readArray(BLOCKED_LANGUAGES_KEY);
}

export function blockLanguage(lang: string): void {
  const current = getBlockedLanguages();
  if (lang && !current.includes(lang)) {
    current.push(lang);
    writeArray(BLOCKED_LANGUAGES_KEY, current);
  }
}

export function unblockLanguage(lang: string): void {
  writeArray(BLOCKED_LANGUAGES_KEY, getBlockedLanguages().filter((l) => l !== lang));
}

export function getBlockedCreators(): string[] {
  return readArray(BLOCKED_CREATORS_KEY);
}

export function blockCreator(creatorId: string): void {
  const current = getBlockedCreators();
  if (creatorId && !current.includes(creatorId)) {
    current.push(creatorId);
    writeArray(BLOCKED_CREATORS_KEY, current);
  }
}

export function unblockCreator(creatorId: string): void {
  writeArray(BLOCKED_CREATORS_KEY, getBlockedCreators().filter((c) => c !== creatorId));
}

export function getBlockedItems(): string[] {
  return readArray(BLOCKED_ITEMS_KEY);
}

export function blockItem(itemId: string): void {
  const current = getBlockedItems();
  if (itemId && !current.includes(itemId)) {
    current.push(itemId);
    writeArray(BLOCKED_ITEMS_KEY, current);
  }
}

export function unblockItem(itemId: string): void {
  writeArray(BLOCKED_ITEMS_KEY, getBlockedItems().filter((i) => i !== itemId));
}

// Simple language detection — checks for non-ASCII scripts and common non-English markers
// Used only as a fallback when the source doesn't provide language info
export function detectLanguage(text: string): string {
  if (!text) return "unknown";
  // CJK characters
  if (/[一-鿿]/.test(text)) return "zh";
  if (/[぀-ゟ゠-ヿ]/.test(text)) return "ja";
  if (/[가-힯]/.test(text)) return "ko";
  if (/[Ѐ-ӿ]/.test(text)) return "ru";
  if (/[؀-ۿ]/.test(text)) return "ar";
  if (/[ऀ-ॿ]/.test(text)) return "hi";
  // Latin diacritics common in Spanish/French/Portuguese/German
  if (/[ñ¿áéíóúü]/i.test(text)) return "es";
  if (/[àâçéèêëîïôûùü]/i.test(text)) return "fr";
  if (/[ãõçáéíóúâêô]/i.test(text)) return "pt";
  if (/[äöüß]/i.test(text)) return "de";
  return "en";
}

export function isItemBlocked(opts: { itemId?: string; creatorId?: string; language?: string; title?: string }): boolean {
  const blockedItems = getBlockedItems();
  const blockedCreators = getBlockedCreators();
  const blockedLanguages = getBlockedLanguages();

  if (opts.itemId && blockedItems.includes(opts.itemId)) return true;
  if (opts.creatorId && blockedCreators.includes(opts.creatorId)) return true;
  if (opts.language && blockedLanguages.includes(opts.language)) return true;
  // Fallback: detect language from title if not provided
  if (!opts.language && opts.title) {
    const detected = detectLanguage(opts.title);
    if (blockedLanguages.includes(detected)) return true;
  }
  return false;
}
