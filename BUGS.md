# TubeForge — Bug Hunt Report

**Date:** 2026-07-23
**Scope:** Full-codebase bug hunt across `src/app/api/**`, `src/lib/**`, `src/components/**`, `src/hooks/**`, `src/app/**/page.tsx`, and config (`next.config.ts`, `firestore.rules`, `package.json`, `firebase.ts`).
**Method:** Four parallel deep-review passes plus manual verification of the highest-impact findings.

Findings are grouped by severity. Each entry lists **file:line** — the defect — a concrete failure scenario — and a suggested fix. Severity reflects exploitability / user impact, not effort to fix.

---

## Critical

### 1. Auth bypass — `validateUserAccess` allows requests with no token
**File:** `src/lib/api-auth.ts:15-36, 57-59`
**Defect:** `extractUserIdFromToken` base64-decodes the JWT payload and trusts the `sub` claim **without verifying the signature**. Worse, `validateUserAccess` returns `null` (allow) when no `Authorization` header is present.
**Failure scenario:** An attacker omits the auth header and calls `GET /api/chat/session?userId=VICTIM&sessionId=X`, or forges a JWT with the victim's `uid`, and reads/writes any user's Firestore data via every route using this guard.
**Fix:** Initialize `firebase-admin` server-side, use `admin.auth().verifyIdToken(token)`, and **reject** (401) requests with no valid token instead of allowing them.

### 2. Unauthenticated write route — `chat/message`
**File:** `src/app/api/chat/message/route.ts:6-53`
**Defect:** POST writes to `users/{userId}/chatSessions/{sessionId}/messages` with **no auth call at all** (not even the broken `validateUserAccess`).
**Failure scenario:** A fully unauthenticated caller writes arbitrary messages into any user's chat session by supplying `userId`, `sessionId`, and `message` in the body. Chains with the XSS below for stored XSS.
**Fix:** Add `validateUserAccess(request, userId)` and require a verified token.

### 3. More unauthenticated routes (quality/feedback, connections)
**Files:**
- `src/app/api/quality/connections/[platform]/route.ts:11-57` (POST + DELETE)
- `src/app/api/quality/connections/youtube/route.ts:4-45`
- `src/app/api/quality/feedback/insights/route.ts:7-56` (GET)
- `src/app/api/quality/feedback/pull/route.ts:4-20` (POST — expensive, denial-of-wallet)
- `src/app/api/quality/feedback/calibrate/route.ts:4-31` (POST — mutates weights)
- `src/app/api/quality/feedback/track/route.ts:4-35` (POST — no validation of `platform`/`contentType`)

**Defect:** None of these call `validateUserAccess`.
**Failure scenario:** Anyone connects/disconnects platforms (X/Instagram/Facebook/YouTube) for any user, injects attacker-chosen access tokens, reads tracked content + correlations + calibration weights, triggers costly metric pulls, or mutates stored weights.
**Fix:** Add `validateUserAccess(request, userId)` (post-fix-#1) to all of these; for `track` add a Zod enum for `platform`/`contentType`.

### 4. Stored XSS — hand-rolled markdown renderer + `dangerouslySetInnerHTML`
**File:** `src/components/discover/ContentChatPanel.tsx:13-32, 280`
**Defect:** `renderMarkdown` is a regex→HTML converter with **no escaping and no sanitization** (DOMPurify isn't even a dependency), and its output goes to `dangerouslySetInnerHTML`. The link regex injects an attacker-controlled `href` (`href="$2"`) with no protocol allowlist.
**Failure scenario:** LLM output / a stored chat message containing `<img src=x onerror=...>`, `<script>`, or `[click](javascript:alert(1))` executes in any viewer's session. Violates the project's own security rule ("Sanitize HTML… use DOMPurify").
**Fix:** Add `dompurify` and run the rendered HTML through `DOMPurify.sanitize(html)`; also escape text before inserting into attribute values, and allowlist `http(s):` for link hrefs. (Also relevant: `src/app/discover/page.tsx:550` — `prompt()` URL fed to `document.execCommand("createLink")` with no validation, then saved to Firestore as innerHTML at line 159.)

### 5. SSRF + response reflection — `llm/models`
**File:** `src/app/api/llm/models/route.ts:69-83`
**Defect:** `endpoint` and `apiKey` are user-supplied; the server does `fetch(${baseUrl}/models)` and reflects up to 200 chars of the response body back plus the upstream status.
**Failure scenario:** Attacker sets `endpoint: "http://169.254.169.254/latest/meta-data"` or `http://localhost:9099` (emulator) to probe internal services and exfiltrate response bodies/status codes. They also control the `Authorization: Bearer ${apiKey}` header, enabling credential exfiltration to attacker-controlled endpoints.
**Fix:** Allow-list provider domains, never fetch an arbitrary `endpoint`, and never reflect upstream response bodies.

### 6. SSR crashes — `localStorage` accessed during render on client components
**Files:**
- `src/components/discover/VideoCard.tsx:106-115` — `localStorage.getItem("tubeforge_bookmarks")` inside a `useState` initializer, no `typeof window` guard.
- `src/components/AppSidebar.tsx:509, 511, 527, 529` — `localStorage.getItem(...)` inline in `className` strings during render.

**Defect:** Both components are `"use client"` and are rendered by `discover/page.tsx` (`"use client"`). Next.js App Router still server-renders client components for the initial HTML, and `localStorage` is `undefined` on the server.
**Failure scenario:** First SSR pass for `/discover` (and the home page via `AppSidebar`) throws `ReferenceError: localStorage is not defined`, crashing the entire route's SSR.
**Fix:** Wrap in `if (typeof window === "undefined") return <default>;` or move these reads into a `useEffect` + `useState` mounted pattern.

---

## High

### 7. Plaintext OAuth tokens despite `tokenEncrypted` field name
**File:** `src/lib/quality/feedback/platform-connections.ts:118-137`
**Defect:** `getConnectionToken` returns `conn.tokenEncrypted` directly and `connectPlatform` stores `connectionData.tokenEncrypted` verbatim — no encryption performed.
**Failure scenario:** Anyone with Firestore read access (or a rules misconfiguration) exfiltrates live YouTube/X/Instagram/Facebook access tokens and impersonates users on those platforms.
**Fix:** Encrypt tokens server-side with a KMS/key before writing and decrypt on read; or rename the field and rely on Firestore rules + restricted admin access.

### 8. SSRF — `proxyFetch` performs no URL validation
**File:** `src/lib/proxy.ts:99-181`
**Defect:** `validateUrl` exists in `url-validation.ts` and is used by the article route, but `proxyFetch` (used by every scraper) never calls it.
**Failure scenario:** A scraper that interpolates user input into a URL (e.g. Substack `publication`) can be pointed at `http://169.254.169.254/...` or `http://127.0.0.1:PORT`; the server fetches internal services and returns the body.
**Fix:** Call `validateUrl` at the top of `proxyFetch` and reject private/loopback hosts.

### 9. `guardApiKey` treats the client cookie as a valid key
**File:** `src/lib/api-helpers.ts:47-66`
**Defect:** The "guard against missing API key" check returns `null` (pass) whenever a client sends the `tubeforge_llm_config` cookie, regardless of whether the server has a real key configured.
**Failure scenario:** A client sets an arbitrary `tubeforge_llm_config` cookie and bypasses every `guardApiKey` check (including `YOUTUBE_API_KEY`-style guards), even when no server key exists.
**Fix:** Only accept the cookie bypass when `name` is the LLM-config key; don't let a generic cookie satisfy a `YOUTUBE_API_KEY` guard.

### 10. Missing security headers in `next.config.ts`
**File:** `next.config.ts:3-11`
**Defect:** No `headers()` / security headers configured. Combined with the `dangerouslySetInnerHTML` XSS, there's no browser-side mitigation.
**Fix:** Add a `headers()` function returning at minimum `Content-Security-Policy` (`default-src 'self'`), `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`.

### 11. Public cache reads in Firestore rules
**File:** `firestore.rules:62-83`
**Defect:** `youtubeSearchCache`, `contentSearchCache`, `qualityTrendsCache`, `qualityAutocompleteCache` allow `read: if true` with no field validation or path constraints.
**Failure scenario:** An unauthenticated attacker enumerates cache doc IDs and exfiltrates cached content (scraped article bodies, search results, metadata).
**Fix:** Tighten to `allow read: if request.auth != null` if per-user, or keep public only for genuinely public data and add `request.resource.keys()` field-allowlists on write.

### 12. Dead error handling in transcript route
**File:** `src/app/api/youtube/transcript/route.ts:25-31`
**Defect:** The `.catch` on `YoutubeTranscript.fetchTranscript` converts every error to `null`, so the `instanceof YoutubeTranscriptError` checks (rate-limit 429, unavailable 404, disabled 404) are unreachable.
**Failure scenario:** A rate-limited or caption-disabled video returns `200 success` with an empty transcript instead of `429`/`404`; the client can't tell "no captions" from "rate limited" and retries pointlessly.
**Fix:** Remove the `.catch` (let it throw into the outer try/catch) or handle the typed error inside it.

### 13. Information disclosure — `error.message` returned to client across ~17 routes
**Files:** `api/analyze/route.ts:184`, `api/generate/video-analysis/route.ts:215`, `api/chat/headline-variations/route.ts:71`, `api/content/scrape/route.ts:43`, `api/content/search/route.ts:85`, `api/content/last30days/route.ts:28`, `api/creators/[creatorId]/videos/route.ts:131`, `api/generate/script/route.ts:323`, `api/youtube/channel-videos/route.ts:144`, `api/youtube/channel/route.ts:60`, `api/youtube/connect/route.ts:55`, `api/youtube/search/route.ts:70`, `api/youtube/video/route.ts:91`, `api/chat/session/route.ts:64,150`, `api/chat/message/route.ts:49`, `api/chat/generate/route.ts:186`, `api/llm/models/route.ts:94`.
**Defect:** Routes return `Response.json({ success: false, error: error.message })`, leaking internal hostnames, key-missing messages, or stack details to the browser (violates project rule "Never expose stack traces or internal details to the client").
**Fix:** Return a generic `error: "Internal server error"` to the client; keep details server-side only.

### 14. Unmemoized Auth context value → tree-wide re-renders
**File:** `src/components/auth-provider.tsx:49`
**Defect:** `AuthContext.Provider value` is a fresh object literal every render.
**Failure scenario:** Every `useAuth()` consumer (`useVoiceProfile`, `useConnectChannel`, `useContentChat`, `useChatSessions`, `Navbar`, `AppSidebar`) re-renders on any provider re-render.
**Fix:** `const value = useMemo(() => ({ user, profile, isLoading, isAuthenticated: !!user }), [user, profile, isLoading]);`

### 15. Broken `mountedRef` in `useVoiceProfileBuilder` — dead unmount guard
**File:** `src/hooks/useVoiceProfileBuilder.ts:66, 69, 74`
**Defect:** `const mountedRef = { current: true };` is a brand-new object per call; nothing ever sets `current` to `false`, so the unmount guards are dead code.
**Failure scenario:** If the user navigates away mid-analysis (600ms/step × 4 steps + Firestore writes), `setFingerprint`/`setVersions`/`setCurrentVersion` fire on an unmounted component.
**Fix:** Hoist `const mountedRef = useRef(true)` to the hook body, add a cleanup effect that sets it `false` on unmount.

### 16. Auth race — stale profile after sign-out
**File:** `src/components/auth-provider.tsx:27-46`
**Defect:** In-flight `createOrUpdateUserProfile` can resolve after sign-out, leaving `user: null` but `profile: {...}`. `isAuthenticated` is false but `profile` is truthy → downstream `profile.xxx` checks behave inconsistently. The `unsubscribe` cleanup doesn't cancel the promise.
**Fix:** Use a request-id / `cancelled` flag captured in the callback; only `setProfile` if still current.

### 17. Stale-closure + silent save failures in `useContentChat`
**File:** `src/hooks/useContentChat.ts:280-285, 266-271, 300-306`
**Defect:** (a) `messages` read in `handleSendMessage`'s closure excludes the just-queued user message (rapid double-send loses the first in the outgoing payload). (b) The user/assistant message saves to `/api/chat/message` are fire-and-forget with `.catch(() => {})` — failures are completely silent.
**Failure scenario:** Server down or 500 → the UI shows a successful chat, but on reload the messages are gone with no toast/retry.
**Fix:** Build the outgoing array inline as `[...messages, userMessage]`; at minimum `console.error` + `toast.error("Failed to save message")`, ideally `await` the persists.

### 18. `getAgeHours` returns `NaN` for invalid `publishedAt`, poisoning scoring math
**File:** `src/lib/discovery-score.ts:30-34`
**Defect:** `Math.max((now - NaN)/..., 0.01)` = `NaN` (`Math.max` with `NaN` yields `NaN`), and unlike `safeNumber` the result is not sanitized here.
**Failure scenario:** A video with empty/garbage `publishedAt` gets `ageHours = NaN`; `calculateVelocityScore` and `calculateContentDiscoveryScore` compute `normalizedScore/NaN` → `NaN` → `safeNumber` returns 0, silently dropping the video's score to the popularity/recency floor (~15).
**Fix:** `const published = new Date(publishedAt).getTime(); if (!Number.isFinite(published)) return 1;` at the top.

### 19. Module-global scorer version breaks per-user isolation
**File:** `src/lib/quality/version.ts:4-12` (called by `calibration.ts:62`)
**Defect:** `currentVersion` is a process-wide singleton; `incrementScorerVersion()` bumps the global for ALL users/requests.
**Failure scenario:** User A calibrates (global → v2); user B's next `stampScore` stamps v2 even though B's weights are still v1 — `scorerVersion` no longer reflects the weights used, breaking the correlation/calibration audit trail.
**Fix:** Store the version per-user in Firestore (alongside `ScorerWeights.version`) and pass it into `stampScore`.

### 20. Empty fallback cached with full TTL — Google Trends
**File:** `src/lib/quality/grounding/google-trends.ts:96-101`
**Defect:** On Python-script failure, `getFallbackResult(keyword)` (all zeros, `searchScore: 0`) is cached under the same key with the full 6h TTL.
**Failure scenario:** A transient timeout/network blip makes every trends lookup for that keyword return empty for 6 hours, even after the script recovers.
**Fix:** Cache fallbacks with a short TTL (e.g. 60s) or don't cache failures.

### 21. Broken CSS selector silently returns null
**File:** `src/lib/content/article-extraction.ts:55-61`
**Defect:** The selector is `"[role='main'"` — missing the closing `]`. `querySelector` returns `null` for an invalid selector.
**Failure scenario:** Articles using `role="main"` (very common ARIA pattern) skip the correct container and fall back to `document.body`, pulling nav/footer/sidebar text into extracted content.
**Fix:** `doc.querySelector("[role='main']")`.

### 22. Rate-limiter drops queued tasks
**File:** `src/lib/rate-limiter.ts:91-139`
**Defect:** When a task finishes in the `finally` block (lines 126-129), it decrements `activeRequests` but never calls `processQueue(source)`. When `maxConcurrent` is reached the loop `break`s and sets `processing=false`; nothing re-drains the queue after a task completes.
**Failure scenario:** Queue has 5 tasks, `maxConcurrent=1`; task 1 runs, tasks 2-5 wait. Task 1 finishes, active → 0, but nothing re-processes the queue — tasks 2-5 hang until another `execute()` call happens to re-trigger `processQueue`.
**Fix:** Call `this.processQueue(source)` in the `finally` block.

### 23. YouTube Analytics query: hardcoded date range + no timeout
**File:** `src/lib/quality/feedback/performance-puller.ts:19-24`
**Defect:** `startDate=2024-01-01, endDate=2099-12-31` excludes pre-2024 data and produces wrong lifetime totals; the `fetch` has no `AbortSignal`/timeout, so a hung endpoint blocks the serial `pullAllDueMetrics` loop indefinitely.
**Fix:** Derive `startDate` from `entry.publishedAt`; add `AbortSignal.timeout(30000)`.

### 24. Serial N×3 Firestore reads + serial API calls in `pullAllDueMetrics`
**File:** `src/lib/quality/feedback/performance-puller.ts:100-152`
**Defect:** Outer + inner `for` loops both `await` serially; a user with 50 tracked pieces triggers 150 sequential `getDocs` + up to 150 sequential `fetch` calls.
**Failure scenario:** Exceeds serverless function timeouts before completing; metrics permanently un-pulled for later entries.
**Fix:** `Promise.all` with bounded concurrency; batch the existing-snapshot checks.

### 25. `chatModel` picker is cosmetic — never sent to the API
**File:** `src/components/discover/ContentChatPanel.tsx:96-117, 145-188` (and `useContentChat.ts:276-285`)
**Defect:** `chatModel` state is set on pick and initialized from `getSavedLlmConfig()`, but is never threaded into `useContentChat` and never appears in the `/api/chat/generate` body.
**Failure scenario:** Users who pick a model see it highlighted, but every request uses the server default.
**Fix:** Thread `chatModel` into `useContentChat` and include `model: chatModel` in the request body.

### 26. `chat/generate` route skips `guardApiKey`
**File:** `src/app/api/chat/generate/route.ts:109-189`
**Defect:** Unlike sibling `generate/*` routes, this one never calls `guardApiKey("KIMI_API_KEY")`.
**Fix:** Add `guardApiKey("KIMI_API_KEY")` at the top of POST.

### 27. Unauthenticated onboarding → silent Firestore write failures
**File:** `src/app/onboarding/page.tsx:38, 89-93`
**Defect:** No `isLoading`/`isAuthenticated` guard; `catch (error) { console.error(...) }` swallows write failures — `setIsLoading(false)` runs in `finally` but no toast/UI error is shown.
**Failure scenario:** An unauthenticated user lands on `/onboarding` (direct URL), fills the form, clicks Complete, and only then sees a "you must be signed in" toast; or a write failure silently does nothing with no explanation.
**Fix:** Check `isLoading`/`isAuthenticated` and redirect to login; `toast.error("Failed to save onboarding. Please try again.")` in the catch.

### 28. Email-signup onboarding skip race
**File:** `src/app/auth/signup/page.tsx:23-27 vs 36`
**Defect:** The `useEffect` redirects to `/discover` when `user` becomes truthy; `handleEmailSignUp` also calls `router.push("/onboarding")`. If the auth-state effect fires between the await resolving and the explicit push, the effect wins and routes to `/discover`, skipping onboarding for email-signup users.
**Fix:** Don't auto-redirect on `user` alone — check an `onboardingComplete` flag (as the Google path does), or remove the effect and route explicitly in the handlers.

---

## Medium

### 29. Wrong URL returned in `content/article` error fallback
**File:** `src/app/api/content/article/route.ts:166`
**Defect:** On failure the response data uses `url: request.url` (the API route URL), not the requested article URL.
**Fix:** Use the original `url` param (resolved to `resolvedUrl` where available).

### 30. `chat/session` + `chat/message` `Promise.race` timeout doesn't cancel the Firestore write
**Files:** `api/chat/session/route.ts:52-58`, `api/chat/message/route.ts:31-43`
**Defect:** On timeout the route returns success without persisting, while the dangling `setDoc` keeps running and may later fail silently.
**Fix:** Use an `AbortSignal`/transaction or report persistence failure rather than masking it.

### 31. Inconsistent / never-incremented `messageCount`
**File:** `api/chat/session/route.ts:118 vs 142`
**Defect:** Single-session GET computes `messages.length`; list GET returns the stored `data.messageCount`, which is never incremented (the `chat/message` route doesn't update it).
**Failure scenario:** Session list shows `messageCount: 0` forever while the session has many messages.
**Fix:** Increment `messageCount` when saving a message, or always compute from the messages collection.

### 32. `defaultIsRetryable` retries 403/Forbidden
**File:** `src/lib/rate-limiter.ts:184-204`
**Defect:** Retrying a true 403 (invalid key, IP ban) wastes quota and delays surfacing the real error (~4× latency for every request that will never succeed).
**Fix:** Don't retry 403 unless the message explicitly indicates a temporary ban.

### 33. `fetchHackerNewsStories` fires `limit` parallel unthrottled requests
**File:** `src/lib/content/hackernews.ts:33-42`
**Defect:** `Promise.all` fans out 20–50 concurrent requests to the HN Firebase API; the `hackernews` rate-limit config (`maxConcurrent: 5`) is never applied to the inner fan-out.
**Fix:** Chunk item fetches through `rateLimiter.execute("hackernews", ...)`.

### 34. Channel-stats fan-out has no concurrency cap / retry
**File:** `src/lib/youtube-scraper.ts:269-273`
**Defect:** `Promise.allSettled` over 30–50 unique channels, each hitting YouTube through `proxyFetch`; `executeWithRetry("youtube", ...)` wraps only the outer search, not these inner fetches.
**Failure scenario:** 50 concurrent channel fetches trigger YouTube bot detection / 429 / IP ban.
**Fix:** Wrap each `fetchChannelStatsScrape` in `rateLimiter.execute("youtube", ...)` with bounded concurrency.

### 35. `ytInitialData` regex is non-greedy and truncates large JSON
**File:** `src/lib/youtube-scraper.ts:62, 128, 339, 397`
**Defect:** `({.*?});</script>` uses `.*?` (lazy), stopping at the first `};</script>`-like sequence; `JSON.parse` then throws (caught → returns null/empty).
**Failure scenario:** A slight YouTube HTML change truncates the JSON and the scraper silently returns zero videos.
**Fix:** Use a balanced-brace parser or a more robust greedy pattern up to `;\s*</script>`.

### 36. Substack `publication` interpolated into URL without validation
**File:** `src/lib/content/substack.ts:34-39`
**Defect:** `https://${publication}.substack.com/api/v1/archive?...` — a malformed `publication` (e.g. `evil.com/path#`) produces an unexpected/attacker-controlled URL.
**Fix:** Validate `publication` is `^[a-zA-Z0-9-]+$` before interpolation.

### 37. Non-atomic `addDoc` + `updateDoc` in `save-to-board`
**File:** `src/lib/discovery/save-to-board.ts:9-28, 36-51`
**Defect:** If `addDoc` succeeds but `updateDoc` (incrementing `itemCount`) fails, the board's `itemCount` is permanently out of sync.
**Fix:** Use a Firestore `writeBatch`, or recompute `itemCount` from a count query.

### 38. Client-side filtering instead of server-side `where` in `content-tracker`
**File:** `src/lib/quality/feedback/content-tracker.ts:33-37, 58-66`
**Defect:** `orderBy("generationDate","desc")` only; `platform`/`contentType`/`hasPublishedUrl` filters are applied client-side after fetching the entire user's history.
**Fix:** Add `where` clauses for the indexed filters server-side.

### 39. N+1 sequential Firestore reads in `correlation-engine`
**File:** `src/lib/quality/feedback/correlation-engine.ts:28-55`
**Defect:** A separate `getDocs` per tracked entry, serially; 50 entries → 50 sequential queries before any correlation is computed.
**Fix:** Batch-query or use a single `in` query on `trackingEntryId`.

### 40. SEO scorer's `primaryKeyword` is never passed → inflated scores
**File:** `src/lib/quality/scorers/seo-scorer.ts:30-33` (and `scorer-registry.ts:12-16`)
**Defect:** `scoreSEO` accepts `primaryKeyword`, but the registry calls `scoreSEO(output, context.trendsData || null)` — `primaryKeyword` is always `undefined`, so the keyword-position checks always take the "no keyword → full points" branch.
**Failure scenario:** SEO scores are inflated for everyone.
**Fix:** Thread `primaryKeyword` through `ScoringContext`.

### 41. Unbounded `limit` parsing in content routes
**Files:** `api/content/scrape/route.ts:13`, `api/content/search/route.ts:43`
**Defect:** `parseInt("abc")` → `NaN` (scrape passes NaN to `fetchSubstackPosts`); search guards NaN but allows negative/huge values (e.g. `limit=1000000`).
**Fix:** Clamp to `[1, 50]`.

### 42. `extractChannelId` returns handles as channel IDs
**File:** `api/creators/route.ts:99-115`
**Defect:** For `youtube.com/@name`, `c/name`, `user/name` the function returns the handle; `fetchChannelFromDataApi` then calls `channels?...&id=<handle>`, which returns no items.
**Failure scenario:** Pasting `https://youtube.com/@MrBeast` fails to track even though the channel exists.
**Fix:** Use `resolveChannelId`, or call `channels?...&forHandle=`/`&forUsername=`.

### 43. `regenerate-auto` route has no Zod validation
**File:** `api/quality/regenerate-auto/route.ts:11-23`
**Defect:** `score` cast `as ...` without validation; a malformed `score.breakdown` (missing keys/non-array `suggestions`) reaches `buildRegenerationPrompt` and may crash.
**Fix:** Add a Zod schema mirroring the expected shape.

### 44. `parsePublishedDate` substring-matches "today"/"yesterday"
**File:** `src/lib/youtube-parsers.ts:15-19`
**Defect:** `lower.includes("today")` matches any text containing "today"; the `=== "today"` exact-match is shadowed by the `||` `includes`.
**Fix:** Use exact match.

### 45. Missing `AbortController` / unmount guards across hooks
**Files:** `hooks/useAnalyzePage.ts:26-76, 78-88`, `hooks/useChannelData.ts:38-197`, `hooks/useCreatorSearch.ts:51-69, 71-105`, `hooks/useVideoCardData.ts:28-42`, `hooks/useWorkspaceBoard.ts:62-130`, `hooks/useBoardCardOps.ts` (migration), `app/discover/creators/[channelId]/page.tsx:28-57`, `app/discover/lists/[listId]/page.tsx:21-44`, `app/settings/performance/page.tsx:20-68`, `components/discover/ListContentGrid.tsx:107-110`.
**Defect:** Manual `fetch` calls without abort/unmount guards; setState fires after unmount or after the underlying resource changed (race → stale-overwrite). `useBoardCardOps` migration is non-atomic with no `writeBatch` and never deletes the legacy `items` collection.
**Fix:** Add an `AbortController` per effect run (pass `signal` to `fetch`, abort in cleanup) + a `cancelled` flag checked before setState; make the migration atomic with `writeBatch`.

### 46. `useOptimizePage` race — abort doesn't cancel post-`await` state sets
**File:** `src/hooks/useOptimizePage.ts:99-102, 121-128`
**Defect:** Aborting the previous controller doesn't cancel the chain after `await response.json()` resolves; `setSeoPackage`/`setScoredOutput` overwrite the newer call's results with stale data.
**Fix:** After `await response.json()`, check `if (controller.signal.aborted) return;` before setting state.

### 47. Render-phase `setState` in `discover/page.tsx`
**File:** `src/app/discover/page.tsx:259-262`
**Defect:** `setLastFetchKey` / `setDisplayCount(24)` run during render on every `userId`/`fetchKey` change, including the auth-bootstrap transition from `undefined` → real uid; initial fetch may fire twice, and `displayCount` resets when `selectedCategory` changes mid-scroll, discarding "load more" progress.
**Fix:** Move into a `useEffect` keyed on `fetchKey`, or use a `useRef` for the previous key.

### 48. `IntersectionObserver` recreated on loading-flag changes
**File:** `src/app/discover/page.tsx:292-303`
**Defect:** Effect deps `[isLoadingMore, isLoadingVideos, isLoadingContent]` tear down + recreate the observer each time any flips; the `setTimeout(...,300)` caps load-more to one batch every 300ms and can miss the sentinel on fast scroll, stalling infinite scroll.
**Fix:** Stable `useCallback` handler + sentinel-only dep array, or a `disabled` flag.

### 49. ContentEditable editor loads blank
**File:** `src/app/discover/page.tsx:139-144`
**Defect:** `editorRef.current.innerHTML = editingCard.content` runs in a `useEffect` keyed on `[editingCard]`, but the editor div isn't mounted until `editingCard` is truthy; in some timing the effect runs before the DOM commits, so content never loads.
**Fix:** Use `useLayoutEffect` keyed on `editingCard` plus a sentinel, or set initial content via `dangerouslySetInnerHTML` on first mount.

### 50. `keydown` listener never removed in `CardContextMenu`
**File:** `src/components/discover/CardContextMenu.tsx:33-40`
**Defect:** The `keydown` handler is an anonymous inline passed to `addEventListener` and never removed in cleanup; a new listener accumulates each open/close cycle → Escape fires `onClose` N times.
**Fix:** Hoist to a named const and `removeEventListener` in cleanup.

### 51. Outside-click listener attached unconditionally
**File:** `src/app/discover/page.tsx:240-253`
**Defect:** No `if (!showFilters) return;` before `document.addEventListener`; the listener is always attached for the component's lifetime.
**Fix:** Early-return when `showFilters` is false.

### 52. `.docx` read as text + no `onerror` / size limit
**File:** `src/app/voice/page.tsx:317-329`
**Defect:** `.docx` is a binary ZIP-based format; `readAsText` feeds the LLM binary noise. If the read fails, `onload` never fires and the UI hangs with no feedback.
**Fix:** Reject `.docx` or use mammoth.js; only `readAsText` for `.txt`/`.csv`; add `reader.onerror` and a size guard.

### 53. `useChannelAnalyticsState` Set mutation doesn't re-render
**File:** `src/hooks/useChannelAnalyticsState.ts:57-72`
**Defect:** `setCompareSelection(prev.add(id))` mutates the same Set reference → React sees no change → compare checkbox doesn't update.
**Fix:** Always create a new Set (`new Set(prev)`), or expose a `toggleCompare(id)` helper.

### 54. React Query hooks ignore the `signal` parameter
**Files:** `hooks/usePerformanceInsights.ts`, `usePlatformConnections.ts`, `useGoogleTrends.ts`, `useYouTubeAutocomplete.ts`
**Defect:** `queryFn` ignores the v5 `signal`; on rapid changes the last-resolved (not last-started) fetch wins → stale data.
**Fix:** `queryFn: ({ signal }) => fetch(..., { signal })`.

### 55. `useDiscoverData` leaks abort listeners
**File:** `src/hooks/useDiscoverData.ts:119-123`
**Defect:** `abortSignal.addEventListener("abort", onAbort, { once: true })` never removes the listener on normal completion (it only auto-removes if it fires).
**Fix:** `abortSignal.removeEventListener("abort", onAbort)` in a `finally`.

### 56. `ListContentGrid` refetches cached creators
**File:** `src/components/discover/ListContentGrid.tsx:78-91`
**Defect:** The fetch loop iterates `listCreators` (all) instead of `creatorsToFetch` (uncached only); cached creators are refetched every time.
**Fix:** Iterate `creatorsToFetch` in the `Promise.all`.

### 57. `useVideoBoost` auto-fetch retries indefinitely on failure
**File:** `components/channel/ChannelVideoDetailModal.tsx:234-254` + `hooks/useVideoBoost.ts:104-111`
**Defect:** Effect deps include `fetchAnalysisInternal` (recreated each render via `channelStats`); on a failed fetch, `videoAnalysis` stays `null`, `isAnalyzing` returns to `false`, and the effect re-fires on the next parent re-render, retrying forever.
**Fix:** Add an "attempted" ref/flag, or drop `fetchAnalysisInternal`/`videoAnalysis` from deps and use a ref.

### 58. `useConnectChannel.refreshChannel` silently swallows token-expired failures
**File:** `src/hooks/useConnectChannel.ts:189-193, 197-202`
**Defect:** `catch {}` swallows with no logging; `getGoogleAccessToken` (which validates) is only called from `connectChannel`, not `refreshChannel`; the user sees stale stats with no indication.
**Fix:** On failure call `getGoogleAccessToken` to re-auth, or log + surface a toast.

### 59. `ContentCardModal` — clipboard and null-access crashes
**Files:** `src/components/discover/ContentCardModal.tsx:153` (clipboard), `:101` (author/source `.toLowerCase()`)
**Defect:** `navigator.clipboard.writeText` with no try/catch (non-secure context / permissions → unhandled rejection); `(item.author || item.source).toLowerCase()` throws if both are falsy.
**Fix:** Guard `if (navigator.clipboard)` + try/catch with `toast.error`; `(item.author || item.source || "").toLowerCase()`.

### 60. Headline copy shows success toast before the promise resolves
**File:** `src/components/discover/ContentChatPanel.tsx:319`
**Defect:** `toast.success("Copied headline")` fires before `navigator.clipboard.writeText` resolves; shows success even if the write rejected.
**Fix:** `await` the promise; toast only on success, `toast.error` on failure.

### 61. `google_access_token` set without try/catch
**File:** `src/app/auth/login/page.tsx:44`
**Defect:** In private-browsing modes or when storage is full/disabled, `localStorage.setItem` throws, propagates to `catch`, and shows "Failed to sign in with Google" even though sign-in succeeded.
**Fix:** Wrap in `try { localStorage.setItem(...) } catch {}`.

### 62. "Clear All Local Data" with no confirmation
**File:** `src/components/AppSidebar.tsx:548-553`
**Defect:** `localStorage.clear()` wipes ALL keys (including non-tubeforge keys if the origin is shared) with no confirm dialog.
**Fix:** Confirm before clearing; clear only tubeforge-prefixed keys if the origin is shared.

### 63. Inconsistent default model for the Kimi endpoint
**Files:** `src/lib/openrouter.ts:24` (`"Kimi-K2.6"`) vs `src/lib/generation/llm.ts:41` (`"DeepSeek-V4-Pro"`)
**Defect:** Two code paths default the *same* Kimi endpoint/fallback to different models; one path may request a model the endpoint doesn't serve.
**Fix:** Use one canonical default for the Kimi endpoint across both files.

---

## Low

### 64. `server.log` committed to git
**File:** `server.log` (git-tracked, not in `.gitignore`)
**Defect:** Log files routinely contain secrets, stack traces, internal URLs.
**Fix:** Add `server.log` and `*.log` to `.gitignore`; `git rm --cached server.log`.

### 65. Firebase config silently falls back to empty strings
**File:** `src/lib/firebase.ts:7-13`
**Defect:** Missing env vars silently produce `""`; `initializeApp` runs with empty `apiKey`/`projectId`/`appId` and fails at the first auth/db call with opaque errors.
**Fix:** Validate required keys at module load and throw a descriptive message.

### 66. Scraper packages in `dependencies` instead of `devDependencies`; no `engines`
**File:** `package.json:20-37`
**Defect:** `playwright`, `puppeteer-extra`, `scrape-youtube`, etc. bloat production installs and trigger browser downloads on every prod `npm install`; no `engines` field (Next 16 / React 19 need Node 18.18+). No `typecheck`/`test` scripts.
**Fix:** Move scraping tooling to `devDependencies`; add `"engines": { "node": ">=18.18" }`; add typecheck/test scripts.

### 67. Article regex can't match nested divs
**File:** `src/lib/content/article-extractor.ts:13` / `src/lib/analyze-structure/article-pipeline.ts:23-26`
**Defect:** `<div class="...article...">[\s\S]*?</div>` stops at the first `</div>`, truncating any container with nested divs (extremely common). The DOMParser path is correct; the regex path runs server-side and is the vulnerable one.
**Fix:** Use a tag-aware parser.

### 68. `transcript.ts extractHook` index check is misleading
**File:** `src/lib/transcript.ts:30`
**Defect:** Guards with `sentences.length > 0` but indexes `sentences[1]`; only safe due to the `||` fallback.
**Fix:** `sentences.length > 1 && !/[.!?]$/.test(sentences[1])`.

### 69. `post-scorer` duplicates issues across `breakdown` and `suggestions`
**File:** `src/lib/quality/scorers/post-scorer.ts:22-37`
**Defect:** Each issue appears in both `breakdown[category].issues` and the top-level `suggestions`; UIs rendering both show every issue twice.
**Fix:** Drop the flattening or render only one.

### 70. Outlier weight saturates too early
**File:** `src/lib/discovery-score.ts:137`
**Defect:** `outlierWeight = Math.min(effectiveOutlier / 50, 1)` — a 5× outlier gets only `5/50 = 0.1`; genuinely viral 10× videos score barely higher than average, defeating the outlier signal.
**Fix:** Recalibrate the divisor (e.g. `/10`).

### 71. `channel-analytics.exportToCSV` mixes browser-only code with a `toast` import
**File:** `src/lib/channel-analytics.ts:225-248`
**Defect:** Uses `URL.createObjectURL` / `document.createElement` at module scope that also imports `toast` from sonner; a server-component import would throw.
**Fix:** Move CSV export to a client-only utility or guard with `typeof document !== "undefined"`.

### 72. `disconnectPlatform` uses `updateDoc` without existence check
**File:** `src/lib/quality/feedback/platform-connections.ts:107-116`
**Defect:** `updateDoc` throws `no-document-to-update` if the doc doesn't exist.
**Fix:** `setDoc` with merge, or check existence first.

### 73. `youtube/video` masks network errors as empty success
**File:** `src/app/api/youtube/video/route.ts:26-29`
**Defect:** `.catch` on `proxyFetch` returns `null`, then the route returns `200 success` with an empty video object; clients can't distinguish "not found" from "network error".
**Fix:** Surface the error appropriately.

### 74. `creators/[creatorId]/videos` channel-average uses lifetime views
**File:** `src/app/api/creators/[creatorId]/videos/route.ts:88`
**Defect:** `channelAvgViews = totalViews / totalVideos` uses lifetime totals, over-weighting old viral videos; outlier scores computed against this baseline are skewed low for recent videos.
**Fix:** Use a recent-video average.

### 75. Various small React issues
- `hooks/useVideoBoost.ts:46-50` — `JSON.parse(cached)` in render-phase reset can throw; catch leaves `videoAnalysis` as the prior video's value → set `null` and `removeItem` in catch.
- `hooks/useBoards.ts:53` — `boardId = Date.now().toString()` collides within the same ms; use `crypto.randomUUID()`.
- `components/discover/DiscoverContentGrid.tsx:42,73,96` — mixed list `key` is `item.id`/`video.id`; if ids collide across content types, React reuses the wrong instance → `key={`${item.contentType}-${item.id}`}`.
- `components/quality/ScoreSuggestions.tsx:18`, `components/quality/CorrelationInsight.tsx:22` — array index `i` as `key` for LLM-derived lists that can change between renders → use a stable id.
- `app/page.tsx:227` — `creator.channelTitle[0]` renders nothing for empty titles → `creator.channelTitle?.[0] ?? "?"`.
- `app/dashboard/page.tsx:43` — `if (deletingId) return;` blocks concurrent deletes globally → use a `Set<string>` of deleting ids.
- `components/discover/FilterDropdown.tsx:396-399` — Clear button condition `selectedTimePeriod !== "3months"` but reset target `"all"` → change to `!== "all"`.
- `components/discover/ContentCardModal.tsx:39-46` & `VideoCardModal.tsx:44-51` — `<a download>` ignored cross-origin → fetch as blob + object URL.
- `components/AppSidebar.tsx:159` — `hidden md:flex` sidebar leaves no nav on mobile → add a mobile drawer.
- `components/ErrorBoundary.tsx:41-46` — "Try again" clears error state but doesn't re-mount children → same error re-throws; reset on route change.
- `components/channel/ChannelVideoCard.tsx:80-82` — `selectedVideo`/`onFixVideo` declared but never destructured → "Fix" action never fires from the table.
- `components/AppSidebar.tsx:693-703` — nested `<span onClick>` inside `<button>`; invalid nesting + redundant `stopPropagation`.

### 76. Dead label cases for deleted platforms
**File:** `src/lib/content/sources.ts`
**Defect:** Still lists icon/label cases for `x`, `instagram`, `tiktok`, `linkedin` (their source modules were deleted). Not broken imports (there's a `default` fallback), just dead label cases.
**Fix:** Remove the dead cases or restore the sources.

### 77. `YOUTUBE_API_KEY` lacks a server-only marker
**File:** `src/lib/youtube-api.ts:3`
**Defect:** `export const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY || process.env.NEXT_PUBLIC_YOUTUBE_API_KEY;` — if any client component imports it, the key lands in the client bundle.
**Fix:** Add a `// server-only` marker or move behind a server-only entry.

---

## Verified clean (no defects)

- **Dangling imports of deleted modules:** searched `src/**` for `board/BoardCanvas`, `board/CardContextMenu`, `chat/ChatPanel`, `creators/CreatorFeed`, `creators/CreatorList`, `content/googlenews`, `content/reddit`, `content/instagram`, `content/tiktok`, `content/x-twitter`, `content/linkedin`, the `boards`/`creators` pages, and the deleted API routes (`api/boards/**`, `api/quality/connections/{facebook,instagram,x}`). **No remaining imports found.** The `src/lib/content/index.ts` barrel correctly references only `hackernews`, `devto`, `substack`.
- Hooks: `useQualityScore.ts`, `useYouTubeSearch.ts` (exemplary `signal` use), `useBlocklistSync.ts`, `useCardState.ts`, `useCategories.ts`, `useLocalCreators.ts`, `useLocalCreatorLists.ts`, `useDiscoverFilters.ts`, `useHomePage.ts` (localStorage calls are inside `useEffect` — client-only).
- Pages: `analyze/page.tsx`, `optimize/page.tsx`, `channel/page.tsx` (trivial Suspense wrappers).
- `outlier.ts` guards division by zero; `HOOK_PATTERNS` regexes are stateless (no `g` flag); `blocklist.ts`/`llm-config.ts` JSON.parse calls are try/catch-guarded with `typeof window` checks.

---

## Top-priority fix order

1. **#1 + #2 + #3** — Close the auth bypass (`validateUserAccess` must reject, not allow, when there's no verified token) and add `validateUserAccess` to the quality/feedback, quality/connections, and chat/message routes that currently have none. Trivially exploitable today.
2. **#4** — `dangerouslySetInnerHTML` without DOMPurify in `ContentChatPanel.tsx`; chains with #2 for stored XSS.
3. **#5** — Eliminate the SSRF in `llm/models` by allow-listing provider endpoints.
4. **#6** — SSR crashes from `localStorage` in render (`VideoCard.tsx`, `AppSidebar.tsx`) — entire routes fail first paint.
5. **#7 + #8** — Encrypt OAuth tokens; validate URLs in `proxyFetch` (SSRF).
6. **#10** — Security headers in `next.config.ts` (no mitigation layer for the XSS above).
7. **#13** — Stop returning `error.message` to clients across ~17 routes.
8. **#64** — Remove `server.log` from git tracking.

---

*Generated by a full-force parallel bug hunt: 4 deep-review agents (API routes, lib, React/components/hooks, config/types/security) + manual verification of the highest-impact findings.*
