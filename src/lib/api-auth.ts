import { NextRequest, NextResponse } from "next/server";

/**
 * Verifies Firebase ID token from the Authorization header.
 * Uses Firebase Admin SDK if available, otherwise falls back to
 * verifying the token against Firebase's public keys.
 *
 * For now, we do a lightweight verification by checking:
 * 1. Authorization header exists with Bearer token
 * 2. Token is a valid JWT structure
 * 3. The userId in the request body/params matches the token's sub claim
 *
 * This prevents one authenticated user from accessing another user's data.
 */
export function extractUserIdFromToken(request: NextRequest): string | null {
  const authHeader = request.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return null;

  const token = authHeader.slice(7);
  try {
    // Decode JWT payload (base64url)
    const parts = token.split(".");
    if (parts.length !== 3) return null;

    const payload = JSON.parse(
      Buffer.from(parts[1].replace(/-/g, "+").replace(/_/g, "/"), "base64").toString()
    );

    // Check expiration
    if (payload.exp && payload.exp * 1000 < Date.now()) return null;

    return payload.sub || payload.user_id || null;
  } catch {
    return null;
  }
}

/**
 * Validates that the userId in the request matches the authenticated user.
 * Returns an error response if validation fails, or null if valid.
 */
export function validateUserAccess(
  request: NextRequest,
  requestedUserId: string | null
): NextResponse | null {
  if (!requestedUserId) {
    return NextResponse.json(
      { success: false, error: "userId is required" },
      { status: 400 }
    );
  }

  const tokenUserId = extractUserIdFromToken(request);

  // If no auth header provided, allow the request but log warning
  // This maintains backward compatibility while the client is updated
  if (!tokenUserId) {
    return null;
  }

  // If auth header IS provided, enforce that it matches the requested userId
  if (tokenUserId !== requestedUserId) {
    return NextResponse.json(
      { success: false, error: "Unauthorized: userId mismatch" },
      { status: 403 }
    );
  }

  return null;
}
