import { NextRequest, NextResponse } from "next/server";
import { getVideoDetails } from "@/lib/youtube";

export async function GET(request: NextRequest) {
  try {
    const videoId = request.nextUrl.searchParams.get("videoId");

    if (!videoId) {
      return NextResponse.json(
        { success: false, error: "videoId parameter is required" },
        { status: 400 }
      );
    }

    const items = await getVideoDetails([videoId]);

    if (!items || items.length === 0) {
      return NextResponse.json(
        { success: false, error: "Video not found" },
        { status: 404 }
      );
    }

    const item = items[0];

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
        thumbnail: item.snippet.thumbnails.medium?.url || "",
        publishedAt: item.snippet.publishedAt || "",
        duration: item.contentDetails.duration,
        description: item.snippet.description || "",
        tags: item.snippet.tags || [],
      },
    });
  } catch (error) {
    console.error("YouTube video details error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to fetch video details",
      },
      { status: 500 }
    );
  }
}
