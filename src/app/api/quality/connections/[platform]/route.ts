import { NextRequest, NextResponse } from "next/server";
import { connectPlatform, disconnectPlatform } from "@/lib/quality/feedback/platform-connections";
import { validateUserAccess } from "@/lib/api-auth";

const VALID_PLATFORMS = ["x", "instagram", "facebook"] as const;
type Platform = (typeof VALID_PLATFORMS)[number];

function isValidPlatform(p: string): p is Platform {
  return VALID_PLATFORMS.includes(p as Platform);
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ platform: string }> }) {
  const { platform } = await params;
  if (!isValidPlatform(platform)) {
    return NextResponse.json({ success: false, error: `Unsupported platform: ${platform}` }, { status: 400 });
  }

  try {
    const { userId, accessToken, username } = await request.json();
    if (!userId || !accessToken) {
      return NextResponse.json(
        { success: false, error: "userId and accessToken are required" },
        { status: 400 }
      );
    }

    const authError = await validateUserAccess(request, userId);
    if (authError) return authError;

    await connectPlatform(userId, platform, {
      tokenEncrypted: accessToken,
      tokenExpiry: null,
      platformUserId: null,
      platformUsername: username || null,
      refreshToken: null,
    });

    return NextResponse.json({ success: true, data: { connected: true } });
  } catch (error) {
    console.error(`${platform} connection error:`, error);
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ platform: string }> }) {
  const { platform } = await params;
  if (!isValidPlatform(platform)) {
    return NextResponse.json({ success: false, error: `Unsupported platform: ${platform}` }, { status: 400 });
  }

  try {
    const { userId } = await request.json();
    if (!userId) {
      return NextResponse.json({ success: false, error: "userId is required" }, { status: 400 });
    }
    const authError = await validateUserAccess(request, userId);
    if (authError) return authError;
    await disconnectPlatform(userId, platform);
    return NextResponse.json({ success: true, data: { connected: false } });
  } catch {
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}
