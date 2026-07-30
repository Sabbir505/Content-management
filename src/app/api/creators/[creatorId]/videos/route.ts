import { NextRequest, NextResponse } from "next/server";
import { YOUTUBE_API_KEY, fetchYouTubeApi, resolveChannelId } from "@/lib/youtube-api";
import { guardApiKey } from "@/lib/api-helpers";
import { calculateOutlierScore, estimateHookType, estimateStructure } from "@/lib/outlier";
import type { CreatorVideo } from "@/types/creator";

interface YouTubeChannelItem {
  id: string;
  snippet: { title: string; thumbnails: { medium?: { url: string }; default?: { url: string } } };
  contentDetails?: { relatedPlaylists?: { uploads?: string } };
  statistics?: { viewCount?: string; subscriberCount?: string; videoCount?: string };
}

interface YouTubePlaylistItem {
  id: string;
  snippet: {
    title: string;
    channelId: string;
    channelTitle: string;
    description: string;
    publishedAt: string;
    thumbnails: { medium?: { url: string }; high?: { url: string }; default?: { url: string } };
    resourceId?: { videoId: string };
  };
}

interface YouTubeVideoItem {
  id: string;
  snippet?: { tags?: string[] };
  statistics?: { viewCount?: string; likeCount?: string; commentCount?: string };
  contentDetails?: { duration?: string };
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ creatorId: string }> }) {
  try {
    const { searchParams } = new URL(request.url);
    const resolvedParams = await params;
    const rawChannelId = resolvedParams.creatorId || searchParams.get("channelId");

    if (!rawChannelId) {
      return NextResponse.json({ success: false, error: "channelId parameter is required" }, { status: 400 });
    }
    const guard = await guardApiKey(YOUTUBE_API_KEY, "YOUTUBE_API_KEY");
    if (guard) return guard;

    const channelId = await resolveChannelId(rawChannelId);
    if (!channelId) {
      return NextResponse.json({ success: false, error: "Could not find channel" }, { status: 404 });
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
      return NextResponse.json({ success: false, error: "No uploads playlist found" }, { status: 404 });
    }

    const playlistItems = await fetchYouTubeApi<YouTubePlaylistItem>(
      `playlistItems?part=snippet&playlistId=${uploadsPlaylistId}&maxResults=50`
    );
    if (!playlistItems.items || playlistItems.items.length === 0) {
      return NextResponse.json({ success: false, error: "No videos found" }, { status: 404 });
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
      if (details.items) videoDetails.push(...details.items);
    }

    const detailsById = new Map(videoDetails.map((item) => [item.id, item]));

    const totalViews = parseInt(channel.statistics?.viewCount || "0", 10);
    const totalVideos = parseInt(channel.statistics?.videoCount || "0", 10);
    const channelAvgViews = totalVideos > 0 && totalViews > 0 ? totalViews / totalVideos : 0;

    const videos: CreatorVideo[] = playlistItems.items
      .map((item) => {
        const videoId = item.snippet.resourceId?.videoId;
        if (!videoId) return null;
        const details = detailsById.get(videoId);
        const viewCount = parseInt(details?.statistics?.viewCount || "0", 10);
        const outlierScore = channelAvgViews > 0 ? calculateOutlierScore(viewCount, channelAvgViews) : 0;

        const video: CreatorVideo = {
          id: videoId,
          creatorId: channelId,
          title: item.snippet.title,
          thumbnail: item.snippet.thumbnails.medium?.url || item.snippet.thumbnails.default?.url || "",
          publishedAt: item.snippet.publishedAt,
          viewCount,
          likeCount: parseInt(details?.statistics?.likeCount || "0", 10),
          duration: details?.contentDetails?.duration || "PT0S",
          outlierScore,
          hookType: estimateHookType(item.snippet.title),
          estimatedStructure: estimateStructure(item.snippet.title),
        };
        return video;
      })
      .filter((v): v is CreatorVideo => v !== null);

    return NextResponse.json({
      success: true,
      data: {
        videos,
        channel: {
          id: channelId,
          title: channel.snippet.title,
          thumbnail: channel.snippet.thumbnails.medium?.url || channel.snippet.thumbnails.default?.url || "",
          subscriberCount: parseInt(channel.statistics?.subscriberCount || "0", 10),
          videoCount: totalVideos,
        },
      },
    });
  } catch (error) {
    console.error("Failed to fetch creator videos:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch creator videos" },
      { status: 500 }
    );
  }
}
