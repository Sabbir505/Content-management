import type { ContentItem, ContentSearchResult } from "@/types/content";
import { proxyFetch } from "../proxy";

interface IGGraphQLMedia {
  shortcode: string;
  __typename: string; // GraphImage, GraphVideo, GraphSidecar
  edge_media_to_caption?: { edges: Array<{ node: { text: string } }> };
  edge_media_to_comment?: { count: number };
  edge_liked_by?: { count: number };
  taken_at_timestamp: number;
  display_url: string;
  thumbnail_src?: string;
  video_url?: string;
  owner: {
    username: string;
    full_name?: string;
    profile_pic_url?: string;
  };
  is_video: boolean;
  video_view_count?: number;
  accessibility_caption?: string;
}

interface IGHashtagResponse {
  data?: {
    hashtag?: {
      edge_hashtag_to_media?: {
        edges: Array<{ node: IGGraphQLMedia }>;
      };
      edge_hashtag_to_top_posts?: {
        edges: Array<{ node: IGGraphQLMedia }>;
      };
    };
  };
}

interface IGProfileResponse {
  data?: {
    user?: {
      edge_owner_to_timeline_media?: {
        edges: Array<{ node: IGGraphQLMedia }>;
      };
    };
  };
}

const IG_APP_ID = "936619743392459"; // Public app ID used by web client
const IG_USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

/**
 * Fetches Instagram posts by hashtag using the web GraphQL API.
 * This uses the public-facing endpoint that doesn't require authentication
 * for top posts on popular hashtags.
 */
async function fetchHashtagPosts(hashtag: string, limit = 12): Promise<IGGraphQLMedia[]> {
  const cleanTag = hashtag.replace(/^#/, "").toLowerCase();

  // Try the public __a=1 endpoint first
  const url = `https://www.instagram.com/explore/tags/${cleanTag}/?__a=1&__d=dis`;
  try {
    const response = await proxyFetch(url, {
      timeout: 10000,
      headers: {
        "User-Agent": IG_USER_AGENT,
        "X-IG-App-ID": IG_APP_ID,
        "X-Requested-With": "XMLHttpRequest",
        Accept: "application/json",
        "Sec-Fetch-Site": "same-origin",
      },
    });

    if (!response.ok) return [];

    const data = (await response.json()) as IGHashtagResponse;
    const topPosts = data?.data?.hashtag?.edge_hashtag_to_top_posts?.edges || [];
    const recentPosts = data?.data?.hashtag?.edge_hashtag_to_media?.edges || [];
    const allPosts = [...topPosts, ...recentPosts];

    return allPosts.slice(0, limit).map((e) => e.node);
  } catch {
    return [];
  }
}

/**
 * Fetches a single Instagram post by shortcode using the GraphQL API.
 * No cookie needed for public posts.
 */
async function fetchPostByShortcode(shortcode: string): Promise<IGGraphQLMedia | null> {
  const graphqlUrl = new URL("https://www.instagram.com/api/graphql");
  graphqlUrl.searchParams.set("variables", JSON.stringify({ shortcode }));
  graphqlUrl.searchParams.set("doc_id", "10015901848480474");
  graphqlUrl.searchParams.set("lsd", "AVqbxe3J_YA");

  try {
    const response = await proxyFetch(graphqlUrl.toString(), {
      timeout: 10000,
      headers: {
        "User-Agent": IG_USER_AGENT,
        "Content-Type": "application/x-www-form-urlencoded",
        "X-IG-App-ID": IG_APP_ID,
        "X-FB-LSD": "AVqbxe3J_YA",
        "Sec-Fetch-Site": "same-origin",
      },
    });

    if (!response.ok) return null;

    const json = (await response.json()) as { data?: { xdt_shortcode_media?: IGGraphQLMedia } };
    return json?.data?.xdt_shortcode_media || null;
  } catch {
    return null;
  }
}

/**
 * Fetches public profile posts using the __a=1 endpoint.
 */
async function fetchProfilePosts(username: string, limit = 12): Promise<IGGraphQLMedia[]> {
  const url = `https://www.instagram.com/${username}/?__a=1&__d=dis`;
  try {
    const response = await proxyFetch(url, {
      timeout: 10000,
      headers: {
        "User-Agent": IG_USER_AGENT,
        "X-IG-App-ID": IG_APP_ID,
        "X-Requested-With": "XMLHttpRequest",
        Accept: "application/json",
      },
    });

    if (!response.ok) return [];

    const data = (await response.json()) as IGProfileResponse;
    const posts = data?.data?.user?.edge_owner_to_timeline_media?.edges || [];
    return posts.slice(0, limit).map((e) => e.node);
  } catch {
    return [];
  }
}

function igMediaToContentItem(media: IGGraphQLMedia): ContentItem {
  const caption = media.edge_media_to_caption?.edges[0]?.node?.text || "";
  const title = caption.length > 120 ? caption.slice(0, 120) + "..." : caption || "Instagram post";

  return {
    id: `ig-${media.shortcode}`,
    title,
    url: `https://www.instagram.com/p/${media.shortcode}/`,
    source: "instagram",
    author: media.owner.full_name || media.owner.username,
    authorUrl: `https://www.instagram.com/${media.owner.username}/`,
    score: media.edge_liked_by?.count || 0,
    commentCount: media.edge_media_to_comment?.count || 0,
    publishedAt: new Date(media.taken_at_timestamp * 1000).toISOString(),
    thumbnail: media.thumbnail_src || media.display_url,
    description: caption || undefined,
  };
}

export async function searchInstagram(query: string, limit = 20): Promise<ContentSearchResult> {
  // Search via hashtag — most reliable public method
  const posts = await fetchHashtagPosts(query, limit);
  const items = posts.map(igMediaToContentItem);

  // Sort by likes
  items.sort((a, b) => b.score - a.score);

  return {
    items: items.slice(0, limit),
    source: "instagram",
    fromCache: false,
    fetchedAt: new Date().toISOString(),
  };
}

export async function fetchTrendingInstagram(limit = 20): Promise<ContentSearchResult> {
  // Fetch from popular content hashtags
  const trendingTags = ["viral", "trending", "explore", "contentcreator", "socialmedia"];
  const allItems: ContentItem[] = [];

  const promises = trendingTags.map(async (tag) => {
    const posts = await fetchHashtagPosts(tag, 5);
    return posts.map(igMediaToContentItem);
  });

  const results = await Promise.allSettled(promises);
  for (const result of results) {
    if (result.status === "fulfilled") {
      allItems.push(...result.value);
    }
  }

  allItems.sort((a, b) => b.score - a.score);

  return {
    items: allItems.slice(0, limit),
    source: "instagram",
    fromCache: false,
    fetchedAt: new Date().toISOString(),
  };
}

export { fetchPostByShortcode, fetchProfilePosts, fetchHashtagPosts };
