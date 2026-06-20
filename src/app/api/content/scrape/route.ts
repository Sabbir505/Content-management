import { NextRequest, NextResponse } from "next/server";
import { fetchSubstackPosts } from "@/lib/content/substack";
import { searchXTwitter } from "@/lib/content/x-twitter";
import { searchInstagram, fetchProfilePosts, fetchHashtagPosts } from "@/lib/content/instagram";
import { searchTikTok, fetchTikTokVideoMeta } from "@/lib/content/tiktok";
import { searchLinkedIn, fetchLinkedInPostEmbed } from "@/lib/content/linkedin";

/**
 * Platform-specific scrape endpoint.
 * GET /api/content/scrape?platform=substack&publication=lenny&limit=12
 * GET /api/content/scrape?platform=x&query=AI
 * GET /api/content/scrape?platform=instagram&hashtag=contentcreator
 * GET /api/content/scrape?platform=instagram&username=user123
 * GET /api/content/scrape?platform=tiktok&query=viral
 * GET /api/content/scrape?platform=tiktok&url=https://tiktok.com/...
 * GET /api/content/scrape?platform=linkedin&query=marketing
 * GET /api/content/scrape?platform=linkedin&url=https://linkedin.com/posts/...
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const platform = searchParams.get("platform");
    const query = searchParams.get("query");
    const publication = searchParams.get("publication");
    const hashtag = searchParams.get("hashtag");
    const username = searchParams.get("username");
    const url = searchParams.get("url");
    const limit = parseInt(searchParams.get("limit") || "12", 10);

    if (!platform) {
      return NextResponse.json(
        { success: false, error: "platform parameter is required (substack|x|instagram|tiktok|linkedin)" },
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

      case "x":
      case "twitter": {
        if (!query) {
          return NextResponse.json(
            { success: false, error: "query parameter required for X/Twitter search" },
            { status: 400 }
          );
        }
        const result = await searchXTwitter(query, limit);
        return NextResponse.json({ success: true, data: result.items, platform: "x" });
      }

      case "instagram": {
        if (username) {
          const posts = await fetchProfilePosts(username, limit);
          return NextResponse.json({ success: true, data: posts, platform: "instagram", username });
        }
        if (hashtag) {
          const posts = await fetchHashtagPosts(hashtag, limit);
          return NextResponse.json({ success: true, data: posts, platform: "instagram", hashtag });
        }
        if (query) {
          const result = await searchInstagram(query, limit);
          return NextResponse.json({ success: true, data: result.items, platform: "instagram" });
        }
        return NextResponse.json(
          { success: false, error: "username, hashtag, or query parameter required for Instagram" },
          { status: 400 }
        );
      }

      case "tiktok": {
        if (url) {
          const meta = await fetchTikTokVideoMeta(url);
          return NextResponse.json({ success: true, data: meta, platform: "tiktok" });
        }
        if (query) {
          const result = await searchTikTok(query, limit);
          return NextResponse.json({ success: true, data: result.items, platform: "tiktok" });
        }
        return NextResponse.json(
          { success: false, error: "url or query parameter required for TikTok" },
          { status: 400 }
        );
      }

      case "linkedin": {
        if (url) {
          const post = await fetchLinkedInPostEmbed(url);
          return NextResponse.json({ success: true, data: post, platform: "linkedin" });
        }
        if (query) {
          const result = await searchLinkedIn(query, limit);
          return NextResponse.json({ success: true, data: result.items, platform: "linkedin" });
        }
        return NextResponse.json(
          { success: false, error: "url or query parameter required for LinkedIn" },
          { status: 400 }
        );
      }

      default:
        return NextResponse.json(
          { success: false, error: `Unknown platform: ${platform}. Supported: substack, x, instagram, tiktok, linkedin` },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error("Scrape API error:", error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Scrape failed" },
      { status: 500 }
    );
  }
}
