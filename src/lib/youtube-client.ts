import { Innertube, UniversalCache } from "youtubei.js";

let clientPromise: Promise<Innertube> | null = null;

const CLIENT_TIMEOUT_MS = 15000;

export async function getYouTubeClient(): Promise<Innertube> {
  if (clientPromise) return clientPromise;

  clientPromise = Promise.race([
    Innertube.create({
      cache: new UniversalCache(false),
    }),
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error("YouTube client initialization timed out")), CLIENT_TIMEOUT_MS)
    ),
  ]);

  try {
    const client = await clientPromise;
    return client;
  } catch (error) {
    clientPromise = null;
    throw error;
  }
}
