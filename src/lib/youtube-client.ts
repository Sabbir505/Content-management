import { Innertube, UniversalCache } from "youtubei.js";

let client: Innertube | null = null;

export async function getYouTubeClient(): Promise<Innertube> {
  if (client) return client;

  client = await Innertube.create({
    cache: new UniversalCache(false),
  });

  return client;
}
