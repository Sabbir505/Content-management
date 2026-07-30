import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/firebase";
import { doc, setDoc, updateDoc, increment, serverTimestamp } from "firebase/firestore";
import { validateUserAccess } from "@/lib/api-auth";
import type { ChatMessage } from "@/types/chat";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, sessionId, message } = body;

    if (!userId || !sessionId || !message) {
      return NextResponse.json(
        { success: false, error: "userId, sessionId, and message are required" },
        { status: 400 }
      );
    }

    const authError = await validateUserAccess(request, userId);
    if (authError) return authError;

    const messageId = crypto.randomUUID();
    const now = new Date().toISOString();

    const chatMessage: Record<string, unknown> = {
      id: messageId,
      role: message.role,
      text: message.text,
      attachments: message.attachments || [],
      createdAt: now,
    };
    if (message.artifact) chatMessage.artifact = message.artifact;

    try {
      await Promise.race([
        setDoc(
          doc(db, "users", userId, "chatSessions", sessionId, "messages", messageId),
          {
            ...chatMessage,
            createdAt: serverTimestamp(),
          }
        ),
        new Promise((_, reject) => setTimeout(() => reject(new Error("timeout")), 3000)),
      ]);
      // Keep the denormalized messageCount on the session in sync so the
      // session list doesn't show stale counts.
      updateDoc(doc(db, "users", userId, "chatSessions", sessionId), {
        messageCount: increment(1),
        updatedAt: serverTimestamp(),
      }).catch((e) => console.error("Failed to update messageCount:", e));
    } catch (fsError) {
      console.error("Firestore unavailable, message not persisted:", fsError);
    }

    return NextResponse.json({ success: true, data: chatMessage });
  } catch (error) {
    console.error("Save message error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
