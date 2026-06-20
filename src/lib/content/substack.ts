import type { ContentItem, ContentSearchResult } from "@/types/content";
import { proxyFetch } from "../proxy";

interface SubstackPost {
  id: number;
  title: string;
  slug: string;
  subtitle?: string;
  post_date: string;
  audience: string; // "everyone" | "only_paid" etc.
  canonical_url: string;
  description?: string;
  reaction_count?: number;
  comment_count?: number;
  cover_image?: string;
  publishedBylines?: Array<{ name: string; handle?: string }>;
}

const POPULAR_PUBLICATIONS = [
  "platformer",
  "thegeneralist",
  "lenny",
  "stratechery",
  "notboring",
  "readmultiplex",
  "aisupremacy",
  "oneusefulthing",
  "thealgorithmicbridge",
  "aibrews",
];

export async function fetchSubstackPosts(
  publication: string,
  limit = 12,
  offset = 0
): Promise<SubstackPost[]> {
  const url = `https://${publication}.substack.com/api/v1/archive?sort=new&limit=${limit}&offset=${offset}`;
  const response = await proxyFetch(url, { timeout: 10000 });
  if (!response.ok) {
    throw new Error(`Substack ${publication} returned ${response.status}`);
  }
  return response.json() as Promise<SubstackPost[]>;
}

function substackPostToContentItem(post: SubstackPost, publication: string): ContentItem {
  const author = post.publishedBylines?.[0]?.name || publication;
  return {
    id: `substack-${publication}-${post.id}`,
    title: post.title,
    url: post.canonical_url || `https://${publication}.substack.com/p/${post.slug}`,
    source: "substack",
    author,
    authorUrl: `https://${publication}.substack.com`,
    score: post.reaction_count || 0,
    commentCount: post.comment_count || 0,
    publishedAt: post.post_date || new Date().toISOString(),
    thumbnail: post.cover_image || undefined,
    description: post.subtitle || post.description || undefined,
  };
}

export async function searchSubstackByTopic(query: string, limit = 20): Promise<ContentSearchResult> {
  const allItems: ContentItem[] = [];
  const queryLower = query.toLowerCase();

  // Fetch from multiple popular publications and filter by query
  const fetchPromises = POPULAR_PUBLICATIONS.map(async (pub) => {
    try {
      const posts = await fetchSubstackPosts(pub, 12);
      return posts
        .filter(
          (p) =>
            p.title.toLowerCase().includes(queryLower) ||
            (p.subtitle && p.subtitle.toLowerCase().includes(queryLower)) ||
            (p.description && p.description.toLowerCase().includes(queryLower))
        )
        .map((p) => substackPostToContentItem(p, pub));
    } catch {
      return [];
    }
  });

  const results = await Promise.allSettled(fetchPromises);
  for (const result of results) {
    if (result.status === "fulfilled") {
      allItems.push(...result.value);
    }
  }

  // Sort by score/reactions
  allItems.sort((a, b) => b.score - a.score);

  return {
    items: allItems.slice(0, limit),
    source: "substack",
    fromCache: false,
    fetchedAt: new Date().toISOString(),
  };
}

export async function fetchTrendingSubstack(limit = 20): Promise<ContentSearchResult> {
  const allItems: ContentItem[] = [];

  const fetchPromises = POPULAR_PUBLICATIONS.map(async (pub) => {
    try {
      const posts = await fetchSubstackPosts(pub, 5);
      return posts.map((p) => substackPostToContentItem(p, pub));
    } catch {
      return [];
    }
  });

  const results = await Promise.allSettled(fetchPromises);
  for (const result of results) {
    if (result.status === "fulfilled") {
      allItems.push(...result.value);
    }
  }

  allItems.sort((a, b) => b.score - a.score);

  return {
    items: allItems.slice(0, limit),
    source: "substack",
    fromCache: false,
    fetchedAt: new Date().toISOString(),
  };
}
