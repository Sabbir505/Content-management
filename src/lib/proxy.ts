const isServer = typeof window === "undefined";

const COMMON_PROXY_PORTS = [7890, 7897, 1080, 10809, 8080, 8118];

async function checkPortActive(port: number): Promise<boolean> {
  if (!isServer) return false;

  try {
    const { createConnection } = await import("net");
    return new Promise((resolve) => {
      const socket = createConnection({ port, host: "127.0.0.1", timeout: 500 });
      let resolved = false;

      socket.on("connect", () => {
        resolved = true;
        socket.destroy();
        resolve(true);
      });

      socket.on("error", () => {
        if (!resolved) {
          resolved = true;
          resolve(false);
        }
      });

      socket.on("timeout", () => {
        if (!resolved) {
          resolved = true;
          socket.destroy();
          resolve(false);
        }
      });
    });
  } catch {
    return false;
  }
}

async function findActiveProxy(): Promise<string | undefined> {
  if (!isServer) return undefined;

  const envProxy =
    process.env.HTTPS_PROXY ||
    process.env.https_proxy ||
    process.env.HTTP_PROXY ||
    process.env.http_proxy;

  if (envProxy) return envProxy;

  const checks = COMMON_PROXY_PORTS.map(async (port) => {
    const active = await checkPortActive(port);
    return active ? `http://127.0.0.1:${port}` : null;
  });

  const results = await Promise.all(checks);
  return results.find((url) => url !== null) || undefined;
}

let cachedProxyUrl: string | undefined | null = null;
let proxyCacheTime = 0;
const PROXY_CACHE_TTL = 30000;

export async function getProxyUrl(): Promise<string | undefined> {
  const now = Date.now();
  if (cachedProxyUrl !== null && now - proxyCacheTime < PROXY_CACHE_TTL) {
    return cachedProxyUrl;
  }

  const url = await findActiveProxy();
  cachedProxyUrl = url;
  proxyCacheTime = now;
  return url;
}

export async function proxyFetch(url: string, init?: RequestInit & { timeout?: number }): Promise<Response> {
  const timeout = init?.timeout || 15000;

  if (!isServer) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);
    try {
      const response = await fetch(url, {
        ...init,
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      return response;
    } catch (error) {
      clearTimeout(timeoutId);
      if (error instanceof Error && error.name === "AbortError") {
        throw new Error(`Request timeout after ${timeout}ms`);
      }
      throw error;
    }
  }

  const proxyUrl = await getProxyUrl();
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const { ProxyAgent, fetch: undiciFetch } = await import("undici");

    if (proxyUrl) {
      const dispatcher = new ProxyAgent(proxyUrl);
      const response = await undiciFetch(url, {
        ...init,
        dispatcher,
        signal: controller.signal as any,
      } as any);
      clearTimeout(timeoutId);
      return response as unknown as Response;
    }

    const response = await undiciFetch(url, {
      ...init,
      signal: controller.signal as any,
    } as any);
    clearTimeout(timeoutId);
    return response as unknown as Response;
  } catch (error) {
    clearTimeout(timeoutId);
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error(`Request timeout after ${timeout}ms`);
    }
    throw error;
  }
}
