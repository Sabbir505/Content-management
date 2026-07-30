import { NextRequest, NextResponse } from "next/server";
import { YOUTUBE_API_KEY, fetchYouTubeApi, resolveChannelId, type YouTubeChannelSnippet } from "@/lib/youtube-api";
import { guardApiKey } from "@/lib/api-helpers";

interface YouTubeChannelItem {
  id: string;
  snippet: YouTubeChannelSnippet;
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
  snippet: YouTubeChannelSnippet & { resourceId?: { videoId: string } };
}

export async function GET(request: NextRequest) {
  try {
    const rawChannelId = request.nextUrl.searchParams.get("channelId");

    if (!rawChannelId) {
      return NextResponse.json({ success: false, error: "channelId parameter is required" }, { status: 400 });
    }

    const guard = await guardApiKey(YOUTUBE_API_KEY, "YOUTUBE_API_KEY");
    if (guard) return guard;

    const channelId = await resolveChannelId(rawChannelId);

    if (!channelId) {
      return NextResponse.json({ success: false, error: "Could not find channel. Try using the full YouTube channel URL or the channel ID (UC...)" }, { status: 404 });
    }

    const channelData = await fetchYouTubeApi<YouTubeChannelItem>(
      `channels?part=snippet,contentDetails,statistics&id=${channelId}`
    );

    if (!channelData.items || channelData.items.length === 0) {
      return NextResponse.json({ success: false, error: "Channel not found" }, { status: 404 });
    }

    const channel = channelData.items[0];
    const uploadsPlaylistId = channel.contentDetails?.relatedPlaylists?.uploads;

    if (!uploadsPlaylistId) {
      return NextResponse.json({ success: false, error: "No uploads playlist found for this channel" }, { status: 404 });
    }

    const playlistItems = await fetchYouTubeApi<YouTubePlaylistItem>(
      `playlistItems?part=snippet&playlistId=${uploadsPlaylistId}&maxResults=50`
    );

    if (!playlistItems.items || playlistItems.items.length === 0) {
      return NextResponse.json({ success: false, error: "No videos found on this channel" }, { status: 404 });
    }

    const videoIds = playlistItems.items
      .map((item) => item.snippet.resourceId?.videoId)
      .filter((id): id is string => !!id);

    const videoDetails: YouTubeVideoItem[] = [];
    for (let i = 0; i < videoIds.length; i += 50) {
      const batch = videoIds.slice(i, i + 50);
      const details = await fetchYouTubeApi<YouTubeVideoItem>(
        `videos?part=statistics,contentDetails&id=${batch.join(",")}`
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
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
