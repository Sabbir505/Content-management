import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/firebase";
import { validateUserAccess } from "@/lib/api-auth";
import { doc, setDoc, collection, getDocs, query, orderBy, serverTimestamp } from "firebase/firestore";
import { proxyFetch } from "@/lib/proxy";
import { YOUTUBE_API_KEY } from "@/lib/youtube-api";
import type { TrackedCreator } from "@/types/creator";

async function fetchChannelFromDataApi(channelId: string) {
  if (!YOUTUBE_API_KEY) throw new Error("YouTube API key not configured");
  const url = `https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics&id=${channelId}&key=${YOUTUBE_API_KEY}`;
  const response = await proxyFetch(url, { headers: { Accept: "application/json" }, timeout: 10000 });
  if (!response.ok) throw new Error(`YouTube API error: ${response.status}`);
  const data = await response.json();
  if (!data.items || data.items.length === 0) throw new Error("Channel not found");
  return data.items[0];
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, channelUrl, channelId: directChannelId } = body;

    if (!userId) {
      return NextResponse.json({ success: false, error: "Missing userId" }, { status: 400 });
    }

    const authError = await validateUserAccess(request, userId);
    if (authError) return authError;

    let channelId: string | null = directChannelId || null;

    if (channelUrl && !channelId) {
      channelId = extractChannelId(channelUrl);
    }

    if (!channelId) {
      return NextResponse.json({ success: false, error: "Could not extract channel ID" }, { status: 400 });
    }

    const channel = await fetchChannelFromDataApi(channelId);
    const snippet = channel.snippet || {};
    const stats = channel.statistics || {};

    const creatorId = channelId;
    const creatorRef = doc(db, "users", userId, "creators", creatorId);

    const creatorData: Omit<TrackedCreator, "id"> = {
      userId,
      channelId,
      channelTitle: snippet.title || channelId,
      thumbnail: snippet.thumbnails?.high?.url || snippet.thumbnails?.medium?.url || snippet.thumbnails?.default?.url || "",
      subscriberCount: parseInt(stats.subscriberCount || "0", 10),
      videoCount: parseInt(stats.videoCount || "0", 10),
      description: snippet.description || "",
      customUrl: snippet.customUrl || "",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await setDoc(creatorRef, {
      ...creatorData,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    // Ensure an "All following" list exists and add this creator to it
    const listsRef = collection(db, "users", userId, "creatorLists");
    const listsSnapshot = await getDocs(listsRef);
    const allFollowingList = listsSnapshot.docs.find((d) => d.data().name === "All following");
    if (!allFollowingList) {
      const newListRef = doc(listsRef);
      await setDoc(newListRef, {
        userId,
        name: "All following",
        description: "Creators you are tracking",
        creatorIds: [creatorId],
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } else {
      const existingIds: string[] = allFollowingList.data().creatorIds || [];
      if (!existingIds.includes(creatorId)) {
        await setDoc(
          doc(db, "users", userId, "creatorLists", allFollowingList.id),
          { creatorIds: [...existingIds, creatorId], updatedAt: serverTimestamp() },
          { merge: true }
        );
      }
    }

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
    if (match) return match[1];
  }

  if (url.startsWith("UC") && url.length > 20) return url;

  return null;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId");

    if (!userId) {
      return NextResponse.json({ success: false, error: "Missing userId" }, { status: 400 });
    }

    const authError = await validateUserAccess(request, userId);
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
