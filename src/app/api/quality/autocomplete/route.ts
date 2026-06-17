import { NextRequest, NextResponse } from "next/server";
import { fetchYouTubeAutocomplete } from "@/lib/quality/grounding/youtube-autocomplete";

export async function GET(request: NextRequest) {
  try {
    const query = request.nextUrl.searchParams.get("query");
    if (!query) {
      return NextResponse.json(
        { success: false, error: "query parameter is required" },
        { status: 400 }
      );
    }

    const data = await fetchYouTubeAutocomplete(query);
    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error("Autocomplete fetch error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch autocomplete data" },
      { status: 500 }
    );
  }
}
