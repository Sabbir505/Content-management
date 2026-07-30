import { NextRequest, NextResponse } from "next/server";
import { YOUTUBE_API_KEY, fetchYouTubeApi } from "@/lib/youtube-api";
import { guardApiKey } from "@/lib/api-helpers";

interface YouTubeChannelResponse {
  id: string;
  snippet?: {
    title: string;
    description: string;
    customUrl?: string;
    thumbnails: { high?: { url: string }; medium?: { url: string }; default?: { url: string } };
  };
  statistics?: { viewCount?: string; subscriberCount?: string; videoCount?: string };
}

export async function GET(request: NextRequest) {
  try {
    const channelId = request.nextUrl.searchParams.get("channelId");

    if (!channelId) {
      return NextResponse.json(
        { success: false, error: "channelId parameter is required" },
        { status: 400 }
      );
    }

    const guard = await guardApiKey(YOUTUBE_API_KEY, "YOUTUBE_API_KEY");
    if (guard) return guard;

    const data = await fetchYouTubeApi<YouTubeChannelResponse>(
      `channels?part=snippet,statistics&id=${channelId}`
    );

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
        subscriberCount: parseInt(channel.statistics?.subscriberCount || "0", 10),
        videoCount: parseInt(channel.statistics?.videoCount || "0", 10),
        viewCount: parseInt(channel.statistics?.viewCount || "0", 10),
      },
    });
  } catch (error) {
    console.error("Channel details error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
