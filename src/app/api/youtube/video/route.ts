import { NextRequest, NextResponse } from "next/server";

const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY || process.env.NEXT_PUBLIC_YOUTUBE_API_KEY;

export async function GET(request: NextRequest) {
  try {
    const videoId = request.nextUrl.searchParams.get("videoId");

    if (!videoId) {
      return NextResponse.json(
        { success: false, error: "videoId parameter is required" },
        { status: 400 }
      );
    }

    if (!YOUTUBE_API_KEY) {
      return NextResponse.json(
        { success: false, error: "YouTube API key not configured" },
        { status: 500 }
      );
    }

    const response = await fetch(
      `https://www.googleapis.com/youtube/v3/videos?part=snippet,statistics,contentDetails&id=${videoId}&key=${YOUTUBE_API_KEY}`,
      { next: { revalidate: 3600 } }
    );

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
        error: error instanceof Error ? error.message : "Failed to fetch video details",
      },
      { status: 500 }
    );
  }
}
