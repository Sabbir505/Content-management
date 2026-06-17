import type { GroundingContext, OutputType, PlatformType } from "../types";
import { fetchGoogleTrends } from "./google-trends";
import { fetchYouTubeAutocomplete } from "./youtube-autocomplete";

export async function enrichGenerationContext(
  topic: string,
  niche: string,
  outputType: OutputType
): Promise<GroundingContext> {
  const [trendsData, autocompleteData] =
    await Promise.all([
      fetchGoogleTrends(topic).catch(() => null),
      fetchYouTubeAutocomplete(topic).catch(() => null),
    ]);

  return {
    trendsData,
    autocompleteData,
    hookPatterns: [],
    postPatterns: [],
  };
}
