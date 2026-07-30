import { NextRequest, NextResponse } from "next/server";
import type { ZodSchema } from "zod";
import { cookies } from "next/headers";

interface ValidationSuccess<T> {
  success: true;
  data: T;
}

interface ValidationFailure {
  success: false;
  errorResponse: NextResponse<{ success: false; error: string }>;
}

type ValidationResult<T> = ValidationSuccess<T> | ValidationFailure;

export async function parseBody<T>(
  request: NextRequest,
  schema: ZodSchema<T>
): Promise<ValidationResult<T>> {
  const body = await request.json();
  const parsed = schema.safeParse(body);

  if (!parsed.success) {
    return {
      success: false,
      errorResponse: NextResponse.json(
        { success: false, error: parsed.error.issues.map((e) => e.message).join(", ") },
        { status: 400 }
      ),
    };
  }

  return { success: true, data: parsed.data };
}

/**
 * Guard against missing API keys. Returns an error Response if the key is missing,
 * or null if the key is configured and execution should continue.
 *
 * Checks client cookie first, then falls back to process.env.
 *
 * Usage:
 *   const guard = guardApiKey("KIMI_API_KEY");
 *   if (guard) return guard;
 */
export async function guardApiKey(
  keyOrName: string | undefined,
  name?: string
): Promise<NextResponse<{ success: false; error: string }> | null> {
  const envKey = name !== undefined ? keyOrName : process.env[keyOrName as string];
  const keyName = name ?? (keyOrName as string);

  // Only the LLM-config cookie may satisfy the guard — and only for the
  // LLM-related key checks. A generic cookie must never bypass a
  // server-only key like YOUTUBE_API_KEY.
  const isLlmKey = keyName === "KIMI_API_KEY" || keyName === "tubeforge_llm_config";
  if (isLlmKey) {
    const clientKey = await getClientApiKey();
    if (clientKey) return null;
  }

  if (!envKey) {
    console.error(`${keyName} is not set`);
    return NextResponse.json(
      { success: false, error: `${keyName} not configured` },
      { status: 500 }
    );
  }
  return null;
}

/** Read-only access to KIMI_API_KEY from environment. */
export const KIMI_API_KEY = process.env.KIMI_API_KEY;

export async function getClientApiKey(): Promise<string | null> {
  try {
    const cookieStore = await cookies();
    const configCookie = cookieStore.get("tubeforge_llm_config");
    if (configCookie?.value) {
      const config = JSON.parse(configCookie.value);
      return config.apiKey || null;
    }
  } catch {
    // cookies() unavailable
  }
  return null;
}
