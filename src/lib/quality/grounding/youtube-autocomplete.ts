import type { YouTubeAutocompleteResult } from "../types";
import * as cache from "../cache";

const AUTOCOMPLETE_CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours
const AUTOCOMPLETE_URL =
  "https://suggestqueries.google.com/complete/search?client=youtube&q=";

const PREFIX_VARIANTS = [
  "",
  "how to ",
  "why ",
  " tips",
  " 2025",
  "best ",
];

function parseAutocompleteResponse(
  raw: string
): string[] {
  try {
    // Response format: window.google.ac.h(["query", [...suggestions], ...])
    const jsonStr = raw.replace(/^[^(]*\(/, "").replace(/\)$/, "");
    const parsed = JSON.parse(jsonStr);
    if (Array.isArray(parsed) && Array.isArray(parsed[1])) {
      return parsed[1].map((s: unknown) =>
        typeof s === "string" ? s : Array.isArray(s) ? s[0] : ""
      ).filter(Boolean);
    }
    return [];
  } catch {
    return [];
  }
}

async function fetchSingleQuery(query: string): Promise<string[]> {
  const url = `${AUTOCOMPLETE_URL}${encodeURIComponent(query)}`;
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Autocomplete request failed: ${response.status}`);
  }

  const text = await response.text();
  return parseAutocompleteResponse(text);
}

export async function fetchYouTubeAutocomplete(
  query: string
): Promise<YouTubeAutocompleteResult> {
  const cacheKey = `autocomplete:${query.toLowerCase()}`;

  const cached = cache.get<YouTubeAutocompleteResult>(cacheKey);
  if (cached) return cached;

  const allSuggestions: string[] = [];

  for (let i = 0; i < PREFIX_VARIANTS.length; i++) {
    const variant = PREFIX_VARIANTS[i] + query;
    try {
      const suggestions = await fetchSingleQuery(variant);
      allSuggestions.push(...suggestions);
      // Rate limit: 200ms delay between batches of 2
      if (i % 2 === 1 && i < PREFIX_VARIANTS.length - 1) {
        await new Promise((resolve) => setTimeout(resolve, 200));
      }
    } catch (error) {
      console.warn(`Autocomplete fetch failed for variant "${variant}":`, error);
    }
  }

  // Deduplicate and preserve order
  const unique = [...new Set(allSuggestions)];

  const result: YouTubeAutocompleteResult = {
    query,
    suggestions: unique,
    fetchedAt: new Date().toISOString(),
  };

  cache.set(cacheKey, result, AUTOCOMPLETE_CACHE_TTL);
  return result;
}
