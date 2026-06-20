import type { ContentItem, ContentSearchResult } from "@/types/content";
import { proxyFetch } from "../proxy";

interface LinkedInPostData {
  id: string;
  text: string;
  author: string;
  authorHandle: string;
  authorUrl: string;
  thumbnail?: string;
  likes: number;
  comments: number;
  shares: number;
  publishedAt: string;
}

const LINKEDIN_USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

/**
 * Extracts LinkedIn post data from the public embed page.
 * LinkedIn serves a simplified HTML view for embedded posts that
 * doesn't require authentication.
 */
async function fetchLinkedInPostEmbed(postUrl: string): Promise<LinkedInPostData | null> {
  try {
    // LinkedIn's embed endpoint for public posts
    const embedUrl = `https://www.linkedin.com/embed/feed/update/${extractLinkedInUrn(postUrl)}`;
    const response = await proxyFetch(embedUrl, {
      timeout: 10000,
      headers: {
        "User-Agent": LINKEDIN_USER_AGENT,
        Accept: "text/html,application/xhtml+xml",
      },
    });

    if (!response.ok) return null;
    const html = await response.text();

    return parseLinkedInEmbedHTML(html, postUrl);
  } catch {
    return null;
  }
}

function extractLinkedInUrn(url: string): string {
  // Extract activity/share URN from URL
  // Pattern: linkedin.com/posts/username_activity-{id} or linkedin.com/feed/update/urn:li:activity:{id}
  const activityMatch = url.match(/activity[:-](\d+)/);
  if (activityMatch) return `urn:li:activity:${activityMatch[1]}`;

  const shareMatch = url.match(/urn:li:share:(\d+)/);
  if (shareMatch) return `urn:li:share:${shareMatch[1]}`;

  // Try ugcPost format
  const ugcMatch = url.match(/ugcPost[:-](\d+)/);
  if (ugcMatch) return `urn:li:ugcPost:${ugcMatch[1]}`;

  return url;
}

function parseLinkedInEmbedHTML(html: string, originalUrl: string): LinkedInPostData | null {
  // Extract author
  const authorMatch = html.match(/<span class="feed-shared-actor__name[^"]*"[^>]*>([^<]+)<\/span>/);
  const author = authorMatch?.[1]?.trim() || "";

  // Extract text content
  const textMatch = html.match(/<div class="feed-shared-text[^"]*"[^>]*>([\s\S]*?)<\/div>/);
  const text = textMatch?.[1]?.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim() || "";

  // Extract image
  const imageMatch = html.match(/<img[^>]*class="[^"]*feed-shared-image[^"]*"[^>]*src="([^"]+)"/);
  const thumbnail = imageMatch?.[1] || undefined;

  // Extract engagement counts
  const likesMatch = html.match(/(\d+)\s*(?:likes?|reactions?)/i);
  const commentsMatch = html.match(/(\d+)\s*comments?/i);
  const sharesMatch = html.match(/(\d+)\s*(?:reposts?|shares?)/i);

  // Extract timestamp
  const timeMatch = html.match(/<time[^>]*datetime="([^"]+)"/);
  const publishedAt = timeMatch?.[1] || new Date().toISOString();

  if (!text && !author) return null;

  // Extract handle from URL
  const handleMatch = originalUrl.match(/linkedin\.com\/(?:in|posts)\/([^/_?]+)/);
  const handle = handleMatch?.[1] || author.toLowerCase().replace(/\s+/g, "");

  return {
    id: extractLinkedInUrn(originalUrl).replace(/[^a-z0-9]/gi, "-"),
    text,
    author,
    authorHandle: handle,
    authorUrl: `https://www.linkedin.com/in/${handle}`,
    thumbnail,
    likes: likesMatch ? parseInt(likesMatch[1]) : 0,
    comments: commentsMatch ? parseInt(commentsMatch[1]) : 0,
    shares: sharesMatch ? parseInt(sharesMatch[1]) : 0,
    publishedAt,
  };
}

/**
 * Searches LinkedIn posts using Google site: search as a discovery mechanism.
 * This is the most reliable free method since LinkedIn blocks unauthenticated searches.
 */
async function searchLinkedInViaGoogle(query: string, limit = 20): Promise<string[]> {
  const searchUrl = `https://www.google.com/search?q=site:linkedin.com/posts+${encodeURIComponent(query)}&num=${limit}`;
  try {
    const response = await proxyFetch(searchUrl, {
      timeout: 10000,
      headers: {
        "User-Agent": LINKEDIN_USER_AGENT,
        Accept: "text/html",
      },
    });

    if (!response.ok) return [];
    const html = await response.text();

    // Extract LinkedIn URLs from Google results
    const urlRegex = /https?:\/\/(?:www\.)?linkedin\.com\/posts\/[^"&\s<>]+/g;
    const matches = html.match(urlRegex) || [];
    return [...new Set(matches)].slice(0, limit);
  } catch {
    return [];
  }
}

/**
 * Alternative: Fetch LinkedIn posts via their public feed page (limited).
 * Uses LinkedIn's public profile page which shows recent posts.
 */
async function fetchLinkedInProfilePosts(username: string): Promise<LinkedInPostData[]> {
  const url = `https://www.linkedin.com/in/${username}/recent-activity/all/`;
  try {
    const response = await proxyFetch(url, {
      timeout: 10000,
      headers: {
        "User-Agent": LINKEDIN_USER_AGENT,
        Accept: "text/html,application/xhtml+xml",
      },
    });

    if (!response.ok) return [];
    const html = await response.text();

    // Extract post URLs from the activity page
    const postUrls: string[] = [];
    const urlRegex = /href="(https:\/\/www\.linkedin\.com\/feed\/update\/[^"]+)"/g;
    let match;
    while ((match = urlRegex.exec(html)) !== null) {
      postUrls.push(match[1]);
    }

    return postUrls.slice(0, 5).map((postUrl) => ({
      id: extractLinkedInUrn(postUrl).replace(/[^a-z0-9]/gi, "-"),
      text: "",
      author: username,
      authorHandle: username,
      authorUrl: `https://www.linkedin.com/in/${username}`,
      likes: 0,
      comments: 0,
      shares: 0,
      publishedAt: new Date().toISOString(),
    }));
  } catch {
    return [];
  }
}

function linkedInPostToContentItem(post: LinkedInPostData): ContentItem {
  const title = post.text.length > 120 ? post.text.slice(0, 120) + "..." : post.text || "LinkedIn post";

  return {
    id: `li-${post.id}`,
    title,
    url: post.authorUrl,
    source: "linkedin",
    author: post.author,
    authorUrl: post.authorUrl,
    score: post.likes,
    commentCount: post.comments,
    shareCount: post.shares,
    publishedAt: post.publishedAt,
    thumbnail: post.thumbnail,
    description: post.text,
  };
}

export async function searchLinkedIn(query: string, limit = 20): Promise<ContentSearchResult> {
  const items: ContentItem[] = [];

  // Discover posts via Google site: search
  const postUrls = await searchLinkedInViaGoogle(query, limit);

  // Fetch embed data for each discovered post
  const fetchPromises = postUrls.slice(0, 10).map(async (url) => {
    const postData = await fetchLinkedInPostEmbed(url);
    return postData ? linkedInPostToContentItem(postData) : null;
  });

  const results = await Promise.allSettled(fetchPromises);
  for (const result of results) {
    if (result.status === "fulfilled" && result.value) {
      items.push(result.value);
    }
  }

  items.sort((a, b) => b.score - a.score);

  return {
    items: items.slice(0, limit),
    source: "linkedin",
    fromCache: false,
    fetchedAt: new Date().toISOString(),
  };
}

export async function fetchTrendingLinkedIn(limit = 20): Promise<ContentSearchResult> {
  return searchLinkedIn("content creator marketing viral", limit);
}

export { fetchLinkedInPostEmbed, fetchLinkedInProfilePosts };
