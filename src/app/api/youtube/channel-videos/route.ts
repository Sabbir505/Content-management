import { NextRequest, NextResponse } from "next/server";
import { proxyFetch } from "@/lib/proxy";

const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY || process.env.NEXT_PUBLIC_YOUTUBE_API_KEY;

interface YouTubeSnippet {
  title: string;
  channelId: string;
  channelTitle: string;
  description: string;
  publishedAt: string;
  tags?: string[];
  thumbnails: {
    default?: { url: string };
    medium?: { url: string };
    high?: { url: string };
    maxres?: { url: string };
  };
  resourceId?: {
    videoId: string;
  };
}

interface YouTubeChannelItem {
  id: string;
  snippet: YouTubeSnippet;
  contentDetails?: {
    relatedPlaylists?: {
      uploads?: string;
    };
  };
  statistics?: {
    viewCount?: string;
    subscriberCount?: string;
    videoCount?: string;
  };
}

interface YouTubeVideoItem {
  id: string;
  snippet?: {
    tags?: string[];
  };
  statistics?: {
    viewCount?: string;
    likeCount?: string;
    commentCount?: string;
  };
  contentDetails?: {
    duration?: string;
  };
}

interface YouTubePlaylistItem {
  id: string;
  snippet: YouTubeSnippet;
}

interface YouTubeApiListResponse<T> {
  items?: T[];
  nextPageToken?: string;
}

async function fetchYouTubeApi<T>(path: string): Promise<YouTubeApiListResponse<T>> {
  const url = `https://www.googleapis.com/youtube/v3/${path}`;
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

async function resolveChannelId(identifier: string, apiKey: string): Promise<string | null> {
  // Already a channel ID
  if (/^UC[a-zA-Z0-9_-]{22}$/.test(identifier)) {
    return identifier;
  }

  // Try searching by handle (remove @ if present)
  const handle = identifier.startsWith("@") ? identifier : `@${identifier}`;
  const searchData = await fetchYouTubeApi<{ id: { channelId: string } }>(
    `search?part=snippet&q=${encodeURIComponent(handle)}&type=channel&maxResults=1&key=${apiKey}`
  );

  if (searchData.items && searchData.items.length > 0) {
    return searchData.items[0].id.channelId;
  }

  // Fallback: try searching by the raw identifier
  const fallbackData = await fetchYouTubeApi<{ id: { channelId: string } }>(
    `search?part=snippet&q=${encodeURIComponent(identifier)}&type=channel&maxResults=1&key=${apiKey}`
  );

  if (fallbackData.items && fallbackData.items.length > 0) {
    return fallbackData.items[0].id.channelId;
  }

  return null;
}

export async function GET(request: NextRequest) {
  try {
    const rawChannelId = request.nextUrl.searchParams.get("channelId");

    if (!rawChannelId) {
      return NextResponse.json({ success: false, error: "channelId parameter is required" }, { status: 400 });
    }

    if (!YOUTUBE_API_KEY) {
      console.error("YOUTUBE_API_KEY is not set");
      return NextResponse.json({ success: false, error: "YouTube API key not configured" }, { status: 500 });
    }

    // Resolve the channel ID (handles bare names, handles, and raw IDs)
    const channelId = await resolveChannelId(rawChannelId, YOUTUBE_API_KEY);

    if (!channelId) {
      return NextResponse.json({ success: false, error: "Could not find channel. Try using the full YouTube channel URL or the channel ID (UC...)" }, { status: 404 });
    }

    // 1. Get channel details and uploads playlist id
    const channelData = await fetchYouTubeApi<YouTubeChannelItem>(
      `channels?part=snippet,contentDetails,statistics&id=${channelId}&key=${YOUTUBE_API_KEY}`
    );

    if (!channelData.items || channelData.items.length === 0) {
      return NextResponse.json({ success: false, error: "Channel not found" }, { status: 404 });
    }

    const channel = channelData.items[0];
    const uploadsPlaylistId = channel.contentDetails?.relatedPlaylists?.uploads;

    if (!uploadsPlaylistId) {
      return NextResponse.json({ success: false, error: "No uploads playlist found for this channel" }, { status: 404 });
    }

    // 2. Get videos from uploads playlist
    const playlistItems = await fetchYouTubeApi<YouTubePlaylistItem>(
      `playlistItems?part=snippet&playlistId=${uploadsPlaylistId}&maxResults=50&key=${YOUTUBE_API_KEY}`
    );

    if (!playlistItems.items || playlistItems.items.length === 0) {
      return NextResponse.json({ success: false, error: "No videos found on this channel" }, { status: 404 });
    }

    const videoIds = playlistItems.items
      .map((item) => item.snippet.resourceId?.videoId)
      .filter((id): id is string => !!id);

    // 3. Get statistics and duration for each video
    const videoDetails: YouTubeVideoItem[] = [];
    for (let i = 0; i < videoIds.length; i += 50) {
      const batch = videoIds.slice(i, i + 50);
      const details = await fetchYouTubeApi<YouTubeVideoItem>(
        `videos?part=statistics,contentDetails&id=${batch.join(",")}&key=${YOUTUBE_API_KEY}`
      );
      if (details.items) {
        videoDetails.push(...details.items);
      }
    }

    const detailsById = new Map(videoDetails.map((item) => [item.id, item]));

    const videos = playlistItems.items
      .map((item) => {
        const videoId = item.snippet.resourceId?.videoId;
        if (!videoId) return null;

        const details = detailsById.get(videoId);

        return {
          id: videoId,
          snippet: {
            title: item.snippet.title,
            channelId: item.snippet.channelId,
            channelTitle: item.snippet.channelTitle,
            description: item.snippet.description,
            publishedAt: item.snippet.publishedAt,
            thumbnails: item.snippet.thumbnails,
            tags: details?.snippet?.tags || [],
          },
          statistics: {
            viewCount: details?.statistics?.viewCount || "0",
            likeCount: details?.statistics?.likeCount || "0",
            commentCount: details?.statistics?.commentCount || "0",
          },
          contentDetails: {
            duration: details?.contentDetails?.duration || "PT0S",
          },
        };
      })
      .filter((video): video is NonNullable<typeof video> => video !== null);

    return NextResponse.json({
      success: true,
      data: {
        channel: {
          id: channelId,
          title: channel.snippet.title,
          thumbnail: channel.snippet.thumbnails.medium?.url || channel.snippet.thumbnails.default?.url || "",
          subscriberCount: parseInt(channel.statistics?.subscriberCount || "0", 10),
          videoCount: parseInt(channel.statistics?.videoCount || "0", 10),
          viewCount: parseInt(channel.statistics?.viewCount || "0", 10),
        },
        videos,
      },
    });
  } catch (error) {
    console.error("Channel videos error:", error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
