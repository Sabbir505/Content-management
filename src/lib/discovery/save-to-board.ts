import type { VideoWithOutlier } from "@/types/video";
import type { ContentItem } from "@/types/content";
import { addLocalCard, ensureLocalBoard } from "@/lib/local-board";

const MY_IDEAS_BOARD_ID = "my-ideas";

function ensureMyIdeasBoard(): void {
  ensureLocalBoard(MY_IDEAS_BOARD_ID, "My Ideas", "Quick ideas and notes", true);
}

function buildVideoContent(video: VideoWithOutlier): string {
  const parts: string[] = [];
  if (video.description) parts.push(video.description);
  if (video.transcript) parts.push(video.transcript);
  return parts.join("\n\n");
}

export async function saveVideoToBoard(
  userId: string,
  _boardId: string,
  video: VideoWithOutlier
): Promise<void> {
  const { doc, writeBatch, increment, serverTimestamp } = await import("firebase/firestore");
  const { db } = await import("@/lib/firebase");

  const cardId = crypto.randomUUID();
  const cardRef = doc(db, "users", userId, "boards", MY_IDEAS_BOARD_ID, "cards", cardId);
  const boardRef = doc(db, "users", userId, "boards", MY_IDEAS_BOARD_ID);

  const url = `https://www.youtube.com/watch?v=${video.id}`;

  const batch = writeBatch(db);
  batch.set(cardRef, {
    type: "idea",
    title: video.title,
    content: buildVideoContent(video),
    url,
    videoId: video.id,
    thumbnail: video.thumbnail,
    boardId: MY_IDEAS_BOARD_ID,
    x: 0,
    y: 0,
    width: 240,
    height: video.thumbnail ? 200 : 160,
    metadata: {
      sourceType: "video",
      channelTitle: video.channelTitle,
      viewCount: video.viewCount,
      outlierScore: video.outlierScore,
      hookType: video.hookType,
      estimatedStructure: video.estimatedStructure,
      duration: video.duration,
      publishedAt: video.publishedAt,
      transcript: video.transcript,
    },
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  batch.set(
    boardRef,
    {
      name: "My Ideas",
      description: "Quick ideas and notes",
      isDefault: true,
      itemCount: increment(1),
      updatedAt: serverTimestamp(),
      createdAt: serverTimestamp(),
    },
    { merge: true }
  );
  await batch.commit();
}

export async function saveContentToBoard(
  userId: string,
  _boardId: string,
  item: ContentItem
): Promise<void> {
  const { doc, writeBatch, increment, serverTimestamp } = await import("firebase/firestore");
  const { db } = await import("@/lib/firebase");

  const cardId = crypto.randomUUID();
  const cardRef = doc(db, "users", userId, "boards", MY_IDEAS_BOARD_ID, "cards", cardId);
  const boardRef = doc(db, "users", userId, "boards", MY_IDEAS_BOARD_ID);

  const batch = writeBatch(db);
  batch.set(cardRef, {
    type: "idea",
    title: item.title,
    content: item.description || "",
    url: item.url,
    thumbnail: item.thumbnail || null,
    boardId: MY_IDEAS_BOARD_ID,
    x: 0,
    y: 0,
    width: 240,
    height: item.thumbnail ? 200 : 160,
    metadata: {
      sourceType: "article",
      source: item.source,
      author: item.author,
      score: item.score,
      publishedAt: item.publishedAt,
    },
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  batch.set(
    boardRef,
    {
      name: "My Ideas",
      description: "Quick ideas and notes",
      isDefault: true,
      itemCount: increment(1),
      updatedAt: serverTimestamp(),
      createdAt: serverTimestamp(),
    },
    { merge: true }
  );
  await batch.commit();
}

// Offline / signed-out fallback: persist to localStorage so the idea survives
// even when Firestore is unavailable. Mirrors the Firestore card shape.
export function saveVideoToLocalIdeas(video: VideoWithOutlier): void {
  ensureMyIdeasBoard();
  addLocalCard(MY_IDEAS_BOARD_ID, {
    type: "idea",
    title: video.title,
    content: buildVideoContent(video),
    url: `https://www.youtube.com/watch?v=${video.id}`,
    videoId: video.id,
    thumbnail: video.thumbnail,
    metadata: {
      sourceType: "video",
      channelTitle: video.channelTitle,
      viewCount: video.viewCount,
      outlierScore: video.outlierScore,
      hookType: video.hookType,
      estimatedStructure: video.estimatedStructure,
      duration: video.duration,
      publishedAt: video.publishedAt,
      transcript: video.transcript,
    },
  });
}

export function saveContentToLocalIdeas(item: ContentItem): void {
  ensureMyIdeasBoard();
  addLocalCard(MY_IDEAS_BOARD_ID, {
    type: "idea",
    title: item.title,
    content: item.description || "",
    url: item.url,
    thumbnail: item.thumbnail,
    metadata: {
      sourceType: "article",
      source: item.source,
      author: item.author,
      score: item.score,
      publishedAt: item.publishedAt,
    },
  });
}
