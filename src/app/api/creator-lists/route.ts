import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/firebase";
import { validateUserAccess } from "@/lib/api-auth";
import { doc, setDoc, collection, getDocs, query, orderBy, serverTimestamp } from "firebase/firestore";
import type { CreatorList } from "@/types/creator";

export async function POST(request: NextRequest) {
  try {
    if (!db) {
      return NextResponse.json({ success: false, error: "Database not configured" }, { status: 503 });
    }

    const body = await request.json();
    const { userId, name, description } = body;

    if (!userId) {
      return NextResponse.json({ success: false, error: "Missing userId" }, { status: 400 });
    }
    if (!name || !name.trim()) {
      return NextResponse.json({ success: false, error: "List name is required" }, { status: 400 });
    }

    const authError = await validateUserAccess(request, userId);
    if (authError) return authError;

    const listRef = doc(collection(db, "users", userId, "creatorLists"));
    const listData: Omit<CreatorList, "id"> = {
      userId,
      name: name.trim(),
      description: description?.trim() || "",
      creatorIds: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await setDoc(listRef, {
      ...listData,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    return NextResponse.json({ success: true, data: { id: listRef.id, ...listData } });
  } catch (error) {
    console.error("Failed to create list:", error);
    return NextResponse.json({ success: false, error: "Failed to create list" }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    if (!db) {
      return NextResponse.json({ success: false, error: "Database not configured" }, { status: 503 });
    }

    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId");

    if (!userId) {
      return NextResponse.json({ success: false, error: "Missing userId" }, { status: 400 });
    }

    const authError = await validateUserAccess(request, userId);
    if (authError) return authError;

    const listsSnapshot = await getDocs(
      query(collection(db, "users", userId, "creatorLists"), orderBy("updatedAt", "desc"))
    );

    const lists: CreatorList[] = [];
    listsSnapshot.forEach((docSnap) => {
      const data = docSnap.data();
      lists.push({
        id: docSnap.id,
        userId: data.userId,
        name: data.name,
        description: data.description,
        creatorIds: data.creatorIds || [],
        createdAt: data.createdAt?.toDate?.()?.toISOString() || data.createdAt || "",
        updatedAt: data.updatedAt?.toDate?.()?.toISOString() || data.updatedAt || "",
      });
    });

    return NextResponse.json({ success: true, data: lists });
  } catch (error) {
    console.error("Failed to fetch lists:", error);
    return NextResponse.json({ success: false, error: "Failed to fetch lists" }, { status: 500 });
  }
}
