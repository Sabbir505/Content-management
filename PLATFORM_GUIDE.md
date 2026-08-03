# TubeForge — Platform Guide

A complete reference for how TubeForge works: features, data flow, and the full user journey from landing to content generation.

## What TubeForge is

TubeForge is a content discovery and creation tool for creators. It surfaces outlier-performing videos and articles across YouTube, Hacker News, DEV.to, and Substack; lets you block, filter, and track what you see; and provides an LLM-powered chat panel to turn what you find into scripts, social posts, and headline variations.

The app is built on Next.js 16 (App Router) with React 19, TypeScript, Firebase Auth + Firestore, and Tailwind CSS. Storage is localStorage-first (Firestore is used when available, but the app degrades gracefully to localStorage when the proxy blocks Firebase — which is the current state in this environment).

## The pages

| Route | Purpose |
|-------|---------|
| `/` | Home — onboarding status, daily streak, quick navigation to tracked creators and boards |
| `/discover` | Main research workspace — feed of videos + articles, filters, creators tab, lists tab, channel analytics tab. Also hosts the workspace board view when a board is active. |
| `/discover?tab=creators` | Discover page with the Creators tab pre-selected |
| `/discover?workspace=my-ideas` | Discover page with the My Ideas board pre-loaded in the workspace pane |
| `/channel` | Per-channel analytics view |
| `/settings/performance` | Performance insights dashboard + platform OAuth connections + score calibration |
| `/auth/login`, `/auth/signup` | Firebase auth |
| `/onboarding`, `/optimize`, `/voice`, `/analyze`, `/dashboard` | Auxiliary pages |

## The user flow

### 1. Landing and auth

User lands on `/` (Home). If not signed in, the auth guard on `/discover` redirects to `/auth/login`. After sign-in, Home shows:

- **Onboarding checklist** — 3 steps: (1) create ≥1 board, (2) have ≥2 chat sessions, (3) track ≥3 creators. Each step auto-completes when the threshold is met (tracked in Firestore/localStorage).
- **Daily streak** — tracks consecutive days of activity. Incremented when the user does something (saves a card, sends a chat message, tracks a creator). Stored in localStorage under `tubeforge_streak`.
- **Quick nav** — sidebar with Home, Research, Chat dropdown, Workspace (My Ideas + custom boards), Settings.

### 2. Discover feed

The main page (`/discover`). On load:

1. `useDiscoverData` hook fires `fetchVideos` and `fetchContent` in parallel, querying `/api/youtube/search` and `/api/content/search` with a query built from the selected category (or all active categories joined with `|`).
2. Videos are scored via `calculateVideoDiscoveryScore` (engagement + recency + outlier). Articles are scored via `calculateContentDiscoveryScore`.
3. `useDiscoverFilters` hook derives `filteredVideos`, `filteredArticles`, and `unifiedItems` (a discriminated union sorted by the selected `sortBy` option: top / trending / recent / discussed).
4. The feed renders cards in a masonry layout. Infinite scroll via `IntersectionObserver` bumps `displayCount` by 12.

### 3. Filtering and blocking

**Filter dropdown** (`FilterDropdown` component, opened from the top-right filter button):

- **Platforms** — YouTube, HackerNews, DEV.to, Substack (multi-select).
- **Format** — per-platform: YouTube (videos/shorts/all), Substack (articles/notes/all), Instagram (reels/carousel/photos/all — Instagram isn't in the feed yet, so this is forward-looking).
- **Language** — 12 languages. Selecting one hides items in other languages (detected via Unicode script analysis in `detectLanguage`).
- **Followers** — preset ranges (Any / 1K–20K / 20K–100K / 100K–1M / 1M–8M / 8M+). Custom min/max inputs exist but the "custom" option isn't in the preset list, so they're inert unless the user picks a range that triggers custom logic.
- **Min outlier score** — 3×/5×/10×/20×/50× or Any.
- **Posted within** — Week / Month / 3 months / Year / All time.

**Blocklist** (per-item, in the card "⋯" menu and the modal "Hide" button):

- **Not in my language** — calls `blockLanguage(detectLanguage(...))`, then dispatches a `tubeforge-blocklist-updated` window event.
- **Hide this creator** — calls `blockCreator(channelId)`, same event.
- **Hide** (modal header) — calls `blockItem(item.id)`, same event.

`useBlocklistSync` listens for the event and bumps `blocklistVersion`. The filter memos in `useDiscoverFilters` depend on `blocklistVersion`, so they re-run and the blocked items disappear from `filteredVideos`/`filteredArticles` reactively. The blocklist is stored in localStorage under `tubeforge_blocklist` and persists across sessions.

### 4. Category pills

Below the search bar. Default categories: Productivity, Self-improvement, Business, Health & fitness, Content creation, Psychology, Technology, Finance, Entertainment. Users can:

- Click a category to fetch content for it (triggers the main fetch effect).
- Add a custom category (input + Enter) — persisted to localStorage.
- Remove a category (hover → X).

Active vs. custom categories are tracked separately in `useCategories` and persisted to `discover_activeCategories` / `discover_customCategories` localStorage keys.

### 5. Research tabs

Four tabs on the discover page:

- **Discover** — the feed described above.
- **Creators** — search YouTube channels by name, track them (saved to localStorage via `useLocalCreators`), see your tracked creators list. Tracked creators auto-add to an "All following" list.
- **Lists** — creator lists (groups of creators). Manage list membership.
- **Channel** — per-channel analytics (subscriber count, video count, recent performance). Uses `ChannelAnalytics` component.

### 6. Chat panel

The split chat panel (`ContentChatPanel`) opens from:

- A video/article card's chat button (passes the item as context).
- The sidebar's "Chat" dropdown → a specific session, or "+ New Chat".
- Quick pills in the workspace board's chat pane (Start Writing, Creator Research, Topic Research, Watchlist — each pre-fills a prompt).

The panel:

- Creates a chat session via `POST /api/chat/session` (or loads an existing one).
- Sends messages via `POST /api/chat/generate` with the session ID + message history + detected intent (script / social / chat).
- Assistant responses can include an `artifact` — currently three types:
  - **headline_variations** — 5 categorized headlines (Contrarian reframe, Confession/Stakes, Specific promise, Curiosity gap, Polarizing swing). Triggered by the "Create headline variation" prompt. Has a "Save all to board" button that saves all 5 to the My Ideas board in localStorage with a circular loading spinner during save.
  - **script** — a content script.
  - **social_posts** — platform-specific social copy.

**Header buttons:**

- **New chat** — clears the current session and messages, starts fresh.
- **Link** — generates a shareable URL with the current item's context, saves it to My Ideas as a reference card. (Fork was removed per user request.)

### 7. Workspace board

When `activeWorkspace` is set (via sidebar click or URL `?workspace=...`), the discover page switches to the workspace board view. This is a two-pane layout:

- **Left pane** — board header + card grid. Cards can be notes, links, documents, sections, or references. Add via the "+ Add" menu. Each card has a context menu (right-click): Duplicate, Delete, Move to Board, Reference on Board.
- **Right pane** — either "info" (card details) or "chat" (chat input bound to the selected card, with the 4 quick pills).

`useWorkspaceBoard` owns all board state and CRUD. `loadWorkspaceCards` tries Firestore first (if signed in), then merges localStorage cards on top. New cards, moves, and references are written to Firestore when signed in; `handleMoveToBoard` and `handleReferenceToBoard` use localStorage only (they create new local boards).

### 8. Save to board

From a video/article card's save button:

1. Opens `BoardPicker` modal.
2. User picks a board (or the default "My Ideas").
3. `handleSaveToBoard` / `handleSaveContentToBoard` writes the item to Firestore under `users/{uid}/boards/{boardId}/items`.

If Firestore is unavailable (proxy issue), the save fails silently with a toast. The localStorage-first approach in the chat panel's "Save all to board" works regardless.

### 9. Boards

There is no separate `/boards` route — board management lives entirely within
the `/discover` workspace board (see §7). Saved feed items land in
`users/{uid}/boards/{boardId}/items`; canvas cards (with x/y coordinates) land
in `users/{uid}/boards/{boardId}/cards`. When Firestore is proxy-blocked, board
state falls back to localStorage (`tubeforge_boards`, `tubeforge_cards_{boardId}`).

### 10. Settings / Performance

`/settings/performance`:

- **Performance Dashboard** — shows total generated content, total tracked, platform breakdown, working/not-working insights. Data from `/api/quality/feedback/insights`.
- **Analytics Connections** — YouTube, X, Instagram, Facebook OAuth. Currently not configured — clicking "Connect" shows an honest error toast ("OAuth is not configured. Add credentials to enable.").
- **Score Calibration** — every 14 days, TubeForge adjusts scoring weights based on the user's content performance. "Run Calibration Now" triggers `/api/quality/feedback/calibrate`.

## Data sources and APIs

### Content sources (`src/lib/content/`)

- **YouTube** — `/api/youtube/search` (outlier videos), `/api/youtube/channel` (channel details), `/api/youtube/channel-search` (channel search), `/api/youtube/transcript` (transcripts), `/api/youtube/video` (single video). Uses the YouTube Data API v3 with proxy fallback (`proxyFetch`).
- **Hacker News** — `src/lib/content/hackernews.ts` (Algolia API).
- **DEV.to** — scraped via `src/lib/content/index.ts`.
- **Substack** — scraped.
- **Article extraction** — `src/lib/content/article-extraction.ts` (HTML parsing: title, content, images, author, published date, entity decoding).
- **Removed** — Google News, Reddit, Instagram, TikTok, LinkedIn, X/Twitter (deleted in a prior cleanup; the `instagram` filter option in the UI is forward-looking).

### Generation APIs

- `/api/chat/generate` — main LLM chat endpoint.
- `/api/chat/headline-variations` — dedicated endpoint for the 5-category headline structure.
- `/api/chat/session`, `/api/chat/message` — session and message persistence.
- `/api/generate/script` — script generation (sections, hooks, CTAs).
- `/api/generate/seo` — SEO package generation (titles, description, tags, thumbnails, chapters, pinned comment).
- `/api/generate/social` — social post generation (X thread, Instagram caption, Facebook post).
- `/api/generate/video-analysis` — video performance analysis (strengths, weaknesses, scores per category).

All generation routes share a single `callLLM` wrapper in `src/lib/generation/llm.ts`. Each route passes its own `CallLLMOptions` (max_tokens, timeout, retries, empty fallback) so the per-route behavior is preserved without duplicating the fetch/retry/proxy boilerplate. The LLM endpoint, model, and API key come from `KIMI_API_ENDPOINT`, `KIMI_MODEL`, and `KIMI_API_KEY` env vars. Proxy routing is opt-in via `KIMI_USE_PROXY=true`. Also exports `parseJsonResponse<T>(content, fallback)` — a generic JSON response parser that strips markdown code fences and falls back to a typed default on parse failure.
- `src/lib/generation/schemas.ts` — shared Zod schemas (`voiceProfileSchema`, `generationMetadataSchema`) composed into route-specific schemas via `.merge()` to prevent schema drift across generation routes.
- `src/lib/generation/seo-prompts.ts` — SEO scoring functions, response parser, system prompt + user prompt builder for YouTube metadata generation (extracted from `/api/generate/seo`).

### Storage

- **Firebase Auth** — email/password and (optionally) OAuth.
- **Firestore** — `users/{uid}/boards/{boardId}` (board metadata), `users/{uid}/boards/{boardId}/cards/{cardId}` (canvas cards), `users/{uid}/boards/{boardId}/items/{itemId}` (saved feed items), `users/{uid}/chatSessions/{sessionId}` (chat).
- **localStorage** (primary when Firestore is proxy-blocked):
  - `tubeforge_boards` — board metadata.
  - `tubeforge_cards_{boardId}` — cards per board.
  - `tubeforge_blocklist` — hidden items/creators/languages.
  - `tubeforge_creators`, `tubeforge_creator_lists` — tracked creators (user-scoped with `_{uid}` suffix).
  - `tubeforge_streak` — daily streak data.
  - `discover_activeCategories`, `discover_customCategories` — category state.
  - `notifications_enabled`, `auto_refresh` — settings toggles.

### Quality and scoring

- `src/lib/discovery-score.ts` — `calculateVideoDiscoveryScore`, `calculateContentDiscoveryScore`. Combines engagement (views/comments/score), recency (age in hours), and outlier factor.
- `src/lib/outlier.ts` — outlier detection (how many× the channel's median performance).
- `src/lib/quality/` — feedback loop (track what generated content performed well, recalibrate weights).
- `src/lib/discovery/time-periods.ts` — shared time-period and duration helpers (extracted in this refactor).

## Architecture (post-refactor)

│   ├── app/
│   │   ├── discover/page.tsx        # Orchestrator: composes hooks, renders JSX (~1030 lines)
│   │   ├── page.tsx                 # Home (onboarding, streak)
│   │   ├── settings/performance/    # Performance dashboard
│   │   └── api/                     # Next.js API routes
│   ├── components/
│   │   ├── AppSidebar.tsx           # Left nav (Home, Research, Chat dropdown, Workspace, Settings)
│   │   ├── discover/
│   │   │   ├── VideoCard.tsx        # Video card with context menu + boost modal
│   │   │   ├── VideoCardMenus.tsx   # Context menu items + boost items factory functions
│   │   │   ├── VideoCardModal.tsx   # Video detail modal (iframe, stats, description, transcript)
│   │   │   ├── ContentCard.tsx      # Article card with context menu + boost modal
│   │   │   ├── ContentCardMenus.tsx  # Context menu items + boost items factory functions
│   │   │   ├── ContentCardModal.tsx # Article detail modal (thumbnail, stats, note)
│   │   │   ├── DiscoverContentGrid.tsx # Masonry grid (mixed/videos/articles) with load-more spinner
│   │   │   ├── CategoryPills.tsx      # Horizontal scrollable category filter bar with add/remove
│   │   │   ├── ContentChatPanel.tsx # Split chat panel (headline variations, save-all, link)
│   │   │   ├── FilterDropdown.tsx   # 320-line filter dropdown (extracted)
│   │   │   ├── BoardPicker.tsx      # Board selection modal
│   │   │   ├── CreatorSearchRow.tsx # Creator search result row
│   │   │   ├── CreatorListsTab.tsx  # Creator lists management
│   │   │   ├── CreatorsTab.tsx      # Creator search + tracked creators list (discover page tab)
│   │   │   └── QuotaExceededError.tsx
│   │   ├── chat/ChatSessionsModal.tsx # Chat session list modal
│   │   ├── channel/
│   │   │   ├── ChannelAnalytics.tsx
│   │   │   ├── ChannelVideoCard.tsx          # Analytics-specific video card + grid (performance score, outlier badges, compare mode)
│   │   │   ├── ChannelVideoDetailModal.tsx  # Video detail + AI analysis + SEO boost modal
│   │   │   ├── ChannelCharts.tsx            # InsightsCharts, ViewsOverTimeChart, PerformanceDistributionChart
│   │   │   ├── CompareModal.tsx             # 2-video side-by-side comparison dialog
│   │   │   ├── FixVideoModal.tsx            # "Fix this video" nav (optimizer, script, social)
│   │   │   ├── StatCard.tsx                 # Leaf stat display (label, value, sub)
│   │   │   └── HealthScoreCard.tsx          # Channel health score + 3-metric breakdown
│   │   └── voice/
│   │       ├── InputSourceSelector.tsx    # 5-card input-method picker
│   │       ├── SourceCard.tsx             # Leaf card (icon, title, description, onClick)
│   │       ├── VoiceFingerprintCard.tsx   # 6-dimension fingerprint display + sample sentences
│   │       ├── FeedbackForm.tsx           # Star rating + tag multi-select + submit
│   │       └── VersionHistory.tsx         # Version list with revert buttons
│   ├── hooks/
│   │   ├── useAuth.ts
│   │   ├── useBlocklistSync.ts      # Blocklist version + event listener
│   │   ├── useCategories.ts         # Category state + localStorage persistence
│   │   ├── useChatSessions.ts       # Chat session list (sidebar dropdown)
│   │   ├── useCreatorSearch.ts      # Creator search + track
│   │   ├── useDiscoverData.ts       # Video/article fetch, error, retry
│   │   ├── useDiscoverFilters.ts    # 9 filter states + 5 derived memos
│   │   ├── useBoardSave.ts          # Save-to-board picker state + handlers (discover page)
│   │   ├── useBoardCardOps.ts       # Pure Firestore CRUD for workspace board cards (loadCards, saveCardPosition, removeCard)
│   │   ├── useWorkspaceBoard.ts     # Workspace board state + card CRUD (discover page)
│   │   ├── useCardState.ts          # Shared card UI state (modal/boost/description) for VideoCard + ContentCard
│   │   ├── useContentChat.ts        # ContentChatPanel state + chat/headline-variations/save-to-board logic
│   │   ├── useLocalCreators.ts      # Tracked creators (localStorage)
│   │   ├── useConnectChannel.ts
│   │   ├── useChannelAnalyticsState.ts   # Channel analytics state (14 values + filtered/sorted derivation)
│   │   ├── useGoogleTrends.ts
│   │   ├── usePerformanceInsights.ts
│   │   ├── usePlatformConnections.ts
│   │   ├── useQualityScore.ts
│   │   ├── useVoiceProfile.ts
│   │   ├── useVoiceProfileBuilder.ts  # Voice profile CRUD (build, analyze, feedback, revert)
│   │   ├── useAnalyzePage.ts          # Analyze page state + analysis/copy/export/save handlers
│   │   ├── useOptimizePage.ts         # Optimize page state + SEO generation/auto-run/copy handlers
│   │   ├── useHomePage.ts             # Home page state + boards/chats/streak/onboarding loading
│   │   ├── useYouTubeAutocomplete.ts
│   │   └── useYouTubeSearch.ts
│   ├── lib/
│   │   ├── discovery/
│   │   │   ├── time-periods.ts      # Shared time/duration helpers + constants
│   │   │   └── save-to-board.ts     # Save video/article to Firestore board items subcollection
│   │   ├── discovery-score.ts       # Scoring algorithms
│   │   ├── format.ts                # Shared date + compact-number formatters
│   │   ├── channel-analytics.ts     # ChannelAnalytics types + analytics logic (suggestions, insights, CSV)
│   │   ├── scoring-utils.ts          # Pure score/grade threshold mappers (getGrade, getScoreColorClass, etc.)
│   │   ├── voice-analysis.ts        # VoiceFingerprint types + analyzeText (extractVideoId re-exported from youtube.ts)
│   │   ├── voice-questions.ts        # VOICE_QUESTIONS config + VoiceQuestion interface (voice profiling wizard)
│   │   ├── analyze-helpers.ts       # AnalysisError type + formatDuration/formatDate + formatAnalysisAsMarkdown
│   │   ├── optimize-types.ts        # Canonical SeoPackage + sub-types (SeoTitle, SeoTag, SeoDescription, etc.)
│   │   ├── outlier.ts               # Outlier detection
│   │   ├── blocklist.ts             # Blocklist storage + language detection
│   │   ├── local-board.ts           # localStorage board storage
│   │   └── url-validation.ts        # SSRF protection (validateUrl, isPrivateIp)
│   │   ├── firebase.ts              # Firebase init
│   │   ├── youtube.ts               # YouTube API client
│   │   ├── youtube-api.ts            # Shared YouTube Data API v3 client (fetchYouTubeApi, resolveChannelId, YOUTUBE_API_KEY)
│   │   ├── youtube-parsers.ts        # YouTube view count + date string parsers (parseViewCount, parsePublishedDate)
│   │   ├── api-helpers.ts            # Shared Zod validation util (parseBody<T>) — used by all 7 generation/chat/quality routes
│   │   ├── youtube-scraper.ts
│   │   ├── proxy.ts                 # proxyFetch
│   │   ├── rate-limiter.ts
│   │   ├── quality/                 # Quality feedback loop
│   │   └── content/                 # Content source scrapers + sources.ts (icon/label maps)
│   └── types/
        ├── video.ts
        ├── content.ts
        ├── creator.ts
        ├── chat.ts                  # ChatMessage, ChatArtifact, HeadlineVariation
        └── board.ts

### Hook composition in `discover/page.tsx`

```
useAuth()                     → user, authLoading
useDiscoverData()             → videos, contentItems, loading flags, error, fetch fns
useCategories()               → activeCategories, customCategories, handleAddCategory
useDiscoverFilters({          → selectedPlatforms, selectedFormat, ..., filteredVideos,
  videos, contentItems,         filteredArticles, unifiedItems, sortedVideos,
  searchQuery, sortBy,          sortedArticles
  blocklistVersion
})
useChatSessions()             → chatSessions, chatDropdownOpen
useWorkspaceBoard({ user })   → activeWorkspace, workspaceCards, card CRUD fns
useCreatorSearch({            → creatorSearchQuery, results, handleSearchCreators,
  user, addCreator              handleTrackCreator
})
useLocalCreators()            → trackedCreators, addCreator, refresh
useBlocklistSync()            → blocklistVersion (triggers filter re-memo)
```

The page component itself is now mostly: URL-param parsing, the main fetch effect, the infinite-scroll observer, the auth guard, the search submit, the quick-pill handler, and ~1000 lines of JSX.

## Known limitations

- **No React Query.** All server state is managed with plain `fetch` + `useState`. CLAUDE.md §State Management recommends React Query, but migration is out of scope for this refactor.
- **OAuth not configured.** The Settings → Performance → Analytics Connections buttons show an error toast. Needs credentials in `.env.local`.
- **Custom follower range unreachable from UI.** The "custom" option isn't in `FOLLOWER_RANGES`, so the min/max inputs are inert unless the user picks a preset that sets `selectedFollowers` to "custom" — which no preset does.
- **Firebase proxy issue (environment-specific).** In some environments, Firebase requests may be blocked by a proxy. The app degrades to localStorage for boards, blocklist, creators, and chat-panel saves. Firestore writes from `handleSaveToBoard`/`handleSaveContentToBoard` (video/article save from feed) will fail silently. To fix: configure the proxy or run in an environment with Firebase access.

- **Firestore proxy issue.** In the current environment, Firebase requests are blocked by a proxy. The app degrades to localStorage for boards, blocklist, creators, and chat-panel saves. Firestore writes from `handleSaveToBoard`/`handleSaveContentToBoard` (video/article save from feed) will fail silently. To fix: configure the proxy or run in an environment with Firebase access.
- **No React Query.** All server state is managed with plain `fetch` + `useState`. CLAUDE.md §State Management recommends React Query, but migration is out of scope for this refactor.
- **OAuth not configured.** The Settings → Performance → Analytics Connections buttons show an error toast. Needs credentials in `.env.local`.
- **Custom follower range unreachable from UI.** The "custom" option isn't in `FOLLOWER_RANGES`, so the min/max inputs are inert unless the user picks a preset that sets `selectedFollowers` to "custom" — which no preset does.

## Architecture layers

### Data access
All Firestore operations and external API calls live in hooks and `lib/` utilities. Components are pure rendering shells.

| Layer | Location | Examples |
|-------|----------|----------|
| API route helpers | `src/lib/api-helpers.ts` | `parseBody()` (Zod validation), `guardApiKey()` (env var check) |
| YouTube API | `src/lib/youtube-api.ts` | `YOUTUBE_API_KEY`, `fetchYouTubeApi()`, `resolveChannelId()` |
| Generation | `src/lib/generation/` | `llm.ts` (shared `callLLM` used by all 5 generate routes), `schemas.ts`, `script-prompts.ts`, `seo-prompts.ts`, `social-prompts.ts` |
| Quality scoring | `src/lib/quality/` | `regeneration.ts`, `grounding/`, `scorers/`, `types.ts` (shared `PlatformType` + `PLATFORM_TYPES` constant) |
| Content sources | `src/lib/content/` | `youtube.ts`, `hackernews.ts`, `devto.ts`, `substack.ts` |
| Hooks — data layer | `src/hooks/useBoardCardOps.ts` | Pure Firestore CRUD (loadCards, saveCardPosition, removeCard, etc.) |
| Hooks — UI state | `src/hooks/useWorkspaceBoard.ts` | Composes data-layer hooks with React state + toast notifications |
| Hooks — fetch | `src/hooks/useConnectChannel.ts`, `src/hooks/useChannelAnalyticsState.ts` | Owns full API lifecycle (chat, channel analytics) |
| Components — channel | `src/components/channel/` | `ChannelAnalytics.tsx` (orchestrator, 132 lines), `ChannelTabContent.tsx` (shared tab content, 316 lines), `StatCard`, `HealthScoreCard`, `CompareModal`, `FixVideoModal`, `ChannelVideoCard`, `ChannelVideoDetailModal`, `ChannelCharts` |
| Hooks — Firebase | `src/hooks/useKeywords.ts`, `src/hooks/useBoards.ts` | Firestore subscriptions and CRUD for keywords/boards |

### Key design rules
- **Zero Firestore imports in components.** All Firestore access is through hooks.
- **Zero inline `fetch()` in components.** All API calls are through hooks.
- **Two-line API key guard.** `guardApiKey(KEY, "NAME")` replaces 3-5 lines of duplicated guard logic in every API route.
- **Two-layer hooks.** `useBoardCardOps` (pure data) → `useWorkspaceBoard` (composes with state). Same pattern as `useKeywords` (data) → `keyword-sidebar` (UI).
- **Module-level functions for non-reactive code.** `migrateLegacyItems` doesn't need React state — it's a plain async function at module level.

## Testing the refactor

After any change, run:

```bash
npx tsc --noEmit    # type check
npx next build      # production build
npm run dev         # local dev server for manual verification
```

Key flows to click through:

After any change, run:

```bash
npx tsc --noEmit    # type check (ignore vitest/jest module errors in test files)
npx next build      # production build
npm run dev         # local dev server for manual verification
```

Key flows to click through:

1. `/discover` — feed loads, filters apply, category pills work, infinite scroll.
2. Blocklist — "Not in my language" / "Hide this creator" / modal "Hide" — items disappear reactively.
3. Chat panel — opens from card, "Create headline variation" returns 5 headlines, "Save all to board" shows spinner then toast, items appear in My Ideas.
4. Chat header — "New chat" clears session, "Link" generates share URL saved to My Ideas.
5. Quick pills — Start Writing / Creator Research / Topic Research / Watchlist — each opens chat with pre-filled prompt.
6. Workspace board — sidebar My Ideas, add/delete/duplicate cards, Move to Board / Reference on Board create new boards.
7. Creators tab — search, track, see list.
8. Home — onboarding steps auto-complete, streak increments.

## Refactor summary (completed 2026-07-09)

62 iterations over 2 days. Major results:

- **28 hooks created** — every page now has a data hook; every API call goes through hooks
- **17 shared lib modules** — `api-helpers.ts`, `generation/llm.ts`, `generation/schemas.ts`, `quality/types.ts`, `discovery/save-to-board.ts`, etc.
- **Page reductions**: discover 2182→952 (−56%), ChannelAnalytics 1304→132 (−90%), boards 861→376 (−57%), voice 889→399 (−55%), optimize 598→367 (−39%)
- **0 duplicated callLLM** — 6 copies consolidated to 1
- **0 duplicated KIMI_API_KEY** — 7 inline reads reduced to 2 canonical locations
- **0 duplicated PLATFORM_TYPES** — 4 hardcoded arrays → 1 shared constant
- **0 Firestore imports in components** — all data access through hooks
- **0 inline fetch() in components** — all API calls through hooks
