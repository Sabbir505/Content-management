import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/firebase";
import { validateUserAccess } from "@/lib/api-auth";
import { doc, setDoc, getDoc, collection, getDocs, query, orderBy, serverTimestamp } from "firebase/firestore";
import { getYouTubeClient } from "@/lib/youtube-client";
import { calculateOutlierScore, estimateHookType, estimateStructure } from "@/lib/outlier";
import type { TrackedCreator } from "@/types/creator";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, channelUrl } = body;

    if (!userId) {
      return NextResponse.json({ success: false, error: "Missing userId" }, { status: 400 });
    }

    const authError = validateUserAccess(request, userId);
    if (authError) return authError;

    let channelId: string | null = body.channelId || null;

    // If channelUrl is provided, extract channel ID from it
    if (channelUrl && !channelId) {
      channelId = extractChannelId(channelUrl);
    }

    if (!channelId) {
      return NextResponse.json({ success: false, error: "Could not extract channel ID" }, { status: 400 });
    }

    // Fetch channel info from YouTube
    const yt = await getYouTubeClient();
    const channel = await yt.getChannel(channelId);
    const metadata = (channel as any).metadata;

    const creatorId = channelId;
    const creatorRef = doc(db, "users", userId, "creators", creatorId);

    const creatorData: Omit<TrackedCreator, "id"> = {
      userId,
      channelId,
      channelTitle: metadata.title || channelId,
      thumbnail: metadata.avatar?.[0]?.url || "",
      subscriberCount: parseInt(metadata.subscriber_count?.toString() || "0", 10),
      videoCount: parseInt(metadata.total_videos?.toString() || "0", 10),
      description: metadata.description || "",
      customUrl: metadata.custom_url || "",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await setDoc(creatorRef, {
      ...creatorData,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    return NextResponse.json({ success: true, data: { id: creatorId, ...creatorData } });
  } catch (error) {
    console.error("Failed to track creator:", error);
    return NextResponse.json({ success: false, error: "Failed to track creator" }, { status: 500 });
  }
}

function extractChannelId(url: string): string | null {
  const patterns = [
    /youtube\.com\/channel\/(UC[\w-]+)/,
    /youtube\.com\/@([\w-]+)/,
    /youtube\.com\/c\/([\w-]+)/,
    /youtube\.com\/user\/([\w-]+)/,
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) {
      return match[1];
    }
  }

  if (url.startsWith("UC") && url.length > 20) {
    return url;
  }

  return null;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId");

    if (!userId) {
      return NextResponse.json({ success: false, error: "Missing userId" }, { status: 400 });
    }

    const authError = validateUserAccess(request, userId);
    if (authError) return authError;

    const creatorsSnapshot = await getDocs(
      query(collection(db, "users", userId, "creators"), orderBy("updatedAt", "desc"))
    );

    const creators: TrackedCreator[] = [];
    creatorsSnapshot.forEach((docSnap) => {
      const data = docSnap.data();
      creators.push({
        id: docSnap.id,
        userId: data.userId,
        channelId: data.channelId,
        channelTitle: data.channelTitle,
        thumbnail: data.thumbnail,
        subscriberCount: data.subscriberCount,
        videoCount: data.videoCount,
        description: data.description,
        customUrl: data.customUrl,
        createdAt: data.createdAt?.toDate?.()?.toISOString() || data.createdAt || "",
        updatedAt: data.updatedAt?.toDate?.()?.toISOString() || data.updatedAt || "",
      });
    });

    return NextResponse.json({ success: true, data: creators });
  } catch (error) {
    console.error("Failed to fetch creators:", error);
    return NextResponse.json({ success: false, error: "Failed to fetch creators" }, { status: 500 });
  }
}
