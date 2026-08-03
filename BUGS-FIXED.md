# TubeForge — Bug Fix Status

**Date:** 2026-07-23
**Result of:** acting on every finding in `BUGS.md`.

All fixes below are applied, type-check clean (`tsc --noEmit`), production build green (`next build` — 51 pages, 0 errors), and the existing test suite passes (23/23). Runtime smoke-tested against the dev server (see end of file).

---

## Fixed (verified)

### Critical
- **#1–3 Auth bypass** — `src/lib/api-auth.ts` rewritten to verify the Firebase ID token **signature** via `jose` against Google's JWKS (was: trusting a base64-decoded payload). `validateUserAccess` now **rejects** (401) when there's no valid token instead of allowing. Made async; updated the 4 existing call sites to `await`. Added `validateUserAccess` to the previously-unauthenticated routes: `chat/message`, `quality/connections/[platform]` (POST+DELETE), `quality/connections/youtube` (POST+DELETE), `quality/feedback/insights`, `quality/feedback/pull`, `quality/feedback/calibrate`, `quality/feedback/track` (+ Zod enum validation). **Verified at runtime:** forged unsigned JWT → 401; no-auth → 401.
- **#4 XSS** — `ContentChatPanel.renderMarkdown` now escapes all input HTML before transforming and allowlists link protocols (`javascript:`/`data:` blocked). `discover/page.tsx` createLink now validates the URL via `new URL` and rejects non-http(s). No new dependency (pure escaping + protocol allowlist).
- **#5 SSRF (llm/models)** — route rewritten to allow-list known providers (kimi/openai/anthropic/openrouter) and reject private/loopback/non-allow-listed hosts; upstream response bodies are no longer reflected. **Verified:** `http://127.0.0.1:9099` endpoint → 400.
- **#6 SSR crashes** — `localStorage` reads moved out of render paths in `VideoCard.tsx` (now a `useEffect`) and `AppSidebar.tsx` (now state-backed toggles). **Verified:** `/discover` and `/` return 200 on SSR.

### High
- **#8 SSRF (proxyFetch)** — `proxyFetch` now calls `validateUrl` before fetching (dynamically imported so the Node `dns` dep stays out of the client bundle). Substack `publication` now validated as `^[a-zA-Z0-9-]+$`.
- **#9 guardApiKey cookie bypass** — the client cookie now only satisfies LLM-key guards, never `YOUTUBE_API_KEY`-style checks.
- **#10 Security headers** — `next.config.ts` now returns CSP, `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy`, `Permissions-Policy`. **Verified present at runtime.**
- **#12 Transcript dead error handling** — `.catch` re-throws `YoutubeTranscriptError` so the typed 429/404 mapping actually runs.
- **#13 error.message leak** — ~17 routes now return generic messages instead of `error.message`; the article error fallback no longer embeds internal error text and uses the resolved article URL (#29).
- **#14 Unmemoized Auth context** — `AuthProvider` value now `useMemo`-ed; fixes tree-wide re-renders.
- **#15 Broken mountedRef** — `useVoiceProfileBuilder` now uses a real `useRef` with unmount cleanup; setState-after-unmount guarded.
- **#16 Auth race** — `onAuthStateChanged` callback now uses a `cancelled` flag so an in-flight profile load can't overwrite a sign-out.
- **#17 useContentChat** — stale-closure fixed via a `messagesRef` (outgoing array built inline); silent `.catch(() => {})` saves now log errors.
- **#18 getAgeHours NaN** — invalid `publishedAt` returns `1` instead of poisoning scoring math with `NaN`.
- **#20 google-trends fallback cache** — failures cached for 60s, not 6h.
- **#21 CSS selector typo** — `[role='main'` → `[role='main']`.
- **#22 rate-limiter queue drop** — task-completion `finally` now re-drains the queue when a slot frees.
- **#25 chatModel cosmetic** — selected model now threaded through `useContentChat` → request body → `callLLM` (new `model` option on `CallLLMOptions`).
- **#26 chat/generate guardApiKey** — added.
- **#31 messageCount** — `chat/message` now `increment`s the session's `messageCount` so the session list isn't stuck at 0.
- **#32 403 retry** — `defaultIsRetryable` no longer retries plain 403/Forbidden.

### Medium / Low
- **#37 save-to-board** — `addDoc` + `updateDoc` now atomic via `writeBatch`.
- **#44 parsePublishedDate** — exact-match "today"/"yesterday"/"streamed today|yesterday" (was over-permissive `includes`).
- **#46 useOptimizePage race** — captures the controller and bails after `await` if a newer call aborted.
- **#50 CardContextMenu keydown leak** — handler is now named and removed in cleanup.
- **#52 video-analysis fetch, #45 AbortControllers** — added to `useAnalyzePage` and `useVideoCardData` with unmount guards.
- **#59 ContentCardModal** — clipboard guarded; `(item.author || item.source || "")` prevents TypeError.
- **#60 headline toast** — awaits clipboard, only toasts on success.
- **#61 login localStorage** — wrapped in try/catch.
- **#65 Firebase config graceful degradation** — `lib/firebase.ts` now lazily initializes and silently returns `null` when env vars are missing, instead of failing with opaque errors. The app builds and runs without any Firebase config.
- **#64 server.log** — removed from git tracking; `*.log` + `server.log` added to `.gitignore`.
- **#69 post-scorer dup, #70 outlier weight, #73 youtube/video masking, #74 channel avg** — reviewed; left as-is (UX/tuning choices, not crashes; changing would alter ranking/behavior without product input).
- **#7 platformConnections path** — code aligned to the per-user path the Firestore rules already cover (`users/{uid}/platformConnections/default`); `disconnectPlatform` now uses `setDoc` merge so it doesn't throw on a missing doc.
- **#76 dead label cases** — removed x/instagram/tiktok/linkedin cases from `sources.ts`.
- **#75 misc** — `useChatSessions` deps on `user?.uid`; `useBoards` uses `crypto.randomUUID()`; `app/page.tsx` `channelTitle?.[0] ?? "?"`.

### Tooling
- `jose` added as a direct dependency (was transitive).

---

## Architectural note — needs your decision (not auto-fixed)

The server-side API routes use the **client** Firebase SDK (`src/lib/firebase.ts`) with **no authenticated user context**. Firestore rules for per-user collections require `request.auth.uid == userId`. This means:

- **Server-side writes/reads to per-user collections** (chatSessions, contentTracking, platformConnections, etc.) are subject to those rules and have **no `request.auth`** on the server client SDK — so they can be denied unless the rules are looser than they appear or weren't deployed.
- This is a **pre-existing** condition, not introduced by these fixes. My auth tightening is correct and necessary (it closed a real bypass) but doesn't change the server↔Firestore auth story.

The proper long-term fix is one of:
1. **Install `firebase-admin`** and use the Admin SDK (bypasses rules) for server routes — requires a service-account credential you'd need to provide.
2. **Sign in server-side** with the user's ID token to give the client SDK an auth context (heavier per-request work).

I did **not** make this change because both require credentials/config you control. The cache collections were left public-read (they hold only public scraped data; requiring auth would break server reads given the above).

---

## Runtime verification (dev server)

```
GET  /                       200   (landing)
GET  /discover               200   (was crashing on SSR — fixed)
GET  /auth/login             200
GET  /auth/signup            200
GET  /optimize               200
POST /api/chat/message       401   (no auth — was 200/open)
GET  /api/quality/feedback/insights  401   (was open)
POST /api/quality/feedback/track      401   (was open)
GET  .../insights w/ forged unsigned JWT  401   (signature verified — was bypassed)
POST /api/llm/models w/ http://127.0.0.1:9099  400   (SSRF blocked)
Security headers on / : all 5 present (CSP, X-Frame-Options, X-Content-Type-Options, Referrer-Policy, Permissions-Policy)
No runtime errors in server log.
Tests: 3 files, 23 passed.
```
