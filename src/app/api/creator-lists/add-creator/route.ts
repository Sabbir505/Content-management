import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/firebase";
import { validateUserAccess } from "@/lib/api-auth";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, listId, creatorId } = body;

    if (!userId || !listId || !creatorId) {
      return NextResponse.json({ success: false, error: "Missing userId, listId, or creatorId" }, { status: 400 });
    }

    const authError = await validateUserAccess(request, userId);
    if (authError) return authError;

    const listRef = doc(db, "users", userId, "creatorLists", listId);
    const listSnap = await getDoc(listRef);
    if (!listSnap.exists()) {
      return NextResponse.json({ success: false, error: "List not found" }, { status: 404 });
    }

    const data = listSnap.data();
    const existingIds: string[] = data.creatorIds || [];
    if (existingIds.includes(creatorId)) {
      return NextResponse.json({ success: true, data: { alreadyAdded: true } });
    }

    await setDoc(
      listRef,
      { creatorIds: [...existingIds, creatorId], updatedAt: serverTimestamp() },
      { merge: true }
    );

    return NextResponse.json({ success: true, data: { alreadyAdded: false } });
  } catch (error) {
    console.error("Failed to add creator to list:", error);
    return NextResponse.json({ success: false, error: "Failed to add creator to list" }, { status: 500 });
  }
}
