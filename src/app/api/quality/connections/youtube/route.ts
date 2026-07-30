import { NextRequest, NextResponse } from "next/server";
import { connectPlatform, disconnectPlatform } from "@/lib/quality/feedback/platform-connections";
import { validateUserAccess } from "@/lib/api-auth";

export async function POST(request: NextRequest) {
  try {
    const { userId, accessToken, channelId, channelTitle } = await request.json();
    if (!userId || !accessToken) {
      return NextResponse.json(
        { success: false, error: "userId and accessToken are required" },
        { status: 400 }
      );
    }

    const authError = await validateUserAccess(request, userId);
    if (authError) return authError;

    await connectPlatform(userId, "youtube", {
      tokenEncrypted: accessToken,
      tokenExpiry: new Date(Date.now() + 3600 * 1000).toISOString(),
      platformUserId: channelId || null,
      platformUsername: channelTitle || null,
      refreshToken: null,
    });

    return NextResponse.json({ success: true, data: { connected: true } });
  } catch (error) {
    console.error("YouTube connection error:", error);
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { userId } = await request.json();
    if (!userId) {
      return NextResponse.json(
        { success: false, error: "userId is required" },
        { status: 400 }
      );
    }

    const authError = await validateUserAccess(request, userId);
    if (authError) return authError;

    await disconnectPlatform(userId, "youtube");
    return NextResponse.json({ success: true, data: { connected: false } });
  } catch (error) {
    console.error("YouTube disconnection error:", error);
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}
