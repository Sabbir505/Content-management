import { Innertube, UniversalCache } from "youtubei.js";
import { getProxyUrl } from "./proxy";

let clientPromise: Promise<Innertube> | null = null;

const CLIENT_TIMEOUT_MS = 15000;

async function createProxiedFetch(): Promise<typeof fetch> {
  const proxyUrl = await getProxyUrl();
  if (!proxyUrl) return fetch;

  const { ProxyAgent, fetch: undiciFetch } = await import("undici");
  const dispatcher = new ProxyAgent({
    uri: proxyUrl,
    connectTimeout: 30000,
  });
  return (async (input: RequestInfo | URL, init?: RequestInit) => {
    let url: string;
    let options: RequestInit = {};

    if (typeof input === "string") {
      url = input;
    } else if (input instanceof URL) {
      url = input.toString();
    } else {
      // It's a Request object
      url = input.url;
      options = {
        method: input.method,
        headers: input.headers,
        body: input.body,
      };
    }

    // Merge init overrides
    if (init) {
      options = { ...options, ...init };
      // Headers need special merging
      if (init.headers) {
        const merged = new Headers(options.headers);
        const initHeaders = new Headers(init.headers);
        initHeaders.forEach((v, k) => merged.set(k, v));
        options.headers = merged;
      }
    }

    return undiciFetch(url, { ...options, dispatcher } as never) as unknown as Response;
  }) as typeof fetch;
}

export async function getYouTubeClient(): Promise<Innertube> {
  if (clientPromise) return clientPromise;

  clientPromise = (async () => {
    const customFetch = await createProxiedFetch();

    const client = await Promise.race([
      Innertube.create({
        cache: new UniversalCache(false),
        fetch: customFetch,
      }),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("YouTube client initialization timed out")), CLIENT_TIMEOUT_MS)
      ),
    ]);

    return client;
  })();

  try {
    const client = await clientPromise;
    return client;
  } catch (error) {
    clientPromise = null;
    throw error;
  }
}
