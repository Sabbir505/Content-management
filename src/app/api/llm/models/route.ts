import { z } from "zod";
import { NextRequest, NextResponse } from "next/server";

const fetchModelsSchema = z.object({
  provider: z.string(),
  apiKey: z.string().min(1),
  endpoint: z.string().optional(),
});

interface ModelsResponse {
  success: boolean;
  data?: { id: string }[];
  error?: string;
}

const ANTHROPIC_MODELS = [
  { id: "claude-sonnet-4-20250514" },
  { id: "claude-opus-4-20250514" },
  { id: "claude-3-5-sonnet-20241022" },
  { id: "claude-3-5-haiku-20241022" },
  { id: "claude-3-opus-20240229" },
  { id: "claude-3-haiku-20240307" },
];

// Allow-listed providers. Only these hosts may be fetched server-side.
const ALLOWED_PROVIDERS: Record<string, string> = {
  kimi: "https://ai2.18.show",
  openai: "https://api.openai.com",
  anthropic: "https://api.anthropic.com",
  openrouter: "https://openrouter.ai",
};

function resolveBaseUrl(provider: string, endpoint?: string): string | null {
  const allowed = ALLOWED_PROVIDERS[provider];
  if (!allowed) return null;

  if (!endpoint) return allowed;

  let parsed: URL;
  try {
    parsed = new URL(endpoint);
  } catch {
    return null;
  }

  // Reject anything that isn't https, isn't the allow-listed host,
  // or resolves to a private/loopback address (defence in depth).
  if (parsed.protocol !== "https:") return null;
  const host = parsed.hostname.toLowerCase();
  const allowedHost = new URL(allowed).hostname.toLowerCase();
  if (host !== allowedHost && !host.endsWith(`.${allowedHost}`)) return null;
  if (isPrivateHost(host)) return null;

  return `${parsed.protocol}//${parsed.host}${parsed.pathname.replace(/\/+$/, "").replace(/\/(chat\/completions|messages)\/?$/, "")}`;
}

function isPrivateHost(host: string): boolean {
  if (host === "localhost" || host === "127.0.0.1" || host === "::1") return true;
  if (host.endsWith(".local") || host.endsWith(".internal")) return true;
  if (host.startsWith("10.") || host.startsWith("192.168.")) return true;
  if (/^172\.(1[6-9]|2\d|3[01])\./.test(host)) return true;
  if (host.startsWith("169.254.")) return true;
  return false;
}

// OpenAI-compatible providers expose models at /v1/models, not /api/models.
const OPENAI_COMPATIBLE_PROVIDERS = new Set(["kimi", "openai", "openrouter"]);

export async function POST(request: NextRequest): Promise<NextResponse<ModelsResponse>> {
  try {
    const body = await request.json();
    const parsed = fetchModelsSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: parsed.error.issues.map((e) => e.message).join(", ") },
        { status: 400 },
      );
    }

    const { provider, apiKey, endpoint } = parsed.data;

    if (provider === "anthropic") {
      const baseUrl = resolveBaseUrl("anthropic", endpoint);
      if (baseUrl) {
        try {
          const response = await fetch(`${baseUrl}/v1/models`, {
            headers: {
              "x-api-key": apiKey,
              "anthropic-version": "2023-06-01",
              "Content-Type": "application/json",
            },
            signal: AbortSignal.timeout(15000),
          });
          if (response.ok) {
            const data: { data?: { id: string }[] } = await response.json();
            const models = (data.data || []).filter((m) => m.id).sort((a, b) => a.id.localeCompare(b.id));
            if (models.length > 0) {
              return NextResponse.json({ success: true, data: models });
            }
          }
        } catch {
          // fall through to hardcoded list
        }
      }
      return NextResponse.json({ success: true, data: ANTHROPIC_MODELS });
    }

    const baseUrl = resolveBaseUrl(provider, endpoint);
    if (!baseUrl) {
      return NextResponse.json(
        { success: false, error: "Unsupported or disallowed provider endpoint" },
        { status: 400 },
      );
    }

    const modelsPath = OPENAI_COMPATIBLE_PROVIDERS.has(provider) ? "/models" : "/api/models";
    const response = await fetch(`${baseUrl}${modelsPath}`, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      signal: AbortSignal.timeout(15000),
    });

    if (!response.ok) {
      // Surface only the status — never the upstream response body.
      return NextResponse.json(
        { success: false, error: `Failed to fetch models (status ${response.status})` },
        { status: 502 },
      );
    }

    const data: { data?: { id: string }[] } = await response.json();
    const models = (data.data || [])
      .filter((m) => m.id)
      .sort((a, b) => a.id.localeCompare(b.id));

    return NextResponse.json({ success: true, data: models });
  } catch (error) {
    console.error("Failed to fetch models:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 },
    );
  }
}
