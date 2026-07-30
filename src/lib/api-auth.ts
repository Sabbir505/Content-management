import { NextRequest, NextResponse } from "next/server";
import { createRemoteJWKSet, jwtVerify, decodeJwt, type JWTPayload } from "jose";

/**
 * Verifies a Firebase ID token from the Authorization header using the
 * Firebase public keys (JWKS). Signature is actually checked — we never
 * trust an unsigned/decoded payload.
 *
 * Firebase ID tokens are RS256-signed JWTs whose `sub` claim is the user's UID.
 * https://firebase.google.com/docs/auth/admin/verify-id-tokens
 */

const FIREBASE_JWKS = createRemoteJWKSet(
  new URL("https://www.googleapis.com/service_accounts/v1/metadata/x509/securetoken@system.gserviceaccount.com"),
  { timeoutDuration: 2500 }
);

// Cache verified tokens so we don't hit the JWKS endpoint on every request.
const tokenCache = new Map<string, { userId: string; expiresAt: number }>();
const TOKEN_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

// Development-only bypass for machines that cannot reach googleapis.com
// (restrictive VPN/firewall). Decodes tokens without signature verification —
// never enable outside local development.
const devBypassEnabled =
  process.env.NODE_ENV === "development" &&
  process.env.TUBEFORGE_DEV_AUTH_BYPASS === "true";

// Once the JWKS endpoint fails with a network error, skip it for a while
// instead of paying the fetch timeout on every request.
let jwksUnreachableUntil = 0;

function decodeUnverified(token: string): JWTPayload | null {
  try {
    return decodeJwt(token);
  } catch {
    return null;
  }
}

async function verifyIdToken(token: string): Promise<JWTPayload | null> {
  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || process.env.FIREBASE_PROJECT_ID;
  if (!projectId) return null;

  if (devBypassEnabled && Date.now() < jwksUnreachableUntil) {
    return decodeUnverified(token);
  }

  try {
    const { payload } = await jwtVerify(token, FIREBASE_JWKS, {
      issuer: `https://securetoken.google.com/${projectId}`,
      algorithms: ["RS256"],
    });

    return payload;
  } catch (error) {
    const isNetworkError =
      error instanceof Error &&
      (error.name === "JWKSTimeout" ||
        error.message.includes("fetch") ||
        error.message.includes("timed out") ||
        error.message.includes("timeout") ||
        error.message.includes("network") ||
        error.message.includes("ENOTFOUND") ||
        error.message.includes("ETIMEDOUT") ||
        error.message.includes("ECONNREFUSED") ||
        error.message.includes("ECONNRESET"));

    if (devBypassEnabled && isNetworkError) {
      jwksUnreachableUntil = Date.now() + TOKEN_CACHE_TTL_MS;
      console.warn("[dev] Auth verification bypassed for network error.");
      return decodeUnverified(token);
    }

    return null;
  }
}

/**
 * Extracts and verifies the authenticated user's UID from the Authorization
 * header. Returns null if there is no valid, unexpired, signed token.
 */
export async function extractUserIdFromToken(request: NextRequest): Promise<string | null> {
  const authHeader = request.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return null;

  const token = authHeader.slice(7).trim();
  if (!token) return null;

  const cached = tokenCache.get(token);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.userId;
  }

  const payload = await verifyIdToken(token);
  if (!payload) return null;

  if (payload.exp && payload.exp * 1000 < Date.now()) return null;

  const sub = payload.sub || payload.user_id;
  const userId = typeof sub === "string" ? sub : null;

  if (userId) {
    tokenCache.set(token, { userId, expiresAt: Date.now() + TOKEN_CACHE_TTL_MS });
  }

  return userId;
}

/**
 * Validates that the requesting user is authenticated and that the
 * `requestedUserId` matches the signed token's subject.
 *
 * Returns an error response on failure, or null when access is allowed.
 * A missing/invalid token is rejected (401) — no anonymous access.
 */
export async function validateUserAccess(
  request: NextRequest,
  requestedUserId: string | null
): Promise<NextResponse | null> {
  if (!requestedUserId) {
    return NextResponse.json(
      { success: false, error: "userId is required" },
      { status: 400 }
    );
  }

  const tokenUserId = await extractUserIdFromToken(request);

  if (!tokenUserId) {
    return NextResponse.json(
      { success: false, error: "Unauthorized" },
      { status: 401 }
    );
  }

  if (tokenUserId !== requestedUserId) {
    return NextResponse.json(
      { success: false, error: "Forbidden: user mismatch" },
      { status: 403 }
    );
  }

  return null;
}
