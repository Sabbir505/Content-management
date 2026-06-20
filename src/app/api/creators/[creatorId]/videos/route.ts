import { NextResponse } from "next/server";
import { getYouTubeClient } from "@/lib/youtube-client";
import { calculateOutlierScore, estimateHookType, estimateStructure } from "@/lib/outlier";
import { calculateVideoDiscoveryScore } from "@/lib/discovery-score";
import type { CreatorVideo } from "@/types/creator";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const channelId = searchParams.get("channelId");

    if (!channelId) {
      return NextResponse.json({ success: false, error: "Missing channelId" }, { status: 400 });
    }

    const yt = await getYouTubeClient();
    const channel = await yt.getChannel(channelId);
    const metadata = (channel as any).metadata;

    // Get channel videos
    const videos = await (channel as any).getVideos();

    const videoPromises = videos.videos?.slice(0, 20).map(async (video: any) => {
      const viewCount = parseInt(video.view_count?.text?.replace(/[^\d]/g, "") || "0", 10);
      const durationText = video.duration?.text || "0:00";
      const durationSeconds = parseDuration(durationText);
      const publishedAt = video.published?.text || "";

      // Calculate outlier score
      let channelAvgViews = viewCount * 0.1;
      try {
        const totalViews = parseInt(metadata.view_count?.toString() || "0", 10);
        const totalVideos = parseInt(metadata.total_videos?.toString() || "0", 10);
        if (totalVideos > 0 && totalViews > 0) {
          channelAvgViews = totalViews / totalVideos;
        }
      } catch {
        // Fallback
      }
      const outlierScore = calculateOutlierScore(viewCount, channelAvgViews);

      const videoData: CreatorVideo = {
        id: video.id,
        creatorId: channelId,
        title: video.title?.text || "",
        thumbnail: video.thumbnails?.[0]?.url || "",
        publishedAt: new Date().toISOString(), // Fallback since published might not be available
        viewCount,
        duration: durationText,
        outlierScore,
        hookType: estimateHookType(video.title?.text || ""),
        estimatedStructure: estimateStructure(video.title?.text || ""),
      };

      return videoData;
    }) || [];

    const formattedVideos = await Promise.all(videoPromises);

    return NextResponse.json({
      success: true,
      data: {
        videos: formattedVideos,
        channel: {
          id: channelId,
          title: metadata.title,
          thumbnail: metadata.avatar?.[0]?.url || "",
          subscriberCount: parseInt(metadata.subscriber_count?.toString() || "0", 10),
          videoCount: parseInt(metadata.total_videos?.toString() || "0", 10),
        },
      },
    });
  } catch (error) {
    console.error("Failed to fetch creator videos:", error);
    return NextResponse.json({ success: false, error: "Failed to fetch creator videos" }, { status: 500 });
  }
}

function parseDuration(duration: string): number {
  const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return 0;
  const hours = parseInt(match[1] || "0");
  const minutes = parseInt(match[2] || "0");
  const seconds = parseInt(match[3] || "0");
  return hours * 3600 + minutes * 60 + seconds;
}
