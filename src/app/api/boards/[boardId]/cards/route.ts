import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/firebase";
import { collection, doc, setDoc, getDoc, getDocs, query, orderBy, serverTimestamp, deleteDoc, updateDoc, increment } from "firebase/firestore";
import type { BoardCard, Board } from "@/types/board";

// POST /api/boards/{boardId}/cards - Create card
export async function POST(request: NextRequest, { params }: { params: Promise<{ boardId: string }> }) {
  try {
    const { boardId } = await params;
    const body = await request.json();
    const { userId, card } = body;

    if (!userId || !card) {
      return NextResponse.json({ success: false, error: "userId and card are required" }, { status: 400 });
    }

    const cardId = crypto.randomUUID();
    const now = new Date().toISOString();

    const newCard: BoardCard = {
      ...card,
      id: cardId,
      boardId,
      createdAt: now,
      updatedAt: now,
    };

    await setDoc(doc(db, "users", userId, "boards", boardId, "cards", cardId), {
      ...newCard,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    // Increment board item count
    await updateDoc(doc(db, "users", userId, "boards", boardId), {
      itemCount: increment(1),
      updatedAt: serverTimestamp(),
    });

    return NextResponse.json({ success: true, data: newCard });
  } catch (error) {
    console.error("Create card error:", error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}

// GET /api/boards/{boardId}/cards - Fetch all cards
export async function GET(request: NextRequest, { params }: { params: Promise<{ boardId: string }> }) {
  try {
    const { boardId } = await params;
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId");

    if (!userId) {
      return NextResponse.json({ success: false, error: "userId is required" }, { status: 400 });
    }

    const cardsSnapshot = await getDocs(
      query(
        collection(db, "users", userId, "boards", boardId, "cards"),
        orderBy("createdAt", "desc")
      )
    );

    const cards: BoardCard[] = [];
    cardsSnapshot.forEach((docSnap) => {
      const data = docSnap.data();
      cards.push({
        id: docSnap.id,
        boardId: data.boardId,
        type: data.type,
        x: data.x,
        y: data.y,
        width: data.width,
        height: data.height,
        title: data.title,
        content: data.content,
        metadata: data.metadata,
        thumbnail: data.thumbnail,
        url: data.url,
        videoId: data.videoId,
        artifactType: data.artifactType,
        platform: data.platform,
        scoredOutput: data.scoredOutput,
        createdAt: data.createdAt?.toDate?.()?.toISOString() || data.createdAt,
        updatedAt: data.updatedAt?.toDate?.()?.toISOString() || data.updatedAt,
      });
    });

    return NextResponse.json({ success: true, data: cards });
  } catch (error) {
    console.error("Fetch cards error:", error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
