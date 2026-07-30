import { cookies } from "next/headers";

function normalizeEndpoint(url: string, provider: string): string {
  const trimmed = url.trim().replace(/\/+$/, "");
  if (!trimmed) return "";
  // Anthropic uses /v1/messages, everyone else uses /v1/chat/completions (or /chat/completions)
  const expectedPath = provider === "anthropic" ? "/messages" : "/chat/completions";
  if (trimmed.endsWith(expectedPath)) return trimmed;
  // User entered a base URL without the path — append it
  if (provider === "anthropic") {
    return trimmed.endsWith("/v1") ? `${trimmed}/messages` : `${trimmed}/v1/messages`;
  }
  if (trimmed.endsWith("/v1")) return `${trimmed}/chat/completions`;
  return `${trimmed}/v1/chat/completions`;
}

async function getLlmConfig(): Promise<{ apiUrl: string; apiKey: string; model: string; provider: string }> {
  const cookieStore = await cookies();
  const configCookie = cookieStore.get("tubeforge_llm_config");
  if (configCookie?.value) {
    try {
      const config = JSON.parse(configCookie.value);
      if (config.apiKey && config.apiEndpoint) {
        const provider = config.provider || "kimi";
        return {
          apiUrl: normalizeEndpoint(config.apiEndpoint, provider),
          apiKey: config.apiKey,
          model: config.model || "DeepSeek-V4-Pro",
          provider,
        };
      }
    } catch {
      // malformed cookie — fall through to env defaults
    }
  }

  const fallbackEndpoint = process.env.KIMI_API_ENDPOINT || "https://ai2.18.show/v1/chat/completions";
  return {
    apiUrl: fallbackEndpoint,
    apiKey: process.env.KIMI_API_KEY || "",
    model: process.env.KIMI_MODEL || "DeepSeek-V4-Pro",
    provider: "kimi",
  };
}

export interface ApiMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface ApiResponse {
  choices: {
    message: {
      content: string;
    };
    finish_reason?: string;
  }[];
}

export interface VoiceProfileInput {
  hookStyle: string;
  sentenceLength: string;
  tone: string;
  vocabulary: string;
  humorLevel: string;
  ctaPattern: string;
  sampleSentences?: string[];
}

export interface CallLLMOptions {
  temperature?: number;
  maxTokens?: number;
  timeoutMs?: number;
  maxRetries?: number;
  emptyFallback?: string;
  throwOnTruncate?: boolean;
  useProxy?: boolean;
  /** Override the configured model for this call only. */
  model?: string;
}

const DEFAULT_OPTIONS: Required<Omit<CallLLMOptions, "useProxy" | "model">> = {
  temperature: 0.7,
  maxTokens: 2500,
  timeoutMs: 45000,
  maxRetries: 2,
  emptyFallback: "",
  throwOnTruncate: false,
};

async function resolveFetch(useProxy: boolean | undefined): Promise<typeof fetch> {
  if (useProxy !== true && process.env.KIMI_USE_PROXY !== "true") {
    return fetch;
  }
  const { getProxyUrl } = await import("../proxy");
  const proxyUrl = await getProxyUrl();
  if (!proxyUrl) return fetch;
  const { ProxyAgent, fetch: undiciFetch } = await import("undici");
  const dispatcher = new ProxyAgent({ uri: proxyUrl, connectTimeout: 30000 });
  return (async (input: RequestInfo | URL, init?: RequestInit) => {
    let url: string;
    let options: RequestInit = {};
    if (typeof input === "string") {
      url = input;
    } else if (input instanceof URL) {
      url = input.toString();
    } else {
      url = input.url;
      options = { method: input.method, headers: input.headers, body: input.body };
    }
    if (init) {
      options = { ...options, ...init };
      if (init.headers) {
        const merged = new Headers(options.headers);
        new Headers(init.headers).forEach((v, k) => merged.set(k, v));
        options.headers = merged;
      }
    }
    return undiciFetch(url, { ...options, dispatcher } as never) as unknown as Response;
  }) as typeof fetch;
}

export async function callLLM(
  messages: ApiMessage[],
  optionsOrTemperature?: CallLLMOptions | number
): Promise<string> {
  const opts: CallLLMOptions =
    typeof optionsOrTemperature === "number"
      ? { temperature: optionsOrTemperature }
      : optionsOrTemperature ?? {};

  const temperature = opts.temperature ?? DEFAULT_OPTIONS.temperature;
  const maxTokens = opts.maxTokens ?? DEFAULT_OPTIONS.maxTokens;
  const timeoutMs = opts.timeoutMs ?? DEFAULT_OPTIONS.timeoutMs;
  const maxRetries = opts.maxRetries ?? DEFAULT_OPTIONS.maxRetries;
  const emptyFallback = opts.emptyFallback ?? DEFAULT_OPTIONS.emptyFallback;
  const throwOnTruncate = opts.throwOnTruncate ?? DEFAULT_OPTIONS.throwOnTruncate;
  const useProxy = opts.useProxy;

  const { apiUrl, apiKey, model: configModel, provider } = await getLlmConfig();
  const model = opts.model || configModel;

  if (!apiKey) {
    throw new Error("KIMI_API_KEY not configured");
  }

  const isAnthropic = provider === "anthropic";

  const fetchFn = await resolveFetch(useProxy);
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      if (isAnthropic) {
        const systemMsg = messages.find((m) => m.role === "system");
        const nonSystem = messages.filter((m) => m.role !== "system");

        const body = {
          model,
          max_tokens: maxTokens,
          temperature,
          ...(systemMsg ? { system: systemMsg.content } : {}),
          messages: nonSystem.map((m) => ({
            role: m.role,
            content: m.content,
          })),
        };

        const response = await fetchFn(apiUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-api-key": apiKey,
            "anthropic-version": "2023-06-01",
          },
          body: JSON.stringify(body),
          signal: AbortSignal.timeout(timeoutMs),
        });

        if (!response.ok) {
          const errorText = await response.text().catch(() => "");
          throw new Error(`API error: ${response.status}${errorText ? ` - ${errorText}` : ""}`);
        }

        const anthropicContentType = response.headers.get("content-type") || "";
        if (!anthropicContentType.includes("application/json")) {
          const text = await response.text().catch(() => "");
          throw new Error(`Unexpected response type: ${text.slice(0, 300)}`);
        }

        const data: { content: { type: string; text: string }[]; stop_reason?: string } = await response.json();
        const text = data.content?.find((c) => c.type === "text")?.text || "";
        if (throwOnTruncate && data.stop_reason === "max_tokens") {
          throw new Error("Analysis response was truncated. The transcript or beats may be too long.");
        }
        return text || emptyFallback;
      }

      const response = await fetchFn(apiUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          messages,
          temperature,
          max_tokens: maxTokens,
        }),
        signal: AbortSignal.timeout(timeoutMs),
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => "");
        throw new Error(`API error: ${response.status}${errorText ? ` - ${errorText}` : ""}`);
      }

      const contentType = response.headers.get("content-type") || "";
      if (!contentType.includes("application/json")) {
        const text = await response.text().catch(() => "");
        throw new Error(`Unexpected response type: ${text.slice(0, 300)}`);
      }

      const data: ApiResponse = await response.json();
      const choice = data.choices[0];
      if (throwOnTruncate && choice?.finish_reason === "length") {
        throw new Error("Analysis response was truncated. The transcript or beats may be too long.");
      }
      return choice?.message?.content || emptyFallback;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      if (attempt < maxRetries) {
        await new Promise((resolve) => setTimeout(resolve, 1000 * (attempt + 1)));
      }
    }
  }

  throw lastError || new Error("LLM call failed after retries");
}

export function parseJsonResponse<T>(content: string, fallback: T): T {
  const cleanJson = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
  try {
    return JSON.parse(cleanJson);
  } catch {
    return fallback;
  }
}
