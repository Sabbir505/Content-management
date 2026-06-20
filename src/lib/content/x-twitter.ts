import type { ContentItem, ContentSearchResult } from "@/types/content";
import { proxyFetch } from "../proxy";

interface XSyndicationTweet {
  id_str: string;
  text: string;
  full_text?: string;
  created_at: string;
  favorite_count: number;
  retweet_count: number;
  reply_count?: number;
  quote_count?: number;
  user: {
    name: string;
    screen_name: string;
    profile_image_url_https: string;
    followers_count: number;
  };
  entities?: {
    media?: Array<{
      media_url_https: string;
      type: string;
    }>;
    urls?: Array<{
      expanded_url: string;
    }>;
  };
}

/**
 * Fetches tweets via X's syndication API (used by embedded tweets).
 * No authentication required — uses the same endpoint that embed widgets use.
 */
async function fetchTweetBySyndication(tweetId: string): Promise<XSyndicationTweet | null> {
  const url = `https://cdn.syndication.twimg.com/tweet-result?id=${tweetId}&lang=en&token=0`;
  try {
    const response = await proxyFetch(url, { timeout: 8000 });
    if (!response.ok) return null;
    const data = await response.json() as Record<string, unknown>;
    if (!data || typeof data !== "object") return null;
    return data as unknown as XSyndicationTweet;
  } catch {
    return null;
  }
}

/**
 * Searches X/Twitter using the public search page via Nitter instances.
 * Nitter is a free, open-source alternative frontend for Twitter that
 * doesn't require authentication.
 */
const NITTER_INSTANCES = [
  "https://nitter.privacydev.net",
  "https://nitter.poast.org",
  "https://nitter.woodland.cafe",
];

interface ParsedTweet {
  id: string;
  text: string;
  author: string;
  handle: string;
  timestamp: string;
  likes: number;
  retweets: number;
  replies: number;
  avatar?: string;
  media?: string;
}

function parseNitterHTML(html: string, baseUrl: string): ParsedTweet[] {
  const tweets: ParsedTweet[] = [];

  // Parse tweet containers from Nitter HTML
  const tweetRegex = /<div class="timeline-item[^"]*">([\s\S]*?)<\/div>\s*<\/div>\s*<\/div>/g;
  const matches = html.matchAll(tweetRegex);

  for (const match of matches) {
    const block = match[1] || "";

    // Extract tweet link for ID
    const linkMatch = block.match(/href="\/([^/]+)\/status\/(\d+)/);
    if (!linkMatch) continue;

    const handle = linkMatch[1];
    const id = linkMatch[2];

    // Extract text
    const textMatch = block.match(/<div class="tweet-content[^"]*"[^>]*>([\s\S]*?)<\/div>/);
    const text = textMatch
      ? textMatch[1].replace(/<[^>]+>/g, "").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").trim()
      : "";

    // Extract stats
    const likesMatch = block.match(/icon-heart[^<]*<\/span>\s*(\d+)/);
    const retweetsMatch = block.match(/icon-retweet[^<]*<\/span>\s*(\d+)/);
    const repliesMatch = block.match(/icon-comment[^<]*<\/span>\s*(\d+)/);

    // Extract timestamp
    const timeMatch = block.match(/data-time="(\d+)"/);
    const timestamp = timeMatch
      ? new Date(parseInt(timeMatch[1]) * 1000).toISOString()
      : new Date().toISOString();

    // Extract display name
    const nameMatch = block.match(/<a class="fullname"[^>]*>([^<]+)<\/a>/);
    const author = nameMatch ? nameMatch[1].trim() : handle;

    // Extract avatar
    const avatarMatch = block.match(/<img[^>]*class="[^"]*avatar[^"]*"[^>]*src="([^"]+)"/);
    const avatar = avatarMatch ? avatarMatch[1] : undefined;

    // Extract media
    const mediaMatch = block.match(/<img[^>]*class="[^"]*still-image[^"]*"[^>]*src="([^"]+)"/);
    const media = mediaMatch ? `${baseUrl}${mediaMatch[1]}` : undefined;

    tweets.push({
      id,
      text,
      author,
      handle,
      timestamp,
      likes: likesMatch ? parseInt(likesMatch[1]) : 0,
      retweets: retweetsMatch ? parseInt(retweetsMatch[1]) : 0,
      replies: repliesMatch ? parseInt(repliesMatch[1]) : 0,
      avatar,
      media,
    });
  }

  return tweets;
}

function tweetToContentItem(tweet: ParsedTweet): ContentItem {
  return {
    id: `x-${tweet.id}`,
    title: tweet.text.length > 120 ? tweet.text.slice(0, 120) + "..." : tweet.text,
    url: `https://x.com/${tweet.handle}/status/${tweet.id}`,
    source: "x",
    author: tweet.author,
    authorUrl: `https://x.com/${tweet.handle}`,
    score: tweet.likes,
    commentCount: tweet.replies,
    shareCount: tweet.retweets,
    publishedAt: tweet.timestamp,
    thumbnail: tweet.media || undefined,
    description: tweet.text,
  };
}

export async function searchXTwitter(query: string, limit = 20): Promise<ContentSearchResult> {
  const encodedQuery = encodeURIComponent(query);
  const items: ContentItem[] = [];

  // Try Nitter instances for search
  for (const instance of NITTER_INSTANCES) {
    try {
      const url = `${instance}/search?f=tweets&q=${encodedQuery}`;
      const response = await proxyFetch(url, {
        timeout: 10000,
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          Accept: "text/html,application/xhtml+xml",
        },
      });
      if (!response.ok) continue;

      const html = await response.text();
      const tweets = parseNitterHTML(html, instance);

      for (const tweet of tweets.slice(0, limit)) {
        items.push(tweetToContentItem(tweet));
      }

      if (items.length > 0) break; // Success, stop trying instances
    } catch {
      continue;
    }
  }

  // Sort by engagement
  items.sort((a, b) => b.score - a.score);

  return {
    items: items.slice(0, limit),
    source: "x",
    fromCache: false,
    fetchedAt: new Date().toISOString(),
  };
}

export async function fetchTrendingXTwitter(limit = 20): Promise<ContentSearchResult> {
  // Use a trending/popular search approach
  return searchXTwitter("filter:links min_faves:100", limit);
}

export { fetchTweetBySyndication };
