import { NextRequest, NextResponse } from "next/server";
import { YOUTUBE_API_KEY, fetchYouTubeApi } from "@/lib/youtube-api";
import { guardApiKey } from "@/lib/api-helpers";

interface YouTubeChannelSearchItem {
  id: { channelId: string };
  snippet: {
    title: string;
    description: string;
    thumbnails: { medium?: { url: string }; default?: { url: string } };
  };
}

export async function GET(request: NextRequest) {
  try {
    const query = request.nextUrl.searchParams.get("query");
    if (!query) {
      return NextResponse.json({ success: false, error: "query parameter is required" }, { status: 400 });
    }
    const guard = await guardApiKey(YOUTUBE_API_KEY, "YOUTUBE_API_KEY");
    if (guard) return guard;

    const data = await fetchYouTubeApi<YouTubeChannelSearchItem>(
      `search?part=snippet&type=channel&q=${encodeURIComponent(query)}&maxResults=10`
    );

    const channels = (data.items || []).map((item) => ({
      channelId: item.id.channelId,
      title: item.snippet.title,
      description: item.snippet.description,
      thumbnail: item.snippet.thumbnails.medium?.url || item.snippet.thumbnails.default?.url || "",
    }));

    return NextResponse.json({ success: true, data: channels });
  } catch (error) {
    console.error("Channel search error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to search channels" },
      { status: 500 }
    );
  }
}
