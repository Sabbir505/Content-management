import { NextRequest, NextResponse } from "next/server";
import { getYouTubeClient } from "@/lib/youtube-client";

export async function GET(request: NextRequest) {
  try {
    const channelId = request.nextUrl.searchParams.get("channelId");

    if (!channelId) {
      return NextResponse.json({ success: false, error: "channelId parameter is required" }, { status: 400 });
    }

    const yt = await getYouTubeClient();

    // 1. Get channel details
    const channel = await yt.getChannel(channelId);
    const metadata = channel.metadata;

    // 2. Get channel videos
    const videos = await channel.getVideos();
    const videoIds = Array.isArray(videos) ? videos.map((video) => video.id) : [];

    if (videoIds.length === 0) {
      return NextResponse.json({ success: false, error: "No videos found on this channel" }, { status: 404 });
    }

    // 3. Get video details
    const videoDetails = [];
    for (const videoId of videoIds.slice(0, 50)) {
      try {
        const info = await yt.getInfo(videoId);
        const basicInfo = info.basic_info;
        videoDetails.push({
          id: videoId,
          snippet: {
            title: basicInfo.title,
            channelId: basicInfo.channel_id,
            channelTitle: basicInfo.author,
            description: basicInfo.short_description,
            publishedAt: (basicInfo as any).publish_date || new Date().toISOString(),
            thumbnails: {
              medium: {
                url: basicInfo.thumbnail?.[0]?.url || "",
              },
            },
          },
          statistics: {
            viewCount: basicInfo.view_count?.toString() || "0",
            likeCount: "0",
            commentCount: "0",
          },
          contentDetails: {
            duration: `PT${basicInfo.duration || 0}S`,
          },
        });
      } catch (error) {
        console.error(`Failed to get details for video ${videoId}:`, error);
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        channel: {
          id: channelId,
          title: metadata.title,
          thumbnail: metadata.avatar?.[0]?.url || "",
          subscriberCount: parseInt((metadata as any).subscriber_count?.toString() || "0"),
          videoCount: parseInt((metadata as any).total_videos?.toString() || "0"),
          viewCount: parseInt((metadata as any).view_count?.toString() || "0"),
        },
        videos: videoDetails,
      },
    });
  } catch (error) {
    console.error("Channel videos error:", error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
