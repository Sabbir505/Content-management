import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/firebase";
import {
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  query,
  orderBy,
  serverTimestamp,
  Timestamp,
} from "firebase/firestore";
import type { ChatSession, ChatMessage } from "@/types/chat";
import { validateUserAccess } from "@/lib/api-auth";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, title, boardId, cardId, sessionId: requestedSessionId } = body;

    if (!userId) {
      return NextResponse.json({ success: false, error: "userId is required" }, { status: 400 });
    }

    const authError = await validateUserAccess(request, userId);
    if (authError) return authError;

    // Clients generate their own session ID so sending the first message
    // never blocks on this request; fall back for callers that don't.
    const sessionId =
      typeof requestedSessionId === "string" && /^[\w-]{1,128}$/.test(requestedSessionId)
        ? requestedSessionId
        : crypto.randomUUID();
    const now = new Date().toISOString();

    const session: ChatSession = {
      id: sessionId,
      title: title || "New Chat",
      cardId,
      createdAt: now,
      updatedAt: now,
      messageCount: 0,
    };

    try {
      const firestoreData: Record<string, unknown> = {
        ...session,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };
      // Firestore rejects undefined values
      delete firestoreData.cardId;
      if (boardId) firestoreData.boardId = boardId;
      if (cardId) firestoreData.cardId = cardId;

      await Promise.race([
        setDoc(doc(db, "users", userId, "chatSessions", sessionId), firestoreData),
        new Promise((_, reject) => setTimeout(() => reject(new Error("timeout")), 3000)),
      ]);
    } catch (fsError) {
      console.error("Firestore unavailable, proceeding without persistence:", fsError);
    }

    return NextResponse.json({ success: true, data: session });
  } catch (error) {
    console.error("Create session error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId");
    const sessionId = searchParams.get("sessionId");

    if (!userId) {
      return NextResponse.json({ success: false, error: "userId is required" }, { status: 400 });
    }

    const authError = await validateUserAccess(request, userId);
    if (authError) return authError;

    if (sessionId) {
      // Fetch specific session with messages
      const sessionDoc = await getDoc(doc(db, "users", userId, "chatSessions", sessionId));
      if (!sessionDoc.exists()) {
        return NextResponse.json({ success: false, error: "Session not found" }, { status: 404 });
      }

      const messagesSnapshot = await getDocs(
        query(
          collection(db, "users", userId, "chatSessions", sessionId, "messages"),
          orderBy("createdAt", "asc")
        )
      );

      const messages: ChatMessage[] = [];
      messagesSnapshot.forEach((docSnap) => {
        const data = docSnap.data();
        messages.push({
          id: docSnap.id,
          role: data.role,
          text: data.text,
          attachments: data.attachments || [],
          artifact: data.artifact || undefined,
          createdAt: data.createdAt instanceof Timestamp ? data.createdAt.toDate().toISOString() : data.createdAt,
        });
      });

      const sessionData = sessionDoc.data();
      const session: ChatSession = {
        id: sessionDoc.id,
        title: sessionData.title,
        boardId: sessionData.boardId,
        cardId: sessionData.cardId,
        createdAt: sessionData.createdAt instanceof Timestamp ? sessionData.createdAt.toDate().toISOString() : sessionData.createdAt,
        updatedAt: sessionData.updatedAt instanceof Timestamp ? sessionData.updatedAt.toDate().toISOString() : sessionData.updatedAt,
        messageCount: messages.length,
      };

      return NextResponse.json({ success: true, data: { session, messages } });
    }

    // Fetch all sessions for user
    const sessionsSnapshot = await getDocs(
      query(
        collection(db, "users", userId, "chatSessions"),
        orderBy("updatedAt", "desc")
      )
    );

    const sessions: ChatSession[] = [];
    sessionsSnapshot.forEach((docSnap) => {
      const data = docSnap.data();
      sessions.push({
        id: docSnap.id,
        title: data.title,
        boardId: data.boardId,
        cardId: data.cardId,
        createdAt: data.createdAt instanceof Timestamp ? data.createdAt.toDate().toISOString() : data.createdAt,
        updatedAt: data.updatedAt instanceof Timestamp ? data.updatedAt.toDate().toISOString() : data.updatedAt,
        messageCount: data.messageCount || 0,
      });
    });

    return NextResponse.json({ success: true, data: sessions });
  } catch (error) {
    console.error("Fetch session error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
