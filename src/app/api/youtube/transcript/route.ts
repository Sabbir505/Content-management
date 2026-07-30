import { NextRequest, NextResponse } from "next/server";
import { YoutubeTranscript, YoutubeTranscriptError } from "youtube-transcript";
import { proxyFetch } from "@/lib/proxy";

export async function GET(request: NextRequest) {
  try {
    const videoId = request.nextUrl.searchParams.get("videoId");

    if (!videoId) {
      return NextResponse.json(
        { success: false, error: "videoId parameter is required" },
        { status: 400 }
      );
    }

    // Validate video ID format (11 characters, alphanumeric, -, _)
    const validIdRegex = /^[a-zA-Z0-9_-]{11}$/;
    if (!validIdRegex.test(videoId)) {
      return NextResponse.json(
        { success: false, error: "Invalid video ID format" },
        { status: 400 }
      );
    }

    const transcript = await YoutubeTranscript.fetchTranscript(videoId, {
      lang: "en",
      fetch: proxyFetch as typeof fetch,
    }).catch((error) => {
      // Re-throw typed errors so the outer handler can map them to the
      // right status (429/404); swallow only unexpected non-typed errors
      // so the route still returns an empty transcript rather than 500.
      if (error instanceof YoutubeTranscriptError) throw error;
      console.error("Transcript fetch failed:", error);
      return null;
    });

    if (!transcript || transcript.length === 0) {
      return NextResponse.json({
        success: true,
        data: {
          videoId,
          transcript: "",
          segments: [],
          wordCount: 0,
          segmentCount: 0,
        },
      });
    }

    // Join transcript segments into full text
    const fullText = transcript.map((segment) => segment.text).join(" ");

    // Also return segments for potential timestamp-based analysis
    return NextResponse.json({
      success: true,
      data: {
        videoId,
        transcript: fullText,
        segments: transcript.map((segment) => ({
          text: segment.text,
          offset: segment.offset,
          duration: segment.duration,
        })),
        wordCount: fullText.split(/\s+/).length,
        segmentCount: transcript.length,
      },
    });
  } catch (error) {
    console.error("Transcript fetch error:", error);

    if (error instanceof YoutubeTranscriptError) {
      const message = error.message.toLowerCase();

      if (message.includes("too many requests")) {
        return NextResponse.json(
          { success: false, error: "Rate limited by YouTube. Please try again in a moment." },
          { status: 429 }
        );
      }

      if (message.includes("unavailable")) {
        return NextResponse.json(
          { success: false, error: "This video is unavailable or private." },
          { status: 404 }
        );
      }

      if (message.includes("disabled")) {
        return NextResponse.json(
          { success: false, error: "Transcripts are disabled for this video." },
          { status: 404 }
        );
      }

      if (message.includes("not available")) {
        return NextResponse.json(
          { success: false, error: "No transcript available for this video." },
          { status: 404 }
        );
      }
    }

    return NextResponse.json(
      { success: false, error: "Failed to fetch transcript" },
      { status: 500 }
    );
  }
}
