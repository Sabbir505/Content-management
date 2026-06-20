import { NextRequest, NextResponse } from "next/server";
import { proxyFetch } from "@/lib/proxy";

const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY || process.env.NEXT_PUBLIC_YOUTUBE_API_KEY;

export async function GET(request: NextRequest) {
  try {
    const channelId = request.nextUrl.searchParams.get("channelId");

    if (!channelId) {
      return NextResponse.json(
        { success: false, error: "channelId parameter is required" },
        { status: 400 }
      );
    }

    if (!YOUTUBE_API_KEY) {
      return NextResponse.json(
        { success: false, error: "YouTube API key not configured" },
        { status: 500 }
      );
    }

    const response = await proxyFetch(
      `https://www.googleapis.com/youtube/v3/channels?part=snippet&id=${channelId}&key=${YOUTUBE_API_KEY}`,
      {
        headers: { Accept: "application/json" },
        timeout: 10000,
      }
    );

    if (!response.ok) {
      return NextResponse.json(
        { success: false, error: `YouTube API error: ${response.status}` },
        { status: 500 }
      );
    }

    const data = await response.json();

    if (!data.items || data.items.length === 0) {
      return NextResponse.json(
        { success: false, error: "Channel not found" },
        { status: 404 }
      );
    }

    const channel = data.items[0];
    const thumbnails = channel.snippet?.thumbnails || {};

    return NextResponse.json({
      success: true,
      data: {
        channelId: channel.id,
        title: channel.snippet?.title || "",
        description: channel.snippet?.description || "",
        thumbnail: thumbnails.high?.url || thumbnails.medium?.url || thumbnails.default?.url || "",
        customUrl: channel.snippet?.customUrl || "",
      },
    });
  } catch (error) {
    console.error("Channel details error:", error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
