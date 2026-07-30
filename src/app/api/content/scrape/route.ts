import { NextRequest, NextResponse } from "next/server";
import { fetchSubstackPosts } from "@/lib/content/substack";

/**
 * Platform-specific scrape endpoint.
 * GET /api/content/scrape?platform=substack&publication=lenny&limit=12
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const platform = searchParams.get("platform");
    const publication = searchParams.get("publication");
    const limit = parseInt(searchParams.get("limit") || "12", 10);

    if (!platform) {
      return NextResponse.json(
        { success: false, error: "platform parameter is required (substack)" },
        { status: 400 }
      );
    }

    switch (platform) {
      case "substack": {
        if (!publication) {
          return NextResponse.json(
            { success: false, error: "publication parameter required for substack (e.g. lenny, platformer)" },
            { status: 400 }
          );
        }
        const posts = await fetchSubstackPosts(publication, limit);
        return NextResponse.json({ success: true, data: posts, platform: "substack", publication });
      }

      default:
        return NextResponse.json(
          { success: false, error: `Unknown platform: ${platform}. Supported: substack` },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error("Scrape API error:", error);
    return NextResponse.json(
      { success: false, error: "Scrape failed" },
      { status: 500 }
    );
  }
}
