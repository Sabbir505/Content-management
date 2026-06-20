import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/firebase";
import { doc, updateDoc, deleteDoc, getDoc, serverTimestamp, increment } from "firebase/firestore";

// PATCH /api/boards/{boardId}/cards/{cardId} - Update card
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ boardId: string; cardId: string }> }) {
  try {
    const { boardId, cardId } = await params;
    const body = await request.json();
    const { userId, updates } = body;

    if (!userId || !updates) {
      return NextResponse.json({ success: false, error: "userId and updates are required" }, { status: 400 });
    }

    const cardRef = doc(db, "users", userId, "boards", boardId, "cards", cardId);
    const cardDoc = await getDoc(cardRef);

    if (!cardDoc.exists()) {
      return NextResponse.json({ success: false, error: "Card not found" }, { status: 404 });
    }

    await updateDoc(cardRef, {
      ...updates,
      updatedAt: serverTimestamp(),
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Update card error:", error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}

// DELETE /api/boards/{boardId}/cards/{cardId} - Delete card
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ boardId: string; cardId: string }> }) {
  try {
    const { boardId, cardId } = await params;
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId");

    if (!userId) {
      return NextResponse.json({ success: false, error: "userId is required" }, { status: 400 });
    }

    const cardRef = doc(db, "users", userId, "boards", boardId, "cards", cardId);
    const cardDoc = await getDoc(cardRef);

    if (!cardDoc.exists()) {
      return NextResponse.json({ success: false, error: "Card not found" }, { status: 404 });
    }

    await deleteDoc(cardRef);

    // Decrement board item count
    await updateDoc(doc(db, "users", userId, "boards", boardId), {
      itemCount: increment(-1),
      updatedAt: serverTimestamp(),
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete card error:", error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
