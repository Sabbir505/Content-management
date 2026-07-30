# TubeForge Project Audit Report

> **⚠️ Point-in-time report — most findings are now resolved.**
> This was a snapshot audit. Many items listed below have since been fixed; see
> `BUGS-FIXED.md` for the verified fix status. Specifically, the issues flagged
> here that are **no longer accurate** include:
> - **#3** (` Tier` onboarding typo) — the field is now `tier: "starter"` (no
>   leading space) in `src/app/onboarding/page.tsx`.
> - **#4 / #5 / #13** (fragile `parseInt(selectedOutlier)`, platform/source
>   mismatch, dead filter logic) — filtering moved to
>   `src/hooks/useDiscoverFilters.ts`; outlier min now uses an explicit
>   `getOutlierMin()` map in `src/lib/discovery/time-periods.ts`, and
>   platform→source mapping uses `platformsToSources()`.
> - **#7** (Boards API client-SDK auth) — the `/api/boards/**` routes this
>   referred to were deleted; board data now lives in the discover workspace.
>
> Read the sections below as historical context, not current state. For the
> current security/auth posture, see `BUGS-FIXED.md`.

## Summary

The project builds successfully (`next build` passes with no TypeScript errors). However, there are several bugs, logical issues, code quality problems, and dead code across the codebase.

---

## CRITICAL Issues

### 1. Unused Imports in `src/lib/generation/llm.ts` (Dead Code / Bundle Bloat)
- **File:** `src/lib/generation/llm.ts:1-5`
- **Issue:** Imports `NextRequest`, `NextResponse` from `next/server`, `evaluateAndDeliver`, and `enrichGenerationContext` — none of which are used in this file. These are server-only imports being pulled into a library module.
- **Impact:** Potential bundle confusion and dead code. The `z` import and `NextRequest`/`NextResponse` suggest this file was copy-pasted from a route handler.
- **Fix:** Remove unused imports (lines 1-5 except the type imports actually needed).

### 2. `getFirebaseAuthErrorMessage` is Exported but Never Used Anywhere
- **File:** `src/hooks/useAuth.ts:13-39`
- **Issue:** The helper function `getFirebaseAuthErrorMessage` is defined and exported but never called in any login/signup page. Both `auth/login/page.tsx` and `auth/signup/page.tsx` just display `err.message` directly instead of the user-friendly version.
- **Impact:** Users see raw Firebase error messages like `"Firebase: Error (auth/invalid-credential)"` instead of clean messages.
- **Fix:** Import and use `getFirebaseAuthErrorMessage` in login and signup catch blocks.

---

## HIGH Severity Issues

### 3. Onboarding Field Typo — ` Tier` with Leading Space
- **File:** `src/app/onboarding/page.tsx:82`
- **Issue:** `Tier: "starter"` has a leading space before "Tier", making the Firestore field name ` Tier` (with space) instead of `tier`.
- **Impact:** Data inconsistency — any code querying for `tier` will never find this field. Also breaks any tier-checking logic.
- **Fix:** Change to `tier: "starter"` (lowercase, no leading space).

### 4. Filter Outlier Parsing Bug — `parseInt("10x")` Returns `10`, but `parseInt("any")` Returns `NaN`
- **File:** `src/app/discover/page.tsx:758-760`
- **Issue:** The outlier filter does `parseInt(selectedOutlier)`. When `selectedOutlier` is `"10x"`, `parseInt` returns `10`. When it's `"3x"`, it returns `3`. This works by accident. However, if the outlier IDs were changed (e.g., `"10×"` with Unicode ×), it would break silently.
- **Impact:** Fragile logic relying on `parseInt` accidentally working with format `"3x"`, `"5x"`, etc. Not a current bug, but a ticking time bomb.
- **Fix:** Use explicit mapping: `{ "3x": 3, "5x": 5, "10x": 10, "20x": 20 }`.

### 5. Platform Filter for Articles Does Not Map to Actual Content Sources
- **File:** `src/app/discover/page.tsx:806`
- **Issue:** `filtered.filter((item) => selectedPlatforms.includes(item.source))` — content items have sources like `"hackernews"`, `"reddit"`, `"devto"`, `"googlenews"`, but `selectedPlatforms` contains `"twitter"`, `"youtube"`, `"substack"`, `"instagram"`, `"tiktok"`, `"linkedin"`. These **never match**, so articles are always filtered to empty when platform filtering is applied.
- **Impact:** Articles will never show when any platform filter is active (which is always, since all 6 are selected by default). The only reason articles show currently is that `selectedPlatforms` includes all 6 by default and the filter passes through items whose source is NOT in the platforms list... wait, no — it requires `includes`, so **all articles are filtered out**.
- **Fix:** Either map content sources to platform IDs, or exempt articles from platform filtering, or add the actual content sources as filterable platforms.

### 6. `fetchInProgressRef` Race Condition
- **File:** `src/app/discover/page.tsx:179, 262, 513, 561`
- **Issue:** `fetchInProgressRef.current` is set to `true` in the useEffect and reset to `false` in both `fetchVideos` and `fetchContent` `finally` blocks independently. Since both run in parallel, whichever finishes first resets the ref, allowing a new fetch to start before the other completes.
- **Impact:** The guard `if (fetchInProgressRef.current) return;` is unreliable. Rapid state changes (switching categories quickly) can trigger overlapping fetches.
- **Fix:** Use a counter or track both fetches independently.

### 7. Boards API Uses Firebase Admin SDK from Client-Side `db` Export
- **File:** `src/app/api/boards/[boardId]/cards/route.ts:2`
- **Issue:** The API route imports `db` from `@/lib/firebase` which uses `getFirestore()` from the client SDK. API routes in Next.js run on the server. While this technically works for read/write operations, it means the API routes are **not using Firebase Admin SDK** and therefore have **no server-side auth verification** — anyone who knows the userId can read/write any user's data.
- **Impact:** Security vulnerability — no auth checks on any API route. Any request with a valid `userId` param can access/modify that user's data.
- **Fix:** Add Firebase Admin SDK initialization and verify the user's auth token in API routes, or move board operations fully client-side.

---

## MEDIUM Severity Issues

### 8. Signup Redirects to Onboarding Even for Existing Google Users
- **File:** `src/app/auth/signup/page.tsx:49-50`
- **Issue:** `handleGoogleSignUp` always routes to `/onboarding` after Google sign-in, even if the user already completed onboarding previously. The login page routes to `/discover`.
- **Impact:** Existing users who accidentally use the signup page's Google button get sent back to onboarding.
- **Fix:** Check if onboarding is complete (e.g., check Firestore profile) before routing.

### 9. useEffect Dependency Array Warning — Changing Size Between Renders
- **File:** `src/app/discover/page.tsx` (confirmed in browser console)
- **Issue:** Console error: "The final argument passed to useEffect changed size between renders." This means a useEffect dependency array has a conditional number of items.
- **Impact:** React may skip or double-fire effects unpredictably.
- **Fix:** Audit all useEffects in DiscoverPageContent and ensure dependency arrays have consistent length.

### 10. `VideoCard` Makes Individual API Calls for Each Channel Thumbnail
- **File:** `src/components/discover/VideoCard.tsx:34`
- **Issue:** Every video card independently fetches `/api/youtube/channel?channelId=...` for channel thumbnails. With 20+ cards on screen, this creates 20+ concurrent API requests on each page load.
- **Impact:** Performance degradation, potential rate limiting, slow page load.
- **Fix:** Batch channel thumbnails in a single API call, or fetch them server-side during the search and include in results.

### 11. `localStorage` Access Without SSR Guard in `VideoCard`
- **File:** `src/components/discover/VideoCard.tsx:28`
- **Issue:** `localStorage.getItem(...)` is called directly inside a `useEffect`, which is fine for CSR. However, the component doesn't check if `typeof window !== 'undefined'`. This is technically safe in useEffect but the pattern should be consistent with the rest of the codebase which checks.
- **Impact:** Low — works because useEffect only runs client-side.

### 12. Onboarding Missing Validation — User Can Complete Without Selecting Anything
- **File:** `src/app/onboarding/page.tsx:46-51`
- **Issue:** `handleNext()` advances steps without checking if the user selected a creator type (step 1), niches (step 2), or platforms (step 3). The "Next" button is always enabled.
- **Impact:** Users can submit empty onboarding data to Firestore.
- **Fix:** Disable "Next" button or show validation when no selection is made.

### 13. Content Sources Mismatch Between `ContentItem.source` Type and Actual API
- **File:** `src/types/content.ts:5`
- **Issue:** `source` is typed as `"hackernews" | "reddit" | "devto" | "googlenews"` but the filter dropdown shows "X/Twitter", "YouTube", "Substack", "Instagram", "TikTok", "LinkedIn". There's a complete disconnect between what the filter UI suggests and what content sources actually exist.
- **Impact:** Users think they can filter articles by platform, but the real sources are HN/Reddit/DevTo/GoogleNews.

### 14. `handleRetry` Uses `searchQuery` Which May Be Empty
- **File:** `src/app/discover/page.tsx:713`
- **Issue:** `const query = selectedCategory !== "All" ? selectedCategory : searchQuery || "trending"` — if `selectedCategory` is "All" and `searchQuery` is empty, it falls back to "trending". But the initial fetch logic (line 264-275) uses a combined categories query. So retry doesn't reproduce the same behavior as initial load.
- **Impact:** "Refresh" button may fetch different/narrower results than the initial page load.

### 15. Home Page `loadData` Missing Dependency in useEffect
- **File:** `src/app/page.tsx:47-51`
- **Issue:** `useEffect(() => { if (user) { loadData(); } }, [user])` — React warns about missing `loadData` dependency. While `loadData` is stable (it's a function declaration), the ESLint exhaustive-deps rule would flag this.
- **Impact:** Minor — function is stable so no actual bug, but could break if `loadData` ever uses closure variables that change.

---

## LOW Severity Issues

### 16. Dead Import: `z` from "zod" in `llm.ts`
- **File:** `src/lib/generation/llm.ts:1`
- **Issue:** `z` imported from zod but never used in this file.
- **Impact:** Dead code, minor bundle size increase.

### 17. `useConnectChannel` Hook Fetches on Error Silently
- **File:** `src/hooks/useConnectChannel.ts:69-71`
- **Issue:** When `fetchYouTubeChannel` gets a non-OK response, the error data is fetched (`await response.text()`) but discarded — the error message just says `"YouTube API error: ${response.status}"` without the actual error body.
- **Impact:** Harder to debug YouTube connection failures.

### 18. `"any" as any` Type Assertions in API Routes
- **File:** `src/app/api/content/search/route.ts:39`, `src/app/api/creators/route.ts:31`
- **Issue:** Multiple `as any` casts throughout the codebase. The content search route passes `sources as any`, and creators route uses `(channel as any).metadata`.
- **Impact:** Type safety erosion — actual runtime errors won't be caught at compile time.

### 19. Missing Error Boundary for Discover Page
- **File:** `src/app/discover/page.tsx`
- **Issue:** The 2288-line monolithic component has no error boundary. If any render error occurs, the entire page crashes with no recovery.
- **Impact:** Poor error UX — users see white screen on any render error.
- **Fix:** Add error.tsx boundary, or split into smaller components with individual error handling.

### 20. Context Menu Position May Render Off-Screen
- **File:** `src/app/discover/page.tsx:1276-1277`
- **Issue:** Card context menu is positioned at `style={{ top: cardContextMenu.y, left: cardContextMenu.x }}` using raw `clientX/clientY`. No bounds checking for right/bottom edges of viewport.
- **Impact:** Context menu may render partially off-screen when right-clicking cards near the bottom or right edge.

### 21. No Auth Guard on Discover Page
- **File:** `src/app/discover/page.tsx:127-128`
- **Issue:** The discover page uses `const { user } = useAuth()` but doesn't redirect to login if `user` is null. It just silently does nothing (all fetches check `if (!userId) return`).
- **Impact:** Unauthenticated users see an empty discover page with no guidance to sign in.

### 22. `Checkbox` Import Unused in Onboarding
- **File:** `src/app/onboarding/page.tsx:8`
- **Issue:** `Checkbox` is imported from `@/components/ui/checkbox` but never used.
- **Impact:** Dead import.

### 23. Duplicate `useAuth` Export
- **File:** `src/components/auth-provider.tsx:55-57` and `src/hooks/useAuth.ts:6-8`
- **Issue:** `useAuth` is exported from both `auth-provider.tsx` AND `hooks/useAuth.ts`. The hooks file just re-exports from the context, but this creates two possible import paths for the same thing.
- **Impact:** Confusion — developers might import from either location.

### 24. `label` Variable Shadow in Home Page
- **File:** `src/app/page.tsx:12`
- **Issue:** `limit` is imported from `firebase/firestore` and also exists as a common variable name. While not a current bug, it's a shadow risk.
- **Impact:** Low — could cause confusion.

---

## Code Quality / Architecture Observations

1. **Monolithic discover page (2288 lines)** — Should be split into separate components for Sidebar, FilterDropdown, WorkspaceView, ChannelTab, etc.
2. **40+ useState calls** in a single component — indicates state should be lifted into a reducer or context.
3. **No loading skeleton/placeholder** for workspace cards or channel content.
4. **No pagination** on any content list — all videos and articles are loaded at once.
5. **Multiple "More" menu items** (Skills, Highlights, Identities, Capture, Customize sidebar) are non-functional placeholders that just close the menu.
6. **Context menu "Color", "Move to Board", "Download", "Rename", "Reference on Board"** buttons are non-functional (empty onClick or just close menu).
7. **Chat pane** — no actual message sending logic; the send button and input don't submit to any API.
8. **Time period filter** (`selectedTimePeriod`) is stored in state but never actually used for filtering content.
9. **Follower min/max inputs** (`followerMin`/`followerMax`) are stored in state but never applied to any filtering logic.
10. **Language filter** (`selectedLanguage`) is stored in state but never applied to content filtering.

---

## Security Concerns

1. **No authentication on ANY API route** — All routes accept raw userId in request body/params without verifying the caller's identity.
2. **Debug routes still active** — `/api/debug/env`, `/api/debug/firestore`, `/api/debug/youtube` are all accessible (though env returns 404).
3. **API keys in LLM calls** — The `KIMI_API_KEY` is used directly in server-side fetch; should verify it's not exposed to client.

---

## Build Status

- `next build`: ✅ Passes (0 TypeScript errors)
- Build output: 49 routes total (13 static, 36 dynamic)
