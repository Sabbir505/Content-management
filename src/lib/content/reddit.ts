import { rateLimiter } from "@/lib/rate-limiter";
import type { ContentItem, ContentSearchResult } from "@/types/content";
import { proxyFetch } from "../proxy";

interface RedditPost {
  data: {
    id: string;
    title: string;
    url: string;
    author: string;
    score: number;
    num_comments: number;
    created_utc: number;
    thumbnail?: string;
    selftext?: string;
    subreddit: string;
  };
}

const REDDIT_USER_AGENT = "TubeForge/1.0 (by /u/TubeForgeBot)";

async function fetchRedditAPI(url: string): Promise<Response> {
  return rateLimiter.executeWithRetry("reddit", async () => {
    const response = await proxyFetch(url, {
      headers: {
        "User-Agent": REDDIT_USER_AGENT,
        Accept: "application/json",
      },
    });
    return response;
  });
}

export async function fetchRedditPosts(subreddit: string, limit = 20): Promise<ContentSearchResult> {
  try {
    const response = await fetchRedditAPI(
      `https://www.reddit.com/r/${subreddit}/hot.json?limit=${limit}&raw_json=1`
    );

    if (!response.ok) {
      const text = await response.text().catch(() => "");
      console.warn(`[Reddit] HTTP ${response.status}: ${text.slice(0, 200)}`);
      throw new Error(`Reddit API error: ${response.status}`);
    }

    const data = await response.json();

    if (!data?.data?.children || !Array.isArray(data.data.children)) {
      console.warn("[Reddit] Unexpected response structure:", data);
      return {
        items: [],
        source: "reddit",
        fromCache: false,
        fetchedAt: new Date().toISOString(),
      };
    }

    const posts: RedditPost[] = data.data.children;

    const items: ContentItem[] = posts.map((post) => ({
      id: `reddit-${post.data.id}`,
      title: post.data.title,
      url: post.data.url.startsWith("/r/")
        ? `https://www.reddit.com${post.data.url}`
        : post.data.url,
      source: "reddit" as const,
      author: post.data.author,
      authorUrl: `https://www.reddit.com/user/${post.data.author}`,
      score: post.data.score,
      commentCount: post.data.num_comments,
      publishedAt: new Date(post.data.created_utc * 1000).toISOString(),
      thumbnail: post.data.thumbnail && post.data.thumbnail !== "self" ? post.data.thumbnail : undefined,
      description: post.data.selftext ? post.data.selftext.slice(0, 200) : undefined,
      tags: [post.data.subreddit],
    }));

    return {
      items,
      source: "reddit",
      fromCache: false,
      fetchedAt: new Date().toISOString(),
    };
  } catch (error) {
    console.error("[Reddit] Fetch error:", error);
    throw {
      type: "api_error",
      message: error instanceof Error ? error.message : "Failed to fetch Reddit posts",
    };
  }
}

export async function searchRedditPosts(query: string, limit = 20): Promise<ContentSearchResult> {
  try {
    const response = await fetchRedditAPI(
      `https://www.reddit.com/search.json?q=${encodeURIComponent(query)}&sort=hot&limit=${limit}&raw_json=1`
    );

    if (!response.ok) {
      const text = await response.text().catch(() => "");
      console.warn(`[Reddit] HTTP ${response.status}: ${text.slice(0, 200)}`);
      throw new Error(`Reddit API error: ${response.status}`);
    }

    const data = await response.json();

    if (!data?.data?.children || !Array.isArray(data.data.children)) {
      console.warn("[Reddit] Unexpected search response structure:", data);
      return {
        items: [],
        source: "reddit",
        fromCache: false,
        fetchedAt: new Date().toISOString(),
      };
    }

    const posts: RedditPost[] = data.data.children;

    const items: ContentItem[] = posts.map((post) => ({
      id: `reddit-${post.data.id}`,
      title: post.data.title,
      url: post.data.url.startsWith("/r/")
        ? `https://www.reddit.com${post.data.url}`
        : post.data.url,
      source: "reddit" as const,
      author: post.data.author,
      authorUrl: `https://www.reddit.com/user/${post.data.author}`,
      score: post.data.score,
      commentCount: post.data.num_comments,
      publishedAt: new Date(post.data.created_utc * 1000).toISOString(),
      thumbnail: post.data.thumbnail && post.data.thumbnail !== "self" ? post.data.thumbnail : undefined,
      description: post.data.selftext ? post.data.selftext.slice(0, 200) : undefined,
      tags: [post.data.subreddit],
    }));

    return {
      items,
      source: "reddit",
      fromCache: false,
      fetchedAt: new Date().toISOString(),
    };
  } catch (error) {
    console.error("[Reddit] Search error:", error);
    throw {
      type: "api_error",
      message: error instanceof Error ? error.message : "Failed to search Reddit posts",
    };
  }
}
