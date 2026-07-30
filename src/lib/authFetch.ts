import { auth } from "@/lib/firebase";

/**
 * fetch() wrapper that attaches a Firebase ID token as an
 * `Authorization: Bearer <token>` header. Required by API routes that
 * call validateUserAccess — being signed in via Firebase Auth does not
 * by itself attach a token to requests.
 *
 * Prefer passing the token explicitly from the user object returned by
 * useAuth (onAuthStateChanged), which is reliable. When no usable token is
 * provided, authFetch falls back to auth.currentUser.getIdToken(), which
 * may be null during auth initialization.
 */
export async function authFetch(
  input: string,
  init: RequestInit = {},
  token?: string | null
): Promise<Response> {
  let resolvedToken: string | null = null;

  if (typeof token === "string" && token.trim().length > 0) {
    resolvedToken = token;
  } else if (auth.currentUser) {
    resolvedToken = await auth.currentUser.getIdToken().catch(() => null);
  }

  const headers = new Headers(init.headers);
  if (resolvedToken) {
    headers.set("Authorization", `Bearer ${resolvedToken}`);
  }
  if (init.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  return fetch(input, { ...init, headers });
}
