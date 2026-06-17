import { Innertube, UniversalCache } from "youtubei.js";

let client: Innertube | null = null;

const CLIENT_TIMEOUT_MS = 15000;

export async function getYouTubeClient(): Promise<Innertube> {
  if (client) return client;

  client = await Promise.race([
    Innertube.create({
      cache: new UniversalCache(false),
    }),
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error("YouTube client initialization timed out")), CLIENT_TIMEOUT_MS)
    ),
  ]);

  return client;
}
