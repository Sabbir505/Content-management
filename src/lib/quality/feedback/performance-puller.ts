import {
  collection,
  addDoc,
  query,
  where,
  getDocs,
  Timestamp,
  type Firestore,
} from "firebase/firestore";
import { db } from "../../firebase";
import { PERFORMANCE_WINDOWS } from "../constants";
import { getTrackedContent } from "./content-tracker";
import { getConnectionToken } from "./platform-connections";
import type { PlatformType } from "../types";

function ensureDb(): Firestore {
  if (!db) throw new Error("Firestore is not configured. Set NEXT_PUBLIC_FIREBASE_* env vars.");
  return db;
}

export async function pullYouTubeMetrics(
  videoId: string,
  accessToken: string
): Promise<Record<string, number>> {
  const response = await fetch(
    `https://youtubeanalytics.googleapis.com/v2/reports?ids=channel==MINE&metrics=views,clickThroughRate,averageViewDuration,averageViewPercentage,subscribersGained&startDate=2024-01-01&endDate=2099-12-31&filters=video==${videoId}`,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  );

  if (!response.ok) {
    throw new Error(`YouTube Analytics API error: ${response.status}`);
  }

  const data = await response.json();
  const rows = data.rows?.[0] || [];
  const columns = data.columnHeaders?.map((h: { name: string }) => h.name) || [];

  const metrics: Record<string, number> = {};
  columns.forEach((col: string, i: number) => {
    metrics[col] = rows[i] || 0;
  });

  return metrics;
}

/* eslint-disable @typescript-eslint/no-unused-vars */
export async function pullXMetrics(
  _postId: string,
  _accessToken: string
): Promise<Record<string, number>> {
  // X API v2 metrics require the tweet ID and bearer token
  // Simplified implementation — full OAuth2 flow needed for production
  return {
    likes: 0,
    retweets: 0,
    replies: 0,
    impressions: 0,
    linkClicks: 0,
  };
}

/* eslint-disable @typescript-eslint/no-unused-vars */
export async function pullInstagramMetrics(
  _postId: string,
  _accessToken: string
): Promise<Record<string, number>> {
  // Instagram Graph API: GET /{media-id}/insights
  // Requires Instagram Basic Display API permissions
  return {
    likes: 0,
    comments: 0,
    saves: 0,
    shares: 0,
    reach: 0,
    impressions: 0,
  };
}

/* eslint-disable @typescript-eslint/no-unused-vars */
export async function pullFacebookMetrics(
  _postId: string,
  _accessToken: string
): Promise<Record<string, number>> {
  // Facebook Graph API: GET /{post-id}/insights
  return {
    reactions: 0,
    shares: 0,
    comments: 0,
    reach: 0,
  };
}
/* eslint-enable @typescript-eslint/no-unused-vars */

const pullFns: Record<
  PlatformType,
  (id: string, token: string) => Promise<Record<string, number>>
> = {
  youtube: pullYouTubeMetrics,
  x: pullXMetrics,
  instagram: pullInstagramMetrics,
  facebook: pullFacebookMetrics,
};

export async function pullAllDueMetrics(userId: string): Promise<void> {
  const trackedContent = await getTrackedContent(userId, {
    hasPublishedUrl: true,
  });

  const now = new Date();

  for (const entry of trackedContent) {
    if (!entry.publishedAt || !entry.publishedUrl) continue;

    const publishedDate = new Date(entry.publishedAt);
    const token = await getConnectionToken(userId, entry.platform);

    if (!token) continue;

    for (const window of PERFORMANCE_WINDOWS) {
      const windowTime = new Date(publishedDate.getTime() + window.ms);

      if (now < windowTime) continue;

      // Check if snapshot already exists for this window
      const q = query(
        collection(ensureDb(), "performanceSnapshots"),
        where("trackingEntryId", "==", entry.id),
        where("window", "==", window.name)
      );
      const existing = await getDocs(q);

      if (!existing.empty) continue;

      // Extract platform-specific ID from publishedUrl
      const platformId = extractPlatformId(entry.publishedUrl, entry.platform);
      if (!platformId) continue;

      try {
        const pullFn = pullFns[entry.platform];
        const metrics = await pullFn(platformId, token);

        await addDoc(collection(ensureDb(), "performanceSnapshots"), {
          trackingEntryId: entry.id,
          window: window.name,
          fetchedAt: Timestamp.now(),
          metrics,
        });
      } catch (error) {
        console.error(
          `Failed to pull ${entry.platform} metrics for ${entry.id}:`,
          error
        );
      }
    }
  }
}

function extractPlatformId(url: string, platform: PlatformType): string | null {
  try {
    const parsed = new URL(url);
    switch (platform) {
      case "youtube": {
        const match = url.match(
          /(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/
        );
        return match?.[1] || null;
      }
      case "x": {
        const match = parsed.pathname.match(/\/status\/(\d+)/);
        return match?.[1] || null;
      }
      case "instagram": {
        const match = parsed.pathname.match(/\/p\/([a-zA-Z0-9_-]+)/);
        return match?.[1] || null;
      }
      case "facebook": {
        const match = parsed.pathname.match(/\/posts\/(\d+)/);
        return match?.[1] || null;
      }
    }
  } catch {
    return null;
  }
  return null;
}
