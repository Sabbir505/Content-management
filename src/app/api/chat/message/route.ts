import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/firebase";
import { collection, doc, setDoc, serverTimestamp } from "firebase/firestore";
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

    const messageId = crypto.randomUUID();
    const now = new Date().toISOString();

    const chatMessage: ChatMessage = {
      id: messageId,
      role: message.role,
      text: message.text,
      attachments: message.attachments || [],
      artifact: message.artifact || undefined,
      createdAt: now,
    };

    await setDoc(
      doc(db, "users", userId, "chatSessions", sessionId, "messages", messageId),
      {
        ...chatMessage,
        createdAt: serverTimestamp(),
      }
    );

    return NextResponse.json({ success: true, data: chatMessage });
  } catch (error) {
    console.error("Save message error:", error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
