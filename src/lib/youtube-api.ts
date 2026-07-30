import { proxyFetch } from "@/lib/proxy";

export const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY || process.env.NEXT_PUBLIC_YOUTUBE_API_KEY;

export interface YouTubeApiListResponse<T> {
  items?: T[];
  nextPageToken?: string;
}

export interface YouTubeChannelSnippet {
  title: string;
  channelId: string;
  channelTitle: string;
  description: string;
  publishedAt: string;
  thumbnails: {
    default?: { url: string };
    medium?: { url: string };
    high?: { url: string };
    maxres?: { url: string };
  };
}

export async function fetchYouTubeApi<T>(path: string): Promise<YouTubeApiListResponse<T>> {
  const separator = path.includes("?") ? "&" : "?";
  const url = `https://www.googleapis.com/youtube/v3/${path}${separator}key=${YOUTUBE_API_KEY}`;

  const response = await proxyFetch(url, {
    headers: { Accept: "application/json" },
    timeout: 30000,
  });

  if (!response.ok) {
    const errorData = await response.text();
    console.error("YouTube Data API error:", response.status, errorData);
    throw new Error(`YouTube Data API error: ${response.status}`);
  }

  return response.json();
}

export async function resolveChannelId(identifier: string): Promise<string | null> {
  if (/^UC[a-zA-Z0-9_-]{22}$/.test(identifier)) {
    return identifier;
  }

  const handle = identifier.startsWith("@") ? identifier : `@${identifier}`;
  const searchData = await fetchYouTubeApi<{ id: { channelId: string } }>(
    `search?part=snippet&q=${encodeURIComponent(handle)}&type=channel&maxResults=1`
  );

  if (searchData.items && searchData.items.length > 0) {
    return searchData.items[0].id.channelId;
  }

  const fallbackData = await fetchYouTubeApi<{ id: { channelId: string } }>(
    `search?part=snippet&q=${encodeURIComponent(identifier)}&type=channel&maxResults=1`
  );

  if (fallbackData.items && fallbackData.items.length > 0) {
    return fallbackData.items[0].id.channelId;
  }

  return null;
}
