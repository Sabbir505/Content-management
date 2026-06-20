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
  "thesequence",
  "importai",
  "theaiedge",
  "chamath",
  "aibrews",
  "marktechpost",
  "milkroad",
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
  const allFetched: ContentItem[] = [];
  const queryWords = query.toLowerCase().split(/\s+/).filter(Boolean);

  // Fetch from popular publications and filter by query keywords
  const fetchPromises = POPULAR_PUBLICATIONS.slice(0, 5).map(async (pub) => {
    try {
      const posts = await fetchSubstackPosts(pub, 6);
      const items = posts.map((p) => substackPostToContentItem(p, pub));
      return items;
    } catch {
      return [];
    }
  });

  const results = await Promise.allSettled(fetchPromises);
  for (const result of results) {
    if (result.status === "fulfilled") {
      allFetched.push(...result.value);
    }
  }

  // Filter by query keywords
  const matched = allFetched.filter((item) => {
    const text = `${item.title} ${item.description || ""}`.toLowerCase();
    return queryWords.some((word) => text.includes(word));
  });

  // If keyword filtering found results, use them. Otherwise return recent posts.
  if (matched.length > 0) {
    allItems.push(...matched);
  } else {
    allItems.push(...allFetched);
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

  const fetchPromises = POPULAR_PUBLICATIONS.slice(0, 6).map(async (pub) => {
    try {
      const posts = await fetchSubstackPosts(pub, 4);
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
