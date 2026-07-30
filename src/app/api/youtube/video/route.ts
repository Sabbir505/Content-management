import { NextRequest, NextResponse } from "next/server";
import { proxyFetch } from "@/lib/proxy";
import { YOUTUBE_API_KEY } from "@/lib/youtube-api";
import { guardApiKey } from "@/lib/api-helpers";

export async function GET(request: NextRequest) {
  try {
    const videoId = request.nextUrl.searchParams.get("videoId");

    if (!videoId) {
      return NextResponse.json(
        { success: false, error: "videoId parameter is required" },
        { status: 400 }
      );
    }

    const guard = await guardApiKey(YOUTUBE_API_KEY, "YOUTUBE_API_KEY");
    if (guard) return guard;

    const response = await proxyFetch(
      `https://www.googleapis.com/youtube/v3/videos?part=snippet,statistics,contentDetails&id=${videoId}&key=${YOUTUBE_API_KEY}`,
      {
        headers: { Accept: "application/json" },
        timeout: 10000,
      }
    ).catch((error) => {
      console.error("YouTube API fetch failed:", error);
      return null;
    });

    if (!response) {
      return NextResponse.json({
        success: true,
        data: {
          id: videoId,
          title: "",
          channelTitle: "",
          channelId: "",
          viewCount: 0,
          likeCount: 0,
          commentCount: 0,
          thumbnail: "",
          publishedAt: "",
          duration: "",
          description: "",
          tags: [],
        },
      });
    }

    if (!response.ok) {
      return NextResponse.json(
        { success: false, error: `YouTube API returned ${response.status}` },
        { status: response.status }
      );
    }

    const data = await response.json();

    if (!data.items || data.items.length === 0) {
      return NextResponse.json(
        { success: false, error: "Video not found" },
        { status: 404 }
      );
    }

    const item = data.items[0];

    return NextResponse.json({
      success: true,
      data: {
        id: item.id,
        title: item.snippet.title || "",
        channelTitle: item.snippet.channelTitle || "",
        channelId: item.snippet.channelId || "",
        viewCount: parseInt(item.statistics.viewCount || "0", 10) || 0,
        likeCount: parseInt(item.statistics.likeCount || "0", 10) || 0,
        commentCount: parseInt(item.statistics.commentCount || "0", 10) || 0,
        thumbnail: item.snippet.thumbnails?.medium?.url || item.snippet.thumbnails?.default?.url || "",
        publishedAt: item.snippet.publishedAt || "",
        duration: item.contentDetails?.duration || "",
        description: item.snippet.description || "",
        tags: item.snippet.tags || [],
      },
    });
  } catch (error) {
    console.error("YouTube video details error:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to fetch video details",
      },
      { status: 500 }
    );
  }
}
