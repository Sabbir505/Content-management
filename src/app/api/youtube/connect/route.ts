import { NextRequest, NextResponse } from "next/server";
import { proxyFetch } from "@/lib/proxy";
import { YOUTUBE_API_KEY } from "@/lib/youtube-api";
import { guardApiKey } from "@/lib/api-helpers";

export async function POST(request: NextRequest) {
  try {
    const { accessToken } = await request.json();

    if (!accessToken) {
      return NextResponse.json({ success: false, error: "Access token is required" }, { status: 400 });
    }

    const guard = await guardApiKey(YOUTUBE_API_KEY, "YOUTUBE_API_KEY");
    if (guard) return guard;

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
      // 401 = the user's OAuth access token is invalid/expired — surface it as
      // 401 so the client knows to re-auth rather than treating it as a server
      // fault. Other upstream failures stay 500.
      const status = response.status === 401 ? 401 : 500;
      const message = response.status === 401
        ? "Your Google session has expired. Reconnect your YouTube account."
        : `YouTube API error: ${response.status}`;
      return NextResponse.json({ success: false, error: message }, { status });
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
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}
