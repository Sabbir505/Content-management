import { NextRequest, NextResponse } from "next/server";
import { connectPlatform, disconnectPlatform } from "@/lib/quality/feedback/platform-connections";

export async function POST(request: NextRequest) {
  try {
    const { userId, accessToken, username } = await request.json();
    if (!userId || !accessToken) {
      return NextResponse.json(
        { success: false, error: "userId and accessToken are required" },
        { status: 400 }
      );
    }

    await connectPlatform(userId, "facebook", {
      tokenEncrypted: accessToken,
      tokenExpiry: null,
      platformUserId: null,
      platformUsername: username || null,
      refreshToken: null,
    });

    return NextResponse.json({ success: true, data: { connected: true } });
  } catch (error) {
    console.error("Facebook connection error:", error);
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { userId } = await request.json();
    if (!userId) return NextResponse.json({ success: false, error: "userId is required" }, { status: 400 });
    await disconnectPlatform(userId, "facebook");
    return NextResponse.json({ success: true, data: { connected: false } });
  } catch (error) {
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}
