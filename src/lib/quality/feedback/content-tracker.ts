import {
  collection,
  addDoc,
  query,
  where,
  getDocs,
  updateDoc,
  doc,
  orderBy,
  Timestamp,
  type Firestore,
} from "firebase/firestore";
import { db } from "../../firebase";
import type { ContentTrackingEntry, OutputType, PlatformType } from "../types";

function ensureDb(): Firestore {
  if (!db) throw new Error("Firestore is not configured. Set NEXT_PUBLIC_FIREBASE_* env vars.");
  return db;
}

export async function trackPublishedContent(
  entry: Omit<ContentTrackingEntry, "id">
): Promise<string> {
  const docRef = await addDoc(collection(ensureDb(), "contentTracking"), {
    ...entry,
    generationDate: Timestamp.now(),
  });
  return docRef.id;
}

export async function getTrackedContent(
  userId: string,
  filters?: {
    platform?: PlatformType;
    contentType?: OutputType;
    hasPublishedUrl?: boolean;
  }
): Promise<ContentTrackingEntry[]> {
  const q = query(
    collection(ensureDb(), "contentTracking"),
    where("userId", "==", userId),
    orderBy("generationDate", "desc")
  );

  const snapshot = await getDocs(q);
  let results = snapshot.docs.map((doc) => {
    const data = doc.data();
    return {
      id: doc.id,
      userId: data.userId,
      contentId: data.contentId,
      contentType: data.contentType,
      scoreAtGeneration: data.scoreAtGeneration,
      scoreBreakdown: data.scoreBreakdown || null,
      niche: data.niche,
      voiceProfileVersion: data.voiceProfileVersion,
      generationDate: data.generationDate?.toDate?.()?.toISOString() || data.generationDate,
      platform: data.platform,
      publishedUrl: data.publishedUrl,
      publishedAt: data.publishedAt?.toDate?.()?.toISOString() || data.publishedAt,
    } as ContentTrackingEntry;
  });

  if (filters?.platform) {
    results = results.filter((r) => r.platform === filters.platform);
  }
  if (filters?.contentType) {
    results = results.filter((r) => r.contentType === filters.contentType);
  }
  if (filters?.hasPublishedUrl) {
    results = results.filter((r) => r.publishedUrl);
  }

  return results;
}

export async function linkContentToUrl(
  trackingEntryId: string,
  publishedUrl: string
): Promise<void> {
  const docRef = doc(ensureDb(), "contentTracking", trackingEntryId);
  await updateDoc(docRef, {
    publishedUrl,
    publishedAt: Timestamp.now(),
  });
}
