import { NextRequest, NextResponse } from "next/server";
import { proxyFetch } from "@/lib/proxy";

const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY || process.env.NEXT_PUBLIC_YOUTUBE_API_KEY;

export async function POST(request: NextRequest) {
  try {
    const { accessToken } = await request.json();

    if (!accessToken) {
      return NextResponse.json({ success: false, error: "Access token is required" }, { status: 400 });
    }

    if (!YOUTUBE_API_KEY) {
      console.error("YOUTUBE_API_KEY is not set");
      return NextResponse.json({ success: false, error: "YouTube API key not configured" }, { status: 500 });
    }

    const url = `https://www.googleapis.com/youtube/v3/channels?part=snippet,contentDetails,statistics&mine=true&key=${YOUTUBE_API_KEY}`;
    console.log("Fetching YouTube channel data for access token");

    // Fetch the user's YouTube channel using their OAuth token
    const response = await proxyFetch(url, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/json",
      },
      timeout: 30000,
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error("YouTube API error:", response.status, errorData);
      return NextResponse.json({ success: false, error: `YouTube API error: ${response.status}` }, { status: 500 });
    }

    const data = await response.json();

    if (!data.items || data.items.length === 0) {
      return NextResponse.json({ success: false, error: "No YouTube channel found for this account" }, { status: 404 });
    }

    const channel = data.items[0];
    const channelData = {
      channelId: channel.id,
      title: channel.snippet.title,
      description: channel.snippet.description,
      thumbnail: channel.snippet.thumbnails.high?.url || channel.snippet.thumbnails.default?.url,
      subscriberCount: parseInt(channel.statistics.subscriberCount || "0", 10),
      videoCount: parseInt(channel.statistics.videoCount || "0", 10),
      viewCount: parseInt(channel.statistics.viewCount || "0", 10),
    };

    return NextResponse.json({ success: true, data: channelData });
  } catch (error) {
    console.error("Channel connection error:", error);
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : "Internal server error" }, { status: 500 });
  }
}
