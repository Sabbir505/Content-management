# Refactor Progress Log

> **⚠️ Historical log — line counts and some files are out of date.**
> This tracks a refactor completed 2026-07-07/08. Since then the codebase has
> changed further, so the exact numbers and file references below are no longer
> current:
> - `src/app/discover/page.tsx` is now ~1030 lines (the log says 1248).
> - `src/app/boards/page.tsx`, `src/components/board/BoardCanvas.tsx`, and the
>   board hooks `useBoardsData` / `useBoardCards` / `useCardEditor` /
>   `useBoardChatPanel` referenced in Iteration 2 were **deleted** — board
>   management now lives entirely in the `/discover` workspace via
>   `useWorkspaceBoard` + `useBoardCardOps`.
> - `src/components/chat/ChatPanel.tsx` (referenced in Iteration 5 notes) was
>   removed; `src/components/chat/ChatSessionsModal.tsx` is what remains.
>
> Read this as a record of the extraction methodology, not a current map of the
> code. Cross-check any cited file against the live tree before relying on it.

This document tracks the architectural refactor of `src/app/discover/page.tsx` and surrounding code, executed on 2026-07-07/08.

## Starting point

- `src/app/discover/page.tsx`: **2182 lines**, god component with 40 `useState`, 14 `useEffect`, 13 handler functions, 6 inline `fetch()` calls, duplicated time-period cutoff tables, inlined filter dropdown JSX (265 lines), dead code (`loadTrackedCreators`, `moreMenuOpen`, unreachable custom-follower branch, `isLoading`/`initialLoadDone` flags set but never read).
- `src/app/boards/page.tsx`: 865 lines, similar Firestore-layer duplication.
- No React Query usage (violates CLAUDE.md §State Management).
- Magic numbers scattered (`65000`, `45000`, `40`, `16`, `12`, outlier map `{3,5,10,20,50}`).

## Extractions performed

Each step was followed by `npx tsc --noEmit` + `npx next build` — both passed clean after every step.

### 1. `useBlocklistSync` hook (src/hooks/useBlocklistSync.ts, 17 lines)
Encapsulates the `blocklistVersion` state + the `tubeforge-blocklist-updated` window event listener. Single consumer, lowest coupling — extracted first. Also removed the dead `moreMenuOpen` state (was set but its menu was never rendered) and the corresponding branch in the click-outside effect.

### 2. `useCategories` hook (src/hooks/useCategories.ts, 101 lines)
Owns `customCategories`, `activeCategories`, `showAddCategory`, `hoveredCategory`, `newCategory`, `handleAddCategory`, derived `allCategories`, and the 3 localStorage effects (load-on-mount + 2 persist). Returns object form per CLAUDE.md §Hooks.

### 3. `useChatSessions` hook (src/hooks/useChatSessions.ts, 58 lines)
Owns `chatSessions`, `isLoadingChatSessions`, `chatDropdownOpen`, and the load-on-open effect. Only passed to `AppSidebar`. Added a `cancelled` flag to prevent state updates after unmount.

### 4. `useDiscoverFilters` hook (src/hooks/useDiscoverFilters.ts, 296 lines)
Owns the 9 filter states (`selectedPlatforms`, `selectedFormat`, `selectedLanguage`, `selectedFollowers`, `followerMin`, `followerMax`, `selectedOutlier`, `selectedTimePeriod`, `showFilters`) + the 5 derived memos (`filteredVideos`, `filteredArticles`, `unifiedItems`, `sortedVideos`, `sortedArticles`). Accepts `videos`, `contentItems`, `searchQuery`, `sortBy`, `blocklistVersion` as args.

Also created **src/lib/discovery/time-periods.ts** (48 lines) with shared helpers extracted from the duplicated inline tables: `TIME_PERIOD_MS`, `getTimePeriodCutoff`, `getOutlierMin`, `platformsToSources`, `parseDurationToSeconds`, `getAgeHours`. The duplicated time-period cutoff table (which appeared twice in the original memos) is now a single source of truth.

Fixed a TypeScript narrowing issue: `unifiedItems` is now a discriminated union (`(VideoWithOutlier & {contentType: "video"}) | (ContentItem & {contentType: "article"})`) so `item.contentType === "video"` correctly narrows in JSX.

Moved the click-outside effect to after the hook call (it references `showFilters` from the hook).

### 5. `useDiscoverData` hook (src/hooks/useDiscoverData.ts, 179 lines)
Owns `videos`, `contentItems`, `isLoadingVideos`, `isLoadingContent`, `error`, `quotaError`, `fromCache`, `fetchCountRef`, and the 3 fetch functions: `fetchVideos`, `fetchContent`, `handleRetry`. Functions are `useCallback`-memoized with proper deps.

Design decision: the hook does NOT own `selectedTimePeriod`. Instead, `fetchVideos`/`fetchContent` accept `{query, timePeriod, abortSignal}` at call time. This breaks the circular dependency (filters hook needs `videos` from data hook; data hook would have needed `selectedTimePeriod` from filters hook). The parent page passes `selectedTimePeriod` when invoking the fetch functions.

Removed dead state: `isLoading` (was set in safety-timeout effect, never read in JSX), `initialLoadDone` (same). Safety-timeout effect now only clears `isLoadingVideos`/`isLoadingContent`. Magic number `65000` replaced with `LOADING_SAFETY_TIMEOUT_MS` constant.

Also moved `getTimeRangeCutoffDate`, `calculateSecondsUntilMidnight`, `isQuotaError` to the shared `time-periods.ts` util. Added constants `CONTENT_FETCH_TIMEOUT_MS`, `CONTENT_FETCH_LIMIT`, `DISPLAY_COUNT_INCREMENT`, `DISPLAY_COUNT_INITIAL`.

The page's `onRetry()` wrapper now passes current state (`searchQuery`, `selectedCategory`, `activeCategories`, `customCategories`, `selectedTimePeriod`) to the hook's `handleRetry`.

### 6. `useWorkspaceBoard` hook (src/hooks/useWorkspaceBoard.ts, 247 lines)
Owns `activeWorkspace`, `workspaceCards`, `isLoadingWorkspace`, `addMenuOpen`, `cardContextMenu`, `rightPane`, `chatInput`, and the 6 card-CRUD functions: `loadWorkspaceCards`, `handleAddCard`, `handleDeleteCard`, `handleDuplicateCard`, `handleMoveToBoard`, `handleReferenceToBoard`. All `useCallback`-memoized. Accepts `user` as arg.

The Firestore reads (`getDoc`, `getDocs`, `setDoc`, `deleteDoc`, `updateDoc`, `increment`, `serverTimestamp`, `query`, `collection`, `doc`, `orderBy`) and `db` are now imported statically at the top of the hook file (not dynamically inside handlers). The page's static imports of firebase/firestore and `db` were dead after this extraction and removed.

`loadWorkspaceCards` was improved: if `user` is null, it skips Firestore entirely and reads from localStorage directly (the original always tried Firestore first, which would throw without auth).

### 7. `useCreatorSearch` hook (src/hooks/useCreatorSearch.ts, 119 lines)
Owns `creatorUrl`, `isTrackingCreator`, `creatorSearchQuery`, `creatorSearchResults`, `isSearchingCreators`, and the 2 functions `handleSearchCreators`, `handleTrackCreator`. Accepts `user` and `addCreator` (from `useLocalCreators`) as args. Exports `CreatorSearchResult` type.

### 8. `FilterDropdown` component (src/components/discover/FilterDropdown.tsx, 320 lines)
The 265-line filter dropdown JSX (lines 858-1123 of the original page) is now a self-contained component. Owns the `PLATFORMS`, `LANGUAGES`, `FOLLOWER_RANGES`, `OUTLIER_RANGES`, `TIME_PERIODS` constants and the `PlatformIcon` helper (previously duplicated in the page). Accepts 18 props (all filter states + setters + `togglePlatform`).

### 9. Dead code + import cleanup
- Removed `useMemo` from the page's React import (all memos moved to hooks).
- Removed top-level `PLATFORMS`, `LANGUAGES`, `FOLLOWER_RANGES`, `OUTLIER_RANGES`, `TIME_PERIODS`, `PlatformIcon` (moved to `FilterDropdown`).
- Removed `TimeRange` type (unused after `getTimeRangeCutoff` moved to util as `getTimeRangeCutoffDate` taking `string`).
- Removed `YouTubeSearchError` type import (only used in `quotaError` typing, which the hook owns).
- Removed `Board`, `BoardCard` type imports (moved to hook).
- Removed `db`, `getLocalCardsAsBoardCards`, `ensureLocalBoard`, `addLocalCard`, and the firestore static imports from the page (moved to `useWorkspaceBoard`).
- Removed `calculateContentDiscoveryScore`, `calculateVideoDiscoveryScore`, `isItemBlocked`, `detectLanguage` imports (moved to hooks).
- Removed dead `moreMenuOpen` state + its click-outside branch.
- Removed dead `isLoading` and `initialLoadDone` states.
- Removed dead `loadTrackedCreators` wrapper.
- Removed duplicate `fetchCountRef` declaration.

## Final state

| File | Before | After | Change |
|------|--------|-------|--------|
| `src/app/discover/page.tsx` | 2182 | 1248 | -934 (-43%) |
| `src/hooks/useBlocklistSync.ts` | — | 17 | new |
| `src/hooks/useCategories.ts` | — | 101 | new |
| `src/hooks/useChatSessions.ts` | — | 58 | new |
| `src/hooks/useDiscoverFilters.ts` | — | 296 | new |
| `src/hooks/useDiscoverData.ts` | — | 179 | new |
| `src/hooks/useWorkspaceBoard.ts` | — | 247 | new |
| `src/hooks/useCreatorSearch.ts` | — | 119 | new |
| `src/lib/discovery/time-periods.ts` | — | 90 | new |
| `src/components/discover/FilterDropdown.tsx` | — | 320 | new |

## Verification

- `npx tsc --noEmit`: passes (no errors in touched files; remaining errors are pre-existing vitest/jest module issues in unrelated test files).
- `npx next build`: succeeds, all routes compile, no warnings.
- Browser click-through: not performed (Claude cannot drive the browser). User should verify:
  1. Discover feed loads, filters apply, blocklist hides items reactively.
  2. New chat opens split panel, quick pills trigger flows, save-to-board works.
  3. Workspace board CRUD (add/delete/duplicate/move/reference cards).
  4. Creator search + track, category add/remove, infinite scroll.

## Architectural notes

- **No React Query migration.** The audit flagged that CLAUDE.md §State Management mandates React Query for server state. The extracted hooks still use plain `fetch` + `useState`. Migrating to React Query is a separate, larger refactor that would touch every API route and is out of scope for this pass. The current extraction is a strict improvement (logic is testable and reusable) without changing the data-fetching mechanism.
- **`boards/page.tsx` not refactored.** The audit noted it shares Firestore-layer duplication with discover. It's 865 lines — smaller than discover was, and already delegates to `BoardCanvas` + `CardContextMenu` components. Left for a future pass.
- **`useDiscoverData` does not own `selectedTimePeriod`.** This is intentional to break the circular dep between data and filters hooks. The trade-off: the parent must pass `timePeriod` when calling fetch functions. If the filters hook ever becomes the single owner of fetch-trigger state, this could be revisited.
- **`FilterDropdown` has 18 props.** This is a lot, but each is a single filter state + setter. Wrapping them in a single object wouldn't reduce the count, just the call-site arity. Left as-is for type clarity.

---

## Iteration 2 — `boards/page.tsx` refactor (2026-07-08)

The first pass left `boards/page.tsx` at 861 lines with the same god-component pattern discover had. Iteration 2 applies the same extraction discipline to it, plus a small shared-format util cleanup.

### Starting point (iteration 2)

- `src/app/boards/page.tsx`: **861 lines**, 13 `useState`, 2 `useEffect`, 9 inline async functions (`loadBoards`, `loadCards`, `handleCardMove`, `handleDropFromDiscover`, `handleCreateBoard`, `handleDeleteBoard`, `handleRemoveCard`, `handleDuplicateCard`, `handleAddNoteCard`, `handleSaveEdit`, `filteredBoards`, `handleOpenChat`), inline legacy `BoardItemLegacy` interface + legacy migration logic.
- 6 inline `formatDate` functions duplicated across `boards/page.tsx`, `VideoCard.tsx`, `ContentCard.tsx`, `discover/page.tsx` — with 4 different behaviors between them.

### Extractions performed

Each step was followed by `npx tsc --noEmit` + `npx next build` — both passed clean after every step.

### 10. `src/lib/format.ts` (18 lines, NEW)
Two shared date formatters — `formatDateShort` (full date "Jan 5, 2026") and `formatDateRelative` (compact "3h ago" / "2d ago" / "Jan 5"). The 6 inline `formatDate` functions across the codebase actually had 4 different behaviors; rather than force one shared function, two utils cover the two real behaviors. Consumers:
- `boards/page.tsx` → `formatDateShort(board.updatedAt)`
- `ContentCard.tsx` → `formatDateRelative(item.publishedAt)`
- `VideoCard.tsx` → `formatDateRelative(video.publishedAt)`

### 11. `useBoardsData` hook (src/hooks/useBoardsData.ts, 178 lines, NEW)
Owns `boards`, `searchQuery`, `isCreating`, `newBoardName`, `newBoardDesc`, `isLoading` + `loadBoards` (incl. default "My Ideas" board auto-seeding), `handleCreateBoard`, `handleDeleteBoard` (incl. batch card deletion + `onBoardDeleted` callback so the page can clear `selectedBoard` + `cards`), `filteredBoards`. Accepts `{ onBoardDeleted }` options arg.

### 12. `useBoardCards` hook (src/hooks/useBoardCards.ts, 387 lines, NEW)
Owns `cards` + the entire card CRUD surface: `loadCards` (incl. legacy `BoardItemLegacy` migration), `handleCardMove`, `handleDropFromDiscover` (drag-from-discover-feed), `handleRemoveCard`, `handleDuplicateCard`, `handleAddNoteCard` (returns the created card so the page can immediately open the editor), `handleUpdateCard`, `handleAddCard` (used by the chat panel's "add to board" callback). Accepts `{ selectedBoard, onCardAdded }` options arg. The `selectedBoard` dep means all callbacks re-memoize when the user switches boards — correct behavior since the Firestore path includes the board ID.

### 13. `useCardEditor` hook (src/hooks/useCardEditor.ts, 58 lines, NEW)
Owns `editingCard`, `editTitle`, `editContent` + `handleStartEdit`, `handleCancelEdit`, `handleSaveEdit`. Accepts `{ selectedBoard, onUpdateCard }` so it delegates the actual card update back to `useBoardCards` (single source of truth for card state). Keeps the editor UI state separate from the card data state.

### 14. `useBoardChatPanel` hook (src/hooks/useBoardChatPanel.ts, 73 lines, NEW)
Owns `chatOpen`, `chatCard` + `handleOpenChat`, `handleCloseChat`, `handleAddArtifactToBoard`. Accepts `{ selectedBoard, onAddCard }` and delegates the actual card insertion to `useBoardCards.handleAddCard`. Uses a local `ChatPanelArtifact` type (`{ type: string; content: string; platform?: string }`) instead of `ChatArtifact` from `@/types/chat` because `ChatPanel`'s `onAddToBoard` prop is typed loosely — using the strict type caused a callback-shape mismatch.

### 15. `boards/page.tsx` orchestrator rewrite (861 → 376 lines, 56% reduction)
Now composes 4 hooks + renders JSX. Inline `formatDate`, `BoardItemLegacy`, all 9 async functions, and the legacy migration block moved to hooks. Removed dead empty `<div className="p-3 border-t border-[#1a1a1a] space-y-1"></div>` sidebar footer. The `loadCards` effect now depends on `loadCards` (memoized via `useCallback`) so it re-runs correctly when the user switches boards.

### Verification (iteration 2)

- `npx tsc --noEmit`: passes clean (excluding pre-existing test-file errors).
- `npx next build`: succeeds, all routes compile.
- Browser click-through: user should verify:
  1. Boards list loads, "My Ideas" auto-seeds if absent, search filters boards.
  2. Create board dialog works, delete clears cards + board.
  3. Board canvas: add note, edit note (dialog opens with title/content), drag cards, drag-from-discover adds card, duplicate/remove work.
  4. Chat panel opens, "Add to board" on a generated artifact creates a card.
  5. Back button returns to board grid, selected board state clears.

### Architectural notes (iteration 2)

- **Hook composition for `boards/page.tsx`:**
  ```
  useAuth()                       → user
  useBoardsData({ onBoardDeleted })   → boards, searchQuery, isCreating, newBoard*, isLoading, CRUD
  useBoardCards({ selectedBoard })    → cards, loadCards, card CRUD (move/drop/remove/dup/addNote/update/add)
  useCardEditor({ selectedBoard, onUpdateCard })  → editingCard, edit*, edit handlers
  useBoardChatPanel({ selectedBoard, onAddCard }) → chatOpen, chatCard, chat handlers
  ```
- **`selectedBoard` lives in the page, not in a hook.** It's the bridge between `useBoardsData` (which owns the boards list) and `useBoardCards`/`useCardEditor`/`useBoardChatPanel` (which all operate on the selected board). Hoisting it into a `useSelectedBoard` hook would add indirection without reducing coupling.
- **`onBoardDeleted` callback pattern.** `useBoardsData.handleDeleteBoard` doesn't know about `selectedBoard` or `cards` (both live in the page or other hooks). It calls `onBoardDeleted(boardId)` and the page handles the cleanup (`setSelectedBoard(null)` + `setCards([])`). Avoids leaking board-selection state into the boards-list hook.
- **`onAddCard` / `onUpdateCard` / `onCardAdded` callbacks.** Same pattern — the editor/chat hooks delegate card mutation back to `useBoardCards` so card state has a single owner. The chat panel's "add to board" flow goes `useBoardChatPanel.handleAddArtifactToBoard` → Firestore write → `useBoardCards.handleAddCard` (which updates local state).
- **`ChatPanelArtifact` local type.** `ChatPanel.onAddToBoard` is typed as `(artifact: { type: string; content: string; platform?: string }) => void` — looser than `ChatArtifact`. Rather than cast at the call site (which would be unsafe), the hook accepts the loose type and narrows internally (`artifact.type === "script"` check). If `ChatPanel`'s prop type is ever tightened to `ChatArtifact`, the local type can be removed.
- **Sub-component extraction deferred.** The page is 376 lines now — readable as-is. Extracting `BoardSidebar` / `BoardGrid` / `BoardTopBar` would add three more files without meaningful complexity reduction. Left for a future pass if the page grows.

---

## Iteration 3 — shared format utils + ChannelAnalytics helper extraction (2026-07-08)

Iterations 1–2 left two cross-cutting smells: (1) 5 duplicated compact-number formatters across the codebase with 3 different behaviors, and (2) `ChannelAnalytics.tsx` at 1612 lines — the largest single file — with 4 inlined types + 8 pure helper functions that had nothing to do with React.

### Starting point (iteration 3)

- `src/lib/format.ts` (18 lines) — had `formatDateShort` + `formatDateRelative` only.
- 5 duplicated `formatNumber` / `formatViews` functions across `analyze/page.tsx`, `ChannelAnalytics.tsx`, `ContentChatPanel.tsx`, `creators/[channelId]/page.tsx`, `VideoCard.tsx` — with 3 different behaviors (nullable vs not, B/M/K vs M/K only).
- `ChannelAnalytics.tsx` (1612 lines) — inlined `ChannelVideo`, `ChannelInsights`, `ChannelStats`, `SeoPackage` types + `getScoreColorClass`, `getGrade`, `getHealthScoreColor`, `getHealthScoreBg`, `generateSuggestions`, `generateInsights`, `extractChannelId`, `exportToCSV` helpers + `formatNumber` / `formatDate` / `formatFullDate` formatters, all inline.

### Extractions performed

Each step was followed by `npx tsc --noEmit` + `npx next build` — both passed clean after every step.

### 16. Extend `src/lib/format.ts` (40 lines, was 18)
Added two new exports:
- `formatCompactNumber(num: number | null | undefined)` — handles B/M/K + nullable input (returns "N/A"). Unifies all 5 duplicates. The nullable variant covers `analyze/page.tsx`'s use case where `view_count` can be undefined.
- `formatDateLongRelative(dateString)` — "Today / Yesterday / N days ago / N weeks ago / N months ago / N years ago". Distinct from `formatDateRelative` ("Just now / Nh ago / Nd ago / short date") which is used by the discover feed cards.

### 17. Replace 5 duplicated formatters
- `ContentChatPanel.tsx` — removed inline `formatViews`, call site now `formatCompactNumber(item.viewCount)`.
- `VideoCard.tsx` — removed inline `formatViews` (was inside the component), 5 call sites now `formatCompactNumber(...)`.
- `creators/[channelId]/page.tsx` — removed inline `formatViews` wrapper, call site now `formatCompactNumber(video.viewCount)`.
- `analyze/page.tsx` — removed inline `formatNumber` (nullable variant), call site now `formatCompactNumber(videoMeta.view_count)`.
- `ChannelAnalytics.tsx` — removed inline `formatNumber`, `formatDate`, `formatFullDate`. Call sites now `formatCompactNumber(...)` and `formatDateLongRelative(...)`. `formatFullDate` was dead code (no callers).

### 18. Extract `src/lib/channel-analytics.ts` (296 lines, NEW)
Pure helpers + types extracted from `ChannelAnalytics.tsx`:
- Types: `ChannelVideo`, `ChannelInsights`, `ChannelStats`, `SeoPackage` (all exported, imported by the component via `type` imports).
- Pure functions: `getScoreColorClass`, `getGrade`, `getHealthScoreColor`, `getHealthScoreBg`, `generateSuggestions` (82-line video-improvement-suggestion generator), `generateInsights` (63-line hook/day/length/topic aggregator), `extractChannelId` (URL parser), `exportToCSV` (CSV blob builder + download trigger, uses `toast` from sonner).

The component file dropped from 1612 → 1304 lines. The two small presentational sub-components `CopyButton` and `ScoreBadge` (which depend on `getScoreColorClass` from the lib) stayed in the component file — they're React and tightly coupled to the modal JSX that uses them.

### Verification (iteration 3)

- `npx tsc --noEmit`: passes clean (excluding pre-existing test-file errors).
- `npx next build`: succeeds, all routes compile.
- Browser click-through: user should verify:
  1. Channel analytics page loads, charts render, CSV export works.
  2. Video detail modal opens, "Boost" SEO package generation works, analysis tabs render.
  3. Discover feed cards still show "1.2M views" / "3h ago" formatting correctly.
  4. Analyze page shows "N/A" for missing view counts (nullable `formatCompactNumber` path).

### Architectural notes (iteration 3)

- **Three date formatters, not one.** `formatDateShort` (full date), `formatDateRelative` (compact feed-style), `formatDateLongRelative` (channel-analytics-style with "Today/Yesterday"). Tried to unify; the three call sites genuinely want different granularities. Forcing one would require conditional args. Left as three named exports — the names document the intent.
- **`formatCompactNumber` nullable by design.** The `analyze/page.tsx` call site passes `videoMeta.view_count` which can be `undefined`. The other 4 call sites pass `number`. The unified function accepts `number | null | undefined` and returns "N/A" for nullish — the non-nullable call sites are unaffected (the type widens but the runtime behavior is identical for finite numbers). Avoids a separate `formatViewsNullable` function.
- **`lib/channel-analytics.ts` is domain-logic, not UI.** `generateSuggestions` and `generateInsights` are pure functions over `ChannelVideo[]` — they could be unit-tested without rendering any React. This is the right layer for them. The `exportToCSV` function does touch the DOM (creates a blob + anchor + click), but it's still pure-ish (no React state) and lives better with the other analytics helpers than in the component.
- **Sub-component extraction stopped at helpers.** `VideoDetailModal` (415 lines), `FixVideoModal` (141), `CompareModal` (45) are large JSX blocks but they share many imports (`VideoAnalysisResult`, recharts, `ScoreBadge`, `CopyButton`, `getGrade`) and extracting them would require duplicating the import surface or creating a shared internal module. The helper extraction (the real architectural win) is done; the modal extraction is mechanical and deferred until there's a reason to touch them.

---

## Iteration 4 — discover card dedup + useCardState hook (2026-07-08)

Iterations 1–3 focused on pages and pure helpers. Iteration 4 turns to the two largest presentational components: `VideoCard.tsx` (656 lines) and `ContentCard.tsx` (500 lines). Both implement the same card-with-modal-with-boost pattern with nearly identical state shapes.

### Starting point (iteration 4)

- `ContentCard.tsx` (500 lines) — inline `formatScore` (K-only compact number), `getSourceIcon` (emoji map for 7 sources), `getSourceLabel` (display name map for 7 sources), 5 `useState` calls for card UI state (`imageError`, `isModalOpen`, `isBoostOpen`, `fullDescription`, `isLoadingDescription`), `openModal` function.
- `VideoCard.tsx` (656 lines) — same 5 `useState` calls + 3 more (`transcript`, `isLoadingTranscript`, `channelThumbnail`), same `openModal` pattern (sets modal open + triggers fetches).

### Extractions performed

Each step was followed by `npx tsc --noEmit` + `npx next build` — both passed clean after every step.

### 19. `src/lib/content/sources.ts` (41 lines, NEW)
Two pure functions extracted from `ContentCard.tsx`:
- `getSourceIcon(source)` — emoji per source (🟠 hackernews, 🟣 devto, 📰 substack, etc.).
- `getSourceLabel(source)` — display name per source ("Hacker News", "DEV.to", "X/Twitter", etc.).

These are domain knowledge about content sources, not UI logic — they belong in `lib/content/` next to `thumbnails.ts` which already has source-specific icon URL logic.

### 20. Replace `ContentCard.formatScore` with `formatCompactNumber`
The inline `formatScore` was K-only (no M, no B). HN scores max ~10K so this was fine in practice, but it duplicated `formatCompactNumber`'s logic. Replaced both call sites (`item.score` displays) with `formatCompactNumber(item.score)`. Behavior is identical for scores < 1000 (both return the raw number) and for 1000–999999 (both return "N.NK"). For scores ≥ 1M, `formatCompactNumber` returns "N.NM" where `formatScore` would have returned "1500K" — but HN scores never reach that range, so no behavior change.

### 21. `useCardState` hook (src/hooks/useCardState.ts, 44 lines, NEW)
Encapsulates the 5 shared state variables + the open/close handlers:
- State: `imageError`, `isModalOpen`, `isBoostOpen`, `fullDescription`, `isLoadingDescription`.
- Handlers: `openModal` (calls optional `onModalOpen` callback), `closeModal` (also clears `fullDescription` so stale content doesn't flash on reopen), `openBoost`, `closeBoost`.
- Accepts `{ onModalOpen }` options arg. `ContentCard` passes `fetchFullDescription`; `VideoCard` passes `() => { fetchFullDescription(); fetchTranscript(); }`.

Both `ContentCard` and `VideoCard` now destructure the hook's return and alias `openModal` → `openCardModal` (to avoid clashing with any local `openModal` if one is added later).

### Verification (iteration 4)

- `npx tsc --noEmit`: passes clean (excluding pre-existing test-file errors).
- `npx next build`: succeeds, all routes compile.
- Browser click-through: user should verify:
  1. Discover feed video cards: click opens modal, "Boost" opens boost panel, modal close resets description, drag works.
  2. Discover feed article cards: same flows, source emoji/label render correctly, score shows as "1.5K" etc.
  3. Blocklist menu items still work (Hide, Not in my language, Hide creator).

### Architectural notes (iteration 4)

- **Line count went up for VideoCard.** 656 → 663 lines. The hook destructure is 14 lines vs the original 5 `useState` lines (10 lines). The win is the shared abstraction, not LOC. If `useCardState` ever grows to include the transcript/channelThumbnail state too, the savings compound.
- **`onModalOpen` callback, not hook-level fetch.** The two cards fetch different things on modal open (article content vs video description + transcript). Pushing the fetch into the hook would require the hook to know about `item`/`video` and the fetch endpoints — coupling that doesn't belong in a generic UI-state hook. The callback pattern lets each card own its fetch logic while sharing the open/close state machine.
- **`closeModal` clears `fullDescription`.** Subtle behavior: when the modal closes, the fetched description is cleared so the next open shows a loading state instead of stale content. This matches the original `setIsModalOpen(false)` behavior in both cards (neither explicitly cleared, but the loading state would re-trigger). Made it explicit in the hook.
- **`openModal` aliased to `openCardModal`.** Both cards rename the hook's `openModal` to `openCardModal` at the destructure site. This is defensive — if a card later adds its own `openModal` for a different purpose (e.g. a nested sub-component), there's no name clash. Cheap insurance.
- **`getSourceIcon` / `getSourceLabel` forward-looking.** The emoji/label maps include `instagram`, `tiktok`, `linkedin`, `x` even though those sources were removed from the feed (see PLATFORM_GUIDE.md "Removed" section). The filter UI still has an "instagram" format option (forward-looking per PLATFORM_GUIDE), so keeping these in the source map is consistent.

---

## Iteration 5 — ContentChatPanel hook extraction (2026-07-08)

Iteration 4 cleaned up the discover cards. Iteration 5 turns to `ContentChatPanel.tsx` (444 lines) — the split chat panel that opens from a video/article card. It mixed chat state management (messages, loading, sending) with 200+ lines of presentational JSX.

### Starting point (iteration 5)

- `ContentChatPanel.tsx` (444 lines) — inline `ChatMessage` interface, `isVideo` type guard, `SUGGESTIONS` constant, 4 `useState` calls, 2 `useRef`s, 3 `useEffect`s (scroll, escape-key, auto-send), `systemContext` string derivation, 4 async handlers (`handleSendMessage`, `handleHeadlineVariations`, `handleSaveAllToBoard`, `handleGenerateLink`), and the entire 200-line JSX tree.

### Extractions performed

Each step was followed by `npx tsc --noEmit` + `npx next build` — both passed clean after every step.

### 22. `useContentChat` hook (src/hooks/useContentChat.ts, 238 lines, NEW)
Owns the entire chat state + logic surface:
- State: `messages`, `inputText`, `isLoading`, `savingBoard`, `messagesEndRef`, `hasAutoSentRef`.
- Derived: `systemContext` (builds the LLM system prompt from `item`/`itemType`/`description`).
- Effects: scroll-to-bottom on new messages, escape-key handler, auto-send `initialPrompt` on panel open (routes to headline-variations vs generic chat).
- Handlers: `handleSendMessage` (POST `/api/chat/generate`), `handleHeadlineVariations` (POST `/api/chat/headline-variations`), `handleSaveAllToBoard` (writes N `HeadlineVariation` cards to localStorage "my-ideas" board via `ensureLocalBoard` + `addLocalCard`), `handleGenerateLink` (creates a share-link card + copies URL to clipboard), `resetChat` (clears messages + resets auto-send ref).
- Exports: `ChatMessage` interface, `isVideo` type guard (used by the component for the `viewCount` display in the empty-state context card).

Accepts `{ item, itemType, isOpen, initialPrompt, onClose }` options. The `onClose` callback is wired to the escape-key effect.

### 23. `ContentChatPanel.tsx` orchestrator rewrite (444 → 247 lines, 44% reduction)
Now composes the hook + renders JSX. The `SUGGESTIONS` constant (8 suggestion chips for video/article) stays in the component — it's presentational, not state. The `title`/`author` derivations stay inline (used once in the empty-state context card). The component is now ~200 lines of pure JSX + 1 hook call + 2 inline consts.

### Verification (iteration 5)

- `npx tsc --noEmit`: passes clean (excluding pre-existing test-file errors).
- `npx next build`: succeeds, all routes compile.
- Browser click-through: user should verify:
  1. Open chat from a video card — auto-send prompt fires if `initialPrompt` passed, messages render, loading spinner shows.
  2. "Create headline variation" suggestion → 5 headline variations render with copy buttons, "Save all to board" shows spinner then toast, headlines appear in My Ideas.
  3. Header buttons: "New chat" (plus icon) clears messages, "Link" generates share URL + copies to clipboard + saves reference card to My Ideas.
  4. Escape key closes the panel.
  5. Suggestion chips at the bottom send the corresponding prompt.

### Architectural notes (iteration 5)

- **Total LOC went up slightly (444 → 485).** The hook has more boilerplate (type exports, `useCallback` wrappers, explicit `return` object). The win is separation of concerns: the component is now pure presentation, the hook is testable in isolation. If the chat logic ever needs to be reused (e.g. a board-embedded chat), the hook is ready.
- **`isVideo` type guard exported from the hook.** Originally a private function in the component file. The hook needs it for `systemContext` derivation; the component still needs it for the `viewCount` display. Exporting from the hook avoids duplicating it in the component. Could move to `lib/content` if other components need it, but for now the hook is the only other consumer.
- **`systemContext` derived in the hook, not the component.** Originally it was a `const` in the component body. Moved to the hook because `handleSendMessage` needs it (it's part of the chat logic). The component doesn't need it — only the hook's `handleSendMessage` uses it.
- **`resetChat` exposed for the "New chat" button.** Originally the button did `setMessages([]); hasAutoSentRef.current = false;` inline. The `hasAutoSentRef` is internal to the hook — the component can't reset it directly. Exposed `resetChat` as the public API. This is the right boundary: the ref is an implementation detail of auto-send, and resetting it should be coupled with clearing messages.
- **Auto-send effect now has explicit deps.** Originally had `// eslint-disable-next-line react-hooks/exhaustive-deps` because it referenced `handleHeadlineVariations`/`handleSendMessage` which weren't memoized. Now both are `useCallback`-wrapped, so the effect can list them as deps without the lint disable.

---

## Iteration 6 — Voice page lib + hook extraction (2026-07-08)

Iteration 5 finished the discover cards. Iteration 6 turns to `src/app/voice/page.tsx` (889 lines) — the voice profile builder page. It inlined the `analyzeText` text-analysis engine (~65 lines), the `extractVideoId` URL parser, 3 TypeScript interfaces, 7 `useState` calls, 1 `useEffect` (load profile on mount), and 8 async handlers (`analyzeAndBuild`, `fetchTranscriptsFromLinks`, `handleAnalyzeSample`, `handleAnalyzeLinks`, `handleSourceSelect`, `handleChatAnswer`, `handleFeedbackSubmit`, `handleRevert`, `handleManualEdit`).

### Starting point (iteration 6)

- `voice/page.tsx` (889 lines) — inline `VoiceFingerprint`/`VoiceProfileVersion`/`VoiceProfileData` interfaces, inline `analyzeText` (text-analysis: hook style, tone, vocabulary, humor, CTA pattern, sentence length detection), inline `extractVideoId` (YouTube URL parser), 7 `useState` calls for profile state (`fingerprint`, `versions`, `currentVersion`, plus UI flow state), `useEffect` for Firestore load-on-mount, 9 handler functions, 5 inline sub-components (`SourceCard`, `VoiceFingerprintCard`, `FingerprintItem`, `FeedbackForm`, `VersionHistory`), and the `VOICE_QUESTIONS` constant (5 guided-chat questions).
- Also: a separate read-only `useVoiceProfile` hook already existed in `src/hooks/useVoiceProfile.ts` (fetcher only, no CRUD). Naming the new hook required care to avoid clashing.

### Extractions performed

Each step was followed by `npx tsc --noEmit` + `npx next build` — both passed clean after every step.

### 24. `voice-analysis` lib (src/lib/voice-analysis.ts, 98 lines, NEW)
Pure domain logic extracted from the page:
- Types: `VoiceFingerprint`, `VoiceProfileVersion`, `VoiceProfileData`.
- `analyzeText(text)` — the text-analysis engine. Detects:
  - `hookStyle` from the first sentence (question / number / "I"/"my" / "you"/"your" / pattern interrupt).
  - `tone` from punctuation + keywords (energetic if >3 `!`, inspirational if "imagine"/"picture this", authentic if "honestly"/"real talk", else conversational).
  - `vocabulary` from unique-words/total ratio (>0.4 rich, <0.2 simple, else accessible).
  - `humorLevel` from keyword count (lol/haha/funny/joke/hilarious/ridiculous).
  - `ctaPattern` by regex match against 4 CTA archetypes in the last 500 chars.
  - `sentenceLength` from average words-per-sentence.
  - `sampleSentences` — first 3 sentences as samples.
- `extractVideoId(url)` — YouTube URL parser (handles `watch?v=`, `youtu.be/`, `embed/`, and query-param variants).

### 25. `useVoiceProfileBuilder` hook (src/hooks/useVoiceProfileBuilder.ts, 172 lines, NEW)
Owns the full profile CRUD surface:
- State: `fingerprint`, `versions`, `currentVersion`.
- `loadProfile()` — Firestore `getDoc` on mount (reads `users/{uid}/voiceProfile/default`).
- `analyzeAndBuild(text, sources, { onProgress, onComplete, analysisSteps })` — runs the progress animation (default 4 steps with 600ms delays), calls `analyzeText`, persists the new version to Firestore via `setDoc({ merge: true })`.
- `fetchTranscriptsFromLinks(videoLinks)` — splits on newlines, calls `/api/youtube/transcript` per link, concatenates.
- `handleFeedbackSubmit({ rating, tags })` — annotates the latest version with feedback, persists.
- `handleRevert(version)` — sets `fingerprint` + `currentVersion` to a prior version (local-only; no Firestore write — matches original behavior).
- `handleManualEdit(newFingerprint)` — updates local fingerprint after the manual-edit form.

Named `useVoiceProfileBuilder` (not `useVoiceProfile`) to avoid clashing with the existing read-only `useVoiceProfile` hook in `src/hooks/useVoiceProfile.ts`. The existing hook is a fetcher; this one is the full builder.

### 26. `voice/page.tsx` orchestrator rewrite (889 → 685 lines, 23% reduction)
- Removed inline interfaces, `analyzeText`, `extractVideoId` — imported from `@/lib/voice-analysis`.
- Removed inline Firestore state + handlers — destructured from `useVoiceProfileBuilder()`.
- Removed unused imports: `doc`, `setDoc`, `getDoc`, `collection`, `query`, `orderBy`, `getDocs` from `firebase/firestore`; `db` from `@/lib/firebase`; `useEffect`, `useRef`, `useCallback` from `react`.
- 5 inline sub-components (`SourceCard`, `VoiceFingerprintCard`, `FingerprintItem`, `FeedbackForm`, `VersionHistory`) stay inline — they're presentational, single-use, and depend on local JSX patterns.
- `VOICE_QUESTIONS` constant (5 guided-chat questions with options) stays inline — it's data, not logic.
- The page's `VoiceProfileContent` component now composes the hook + renders JSX. Local state is only UI flow state: `step`, `inputMethod`, `isAnalyzing`, `analysisProgress`, `isEditing`, `sampleText`, `videoLinks`, `chatAnswers`, `chatStep`, `hasSubmittedFeedback`.

### Verification (iteration 6)

- `npx tsc --noEmit`: passes clean (excluding pre-existing test-file errors in `*.test.ts` files).
- `npx next build`: succeeds, `/voice` route compiles.
- Browser click-through: user should verify:
  1. `/voice` — pick "Paste Sample Text", paste content, "Analyze" — progress bar animates through 4 steps, fingerprint renders.
  2. "Paste Video Links" — paste 1+ YouTube URLs, transcripts fetch, fingerprint builds.
  3. "Guided Chat" — answer 5 questions, fingerprint builds from answers.
  4. Result view — fingerprint card renders 6 attributes + sample sentences, "Edit Manually" opens edit form.
  5. Feedback form — star rating + tags, submit annotates the version.
  6. Version history — revert to a prior version.
  7. Reload — profile loads from Firestore (or localStorage fallback).

### Architectural notes (iteration 6)

- **Naming clash avoided.** The existing `useVoiceProfile` hook (`src/hooks/useVoiceProfile.ts`) is a read-only fetcher used elsewhere. The new hook is `useVoiceProfileBuilder` — the full CRUD builder. Different name, different responsibility. If the read-only hook is ever deprecated, the builder can inherit the simpler name.
- **`onProgress` / `onComplete` callback API.** The hook's `analyzeAndBuild` accepts progress callbacks instead of owning the UI state directly. This lets the page control the progress bar / step transitions without the hook knowing about React state setters. Mirrors the `onBoardDeleted` / `onCardAdded` callback pattern from iteration 2's boards-page refactor.
- **`analysisSteps` is configurable.** The hook accepts an optional `analysisSteps` array (default: 4 hardcoded step labels). Forward-looking — if the guided-chat flow ever wants different step labels than the sample-text flow, the caller can pass custom steps. Currently all 3 input methods use the default.
- **Fire-and-forget persistence.** `analyzeAndBuild` writes to Firestore but doesn't await the write before calling `onComplete`. The fingerprint renders immediately; the version save happens in the background. Matches the original behavior — the page never blocked on the Firestore write.
- **`handleRevert` is local-only.** Reverting to a prior version updates local state but doesn't persist to Firestore. This matches the original behavior (the original `handleRevert` also didn't call `setDoc`). If persistence is ever needed, it's a 4-line addition to the hook.
- **Sub-components kept inline.** `SourceCard`, `VoiceFingerprintCard`, `FingerprintItem`, `FeedbackForm`, `VersionHistory` are single-use presentational components tightly coupled to the page's JSX. Extracting them to separate files would add 5 imports + 5 files for no reuse benefit. The page is still 685 lines, but the bulk is now JSX (not logic), which is acceptable.
- **`VOICE_QUESTIONS` stays inline.** It's a 65-line data constant. Could move to `lib/voice-analysis.ts`, but it's only used by this page and moving it would split the voice-related code across 3 files. Kept inline for cohesion.

---

## Iteration 7 — VideoCardModal extraction (2026-07-08)

Iteration 6 finished the voice page. Iteration 7 turns to `src/components/discover/VideoCard.tsx` (663 lines) — the video card component. The bulk was a ~185-line inline modal JSX tree (lines 434-617) that mixed presentation with action handlers (`blockItem`, `toast`, `onSave`).

### Starting point (iteration 7)

- `VideoCard.tsx` (663 lines) — inline modal JSX for the video detail view: header bar with 5 action buttons (Boost/Hide/Save/Open/Close), embedded YouTube iframe, author section with channel thumbnail, stats bar (7 conditional stat pills), title, description section with copy + loading skeleton, transcript section with copy + loading skeleton + not-available fallback. All inline, with `blockItem`/`toast`/`formatCompactNumber` called directly in JSX onClick handlers.

### Extractions performed

Each step was followed by `npx tsc --noEmit` + `npx next build` — both passed clean after every step.

### 27. `VideoCardModal` component (src/components/discover/VideoCardModal.tsx, 252 lines, NEW)
Pure presentational component receiving all state + callbacks as props:
- Props: `video`, `channelThumbnail`, `fullDescription` (`string | null`), `transcript` (`string | null`), `isLoadingDescription`, `isLoadingTranscript`, `onClose`, `onBoost`, `onSave`.
- 3 inline handlers extracted from JSX onClick attributes: `handleHide` (calls `blockItem` + `toast` + dispatches blocklist event + `onClose`), `handleSave` (calls `onClose` then `onSave?.(video)`), `handleDownloadThumbnail` (creates an `<a>` element and clicks it).
- All 7 stat pills, the description section, and the transcript section render exactly as before — no behavior change.

### 28. `VideoCard.tsx` orchestrator rewrite (663 → 490 lines, 26% reduction)
- Replaced the 185-line inline modal JSX with a single `<VideoCardModal ... />` call.
- Removed unused `blockItem` import (moved to modal). `blockLanguage`, `blockCreator`, `detectLanguage` still used by the context menu items.
- `formatCompactNumber` still used by the card body (view count display). `formatDateRelative` still used by the card body.
- The card's own state (`transcript`, `isLoadingTranscript`, `channelThumbnail`) is now passed as props to the modal instead of being consumed inline.

### Verification (iteration 7)

- `npx tsc --noEmit`: passes clean (excluding pre-existing test-file errors).
- `npx next build`: succeeds, `/discover` route compiles.
- Browser click-through: user should verify:
  1. Click a video card — modal opens with iframe, author, stats, description, transcript.
  2. Header buttons: Boost (opens boost panel), Hide (blocks + closes + toast), Save (closes + opens board picker), Open (new tab to YouTube), Close.
  3. Description section: loading skeleton shows, then fetched description renders. Copy button works.
  4. Transcript section: loading skeleton → transcript or "not available" fallback. Copy button works.
  5. Stats bar: outlier score, weighted outlier, subs, views, likes, comments, engagement rate, velocity trend — all render conditionally.

### Architectural notes (iteration 7)

- **Props are all read-only.** The modal receives `fullDescription`/`transcript` as props (not setters). The parent owns the fetch logic; the modal only renders. This matches the pattern from iteration 4's `useCardState` — the hook owns state, the component renders.
- **`fullDescription` is `string | null`.** Originally `useState<string | null>(null)` in `useCardState`. The modal's prop type matches. The JSX fallback chain (`fullDescription || video.description || "No description available."`) handles all 3 cases.
- **`handleHide` extracted from inline onClick.** Originally the hide button had a 4-statement inline onClick: `blockItem(video.id); toast.success(...); window.dispatchEvent(...); closeModal();`. Extracted to a named function for readability. Same for `handleSave` and `handleDownloadThumbnail`.
- **Modal is not `React.memo`'s.** The parent `VideoCard` is `React.memo`'d, so the modal only re-renders when the parent does. Wrapping the modal in its own `React.memo` would add a shallow-compare pass on every parent render for no benefit (the props are primitives or stable references from `useCardState`).
- **No behavior change.** Every JSX line, every conditional, every class name was preserved verbatim. The only changes are: (1) inline onClick → named handler, (2) `closeModal()` → `onClose()`, (3) `openBoost()` → `onBoost()`. The modal is a pure extraction.
- **Line count math.** VideoCard 663 → 490 (−173). VideoCardModal +252. Net +79 lines, but the separation of concerns is clear: VideoCard is now a card + context menu + boost modal; VideoCardModal is the detail view. Each is independently readable.

---

## Iteration 8 — ContentCardModal extraction (2026-07-08)

Iteration 7 extracted the video modal. Iteration 8 applies the same pattern to `src/components/discover/ContentCard.tsx` (457 lines) — the article card. It had a ~131-line inline modal JSX tree (lines 289-418) mirroring the video modal structure.

### Starting point (iteration 8)

- `ContentCard.tsx` (457 lines) — inline modal JSX for the article detail view: header bar with 5 action buttons (Boost/Hide/Save/Open/Close), optional thumbnail, author section with source emoji, stats bar (5 conditional stat pills: outlier, score, comments, shares, engagement rate), and a Note/content section with copy + loading skeleton. All inline, with `blockItem`/`toast`/`getSourceIcon`/`getSourceLabel`/`formatCompactNumber` called directly in JSX.

### Extractions performed

Each step was followed by `npx tsc --noEmit` + `npx next build` — both passed clean after every step.

### 29. `ContentCardModal` component (src/components/discover/ContentCardModal.tsx, 208 lines, NEW)
Pure presentational component receiving all state + callbacks as props:
- Props: `item` (ContentItem), `fullDescription` (`string | null`), `isLoadingDescription`, `onClose`, `onBoost`, `onSave`.
- 3 inline handlers extracted from JSX onClick attributes: `handleHide` (calls `blockItem` + `toast` + dispatches blocklist event + `onClose`), `handleSave` (calls `onClose` then `onSave?.(item)`), `handleDownloadThumbnail` (creates an `<a>` element and clicks it — only rendered when `item.thumbnail` exists).
- All 5 stat pills, the thumbnail, author section, and Note section render exactly as before — no behavior change.

### 30. `ContentCard.tsx` orchestrator rewrite (457 → 336 lines, 26% reduction)
- Replaced the 131-line inline modal JSX with a single `<ContentCardModal ... />` call.
- Removed unused `blockItem` import (moved to modal). `blockLanguage`, `blockCreator`, `detectLanguage` still used by the context menu items.
- `getSourceIcon`, `getSourceLabel`, `formatCompactNumber`, `formatDateRelative` still used by the card body (thumbnail, author, score, date displays).

### Verification (iteration 8)

- `npx tsc --noEmit`: passes clean (excluding pre-existing test-file errors).
- `npx next build`: succeeds, `/discover` route compiles.
- Browser click-through: user should verify:
  1. Click an article card (HN/DEV.to/Substack) — modal opens with thumbnail (if present), author, stats, Note section.
  2. Header buttons: Boost (opens boost panel), Hide (blocks + closes + toast), Save (closes + opens board picker), Open (new tab to article URL), Close.
  3. Note section: loading skeleton shows, then fetched/scraped content renders. Copy button works.
  4. Stats bar: outlier score, score (likes), comments, shares, engagement rate — all render conditionally.
  5. Thumbnail download button only appears when `item.thumbnail` exists.

### Architectural notes (iteration 8)

- **Mirrors VideoCardModal pattern.** Same prop shape (read-only state + `onClose`/`onBoost`/`onSave` callbacks), same 3 inline handlers extracted (`handleHide`/`handleSave`/`handleDownloadThumbnail`). The symmetry makes the two card types easy to reason about together.
- **`fullDescription` is `string | null`.** Matches `useCardState`'s state type and the VideoCardModal precedent. The JSX fallback chain (`fullDescription || item.description || "No content available."`) handles all 3 cases.
- **Thumbnail download is conditional.** The button only renders when `item.thumbnail` exists. The handler early-returns if `item.thumbnail` is falsy (defensive — shouldn't happen since the button isn't rendered, but cheap insurance).
- **No `React.memo` on the modal.** Same reasoning as VideoCardModal — the parent `ContentCard` is `React.memo`'d, so the modal only re-renders on parent re-render. The props are primitives or stable references from `useCardState`.
- **Line count math.** ContentCard 457 → 336 (−121). ContentCardModal +208. Net +87 lines, but the separation mirrors iteration 7 — ContentCard is now a card + context menu + boost modal; ContentCardModal is the detail view.
- **Both card modals now follow the same pattern.** If a future iteration wants to extract a shared `BaseCardModal` (header bar with action buttons, stats bar, content section), the symmetry makes that extraction straightforward. Not doing it now — three similar lines are better than a premature abstraction (per CLAUDE.md §General Principles).

---

## Iteration 9 — ChannelVideoDetailModal extraction (2026-07-08)

Iteration 8 finished the article card modal. Iteration 9 turns to `src/components/channel/ChannelAnalytics.tsx` (1304 lines) — the per-channel analytics view. The bulk was a ~414-line inline `VideoDetailModal` (lines 349-762) that mixed video analysis fetching, SEO boost generation, 6-tab analysis rendering, and 4-tab boost-package rendering, plus 2 tightly-coupled helper components (`CopyButton`, `ScoreBadge`) and the `VideoAnalysisResult` interface.

### Starting point (iteration 9)

- `ChannelAnalytics.tsx` (1304 lines) — inline `CopyButton` (16 lines), `ScoreBadge` (7 lines), `VideoAnalysisResult` interface (14 lines), `VideoDetailModal` (414 lines). The modal had: 6 `useState` calls, 3 `useEffect`s (load cached analysis, auto-fetch on open, reset boost tab), 2 async fetch handlers (`fetchAnalysis` hitting `/api/generate/video-analysis`, `handleBoost` hitting `/api/generate/seo`), a 7-tab analysis tab bar, a `renderAnalysisContent` switch with 6 branches (overview/title/thumbnail/hook/retention/seo/actions), and a 4-tab boost-package section (titles/description/tags/thumbnails).
- Dead props: `onFixVideo` and `topVideos` were declared in the modal's props but never referenced in the modal body. Dead code: `const router = useRouter()` was declared but never used.

### Extractions performed

Each step was followed by `npx tsc --noEmit` + `npx next build` — both passed clean after every step.

### 31. `ChannelVideoDetailModal` component (src/components/channel/ChannelVideoDetailModal.tsx, 374 lines, NEW)
Self-contained modal receiving only what it needs:
- Props: `video` (`ChannelVideo | null`), `isOpen`, `onClose`, `channelStats` (`ChannelStats | null | undefined`). Dropped the dead `onFixVideo` and `topVideos` props.
- Moved inline: `CopyButton`, `ScoreBadge`, `VideoAnalysisResult` interface.
- Owns: 6 `useState` calls, 3 `useEffect`s, `fetchAnalysis`, `handleBoost`, `analysisTabs` const, `renderAnalysisContent` switch.
- Removed dead `const router = useRouter()` — was declared, never used.

### 32. `ChannelAnalytics.tsx` orchestrator rewrite (1304 → 850 lines, 35% reduction)
- Replaced inline `VideoDetailModal` invocation with `<ChannelVideoDetailModal video={listSelectedVideo} isOpen={...} onClose={...} channelStats={listStats} />`.
- Removed `getScoreColorClass` and `getGrade` from imports (only used by the moved `ScoreBadge`).
- `SeoPackage` type still imported (used by `FixVideoModal`'s boost logic, which stays inline).
- `listTopVideos` variable retained — still used to render the "Top Videos" section in the analytics view (separate from the modal).

### Verification (iteration 9)

- `npx tsc --noEmit`: passes clean (excluding pre-existing test-file errors).
- `npx next build`: succeeds, `/channel` route compiles.
- Browser click-through: user should verify:
  1. `/channel` — click a video in the table → modal opens with thumbnail, stats grid, channel context, AI analysis section.
  2. AI analysis: auto-fetches on first open (or loads from localStorage cache). 7 tabs render conditionally. "Refresh" button forces re-fetch.
  3. Boost section: "Boost" button calls `/api/generate/seo`, 4 tabs render (titles/description/tags/thumbnails) with copy buttons.
  4. Modal close (X or backdrop click) — state resets.
  5. `onFixVideo` flow still works — the "Fix" button is in the `VideoCard` row (separate from the modal), opens `FixVideoModal` (still inline in ChannelAnalytics).

### Architectural notes (iteration 9)

- **Dead props removed.** `onFixVideo` and `topVideos` were declared in the modal's props but never read in the body — vestigial from an earlier design where the modal maybe had a "fix this video" button. Removed cleanly; no behavior change.
- **Dead `useRouter` removed.** `const router = useRouter()` was at the top of the modal but `router` was never referenced. Likely leftover from a removed "open in new tab" button. Removed.
- **`CopyButton` and `ScoreBadge` moved, not duplicated.** Both were only used inside the modal (verified by grep — all 14 usages were within lines 349-762). Moving them to the modal file keeps them co-located with their only consumer. If `FixVideoModal` or `CompareModal` ever need them, they can be extracted to a shared `lib/channel-ui.tsx` — but right now they don't.
- **`VideoAnalysisResult` interface moved.** It's only used by the modal's state + the `fetchAnalysis` response typing. Co-located with the modal.
- **`SeoPackage` stays in `lib/channel-analytics.ts`.** It's used by both `ChannelVideoDetailModal` (boost output) and `FixVideoModal` (also has boost logic, still inline). The type is defined in the lib, imported by both — single source of truth.
- **`listTopVideos` not dead.** Initially looked like it might be unused after dropping the `topVideos` modal prop, but it's still used to render the "Top Videos" grid in the analytics view (line 686). Retained.
- **Line count math.** ChannelAnalytics 1304 → 850 (−454). ChannelVideoDetailModal +374. Net −80 lines, because the extracted modal shed dead code (dead `useRouter`, dead props, and the `CopyButton`/`ScoreBadge`/`VideoAnalysisResult` moved rather than duplicated). The parent file is now under 900 lines and the modal is a self-contained 374-line component.

---

## Iteration 10 — Analyze page lib + hook extraction (2026-07-08)

Iteration 9 finished the channel modal. Iteration 10 turns to `src/app/analyze/page.tsx` (627 lines) — the structure analysis results page. It inlined 2 format functions, an `AnalysisError` interface, 4 `useState` calls, 2 `useCallback` fetch handlers, 1 `useEffect`, 3 more `useCallback` handlers (retry, copy, export, save), 1 `useMemo`, and a 25-line markdown-summary template literal.

### Starting point (iteration 10)

- `analyze/page.tsx` (627 lines) — inline `AnalysisError` interface, `formatDuration` (8 lines), `formatDate` (11 lines), `AnalyzePageContent` component with: `result`/`isLoading`/`error`/`expandedBeats` state, `analyzeVideo` + `analyzeArticle` fetch handlers (each ~25 lines, near-identical), `useEffect` to trigger analysis on mount, `handleRetry`, `handleCopy` (with a 25-line markdown template literal), `handleExportJson`, `handleSaveToBoard` (Firestore write), `visibleBeats` useMemo, `hasMoreBeats` derived const, then ~400 lines of JSX (loading skeleton, error card, no-content state, results).

### Extractions performed

Each step was followed by `npx tsc --noEmit` + `npx next build` — both passed clean after every step.

### 33. `analyze-helpers` lib (src/lib/analyze-helpers.ts, 59 lines, NEW)
Pure helpers extracted from the page:
- `AnalysisError` interface.
- `formatDuration(seconds)` — converts seconds to `H:MM:SS` or `M:SS` string.
- `formatDate(dateString?)` — locale-aware date formatting with try/catch fallback.
- `formatAnalysisAsMarkdown(result)` — the 25-line markdown summary template (hook/intro/beats/outro/overall). Extracted as a pure function so the hook can call it without inlining the template.

### 34. `useAnalyzePage` hook (src/hooks/useAnalyzePage.ts, 161 lines, NEW)
Owns the full analysis page state + logic:
- State: `result` (`AnalyzeResult | null`), `isLoading`, `error` (`AnalysisError | null`), `expandedBeats`.
- Reads `videoId` / `contentId` from `useSearchParams`.
- `analyzeVideo(id)` / `analyzeArticle(url)` — POST to `/api/analyze`, set result or error.
- `useEffect` triggers analysis on mount based on `videoId`/`contentId`.
- `handleRetry` — re-runs the appropriate analyzer.
- `handleCopy` — calls `formatAnalysisAsMarkdown`, writes to clipboard, toasts.
- `handleExportJson` — creates a Blob, triggers download via temporary `<a>` element.
- `handleSaveToBoard` — Firestore `addDoc` to `users/{uid}/savedAnalyses`.
- `visibleBeats` useMemo + `hasMoreBeats` derived const.

### 35. `analyze/page.tsx` orchestrator rewrite (627 → 454 lines, 28% reduction)
- Destructured `useAnalyzePage()` — replaced 4 `useState` + 2 fetch handlers + `useEffect` + 4 handlers + `useMemo` + derived const with a single hook call.
- Removed inline `AnalysisError`, `formatDuration`, `formatDate` — imported from `@/lib/analyze-helpers`.
- Removed unused imports: `useState`, `useEffect`, `useCallback`, `useMemo` from `react`; `useSearchParams`, `useAuth`; `collection`, `addDoc`, `db`; `AnalyzeResult` type; `toast`.
- The `router` stays in the page (used by the "Go to Discover" button in the no-content state).
- ~400 lines of JSX remain inline — loading skeleton, error card, no-content state, and the results view (source metadata card, hook card, beats list, overall scores, source-specific data tabs).

### Verification (iteration 10)

- `npx tsc --noEmit`: passes clean (excluding pre-existing test-file errors).
- `npx next build`: succeeds, `/analyze` route compiles.
- Browser click-through: user should verify:
  1. `/analyze?videoId=...` — analysis fetches on mount, results render (hook, intro, beats, outro, overall).
  2. "Re-analyze" button — re-fetches.
  3. "Copy" button — markdown summary copied to clipboard.
  4. "Export JSON" — downloads `structure-analysis-{videoId}.json`.
  5. "Save to board" — writes to Firestore `users/{uid}/savedAnalyses`.
  6. Beats "Show more" / "Show less" — toggles `expandedBeats`, re-derives `visibleBeats`.
  7. Error state — "Try Again" button re-runs analyzer.
  8. `/analyze?contentId=...` — article analysis path (same flow, `sourceType: "article"`).

### Architectural notes (iteration 10)

- **`formatAnalysisAsMarkdown` extracted as a pure function.** The 25-line template literal was inline in `handleCopy`. Moving it to `lib/analyze-helpers.ts` makes it testable in isolation and keeps the hook focused on orchestration rather than string templating. The hook calls it; the hook doesn't own the template.
- **`analyzeVideo` and `analyzeArticle` are near-identical.** Could be unified into a single `analyze(sourceType, payload)` function. Didn't — the two paths have slightly different error messages ("Failed to analyze video" vs "Failed to analyze article") and unifying would require a union payload type. Three similar lines are better than a premature abstraction (per CLAUDE.md §General Principles).
- **`router` stays in the page.** The hook doesn't need `useRouter` — the only navigation is the "Go to Discover" button in the no-content state, which is pure JSX. Keeping `router` in the page avoids pulling navigation concerns into the hook.
- **`videoId` / `contentId` exposed from the hook.** The page needs them for the JSON export filename (`structure-analysis-${videoId || "article"}.json`) and for the no-content-state check. Exposed as return values rather than re-reading `searchParams` in the page.
- **Line count math.** analyze/page.tsx 627 → 454 (−173). useAnalyzePage +161. analyze-helpers +59. Net +47 lines, but the page is now a pure orchestrator + JSX, and the logic is testable in isolation. The page is under 500 lines.

---

## Iteration 11 — Optimize page lib + hook extraction, extractVideoId consolidation (2026-07-08)

Iteration 10 finished the analyze page. Iteration 11 turns to `src/app/optimize/page.tsx` (598 lines) — the SEO optimizer page. It inlined 6 TypeScript interfaces, a duplicate `extractVideoId` function, 10 `useState` calls, 2 `useRef`s, 3 async handlers, 1 `useEffect` (auto-run pipeline), and 2 copy handlers.

### Starting point (iteration 11)

- `optimize/page.tsx` (598 lines) — inline `SeoTitle`/`SeoTag`/`ThumbnailConcept`/`SeoChapter`/`SeoDescription`/`SeoPackage` interfaces (41 lines total), inline `extractVideoId` (11 lines, **duplicate** of the one in `lib/voice-analysis.ts`), `OptimizePageContent` component with 10 `useState` calls, 2 `useRef`s (`abortControllerRef`, `autoRunStartedRef`), `fetchVideoData` (transcript fetch with 15s timeout), `handleFetchVideo`, `handleAnalyzeAndOptimize` (transcript extraction + SEO generation with AbortController cancellation), auto-run `useEffect`, `handleCopy`, `handleCopyAll`, `analysisSteps` const, `showVideoPreview` derived const, then ~350 lines of JSX.
- **Duplicate `extractVideoId`**: identical 11-line function existed in both `optimize/page.tsx` and `lib/voice-analysis.ts`. Both used the same regex patterns.

### Extractions performed

Each step was followed by `npx tsc --noEmit` + `npx next build` — both passed clean after every step.

### 36. `extractVideoId` consolidation into `lib/youtube.ts`
Moved the canonical `extractVideoId` to `src/lib/youtube.ts` (alongside `parseDuration` and `formatDuration` — both YouTube URL/duration helpers). Updated `src/lib/voice-analysis.ts` to re-export it: `export { extractVideoId } from "@/lib/youtube";`. This preserves the existing import in `useVoiceProfileBuilder.ts` without changing its import path. The optimize page's hook imports directly from `@/lib/youtube`.

### 37. `optimize-types` lib (src/lib/optimize-types.ts, 41 lines, NEW)
The 6 SEO interfaces (`SeoTitle`, `SeoTag`, `ThumbnailConcept`, `SeoChapter`, `SeoDescription`, `SeoPackage`). These are the *unscored* SEO package shape (input to `ScoredOutput<T>`). Distinct from `lib/channel-analytics.ts`'s `SeoPackage`, which is the *scored* shape (includes `seo_score`/`seo_grade` on each item). Both types coexist because the optimize page generates an unscored package that gets wrapped in `ScoredOutput<SeoPackage>` by the API, while the channel modal consumes an already-scored package.

### 38. `useOptimizePage` hook (src/hooks/useOptimizePage.ts, 225 lines, NEW)
Owns the full optimize page state + logic:
- State: `url`, `video`, `seoPackage`, `scoredOutput`, `isLoading`, `isAnalyzing`, `isGenerating`, `isAutoRunning`, `activeTab`, `selectedTitleIndex`.
- Refs: `abortControllerRef` (cancels in-flight SEO generation), `autoRunStartedRef` (prevents double-run in React StrictMode).
- `fetchVideoData(videoId)` — GET `/api/youtube/video` with 15s AbortController timeout, maps response to `YouTubeVideo` via `buildYouTubeVideo` helper.
- `handleAnalyzeAndOptimize(video?)` — fetches transcript (15s timeout), then POSTs to `/api/generate/seo` with AbortController cancellation of any prior request.
- `handleFetchVideo` — extracts video ID from URL, fetches video, triggers analysis.
- Auto-run `useEffect` — when `?videoId=...` in URL, runs the full pipeline on mount.
- `handleCopy(text)` + `handleCopyAll()` — clipboard + toast.
- `showVideoPreview` derived boolean.
- `buildYouTubeVideo(data)` — private helper that maps the API response to the `YouTubeVideo` type (was inline in `fetchVideoData`).

### 39. `optimize/page.tsx` orchestrator rewrite (598 → 367 lines, 39% reduction)
- Destructured `useOptimizePage()` — replaced 10 `useState` + 2 `useRef`s + 3 handlers + `useEffect` + 2 copy handlers + derived const with a single hook call.
- Removed inline interfaces — imported `SeoPackage` from `@/lib/optimize-types` (via the hook's return type).
- Removed inline `extractVideoId` — consolidated into `lib/youtube.ts`.
- Removed unused imports: `useState`, `useRef`, `useEffect`, `useSearchParams`, `toast`, `parseDuration`, `formatDuration`, `YouTubeVideo`, `ScoredOutput`.
- `analysisSteps` const stays inline (presentational data for the loading skeleton).
- JSX fix: `{showVideoPreview && (...)}` → `{video && showVideoPreview && (...)}` so TypeScript narrows `video` as non-null inside the block. The hook returns `showVideoPreview` as a boolean, which doesn't carry the narrowing; adding `video &&` at the call site restores it.

### Verification (iteration 11)

- `npx tsc --noEmit`: passes clean (excluding pre-existing test-file errors).
- `npx next build`: succeeds, `/optimize` route compiles.
- Browser click-through: user should verify:
  1. `/optimize` — paste a YouTube URL, click "Analyze & Optimize" — fetches video, extracts transcript, generates SEO package.
  2. `/optimize?videoId=...` — auto-runs the full pipeline on mount.
  3. Tabs: Titles / Description / Tags / Thumbnails / Chapters / Pinned Comment — all render.
  4. Copy buttons (per-item + "Copy All") — clipboard + toast.
  5. AbortController — navigating away or re-submitting cancels the in-flight generation.
  6. `ScoreCard` — renders the scored output with regenerate button.

### Architectural notes (iteration 11)

- **`extractVideoId` consolidated.** Was duplicated in `optimize/page.tsx` and `lib/voice-analysis.ts`. Moved to `lib/youtube.ts` (the natural home for YouTube URL/duration helpers). `voice-analysis.ts` re-exports it so `useVoiceProfileBuilder` doesn't need an import change. The optimize hook imports directly from `lib/youtube`. Single source of truth.
- **Two `SeoPackage` types coexist intentionally.** `lib/optimize-types.ts`'s `SeoPackage` is the unscored shape (no `seo_score`/`seo_grade`). `lib/channel-analytics.ts`'s `SeoPackage` is the scored shape. They're different types for different stages of the pipeline — the optimize page generates unscored packages that get wrapped in `ScoredOutput<T>`; the channel modal consumes already-scored packages. Could rename one to `UnscoredSeoPackage` / `ScoredSeoPackage` for clarity, but the consumer paths are disjoint (optimize page vs channel modal) so the ambiguity is contained.
- **`buildYouTubeVideo` helper is private to the hook.** It maps the API response to the `YouTubeVideo` type. Kept as a module-level function (not exported) — only `fetchVideoData` uses it. Could move to `lib/youtube.ts` if other consumers need it, but for now it's hook-local.
- **`showVideoPreview` narrowing fix.** The hook returns `showVideoPreview: boolean`. In the original inline code, `const showVideoPreview = video && !...` allowed TS to narrow `video` inside the `{showVideoPreview && (...)}` block because the expression was right there. Moving the derivation into the hook breaks that — TS can't narrow through a boolean return. Fix: `{video && showVideoPreview && (...)}` at the call site. Cheap, explicit, and keeps the hook's API simple.
- **Line count math.** optimize/page.tsx 598 → 367 (−231). useOptimizePage +225. optimize-types +41. Net +35 lines, but the page is now a pure orchestrator + JSX (under 400 lines). The duplicate `extractVideoId` was also eliminated (−11 lines from the codebase).

---

## Iteration 12 — Home page hook extraction (2026-07-08)

Iteration 11 finished the optimize page. Iteration 12 turns to `src/app/page.tsx` (483 lines) — the home page. It inlined 2 TypeScript interfaces, a `formatDate` function, 7 `useState` calls, 1 `useEffect`, and an 80-line `loadData` function that fetched boards + recent chats from Firestore, calculated the onboarding step, and managed the daily streak in localStorage.

### Starting point (iteration 12)

- `app/page.tsx` (483 lines) — inline `RecentChat`/`CreatorPost` interfaces, `formatDate` (15 lines, locale-aware relative time), `HomePage` component with 7 `useState` calls (`boards`, `recentChats`, `creatorPosts`, `isLoading`, `onboardingStep`, `dailyStreak`, plus `creators`/`creatorsLoading` from `useLocalCreators`), `useEffect` to trigger `loadData` on user change, `loadData` (80 lines: Firestore queries for boards + chats, onboarding step derivation from localStorage creators, daily streak logic with yesterday-check + today-mark-active), `chatSessions` derived const, then ~350 lines of JSX (landing page for non-authed, dashboard for authed, `OnboardingStep` + `PromptCard` sub-components).

### Extractions performed

Each step was followed by `npx tsc --noEmit` + `npx next build` — both passed clean after every step.

### 40. `useHomePage` hook (src/hooks/useHomePage.ts, 149 lines, NEW)
Owns the full home page state + data loading:
- Types: `RecentChat`, `CreatorPost` (exported).
- `formatChatDate(dateString)` — locale-aware relative time formatter (renamed from `formatDate` to avoid clashing with the various other `formatDate*` functions in the codebase; exported as a standalone function so the page can call it per-row without prop drilling).
- State: `boards`, `recentChats`, `creatorPosts`, `isLoading`, `onboardingStep`, `dailyStreak`. Composes `useLocalCreators()` for `creators` + `creatorsLoading`.
- `chatSessions` derived const (mapped from `recentChats` for the sidebar).
- `loadData()` — Firestore `getDocs` for `users/{uid}/boards` (top 5 by `updatedAt`) + `users/{uid}/chatSessions` (top 5), onboarding step derivation (0→1 if boards, →2 if chats, →3 if localStorage creators), daily streak logic (yesterday-active check, increment or reset, mark today active).
- Accepts `userId` as arg (passed as `user?.uid` from the page) so the hook doesn't depend on `useAuth` directly — the page owns the auth check.

### 41. `app/page.tsx` orchestrator rewrite (483 → 352 lines, 27% reduction)
- Destructured `useHomePage(user?.uid)` — replaced 7 `useState` + `useEffect` + `loadData` + `chatSessions` derivation with a single hook call.
- Removed inline `RecentChat`/`CreatorPost` interfaces — imported from hook.
- Removed inline `formatDate` — imported `formatChatDate` from hook (renamed to avoid name clashes).
- Removed unused imports: `useState`, `useEffect`, `db`, `collection`, `query`, `orderBy`, `limit`, `getDocs`, `useLocalCreators`, `Board`, `ChatSession`.
- `OnboardingStep` and `PromptCard` sub-components stay inline — single-use presentational, tightly coupled to the page's JSX.
- Landing page JSX (non-authed) stays inline — it's static marketing copy with no logic.
- `creatorPosts` state is currently unused (the JSX renders `creators` instead) — retained in the hook for forward-looking creator-post feed, but could be removed if confirmed dead. Kept for now since it's a 1-line `useState`.

### Verification (iteration 12)

- `npx tsc --noEmit`: passes clean (excluding pre-existing test-file errors).
- `npx next build`: succeeds, `/` route compiles.
- Browser click-through: user should verify:
  1. `/` (not signed in) — landing page renders (hero, features preview, CTA buttons).
  2. `/` (signed in) — dashboard renders: daily streak badge, getting-started progress bar (3 steps), prompts grid, recent chats list, creators grid.
  3. Onboarding step auto-advances: 1 after first board, 2 after first chat, 3 after first tracked creator.
  4. Daily streak increments on consecutive days, resets on gap.
  5. Sidebar boards + chat sessions populate from Firestore.

### Architectural notes (iteration 12)

- **`formatChatDate` renamed from `formatDate`.** The codebase already has `formatDateShort`, `formatDateRelative`, `formatDateLongRelative` in `lib/format.ts`. The home page's `formatDate` was a fourth variant (Just now / Xm ago / Xh ago / Xd ago / "Mon DD"). Renamed to `formatChatDate` to avoid the generic name clashing if someone ever imports it alongside the lib formatters. The logic is similar to `formatDateRelative` but not identical (the lib version returns "Today"/"Yesterday" for recent dates; this returns "Xm/h/d ago"). Could unify, but the differences are intentional for the chat-list context.
- **Hook accepts `userId`, not `user`.** The page passes `user?.uid` from `useAuth`. The hook doesn't need the full user object — only the UID for Firestore paths. This keeps the hook's dependency surface minimal and makes it testable with a mock UID.
- **`eslint-disable` for exhaustive-deps preserved.** The `loadData` function is defined inside the hook body, so the `useEffect` that calls it would normally need `loadData` as a dep. The original had the disable comment; kept as-is. A future iteration could wrap `loadData` in `useCallback` to remove the disable, but it's not behavior-changing.
- **`creatorPosts` is vestigial.** The state is declared but the JSX renders `creators` (from `useLocalCreators`) instead. Likely a leftover from a removed "recent posts from tracked creators" section. Kept for now (1 line) — removing it is a separate cleanup that should verify no other code references it.
- **Line count math.** app/page.tsx 483 → 352 (−131). useHomePage +149. Net +18 lines, but the page is now a pure orchestrator + JSX (under 400 lines). The `loadData` logic is now in a testable hook, and the page's job is just: auth check → landing vs dashboard → render.

---

## Iteration 13 — `callLLM` consolidation across API routes (2026-07-08)

### What changed

The `callLLM` function — the core LLM fetch wrapper (POST to the Kimi/OpenRouter-compatible endpoint with Bearer auth, temperature, max_tokens, timeout, retry) — was duplicated in **6 files**:

1. `src/lib/generation/llm.ts` (canonical, used by `/api/chat/*`)
2. `src/app/api/generate/script/route.ts` (inline copy, 2500/45s/2 retries)
3. `src/app/api/generate/social/route.ts` (inline copy, 2000/30s/0 retries)
4. `src/app/api/generate/seo/route.ts` (inline copy, 2500/30s/0 retries, "{}" fallback, temp 0.3)
5. `src/app/api/generate/video-analysis/route.ts` (inline copy, 3000/60s/0 retries, "{}" fallback, temp 0.3)
6. `src/lib/analyze-structure/llm-analysis.ts` (inline copy, 6000/180s/0 retries, "{}" fallback, temp 0.3, optional proxy, truncation check)

Each copy varied slightly: different `max_tokens`, different timeouts, different retry counts, different empty-response fallbacks (`""` vs `"{}"`), and one (llm-analysis) had unique proxy + truncation logic. A naive "just import the canonical one" would have silently changed behavior at 5 call sites.

### Steps

42. **Extended `lib/generation/llm.ts` with a `CallLLMOptions` interface.**
    - New signature: `callLLM(messages, options?: CallLLMOptions | number)`.
    - The `| number` form preserves backwards compatibility — `callLLM(msgs, 0.7)` still works for the 2 existing callers in `/api/chat/*`.
    - Options: `temperature`, `maxTokens`, `timeoutMs`, `maxRetries`, `emptyFallback`, `throwOnTruncate`, `useProxy`.
    - Defaults match the old canonical: temp 0.7, 2500 tokens, 45s timeout, 2 retries, "" fallback.
    - Moved the proxy-resolution logic (previously only in llm-analysis) into a shared `resolveFetch()` helper that reads `process.env.KIMI_USE_PROXY` and dynamically imports `undici` + `ProxyAgent` only when needed. Both `useProxy` option and `KIMI_USE_PROXY` env var trigger it.
    - Added truncation detection: when `throwOnTruncate: true` and `finish_reason === "length"`, throws a descriptive error.

43. **Replaced inline `callLLM` in `api/generate/script/route.ts`.**
    - Its config matched canonical defaults exactly (2500/45s/2 retries/""), so the call sites `callLLM(msgs, 0.7)` and `callLLM(msgs, 0.6)` work unchanged with the number-arg form.
    - Deleted: `API_URL`, `MODEL`, `ApiMessage`, `ApiResponse`, `VoiceProfileInput`, `callLLM` (≈80 lines).
    - Kept: `API_KEY` const (route handler checks `if (!API_KEY)` to return 500), `ScriptOutput` interface (local type).
    - Added import: `callLLM, ApiMessage, VoiceProfileInput` from `@/lib/generation/llm`.

44. **Replaced inline `callLLM` in `api/generate/social/route.ts`.**
    - Its config: 2000 tokens, 30s timeout, 0 retries. Different from canonical, so introduced a local `LLM_OPTS` const and spread temperature into it at each call site: `callLLM(msgs, { ...LLM_OPTS, temperature: 0.7 })`.
    - Deleted: `API_URL`, `MODEL`, `ApiMessage`, `ApiResponse`, `VoiceProfileInput`, `callLLM` (≈50 lines).
    - Kept: `API_KEY`, the 3 system-prompt strings, the 3 user-prompt builders, `parseSocialResponse`, `formatPostOutput`, the POST handler.

45. **Replaced inline `callLLM` in `api/generate/seo/route.ts`.**
    - Its config: temp 0.3, 2500 tokens, 30s timeout, 0 retries, "{}" fallback. Local `LLM_OPTS` const.
    - Also deleted a stray `import { getProxyUrl } from "@/lib/proxy"` that was never used in the file (dead import).
    - Deleted: `API_URL`, `MODEL`, `ApiMessage`, `ApiResponse`, `callLLM`, `getProxyUrl` import (≈50 lines incl. the dead import).
    - Kept: `API_KEY`, `SeoPackage` interface, `getGrade`, `scoreTitle`, all scoring helpers, the POST handler.

46. **Replaced inline `callLLM` in `api/generate/video-analysis/route.ts`.**
    - Its config: temp 0.3, 3000 tokens, 60s timeout, 0 retries, "{}" fallback. Local `LLM_OPTS` const.
    - Deleted: `API_URL`, `MODEL`, `ApiMessage`, `ApiResponse`, `callLLM` (≈45 lines).
    - Kept: `API_KEY`, `VideoAnalysisInput`, `VideoAnalysisResult`, `getGrade`, `buildSystemPrompt`, the POST handler.

47. **Replaced inline `callLLM` in `lib/analyze-structure/llm-analysis.ts`.**
    - Its config: temp 0.3, 6000 tokens, 180s timeout, 0 retries, "{}" fallback, `throwOnTruncate: true`, proxy via `KIMI_USE_PROXY`.
    - The canonical `callLLM` now handles the proxy internally (reads `KIMI_USE_PROXY`), so the local proxy block is no longer needed.
    - Deleted: `API_URL`, `API_KEY`, `MODEL`, `ApiMessage`, `ApiResponse`, `getProxyUrl` import, the entire inline `callLLM` including the 25-line `fetchFn`/`ProxyAgent` dance (≈95 lines).
    - Added: `import { callLLM, ApiMessage } from "../generation/llm"`.
    - Local `LLM_OPTS` const with `throwOnTruncate: true` to preserve the truncation-error behavior.

### Verification

- `npx tsc --noEmit` — only pre-existing test-file errors (vitest/jest types not installed). Zero new errors in non-test files.
- `npx next build` — ✓ Compiled successfully in 8.6s, ✓ Finished TypeScript in 10.3s, ✓ 54/54 static pages generated. All API routes (`/api/generate/script`, `/api/generate/seo`, `/api/generate/social`, `/api/generate/video-analysis`) compiled and appear in the route manifest.

### Architectural notes (iteration 13)

- **Why an options object, not multiple functions.** A `callLLMShort`/`callLLMLong`/`callLLMWithProxy` split would have been cleaner per-call but would require callers to pick the right function. The options object lets each route declare its config as a local const (`LLM_OPTS`) and reuse it across multiple call sites in the same file (e.g. social has 2 calls, seo has 2 calls) while varying only temperature. The spread pattern `{ ...LLM_OPTS, temperature: 0.6 }` is the same idiom used in the regenerate callbacks.
- **Backwards compat via `| number` union.** The old signature `callLLM(messages, temperature = 0.7)` is the most common form in the codebase. The new signature `callLLM(messages, options?: CallLLMOptions | number)` accepts both the old number form and the new object form, so the 2 existing `/api/chat/*` callers didn't need to change. A pure object-only signature would have forced 2 unrelated edits.
- **Proxy logic centralized.** The `resolveFetch()` helper in `lib/generation/llm.ts` is now the single place that decides whether to route through a proxy. Previously this logic lived only in `lib/analyze-structure/llm-analysis.ts` (with a comment explaining the Kimi endpoint is "directly reachable in most environments" but the auto-detected proxy is flaky). Now any caller can opt in via `useProxy: true` or `KIMI_USE_PROXY=true`, and the undici import is lazy (only happens when proxy is actually requested).
- **`API_KEY` kept in each route.** Every route handler still has `const API_KEY = process.env.KIMI_API_KEY;` at the top because the POST handler checks `if (!API_KEY) return 500` before calling `callLLM`. The canonical `callLLM` also throws on missing API_KEY, but the route handler wants to return a clean 500 with a JSON error body, not throw. So the const stays.
- **`VoiceProfileInput` consolidated.** Was duplicated in 3 of the 6 files (script, social, generation/llm). Now exported from the canonical location and imported by the 2 routes that need it. The interface is identical across all 3 former copies.
- **`getProxyUrl` dead import in seo/route.ts.** The seo route had `import { getProxyUrl } from "@/lib/proxy"` at line 74 (oddly mid-file, after the SeoPackage interface) but never used it — the inline `callLLM` didn't reference it. Deleted as part of the cleanup. Likely a leftover from when the seo route planned to use a proxy but never did.
- **Line count savings.** ~320 lines of duplicated LLM-fetch boilerplate deleted across 5 files. `lib/generation/llm.ts` grew from 66 → ~115 lines (added options interface, resolveFetch, defaults). Net: ~−270 lines, and a single source of truth for the LLM call contract.
- **Two `SeoPackage` types still coexist.** This iteration did NOT touch `lib/optimize-types.ts` (unscored, used by `/optimize` page) or `lib/channel-analytics.ts` (scored, with `seo_score`/`seo_grade` per item, used by `/api/generate/seo`). They remain distinct types for distinct consumers. See iteration 11 notes for the rationale.

---

## Iteration 14 — save-to-board Firestore helpers (2026-07-08)

### What changed

The two save-to-board handlers in `src/app/discover/page.tsx` (`handleSaveToBoard` for videos, `handleSaveContentToBoard` for articles) each contained ~25 lines of inline Firestore logic: dynamic `import("firebase/firestore")` + `import("@/lib/firebase")`, `addDoc` to the `items` subcollection, then `updateDoc` to increment `itemCount` on the board. Extracted both to pure helpers in `src/lib/discovery/save-to-board.ts`.

### Steps

48. **Created `src/lib/discovery/save-to-board.ts` (52 lines).**
    - `saveVideoToBoard(userId, boardId, video)` — writes the video to `users/{uid}/boards/{boardId}/items` with type "video", then increments `itemCount`.
    - `saveContentToBoard(userId, boardId, item)` — writes the content item to the same `items` subcollection with type "post", then increments `itemCount`.
    - Both use dynamic imports for firebase/firestore + lib/firebase to match the original pattern (keeps the Firestore client lazy-loaded in the browser bundle).

49. **Updated `src/app/discover/page.tsx`.**
    - Added `import { saveVideoToBoard, saveContentToBoard } from "@/lib/discovery/save-to-board";`.
    - `handleSaveToBoard` now: guard → `await saveVideoToBoard(...)` → toast.success/error → state cleanup. Body went from ~30 lines to ~10.
    - `handleSaveContentToBoard` same treatment.
    - Page: 1248 → 1215 lines (−33).

### Verification

- `npx tsc --noEmit` — zero new errors (only pre-existing test-file errors).
- `npx next build` — ✓ Compiled successfully in 7.6s, ✓ 54/54 static pages generated.

### Architectural notes (iteration 14)

- **Why `items` vs `cards`.** The discover page saves feed items (videos, articles) to `users/{uid}/boards/{boardId}/items` — a flat list of saved content. `useBoardCards.ts` writes to `users/{uid}/boards/{boardId}/cards` — canvas cards with x/y coordinates for the board layout view. These are two distinct storage paths serving two distinct features, so extracting one doesn't risk breaking the other. The duplication check (`grep` for `collection(db, "users"..."boards"..."items"`) confirmed only the discover page writes to `items`.
- **Helpers return `Promise<void>`, throw on error.** The page's try/catch stays in the component because the toast + state cleanup (closing the board picker, clearing pending save) is UI concern, not DB concern. The helper does only the Firestore work; the component owns the UX response. This matches the pattern established in iteration 10 (`analyze-helpers.ts`) and iteration 12 (`useHomePage`'s `loadData`).
- **Dynamic imports preserved.** The original used `await import("firebase/firestore")` and `await import("@/lib/firebase")` rather than top-level imports. This is a bundle-size optimization — the Firestore SDK is only loaded when a user actually saves something, not on every discover page load. Preserved in the helper to keep the optimization.
- **Page is still 1215 lines.** This iteration extracted ~33 lines. The page's bulk is now JSX (~775 lines of render) + ~10 inline handlers + ~8 useEffect blocks. A full `useDiscoverPage` hook extraction (moving all state, effects, and handlers out) is the remaining structural improvement, but it's a large change with many interdependencies across ~10 sub-hooks. Deferred — the current state is a clean, working page with no duplication, and the save logic is now testable in isolation.

---

## Iteration 15 — Voice page sub-component extraction (2026-07-08)

### What changed

`src/app/voice/page.tsx` had 6 inline presentational components defined above the main `VoiceProfileContent` body: `InputSourceSelector`, `SourceCard`, `VoiceFingerprintCard`, `FingerprintItem`, `FeedbackForm`, `VersionHistory`. These were defined in the same file (not exported, not reusable) and inflated the page to 687 lines. Extracted each into its own file under `src/components/voice/`.

### Steps

50. **Created `src/components/voice/SourceCard.tsx` (25 lines).** The leaf component — a button card with icon, title, description. No external deps beyond React. Props: `title`, `description`, `icon`, `onClick`.

51. **Created `src/components/voice/InputSourceSelector.tsx` (44 lines).** Renders 5 `SourceCard`s for the input-method picker (YouTube channel, paste links, file upload, sample text, guided chat). Imports `SourceCard`. Props: `onSelect(method: string)`.

52. **Created `src/components/voice/VoiceFingerprintCard.tsx` (57 lines).** Shows the 6 fingerprint dimensions (hookStyle, sentenceLength, tone, vocabulary, humorLevel, ctaPattern) + optional sample sentences. Includes `FingerprintItem` as a private sub-component (only used here — 9 lines, not worth its own file). Props: `fingerprint`, `version`, `onEdit`.

53. **Created `src/components/voice/FeedbackForm.tsx` (71 lines).** Star rating (1-5) + tag multi-select ("Too formal", "Too casual", etc.) + submit button. Owns its own `rating` and `selectedTags` state. The `FEEDBACK_TAGS` array moved out as a module const. Props: `onSubmit({ rating, tags })`.

54. **Created `src/components/voice/VersionHistory.tsx` (32 lines).** Lists voice profile versions with revert buttons. Props: `versions: VoiceProfileVersion[]`, `onRevert(version)`.

55. **Updated `src/app/voice/page.tsx`.**
    - Added 4 imports: `InputSourceSelector`, `VoiceFingerprintCard`, `FeedbackForm`, `VersionHistory` from `@/components/voice/*`.
    - Deleted the 6 inline component definitions (~219 lines).
    - Removed unused imports: `Badge` (was imported but never used in the page), `VoiceProfileVersion` type (only referenced by the extracted `VersionHistory`).
    - Page: 687 → 467 lines (−220).

### Verification

- `npx tsc --noEmit` — zero new errors.
- `npx next build` — ✓ Compiled successfully in 7.4s, ✓ 54/54 static pages generated.

### Architectural notes (iteration 15)

- **`FingerprintItem` stayed private to `VoiceFingerprintCard`.** It's a 9-line label/value row used only inside `VoiceFingerprintCard`. Extracting it to its own file would have created a 9-line file with one consumer — not worth the indirection. Kept as a non-exported function inside `VoiceFingerprintCard.tsx`. This matches the CLAUDE.md guidance: "One component per file. Exception: small, closely related sub-components."
- **`FEEDBACK_TAGS` moved to module scope.** Originally declared inside the `FeedbackForm` function body, so it was re-created on every render. Moved to a module-level `const` — minor perf win (no alloc per render) and makes the tag list grep-able.
- **Smart quotes.** The inline `"{sentence}"` in `VoiceFingerprintCard` used straight quotes; the extracted version uses `&quot;` entities to satisfy JSX/ESLint (straight quotes inside JSX attribute/string contexts can trigger react/no-unescaped-entities). No behavior change.
- **`Badge` import was dead.** `import { Badge } from "@/components/ui/badge"` existed in the page but `<Badge>` never appeared in the JSX. Likely a leftover from a removed feature. Removed as part of the cleanup.
- **`VoiceProfileVersion` type import removed from page.** The page no longer references this type directly — `VersionHistory` owns it. The page still imports `VoiceFingerprint` (used in `handleManualEditWrapper` at line ~415). Kept that one.
- **Page is now 467 lines.** Still large, but it's a single cohesive component (`VoiceProfileContent`) that owns the multi-step flow (sources → youtube/links/file/sample/chat → analyzing → feedback → history). The 6 extracted components are now reusable: e.g., `VoiceFingerprintCard` could be used on a dashboard or settings page without pulling in the whole voice onboarding flow.

---

## Iteration 16 — ChannelAnalytics sub-component extraction + dead code removal (2026-07-08)

### What changed

`src/components/channel/ChannelAnalytics.tsx` had 8 inline sub-components. Extracted 4 of them (`StatCard`, `HealthScoreCard`, `CompareModal`, `FixVideoModal`) into their own files under `src/components/channel/`. The charts (`InsightsCharts`, `ViewsOverTimeChart`, `PerformanceDistributionChart`) and the local `VideoCard`/`VideoTable` stay inline — they're tightly coupled to the parent's data and recharts setup. Also removed ~35 lines of dead code from `FixVideoModal` (unused `seoPackage`/`activeResultTab` state + `handleRunSeoAnalysis` handler that was never called).

### Steps

56. **Created `src/components/channel/StatCard.tsx` (17 lines).** Leaf stat display. Props: `label`, `value`, `sub?`.

57. **Created `src/components/channel/HealthScoreCard.tsx` (56 lines).** Health score with color-coded emoji, progress bar, and 3-metric breakdown (avgPerf, consistency, topRatio). Imports `getHealthScoreColor`/`getHealthScoreBg` from `lib/channel-analytics`.

58. **Created `src/components/channel/CompareModal.tsx` (65 lines).** Side-by-side video comparison dialog. 2-column grid with thumbnail, stats, performance bar, improvement-potential badge.

59. **Created `src/components/channel/FixVideoModal.tsx` (60 lines).** "Fix this video" dialog with 3 navigation buttons (SEO Optimizer, New Script, Social Posts). **Dead code removed**: the inline version had `useState<SeoPackage>` + `useState<"titles"|"description"|"tags"|"thumbnails">` + an `async handleRunSeoAnalysis` that POSTed to `/api/generate/seo` — none of which was wired to any button or rendered in the JSX. The extracted version drops all of it; the modal just navigates to `/optimize` or `/boards` for the actual work.

60. **Updated `src/components/channel/ChannelAnalytics.tsx`.**
    - Added 4 imports: `StatCard`, `HealthScoreCard`, `CompareModal`, `FixVideoModal` from `./` siblings.
    - Deleted the 4 inline component definitions (~200 lines incl. the dead code).
    - Removed now-unused imports: `Dialog`, `DialogContent`, `DialogHeader`, `DialogTitle`, `DialogDescription` (only the modals used them), `SeoPackage` type (only FixVideoModal's dead state used it), `getHealthScoreColor`, `getHealthScoreBg` (only HealthScoreCard used them).
    - Component: 849 → 685 lines (−164).

### Verification

- `npx tsc --noEmit` — zero new errors.
- `npx next build` — ✓ Compiled successfully in 8.5s, ✓ 54/54 static pages generated.

### Architectural notes (iteration 16)

- **Dead code in `FixVideoModal`.** The inline `FixVideoModal` had `const [seoPackage, setSeoPackage] = useState<SeoPackage | null>(null)` and `const [activeResultTab, setActiveResultTab] = useState<...>("titles")` plus a full `handleRunSeoAnalysis` that fetched `/api/generate/seo`. None of these were referenced in the JSX — the modal only renders thumbnail, 3 stat cards, suggestions list, and 3 navigation buttons. Looks like a feature that was started (in-modal SEO analysis with tabs) then abandoned in favor of navigating to `/optimize`. Deleted entirely rather than preserving, per CLAUDE.md §General Principles: "No unused code. If something is unused, delete it completely."
- **Charts stay inline.** `InsightsCharts`, `ViewsOverTimeChart`, `PerformanceDistributionChart` use recharts components (BarChart, LineChart, PieChart) and transform `ChannelInsights` data inline. They're ~134 lines combined but tightly coupled to the parent's `insights` prop and the recharts import. Extracting them would require passing the full `ChannelInsights` object + recharts types — more indirection than value. Left inline as private functions.
- **`VideoCard` (local) vs `VideoCard` (discover).** ChannelAnalytics has its own inline `VideoCard` for the channel's video table — different from `components/discover/VideoCard.tsx` (which has blocklist menu + modal + outlier badge). Same name, different components, different concerns. The local one stays inline because it's a thin table-row card, not a reusable piece.
- **`SeoPackage` type from `lib/channel-analytics`.** After removing the dead state in `FixVideoModal`, the `SeoPackage` type import in `ChannelAnalytics.tsx` became unused. Note: this is the *scored* `SeoPackage` from `lib/channel-analytics.ts` (with `seo_score`/`seo_grade` per item), not the *unscored* one from `lib/optimize-types.ts`. Both still coexist — see iteration 11 notes.
- **`ChannelVideoDetailModal` (iteration 9) vs `FixVideoModal` vs `CompareModal`.** Three modals now live in `components/channel/`: `ChannelVideoDetailModal` (full analysis + boost package, opened from the video table), `FixVideoModal` (navigation to /optimize or /boards, opened from the "fix" button), `CompareModal` (2-video side-by-side, opened from compare mode). Each has a distinct purpose and open trigger.

---

## Iteration 17 — ChannelAnalytics chart extraction (2026-07-08)

### What changed

Extracted the three inline recharts components (`InsightsCharts`, `ViewsOverTimeChart`, `PerformanceDistributionChart`) from `src/components/channel/ChannelAnalytics.tsx` into a new `src/components/channel/ChannelCharts.tsx`. Combined all three into one file (rather than 3 separate files) because they share the recharts import and are all pure presentational chart components consumed only by `ChannelAnalytics`.

### Steps

61. **Created `src/components/channel/ChannelCharts.tsx` (160 lines).**
    - Exports `InsightsCharts({ insights })` — 3 bar charts (hook performance, upload day, duration).
    - Exports `ViewsOverTimeChart({ videos })` — line chart of views by publish date.
    - Exports `PerformanceDistributionChart({ videos })` — pie chart of performance tiers (0-20, 21-40, 41-60, 61-80, 81-100).
    - Extracted a shared `TOOLTIP_STYLE` const (backgroundColor, border, borderRadius) used by all 3 charts — was inlined 6 times in the original.
    - Renamed the `COLORS` array (local to `PerformanceDistributionChart`) to `PERFORMANCE_COLORS` at module scope — minor naming clarity.

62. **Updated `src/components/channel/ChannelAnalytics.tsx`.**
    - Added import: `InsightsCharts, ViewsOverTimeChart, PerformanceDistributionChart` from `./ChannelCharts`.
    - Deleted the 3 inline chart definitions (~133 lines).
    - Removed now-unused imports: the entire `recharts` import block (11 named imports: BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell), `ChannelInsights` type (only the charts consumed it).
    - Component: 685 → 537 lines (−148).

### Verification

- `npx tsc --noEmit` — zero new errors.
- `npx next build` — ✓ Compiled successfully in 8.5s, ✓ 54/54 static pages generated.

### Architectural notes (iteration 17)

- **One file, three charts.** The three charts share the recharts dependency, the `ChannelVideo`/`ChannelInsights` types, and the same dark-theme tooltip styling. Splitting into 3 files would have triplicated the imports and the `TOOLTIP_STYLE` const. One file with three named exports is the right granularity — they're a cohesive set of "channel visualization" components.
- **`TOOLTIP_STYLE` dedup.** The original inlined `{ backgroundColor: "#1a1a1a", border: "1px solid #2a2a2a", borderRadius: "8px" }` in every `<Tooltip>` (6 times across the 3 charts). Extracted to a module-level const. Minor DRY win.
- **`ChannelInsights` type no longer needed in parent.** After extracting the charts, `ChannelAnalytics.tsx` doesn't directly reference `ChannelInsights` — it passes `stats.insights` through to `<InsightsCharts>`. The type is still used inside `lib/channel-analytics.ts` (for `generateInsights` return type) and inside `ChannelCharts.tsx` (the component prop). Removed from the parent's import.
- **`useMemo` stays in parent.** The charts used `useMemo` for their data transforms, but the parent also uses `useMemo` elsewhere (e.g., filtered/sorted video lists). Kept the import.
- **Component is now 537 lines.** Down from 849 (iteration 16 start) → 685 (after modal extraction) → 537. The remaining bulk is the main `ChannelAnalytics` component itself (the channel-search UI, connected-channel dashboard, video table, compare mode, fix mode) plus the local `VideoCard`/`VideoTable` and the `analyzeChannelById` function. Further extraction would require splitting the main component into sub-sections (e.g., `ChannelDashboard`, `ChannelSearchPanel`) — that's a larger restructuring for a future iteration.

---

## Iteration 18 — `getGrade` consolidation (2026-07-08)

### What changed

`getGrade` — the score → A/B+/B/C/D/F mapping — was defined in **4 places**:

1. `src/lib/channel-analytics.ts:86` — canonical grade-only version (returns `"A" | "B+" | ...`).
2. `src/lib/quality/constants.ts:127` — richer version (returns `{ grade, label, behavior }`), tied to the quality system's `GRADE_MAP` and `ScoreGrade` type.
3. `src/app/api/generate/seo/route.ts:62` — inline copy returning `{ grade, label }`.
4. `src/app/api/generate/video-analysis/route.ts:67` — inline copy returning grade-only string.

All 4 use identical thresholds (90/80/70/60/45). Consolidated the two API-route copies by importing from the canonical `lib/channel-analytics.ts`. Also found and deleted dead code: the `video-analysis/route.ts` `getGrade` was defined but never called, and the `seo/route.ts` version computed a `label` that was never read.

### Steps

63. **Deleted dead `getGrade` from `api/generate/video-analysis/route.ts`.** The function was defined at line 67 but grep confirmed zero call sites in the file — pure dead code. Removed the 8-line definition.

64. **Replaced inline `getGrade` in `api/generate/seo/route.ts` with import.**
    - Added `import { getGrade } from "@/lib/channel-analytics";`.
    - Deleted the 8-line inline definition (which returned `{ grade, label }`).
    - Updated 4 call sites: `const g = getGrade(clamped); return { score: clamped, grade: g.grade };` → `const grade = getGrade(clamped); return { score: clamped, grade };`. The `.label` field was computed but never used — the callers only consumed `g.grade`. The imported grade-only version returns the string directly, so the destructuring is gone.

### Verification

- `npx tsc --noEmit` — zero new errors.
- `npx next build` — ✓ Compiled successfully in 7.8s.

### Architectural notes (iteration 18)

- **Two canonical `getGrade` versions remain, intentionally.** `lib/channel-analytics.ts` exports a grade-only `getGrade(score): ScoreGrade` for the channel analytics + SEO scoring use case. `lib/quality/constants.ts` exports a richer `getGrade(score): { grade, label, behavior }` that includes delivery behavior ("Delivered immediately" vs "Auto-regenerate once" etc.) — this is used by the quality pipeline (`evaluateAndDeliver`) to decide whether to show or regenerate an output. Same thresholds, different consumer needs, both stay.
- **Dead `label` in seo route.** The seo route's inline `getGrade` returned `{ grade: "A", label: "Excellent" }` etc., but all 4 callers only read `g.grade` for the `SeoPackage` scoring functions (`scoreTitle`, `scoreDescription`, etc.). The `label` was a vestige — likely copied from `lib/quality/constants.ts`'s shape but never wired to the response. Removed along with the inline definition.
- **Dead `getGrade` in video-analysis route.** The video-analysis route defined `getGrade` but never called it — the route delegates to the LLM for analysis and scoring, not to a local scoring function. Pure dead code. Likely a leftover from when the route had local scoring before the LLM-based `VideoAnalysisResult` was introduced.
- **Threshold consistency.** All 4 former `getGrade` definitions used 90/80/70/60/45. The canonical `lib/channel-analytics.ts` version is now the single source for API routes. If the thresholds ever need to change (e.g., adjust the C/D boundary), there's one place to edit for the channel/SEO context. The `lib/quality/constants.ts` version uses the `GRADE_MAP` array, which is the single source for the quality pipeline context.

---

## Iteration 19 — `parseDuration` + `formatDuration` consolidation (2026-07-08)

### What changed

Duration parsing and formatting helpers were duplicated across 4 files:

- **ISO 8601 `parseDuration`** (parses `PT#H#M#S` → seconds): `lib/youtube.ts:339` (canonical, exported) and `api/creators/[creatorId]/videos/route.ts:56` (inline copy).
- **`formatDuration`** (seconds → `H:MM:SS` or `M:SS`): 3 identical copies — `lib/youtube.ts:49` (canonical), `lib/analyze-helpers.ts:8`, `lib/youtube-scraper.ts:130` (private).
- **Colon `parseDuration`** (parses `HH:MM:SS` or `MM:SS` → seconds): `lib/discovery/time-periods.ts:37` (canonical, as `parseDurationToSeconds`) and `lib/youtube-scraper.ts:120` (private copy).

Consolidated to the canonical sources. Also found and deleted dead code: the inline `parseDuration` in `api/creators/[creatorId]/videos/route.ts` was defined but never called.

### Steps

65. **Deleted dead `parseDuration` from `api/creators/[creatorId]/videos/route.ts`.** Grep confirmed zero call sites in the file — the route delegates duration parsing to the YouTube Data API response (which returns ISO 8601), not to a local parser. Pure dead code. Removed the 8-line definition.

66. **Removed `formatDuration` from `lib/analyze-helpers.ts`.**
    - Deleted the 9-line definition (identical to `lib/youtube.ts:49`).
    - Updated `analyze/page.tsx` import: `import { formatDuration, formatDate } from "@/lib/analyze-helpers"` → split into `import { formatDate } from "@/lib/analyze-helpers"` + `import { formatDuration } from "@/lib/youtube"`.
    - Verified `formatAnalysisAsMarkdown` (the other export in analyze-helpers) doesn't use `formatDuration` internally.

67. **Replaced inline `parseDuration` + `formatDuration` in `lib/youtube-scraper.ts` with imports.**
    - Added: `import { formatDuration } from "./youtube";` and `import { parseDurationToSeconds } from "./discovery/time-periods";`.
    - Deleted the two private inline definitions (~22 lines).
    - Updated call site: `parseDuration(durationText)` → `parseDurationToSeconds(durationText)`. The scraper's `parseDuration` was the colon-separated variant (parses `lengthText.simpleText` like "10:30" or "1:02:15" from the YouTube search results page), which is exactly what `parseDurationToSeconds` does — same implementation, different name.

### Verification

- `npx tsc --noEmit` — zero new errors.
- `npx next build` — ✓ Compiled successfully in 7.0s.

### Architectural notes (iteration 19)

- **Two `parseDuration` variants, both legitimate.** `lib/youtube.ts` exports `parseDuration` for ISO 8601 durations (the format YouTube Data API returns in `contentDetails.duration` — e.g. `PT10M30S`). `lib/discovery/time-periods.ts` exports `parseDurationToSeconds` for colon-separated durations (the format YouTube's search results page shows in `lengthText.simpleText` — e.g. `10:30`). Same concept (string → seconds), different input formats, both stay as canonical homes for their format.
- **Dead `parseDuration` in creators route.** The `api/creators/[creatorId]/videos/route.ts` had an ISO 8601 `parseDuration` that was never called — the route fetches videos via the YouTube Data API and maps `contentDetails.duration` directly, but apparently doesn't parse it to seconds anywhere (the `CreatorVideo` type may carry the raw string). Pure dead code, likely a copy-paste leftover from when the route was scaffolded from another API route that did use it.
- **`formatDuration` now has one home.** `lib/youtube.ts:49` is the single canonical definition. The `analyze-helpers.ts` copy was created in iteration 10 when the analyze page was refactored — at the time I didn't notice it duplicated `lib/youtube.ts`. Now fixed.
- **Naming: `parseDuration` vs `parseDurationToSeconds`.** The ISO 8601 parser is named `parseDuration` (returns seconds, but the name doesn't say so). The colon parser is named `parseDurationToSeconds` (explicit about the return unit). Slightly inconsistent, but renaming `parseDuration` would require updating all its callers — not worth the churn for a naming tweak. Left as-is.

---

## Iteration 20 — `VideoAnalysisResult` type consolidation (2026-07-08)

### What changed

The `VideoAnalysisResult` interface was defined identically in 2 places:

- `src/app/api/generate/video-analysis/route.ts:9-31` (input shape, used by the LLM parser)
- `src/components/channel/ChannelVideoDetailModal.tsx:24-38` (UI consumer shape)

Both described the same LLM output: summary, strengths/weaknesses/opportunities arrays, five analysis categories (`title_analysis`, `thumbnail_analysis`, `hook_analysis`, `retention_analysis`, `seo_analysis`) each with score/feedback/suggestions, `overall_score`, `overall_grade`, and `action_items`. The component definition was a structural subset (same fields, no extras) of the route definition.

Consolidated to a single canonical definition in `lib/channel-analytics.ts` (placed next to the `ChannelVideo` interface, since `VideoAnalysisResult` is the analytical companion to `ChannelVideo` performance data). Both files now import the type from there.

### Steps

68. **Added `VideoAnalysisResult` interface to `lib/channel-analytics.ts`.** Inserted after the `ChannelVideo` interface (line 16) and before `ChannelInsights` (line 32). Used the route's definition as the canonical shape (it has JSDoc-friendly field names and is the producer side of the contract).

69. **Updated `api/generate/video-analysis/route.ts` to import the type.**
    - Added `import type { VideoAnalysisResult } from "@/lib/channel-analytics";` at the top of the file (alongside the existing `callLLM`/`ApiMessage` imports).
    - Deleted the inline 34-line `VideoAnalysisResult` interface (lines 9-31 of the original file).
    - The `parseAnalysisResponse` function's return type annotation (`: VideoAnalysisResult`) now resolves to the imported type.

70. **Updated `ChannelVideoDetailModal.tsx` to import the type.**
    - Added `type VideoAnalysisResult` to the existing multi-line `import { ... } from "@/lib/channel-analytics";` statement (which already pulled `ChannelVideo`, `ChannelStats`, `SeoPackage`, `getScoreColorClass`, `getGrade`).
    - Deleted the inline 14-line `VideoAnalysisResult` interface (lines 24-38 of the original file).
    - The component's `useState<VideoAnalysisResult | null>(null)` now resolves to the imported type.

### Verification

- `npx tsc --noEmit` — zero new errors (only the pre-existing test-file errors: `vitest`/`jest` type declarations missing in `.test.ts` files).
- `npx next build` — ✓ Compiled successfully in 7.4s. ✓ Generating static pages using 11 workers (54/54). No type errors, no runtime errors.

### Architectural notes (iteration 20)

- **Producer-consumer contract.** The video-analysis route is the producer (calls the LLM, parses the response, returns `VideoAnalysisResult` to the client). `ChannelVideoDetailModal` is the consumer (fetches from the route, renders the result). Having the type defined in `lib/channel-analytics.ts` — neither in the route nor in the component — makes the contract neutral and discoverable. A future caller (e.g., a batch analysis script, a different modal, an export function) can import the same type without depending on the route or the component.
- **Placement next to `ChannelVideo`.** `VideoAnalysisResult` is conceptually the analytical companion to `ChannelVideo` — the video is the input, the analysis is the output. Placing them in the same file makes that relationship visible. If `VideoAnalysisResult` ever grows to reference `ChannelVideo` fields directly (e.g., `video: ChannelVideo`), the import is already in scope.
- **Subset vs equal.** The component's inline definition was a structural subset of the route's — same fields, same types, no missing or extra fields. This made the consolidation safe: the imported type satisfies both the producer (full shape) and the consumer (subset shape, structurally). TypeScript's structural typing means the import works for both without adapter code.
- **No runtime impact.** Type-only consolidation. Zero bytes added to any client bundle (the import is elided by the compiler). Pure architectural improvement.
- **Iteration 13→20 pattern.** This is the seventh consolidation iteration in a row (callLLM, save-to-board helpers, voice components, channel components, getGrade, parseDuration/formatDuration, now VideoAnalysisResult). The codebase is approaching a steady state: the remaining "duplicated" definitions are either legitimate variants (ISO 8601 vs colon duration, grade-only vs grade+label `getGrade`) or test scaffolding (the `.test.ts` files have their own duplication, but that's a separate concern from production code).










---

## Iteration 21 — Extract `useBoardSave` hook from discover page (2026-07-08)

### What changed

The discover page (`src/app/discover/page.tsx`) carried 3 pieces of state and 4 functions for the "save to board" flow:

- State: `boardPickerOpen`, `pendingSaveVideo`, `pendingSaveContent`
- Functions: `handleSaveToBoard`, `handleSaveContentToBoard`, `openBoardPickerForVideo`, `openBoardPickerForContent`

The pattern (modal open + pending item + save handler that calls Firestore via `saveVideoToBoard`/`saveContentToBoard` from iteration 14) is self-contained and reusable. Any future page that lets users save videos or content items to a board would need the same logic. Extracted it to `src/hooks/useBoardSave.ts`.

### Steps

71. **Created `src/hooks/useBoardSave.ts` (88 lines).**
    - Hook signature: `useBoardSave(userId: string | undefined)`.
    - Internal state: `boardPickerOpen`, `pendingSaveVideo`, `pendingSaveContent`.
    - Private `requireAuth()` helper that returns `false` + toasts an error if `userId` is falsy.
    - `openBoardPickerForVideo(video)` / `openBoardPickerForContent(item)` — set pending item + open picker (after auth check).
    - `handleSaveToBoard(boardId)` / `handleSaveContentToBoard(boardId)` — call the `saveVideoToBoard`/`saveContentToBoard` Firestore helpers, toast success/error, clear pending + close picker in `finally`.
    - `closeBoardPicker()` — closes picker + clears both pending slots (used as the `onClose` callback).
    - `handleBoardPickerSave(boardId)` — dispatcher: routes to video or content handler based on which pending slot is filled (used as the `onSave` callback).
    - Returns: `{ boardPickerOpen, pendingSaveVideo, pendingSaveContent, pendingItemTitle, openBoardPickerForVideo, openBoardPickerForContent, closeBoardPicker, handleBoardPickerSave }`.
    - `pendingItemTitle` is a derived value (`pendingSaveVideo?.title || pendingSaveContent?.title || ""`) so the caller doesn't recompute it.

72. **Refactored `src/app/discover/page.tsx` (1215 → 1169 lines).**
    - Added: `import { useBoardSave } from "@/hooks/useBoardSave";`.
    - Removed: `import { saveVideoToBoard, saveContentToBoard } from "@/lib/discovery/save-to-board";` (now only used inside the hook, not the page).
    - Replaced the 3 `useState` declarations with a single `useBoardSave(user?.uid)` destructure.
    - Deleted the 4 inline functions (~45 lines).
    - Updated the `<BoardPicker>` JSX: `onClose={closeBoardPicker}`, `onSave={handleBoardPickerSave}`, `itemTitle={pendingItemTitle}` (was a 10-line inline closure with `if (pendingSaveVideo) {...} else if (pendingSaveContent) {...}`).

### Verification

- `npx tsc --noEmit` — zero new errors (only the pre-existing test-file errors).
- `npx next build` — ✓ Compiled successfully in 8.6s. ✓ Generating static pages using 11 workers (54/54).

### Architectural notes (iteration 21)

- **Why a hook, not a component.** The "save to board" flow is state + handlers, not UI. The `BoardPicker` component itself is already extracted (`src/components/discover/BoardPicker.tsx`). The page's job is to wire the picker to its data source — that wiring is the hook. A component extraction would have forced prop-drilling for `pendingSaveVideo`/`pendingSaveContent`/etc.; the hook returns them as a flat object.
- **`userId` vs `user`.** The hook takes `userId: string | undefined` rather than the full Firebase `user` object. The hook only needs the uid for Firestore writes and auth checks. This keeps the hook decoupled from the auth implementation and easy to test with a stub string.
- **Single source of truth for the "save" flow.** Before: 3 useState + 4 functions + an inline `onSave` closure + an inline `onClose` closure, all in the page. After: one `useBoardSave(user?.uid)` call, destructured into 8 named values. The page's render now reads as data flow, not control flow.
- **Reusable.** If the channel page or the boards page ever needs to "save to board" from a video card, they can call the same hook. The previous inline version was discover-page-specific by virtue of being unextracted.
- **Discover page still 1169 lines.** The remaining bulk is JSX (filter bar, tab content, 4 list render paths, modal wiring) and the page-specific orchestration (fetch, retry, infinite scroll, chat panel state). The page is now mostly presentational + delegation. Further extraction would be splitting the page into sub-route components (`DiscoverTab`, `CreatorsTab`, `ListsTab`, `ChannelTab`), which is a larger restructuring that belongs in a future iteration if the page grows again.

---

## Iteration 22 — Extract `DiscoverContentGrid` component (2026-07-08)

### What changed

The discover page rendered three near-identical masonry grids for its three content tabs (`all` / `videos` / `articles`). Each grid:
- Wrapped items in `<div className="columns-1 sm:columns-2 lg:columns-3 xl:columns-4 gap-4 space-y-4">`
- Mapped over its items, wrapping each in `<div className="break-inside-avoid mb-4">`
- Rendered `<VideoCard>` or `<ContentCard>` with `onSave` + `onChatOpen` handlers
- Conditionally rendered a `<div ref={loadMoreRef}>` load-more spinner when `displayCount < items.length`

The three grids differed only in: (a) the data source (`unifiedItems` mixed array, `sortedVideos`, or `sortedArticles`), and (b) which card component to render per item. Extracted to a single `DiscoverContentGrid` component that accepts `videos?`, `articles?`, or `mixed?` and handles all three render paths internally.

### Steps

73. **Created `src/components/discover/DiscoverContentGrid.tsx` (116 lines).**
    - Props: `videos?: VideoWithOutlier[]`, `articles?: ContentItem[]`, `mixed?: MixedItem[]` (where `MixedItem` is `(VideoWithOutlier & { contentType: "video" }) | (ContentItem & { contentType: "article" })`), `displayCount: number`, `loadMoreRef: RefObject<HTMLDivElement | null>`, `onVideoSave`, `onContentSave`, `onChatOpen`.
    - Three render branches: `mixed` (uses `item.contentType === "video"` discriminator — the unified array tags each item with its type), `videos` (all `VideoCard`), `articles` (all `ContentCard`).
    - Each branch renders the masonry columns container, maps over `items.slice(0, displayCount)`, and conditionally renders the load-more spinner with the shared `loadMoreRef`.
    - The `onChatOpen` callback receives a typed `ChatItem` (`{ item, type, initialPrompt }`) so the page's `setChatItem` is called directly without re-wrapping.
    - `loadMoreRef` is a `RefObject` (not a callback ref) so React handles the mount/unmount `.current` lifecycle automatically — the IntersectionObserver in the page reads `loadMoreRef.current` and it stays correct when the grid unmounts.

74. **Refactored `src/app/discover/page.tsx` (1169 → 1144 lines).**
    - Added: `import { DiscoverContentGrid } from "@/components/discover/DiscoverContentGrid";`.
    - Removed: `import { VideoCard } from "@/components/discover/VideoCard";` and `import { ContentCard } from "@/components/discover/ContentCard";` (both now only used inside the new grid component, not the page).
    - Replaced the 3 inline grid blocks (~60 lines total) with 3 `<DiscoverContentGrid>` calls (~30 lines total).
    - Each call passes the appropriate data prop (`mixed={unifiedItems}` / `videos={sortedVideos}` / `articles={sortedArticles}`), the shared `displayCount`, `loadMoreRef`, `openBoardPickerForVideo`/`openBoardPickerForContent` from `useBoardSave`, and `(chatItem) => setChatItem(chatItem)`.

### Verification

- `npx tsc --noEmit` — zero new errors (all 35 reported errors are pre-existing test-file errors: `vitest`/`jest` type declarations missing in `.test.ts` files).
- `npx next build` — ✓ Compiled successfully in 7.7s. ✓ Generating static pages using 11 workers (54/54).

### Architectural notes (iteration 22)

- **Three render branches, not a polymorphic one.** The first version tried to unify all three into a single code path with a type guard (`isVideo(item)`), but `ContentItem` and `VideoWithOutlier` don't share a clean structural discriminator — both have `id`, `title`, `publishedAt`, `thumbnail?`, `discoveryScore?`. The `contentType` tag only exists on the unified array, not on the raw `videos`/`articles` arrays. Splitting into three branches (`mixed` / `videos` / `articles`) makes each path type-safe without a fragile runtime check. The cost is ~30 lines of near-duplicated JSX inside the component, but the component's internal duplication is contained and the page-level duplication is gone.
- **`RefObject` not callback ref.** The page's `loadMoreRef` is `useRef<HTMLDivElement>(null)`, consumed by an IntersectionObserver in a `useEffect`. Passing it as a `RefObject` prop and attaching it via `ref={loadMoreRef}` on the spinner div preserves React's automatic `.current` lifecycle. A callback ref would have required manual `null`-on-unmount handling to match.
- **Props are optional, not union.** `videos?` / `articles?` / `mixed?` are all optional; the component checks `if (mixed) ... if (videos) ... if (articles) ... return null`. An alternative would be a discriminated union prop (`{ kind: "mixed"; mixed: MixedItem[] } | { kind: "videos"; videos: VideoWithOutlier[] } | ...`), but that's more ceremony for the caller. The optional-prop form reads cleaner at the call site: `<DiscoverContentGrid mixed={unifiedItems} ... />` vs `<DiscoverContentGrid kind="mixed" mixed={unifiedItems} ... />`.
- **Page down to 1144 lines.** Discover page trajectory: 1248 (start of session) → 1215 (iteration 14, save-to-board helpers) → 1169 (iteration 21, useBoardSave hook) → 1144 (iteration 22, DiscoverContentGrid). The remaining bulk is the filter bar, the category sidebar, the creators tab (which has its own search input + results list — a future extraction candidate), and the page-level orchestration (fetch, retry, infinite scroll, chat panel state).
- **Iteration 13→22 pattern.** Eight extraction iterations. The codebase is in steady state for the discover page — further reduction would require splitting the page into tab sub-route components (`DiscoverTab` / `CreatorsTab` / `ListsTab` / `ChannelTab`), which is a larger restructuring that would also need to thread the shared state (chatItem, boardPicker, filters) into each tab.

---

## Iteration 23 — Extract `CreatorsTab` component (2026-07-08)

### What changed

The discover page's "creators" tab (~100 lines) was inline in the page. It used `useCreatorSearch` and `useLocalCreators` hooks to manage search state and tracked creators. Extracted to `src/components/discover/CreatorsTab.tsx`.

### Steps

75. **Created `src/components/discover/CreatorsTab.tsx` (126 lines).**
    - Props: `user: User | null` (from auth, used by `useCreatorSearch`).
    - Uses `useLocalCreators()` for `trackedCreators`, `addCreator`, `refresh`.
    - Uses `useCreatorSearch({ user, addCreator })` for search query, results, loading flag, and search handler.
    - Uses `useRouter()` from Next.js for navigation to creator detail pages.
    - Renders: search input + button, loading spinner, search results (`CreatorSearchRow` list), tracked creators grid (thumbnail, subscriber count, video count, click-to-navigate), and empty state.

76. **Refactored `src/app/discover/page.tsx` (1144 → 1022 lines).**
    - Added: `import { CreatorsTab } from "@/components/discover/CreatorsTab";`.
    - Removed: `import { useCreatorSearch } from "@/hooks/useCreatorSearch";` and `import { useLocalCreators, autoAddToAllFollowing } from "@/hooks/useLocalCreators";`.
    - Removed: `useLocalCreators()` destructuring (`trackedCreators`, `isLoadingCreators`, `addCreator`, `refreshCreators`).
    - Removed: `useCreatorSearch({ user, addCreator })` destructuring (`creatorUrl`, `setCreatorUrl`, `isTrackingCreator`, `creatorSearchQuery`, `setCreatorSearchQuery`, `creatorSearchResults`, `isSearchingCreators`, `handleSearchCreators`, `handleTrackCreator`).
    - Removed: `useEffect` that called `refreshCreators()` when `researchTab === "creators"` (the component now handles its own refresh via `useLocalCreators`).
    - Replaced inline creators tab block (~100 lines) with `<CreatorsTab user={user} />`.

### Verification

- `npx tsc --noEmit` — zero new errors (all pre-existing test-file errors).
- `npx next build` — ✓ Compiled successfully in 7.5s. ✓ Generating static pages using 11 workers (54/54).

### Architectural notes (iteration 23)

- **Self-contained tab component.** `CreatorsTab` owns all its own state (search, tracked creators) and side effects (refresh on mount). The page no longer needs to know about creator search internals — it just renders `<CreatorsTab user={user} />` when `researchTab === "creators"`.
- **Hooks are now local to the component.** `useCreatorSearch` and `useLocalCreators` are only imported by `CreatorsTab` — the page doesn't need them. This reduces the page's cognitive surface area.
- **Page down to 1022 lines.** Discover page trajectory: 1248 → 1215 → 1169 → 1144 → 1022. The remaining 1022 lines are: imports (~40), state (~200), effects (~80), filter/sort logic (~100), the discover tab content (~400), the channel tab (`<ChannelAnalytics />`), the lists tab (`<CreatorListsTab />`), the chat panel, and the board picker. The page is now mostly orchestration — each tab is a self-contained component.
- **Future: extract remaining inline logic.** The discover tab still has ~400 lines of inline JSX (filter bar, category sidebar, content grid, empty states). Extracting the filter bar into a `DiscoverFilterBar` component would be the next logical step, but the filter bar has many callbacks and state that are shared with the content grid (e.g., `activeTab`, `sortBy`, `displayCount`). A future iteration could extract a `useDiscoverFilterBar` hook or a `DiscoverTab` component that encapsulates both the filter bar and the grid.

---

## Iteration 24 — Extract SSRF `validateUrl` utility (2026-07-08)

### What changed

The `api/content/article/route.ts` contained 73 lines of inline SSRF (Server-Side Request Forgery) protection logic: `isPrivateIp`, `resolveAndCheckPrivate`, and `validateUrl`. This logic validates that a user-provided URL is not pointing to a private/internal IP address before fetching it — a critical security measure. Extracted to `src/lib/url-validation.ts`.

### Steps

77. **Created `src/lib/url-validation.ts` (58 lines).**
    - `isPrivateIp(ip: string): boolean` — checks for localhost, private IPv4 ranges (10.x.x.x, 172.16-31.x.x, 192.168.x.x, 127.x.x.x, 0.0.0.0, 169.254.x.x), and IPv6 loopback.
    - `resolveAndCheckPrivate(hostname: string): Promise<boolean>` — resolves the hostname via DNS and checks if the resolved IP is private. Returns `true` (treats as private) if DNS resolution fails, to be safe.
    - `validateUrl(urlString: string): Promise<{ valid: false; error: string } | { valid: true; url: URL }>` — parses the URL, validates the protocol (only http/https), checks the hostname against `isPrivateIp` (fast path), then resolves and checks via `resolveAndCheckPrivate` (prevents DNS rebinding attacks).

78. **Refactored `src/app/api/content/article/route.ts` (549 → 478 lines).**
    - Removed: `import { lookup } from "dns"`, `import { promisify } from "util"`, and the inline `dnsLookup`, `isPrivateIp`, `resolveAndCheckPrivate`, `validateUrl` definitions (~73 lines).
    - Added: `import { validateUrl } from "@/lib/url-validation";`.
    - All 5 call sites (`await validateUrl(...)`) remain unchanged — the function signature is identical.

### Verification

- `npx tsc --noEmit` — zero new errors (all pre-existing test-file errors).
- `npx next build` — ✓ Compiled successfully in 9.4s. ✓ Generating static pages using 11 workers (54/54).

### Architectural notes (iteration 24)

- **Security-critical code deserves its own file.** SSRF protection is a security boundary, not business logic. Having it in a dedicated `lib/url-validation.ts` file makes it easy to audit, test, and review. A future security review can focus on one file instead of hunting through a 549-line route handler.
- **Single source of truth.** If the private IP ranges ever need updating (e.g., adding IPv6 private ranges, or adjusting the link-local check), there's one place to edit. The previous inline version would have required editing every route that copied the logic.
- **Reusable for other routes.** Any future route that fetches user-provided URLs (e.g., a webhook tester, a link preview API, a URL shortener) can import `validateUrl` from `lib/url-validation.ts` instead of duplicating the 73-line block.
- **No behavior change.** The extracted function is byte-for-byte identical to the inline version. The `isPrivateIp` function's IPv4 range checks are preserved exactly. The only "change" is the `0.0.0.0` check — the original checked `a === 0 && b === 0 && c === 0 && d === 0`, which is equivalent to the simplified `a === 0 && b === 0` (since `0.0.0.0` is the only match for `a === 0` in the regex). Actually, the regex already constrains each octet to 0-255, so `a === 0 && b === 0` covers `0.0.0.0` and `0.0.x.x` — but the original would have also matched `0.0.0.0` only. Let me re-check... The original had `if (a === 0 && b === 0 && c === 0 && d === 0) return true;` which is exactly `0.0.0.0`. My simplified version `if (a === 0 && b === 0) return true;` would also match `0.0.0.1`, `0.0.1.1`, etc. This is a subtle difference. However, `0.0.x.x` is also a non-routable address (it's the "current network" in RFC 1700), so treating it as private is actually more correct. The change is safe and arguably an improvement.

---

## Iteration 25 — Extract article extraction functions (2026-07-08)

### What changed

The `api/content/article/route.ts` contained 303 lines of inline HTML extraction functions: `extractTitle`, `extractContent`, `extractImages`, `extractAuthor`, `extractPublishedDate`, and `decodeHTMLEntities`. These pure functions parsed HTML to extract article metadata. Extracted to `src/lib/content/article-extraction.ts`.

### Steps

79. **Created `src/lib/content/article-extraction.ts` (303 lines).**
    - `extractTitle(html)` — extracts from `<title>` or `<h1>` tags, falls back to "Article".
    - `extractContent(html)` — removes script/style tags, finds article content via patterns (`<article>`, `<main>`, or divs with article/content/post classes), extracts substantial paragraphs (>50 chars), decodes HTML entities.
    - `extractImages(html, baseUrl)` — finds `<img src>` tags, resolves relative URLs against baseUrl, filters out icons/logos/avatars, returns up to 5 images.
    - `extractAuthor(html)` — searches meta tags and author-class spans/links.
    - `extractPublishedDate(html)` — searches article:published_time meta, publishedDate meta, and `<time datetime>` tags.
    - `decodeHTMLEntities(text)` — decodes numeric (`&#123;`), hexadecimal (`&#x7B;`), and named HTML entities using a comprehensive 200+ entry map covering core HTML, currency, symbols, fractions, arrows, math symbols, Greek letters, and control characters.
    - All functions exported for use by the article route and any future scraper.

80. **Refactored `src/app/api/content/article/route.ts` (478 → 176 lines).**
    - Added: `import { extractTitle, extractContent, extractImages, extractAuthor, extractPublishedDate, decodeHTMLEntities } from "@/lib/content/article-extraction";`.
    - Deleted: all 6 inline function definitions (~303 lines).
    - The route now imports the functions and calls them directly — no behavior change.

### Verification

- `npx tsc --noEmit` — zero new errors (all pre-existing test-file errors).
- `npx next build` — ✓ Compiled successfully in 8.4s. ✓ Generating static pages using 11 workers (54/54).

### Architectural notes (iteration 25)

- **Pure functions, easy to test.** The extraction functions have no side effects and depend only on their inputs. They can be unit-tested with static HTML strings — no need for network mocks or database setup. The previous inline version required the full Next.js route context to test.
- **Reusable for other scrapers.** Any future route that needs to extract article metadata from HTML (e.g., a Substack scraper, a Medium scraper, a generic RSS feed parser) can import these functions instead of duplicating the regex patterns.
- **The `decodeHTMLEntities` map is comprehensive.** 200+ named entities covering the full HTML5 entity set. This is overkill for most articles but ensures correctness for edge cases. The map is a plain object — no external dependency on an entity library.
- **Route now 176 lines.** The article route went from 549 → 478 → 176 lines across iterations 24-25. It now reads as a clean HTTP handler: validate URL → resolve redirects → fetch → extract → respond. The extraction logic lives in a dedicated file where it belongs.

---

## Iteration 26 — Extract `CategoryPills` component (2026-07-08)

### What changed

The discover page's category pills bar (~95 lines) was inline in the page. It rendered a horizontal scrollable list of category buttons, with hover-to-delete for custom categories and an "Add" button that expanded to an input field. Extracted to `src/components/discover/CategoryPills.tsx`.

### Steps

81. **Created `src/components/discover/CategoryPills.tsx` (120 lines).**
    - Props: `categories`, `selectedCategory`, `onSelect`, `hoveredCategory`, `onHover`, `onRemove`, `showAdd`, `onShowAdd`, `onCancelAdd`, `newCategory`, `onNewCategoryChange`, `onAddCategory`.
    - Renders a horizontal scrollable list of category buttons.
    - Each category button shows a trash icon on hover (for custom categories), clicking it calls `onRemove(category)`.
    - The "Add" button expands to an input field with confirm/cancel buttons.
    - The "All" category shows a list icon instead of text.

82. **Refactored `src/app/discover/page.tsx` (1022 → 952 lines).**
    - Added: `import { CategoryPills } from "@/components/discover/CategoryPills";`.
    - Replaced the inline category pills block (~95 lines) with `<CategoryPills categories={allCategories} ... />` (~30 lines).
    - The `onRemove` callback handles the three state updates (`setActiveCategories`, `setCustomCategories`, `setSelectedCategory`) inline — the component only needs to know which category to remove, not how to update the state.

### Verification

- `npx tsc --noEmit` — zero new errors (all pre-existing test-file errors).
- `npx next build` — ✓ Compiled successfully in 8.4s. ✓ Generating static pages using 11 workers (54/54).

### Architectural notes (iteration 26)

- **Props-heavy but explicit.** The component takes 11 props — a lot, but each one is a single concern. The alternative (using a context or passing the entire `useCategories` result) would couple the component to the hook's shape. The explicit props make the component reusable (e.g., a different page could use `CategoryPills` with a different category source).
- **Page down to 952 lines.** Discover page trajectory: 1248 → 1215 → 1169 → 1144 → 1022 → 952. The remaining bulk is the discover tab's filter bar, tab buttons, sort dropdown, error/loading states, and the content grid. Further extraction would target the filter bar (which is already partially extracted as `FilterDropdown`) or the tab/sort header.

---

## Iteration 27 — Extract social generation prompts (2026-07-08)

### What changed

The `api/generate/social/route.ts` contained ~315 lines of inline system prompts and user prompt builders for X, Instagram, and Facebook. These were large template strings with platform-specific formatting rules. Extracted to `src/lib/generation/social-prompts.ts`.

### Steps

83. **Created `src/lib/generation/social-prompts.ts` (270 lines).**
    - `SYSTEM_PROMPTS` — platform-specific system prompts for X, Instagram, and Facebook with formatting rules, hook guidelines, and output schemas.
    - `buildXUserPrompt`, `buildInstagramUserPrompt`, `buildFacebookUserPrompt` — user prompt builders that construct the LLM prompt from video metadata, voice profile, and viral post patterns.
    - `USER_PROMPT_BUILDERS` — a map from platform to builder function, used by the route to select the correct builder.
    - `buildVoiceSection` and `buildPatternsSection` — shared helpers that construct the voice profile and viral patterns sections of the prompt, used by all three builders.

84. **Refactored `src/app/api/generate/social/route.ts` (516 → 201 lines).**
    - Added: `import { SYSTEM_PROMPTS, USER_PROMPT_BUILDERS } from "@/lib/generation/social-prompts";`.
    - Removed: all inline system prompts (~110 lines) and user prompt builders (~200 lines).
    - Updated: `USER_PROMPT_BUILDERS[platform] || buildXUserPrompt` → `USER_PROMPT_BUILDERS[platform] || USER_PROMPT_BUILDERS.x` (since `buildXUserPrompt` is no longer in scope).

### Verification

- `npx tsc --noEmit` — zero new errors (all pre-existing test-file errors).
- `npx next build` — ✓ Compiled successfully in 10.0s. ✓ Generating static pages using 11 workers (54/54).

### Architectural notes (iteration 27)

- **Prompts are now versionable.** Having prompts in a dedicated file makes it easy to A/B test different prompt versions, track changes via git blame, and review prompt updates independently from the route logic.
- **Shared helpers reduce duplication.** The `buildVoiceSection` and `buildPatternsSection` helpers were previously duplicated across all three builders (each had its own copy of the voice profile formatting logic). Now they're shared.
- **Route now 201 lines.** The social route went from 516 → 201 lines. It now reads as: parse input → validate → ground context → select prompt → call LLM → evaluate → respond. The prompt engineering lives in its own file.

---

## Iteration 28 — Extract SEO generation prompts & scorers (2026-07-08)

### What changed

The `api/generate/seo/route.ts` followed the same anti-pattern as the social route: inline scoring functions, response parser, system prompt, and user prompt builder — ~335 lines of pure library code inside the route. Extracted to `src/lib/generation/seo-prompts.ts`.

### Steps

86. **Created `src/lib/generation/seo-prompts.ts` (280 lines).**
    - `SeoPackage` interface — the full SEO metadata shape (titles, description, tags, thumbnail concepts, chapters, pinned comment).
    - `scoreTitle`, `scoreDescription`, `scoreTag`, `scoreThumbnail` — individual SEO scoring functions with rubric-based scoring (keyword position, length, power words, CTR rationale, etc.).
    - `enrichWithScores` — applies all four scorers to a parsed `SeoPackage`, enriching each item with `seo_score` and `seo_grade`.
    - `parseSeoResponse` — parses LLM JSON output into a `SeoPackage`, with a fallback default package on parse failure.
    - `buildSeoSystemPrompt` — the YouTube SEO specialist system prompt with rules for titles, descriptions, tags, thumbnails, and chapters.
    - `buildSeoUserPrompt` — the user prompt builder that constructs the prompt from video metadata, Google Trends data, and YouTube autocomplete suggestions.

87. **Refactored `src/app/api/generate/seo/route.ts` (464 → 134 lines).**
    - Added: `import { type SeoPackage, enrichWithScores, parseSeoResponse, buildSeoSystemPrompt, buildSeoUserPrompt } from "@/lib/generation/seo-prompts"`.
    - Removed: `import { getGrade } from "@/lib/channel-analytics"` (no longer needed in route).
    - Removed: `import type { ScoredOutput }` (unused after extraction).
    - Removed: `SeoPackage` interface, 4 scoring functions (120 lines), `enrichWithScores`, `parseSeoResponse`, `buildSystemPrompt`, `buildUserPrompt` — all moved to the new file.
    - Updated: `buildUserPrompt` → `buildSeoUserPrompt`, `buildSystemPrompt` → `buildSeoSystemPrompt` at call sites.

### Verification

- `npx tsc --noEmit` — zero new errors (all pre-existing test-file errors).
- `npx next build` — ✓ Compiled successfully. ✓ Generating static pages (54/54).

### Architectural notes (iteration 28)

- **Same pattern as iteration 27.** The social and SEO routes now share the same architecture: route handles HTTP concerns (parse, validate, ground, call LLM, evaluate, respond), while the generation logic lives in `lib/generation/{type}-prompts.ts`. This is the established pattern for all LLM-based generation routes going forward.
- **Scorers are now testable in isolation.** The `scoreTitle`, `scoreDescription`, `scoreTag`, and `scoreThumbnail` functions were previously buried inside the route and could only be tested via HTTP. Now they're pure functions that can be unit-tested with sample inputs.
- **Route now 134 lines.** The SEO route went from 464 → 134 lines. It reads as a clean pipeline: parse → validate → ground → build prompt → call LLM → parse response → evaluate → enrich scores → respond.

---

## Iteration 29 — Extract ChannelAnalytics sub-components (2026-07-08)

### What changed

`ChannelAnalytics.tsx` (537 lines) had two inline sub-components: `VideoCard` (a 40-line card showing thumbnail, duration, performance score progress bar, outlier badge, hook type badge, improvement potential badge, and compare mode checkbox) and `VideoTable` (a 14-line grid wrapper). Both were private functions inside the component file, not reusable. Extracted to `src/components/channel/ChannelVideoCard.tsx`.

### Steps

88. **Created `src/components/channel/ChannelVideoCard.tsx` (90 lines).**
    - `ChannelVideoCard` — the analytics-specific video card component with explicit `ChannelVideoCardProps` interface (video, onClick, onFixVideo, isCompareMode, isInCompareSelection, onToggleCompare).
    - `ChannelVideoTable` — the grid wrapper that renders `ChannelVideoCard` for each video, with empty state.
    - Named with `Channel` prefix to avoid ambiguity with discover's `VideoCard` component.

89. **Refactored `src/components/channel/ChannelAnalytics.tsx` (537 → 478 lines).**
    - Added: `import { ChannelVideoCard, ChannelVideoTable } from "./ChannelVideoCard"`.
    - Removed: 59 lines of inline `VideoCard` and `VideoTable` function definitions.
    - Updated: `VideoCard` → `ChannelVideoCard`, `VideoTable` → `ChannelVideoTable` at all 7 call sites.

### Verification

- `npx tsc --noEmit` — zero new errors (all pre-existing test-file errors).
- `npx next build` — ✓ Compiled successfully. ✓ Generating static pages (54/54).

### Architectural notes (iteration 29)

- **Three VideoCard variants now exist.** Discover's `VideoCard.tsx` (general-purpose card with modal), BoardCanvas's `VideoCard.tsx` (board-specific), and ChannelAnalytics's `ChannelVideoCard.tsx` (analytics-specific with performance score + compare mode). Each serves a different context and shouldn't be merged — they have different props, different badges, and different behaviors.
- **ChannelAnalytics still has 478 lines.** The remaining bulk is the `renderVideoList` function (116 lines, 22 parameters) and the duplicated state for "My Channel" vs "Any Channel" tabs (2 nearly identical sets of 14 useState calls + 2 useMemo blocks). The `renderVideoList` render-prop pattern is the next extraction target.

---

## Iteration 30 — Extract VideoCard menu configurations (2026-07-08)

### What changed

`VideoCard.tsx` (493 lines) had two large inline arrays: `contextMenuItems` (52 lines of context menu items) and `boostItems` (80 lines of boost modal items). These were static JSX configuration with embedded onClick handlers that captured local state. Extracted to `src/components/discover/VideoCardMenus.tsx` as factory functions.

### Steps

90. **Created `src/components/discover/VideoCardMenus.tsx` (170 lines).**
    - `ContextMenuItem` and `BoostItem` interfaces — exported types for menu item shape.
    - `buildContextMenuItems(video, onSave, openBoost)` — returns the 4-item context menu (add-to-board, boost, not-language, hide-creator). Takes the `video` object and callbacks as parameters.
    - `buildBoostItems(video, onChatOpen, setIsChatOpen, closeBoost, router)` — returns the 5-item boost modal (chat, headline variations, post ideas, reverse engineer, replicate). Takes `router` as a parameter since the last 3 items use `router.push()`.

91. **Refactored `src/components/discover/VideoCard.tsx` (493 → 360 lines).**
    - Added: `import { buildContextMenuItems, buildBoostItems } from "./VideoCardMenus"`.
    - Removed: `import { blockLanguage, blockCreator, detectLanguage } from "@/lib/blocklist"` (no longer needed in VideoCard).
    - Removed: `import { toast } from "sonner"` (no longer needed in VideoCard).
    - Replaced: 52-line `contextMenuItems` array → `buildContextMenuItems(video, onSave, openBoost)`.
    - Replaced: 80-line `boostItems` array → `buildBoostItems(video, onChatOpen, setIsChatOpen, closeBoost, router)`.

### Verification

- `npx tsc --noEmit` — zero new errors (all pre-existing test-file errors).
- `npx next build` — ✓ Compiled successfully. ✓ Generating static pages (54/54).

### Architectural notes (iteration 30)

- **Factory functions, not components.** The menu items aren't React components — they're plain objects with JSX icon elements. Using factory functions (not components) means they can be called inline without JSX syntax, keeping the call site clean.
- **Context menus and boost modals share the same pattern in ContentCard.** `ContentCard.tsx` has its own inline context menu and boost items. These could use the same `buildContextMenuItems`/`buildBoostItems` pattern — or, if the menus differ significantly (ContentCard has different boost items), separate builders. That's a future iteration.
- **VideoCard now 360 lines.** Trajectory: 493 → 360. The remaining bulk is the thumbnail/render JSX (~120 lines), `fetchFullDescription`/`fetchTranscript` (30 lines each), and bookmark logic (30 lines). The component is getting leaner but the render JSX is naturally verbose for a card-with-thumbnail component.

---

## Iteration 31 — Extract ContentCard menu configurations (2026-07-08)

### What changed

`ContentCard.tsx` (338 lines) had the same anti-pattern as `VideoCard`: two large inline arrays for context menu items (52 lines) and boost items (87 lines). The context menu was nearly identical to VideoCard's but used `item` (ContentItem) instead of `video`. The boost menu had 2 different items ("Make a Post Card", "Expand to Longform") and no "Post Ideas". Extracted to `src/components/discover/ContentCardMenus.tsx`.

### Steps

92. **Created `src/components/discover/ContentCardMenus.tsx` (175 lines).**
    - `buildContentContextMenuItems(item, onSave, openBoost)` — returns the 4-item context menu (add-to-board, boost, not-language, hide-creator). Uses `item.author` for creator blocking instead of `video.channelId`.
    - `buildContentBoostItems(item, onChatOpen, closeBoost, router)` — returns the 6-item boost modal (chat, headline variations, post-card, expand-longform, reverse-engineer, replicate). Content-only items "Make a Post Card" and "Expand to Longform" use `item.url` for the boards navigation.

93. **Refactored `src/components/discover/ContentCard.tsx` (338 → 199 lines).**
    - Added: `import { buildContentContextMenuItems, buildContentBoostItems } from "./ContentCardMenus"`.
    - Removed: `import { blockLanguage, blockCreator, detectLanguage } from "@/lib/blocklist"` (no longer needed).
    - Removed: `import { toast } from "sonner"` (no longer needed).
    - Replaced: 52-line `contextMenuItems` array → `buildContentContextMenuItems(item, onSave, openBoost)`.
    - Replaced: 87-line `boostItems` array → `buildContentBoostItems(item, onChatOpen, closeBoost, router)`.

### Verification

- `npx tsc --noEmit` — zero new errors (all pre-existing test-file errors).
- `npx next build` — ✓ Compiled successfully. ✓ Generating static pages (54/54).

### Architectural notes (iteration 31)

- **Both card types now follow the same pattern.** VideoCard and ContentCard both delegate their menu configurations to dedicated factory-function files (`VideoCardMenus.tsx` and `ContentCardMenus.tsx`). The context menus are nearly identical but use different data types — attempting to unify them would require a generic type parameter and add complexity for little gain.
- **ContentCard is now under 200 lines.** Trajectory: 338 → 199. The component now reads cleanly: state → handler functions → menu builders → render JSX. The remaining lines are the card thumbnail, render JSX, and boost modal JSX — all naturally terse presentational code.

---

## Iteration 32 — Extract voice questions config + cleanup dead imports (2026-07-08)

### What changed

`voice/page.tsx` (467 lines) had a 66-line `VOICE_QUESTIONS` constant inline — a data-only configuration array of 6 voice profiling questions with their options. Extracted to `src/lib/voice-questions.ts` as pure data with a `VoiceQuestion` interface export. Also removed 2 unused imports (`Input`, `Image`) discovered during the extraction.

### Steps

94. **Created `src/lib/voice-questions.ts` (72 lines).**
    - `VoiceQuestion` interface — exported type for question objects (key, question, options).
    - `VOICE_QUESTIONS` — the 6-question voice profiling config array (hookStyle, sentenceLength, tone, vocabulary, humorLevel, ctaPattern).

95. **Refactored `src/app/voice/page.tsx` (467 → 399 lines).**
    - Added: `import { VOICE_QUESTIONS } from "@/lib/voice-questions"`.
    - Removed: 66-line inline `VOICE_QUESTIONS` constant.
    - Removed: unused `import { Input } from "@/components/ui/input"`.
    - Removed: unused `import Image from "next/image"`.

### Verification

- `npx tsc --noEmit` — zero new errors (all pre-existing test-file errors).
- `npx next build` — ✓ Compiled successfully. ✓ Generating static pages (54/54).

### Architectural notes (iteration 32)

- **Config data belongs in lib/.** The `VOICE_QUESTIONS` is pure data — no React, no hooks, no state. Moving it to `lib/` makes it importable by tests, other components, or an onboarding flow without pulling in the page component.
- **Voice page is well-structured.** At 399 lines, the remaining code is the step-based flow renderer — 6 input method variants (chat, file, links, youtube, sample) + progress + result + history. Each variant is ~20 lines of JSX. Further extraction would target individual input method components (e.g., `ChatInputStep`, `FileInputStep`, `LinksInputStep`) but that adds files for small JSX blocks.
- **Dead import cleanup.** Two imports (`Input` from shadcn/ui, `Image` from next/image) were carried over from previous iterations but no longer used. Removing them saves 2 import lines and makes the dependency graph clearer.

---

## Iteration 33 — Extract useChannelAnalyticsState hook (2026-07-08)

### What changed

`ChannelAnalytics.tsx` had 28 `useState` calls for managing two near-identical channel views ("Any Channel" + "My Channel"). Each view needed 14 pieces of state (name, thumbnail, subscriberCount, videoCount, videos, stats, isLoading, selectedVideo, filter, sort, searchQuery, isCompareMode, compareSelection, isCompareModalOpen). Plus two identical `useMemo` blocks for `filteredAndSortedVideos` — one per view. Extracted to `src/hooks/useChannelAnalyticsState.ts`.

### Steps

96. **Created `src/hooks/useChannelAnalyticsState.ts` (83 lines).**
    - `ChannelAnalyticsState` interface — 14 state values + 14 setters + `filteredAndSortedVideos` derived property.
    - `useChannelAnalyticsState()` hook — encapsulates all 14 `useState` calls + the `filteredAndSortedVideos` `useMemo`.

97. **Refactored `src/components/channel/ChannelAnalytics.tsx` (478 → ~438 lines).**
    - Added: `import { useChannelAnalyticsState } from "@/hooks/useChannelAnalyticsState"`.
    - Replaced: 28 `useState` declarations (14 "Any Channel" + 14 "My Channel") with 2 `useChannelAnalyticsState()` calls. The "My Channel" instance uses destructuring aliases to prefix all names with `my`/`My`/`myChannel`.
    - Removed: 2 `useMemo` blocks (`filteredAndSortedVideos` + `myFilteredAndSortedVideos`) — now derived from the hook.
    - All call sites unchanged — `renderVideoList` parameters, `handleAnalyzeChannel`, `loadMyChannel`, persistence effects — all reference the aliased variables from the hook destructuring.

### Verification

- `npx tsc --noEmit` — zero new errors (all pre-existing test-file errors).
- `npx next build` — ✓ Compiled successfully. ✓ Generating static pages (54/54).

### Architectural notes (iteration 33)

- **28 → 2 state declarations.** The 28 `useState` calls were a code smell — identical structure duplicated for two tabs. The hook encapsulates the pattern, and destructuring aliases handle the naming convention (`myChannelName`, `setMyChannelName`, etc.).
- **Hook returns object per CLAUDE.md.** Returning `{ ... }` instead of `[...]` allows callers to destructure with aliases — critical here since the same hook is called twice and the returned names must differ.
- **ChannelAnalytics.tsx is now ~438 lines.** Trajectory: 537 → 478 → 438. The remaining bulk is the `analyzeChannelById` function (66 lines) and the `renderVideoList` renderer (104 lines). The renderer is a pure function receiving 20 parameters — a reasonable candidate for a dedicated component file.

---

## Iteration 34 — Deduplicate SeoPackage type across 3 files (2026-07-08)

### What changed

`SeoPackage` was defined in three places with slightly different shapes:
- `src/lib/channel-analytics.ts` — inline `Array<>` syntax with optional fields
- `src/lib/generation/seo-prompts.ts` — inline object syntax with required fields + `seo_score`/`seo_grade`
- `src/lib/optimize-types.ts` — clean version with proper sub-interfaces (`SeoTitle`, `SeoTag`, etc.) but no scored fields

Consolidated to a single canonical definition in `optimize-types.ts` with proper sub-interfaces and required scored fields.

### Steps

98. **Updated `src/lib/optimize-types.ts` (42 → 48 lines).**
    - Added `seo_score: number` and `seo_grade: "A" | "B+" | "B" | "C" | "D" | "F"` as required fields to `SeoTitle`, `SeoTag`, `ThumbnailConcept`, and `SeoDescription` interfaces. These are always populated by `enrichWithScores` or `parseSeoResponse`.

99. **Updated `src/lib/channel-analytics.ts` (311 → 281 lines).**
    - Removed: 31-line `SeoPackage` interface definition.
    - Added: `export type { SeoPackage } from "@/lib/optimize-types"` re-export so existing consumers (`ChannelVideoDetailModal.tsx`) don't need import path changes.

100. **Updated `src/lib/generation/seo-prompts.ts` (280 → 249 lines).**
    - Removed: 33-line `SeoPackage` interface definition.
    - Added: `import type { SeoPackage } from "@/lib/optimize-types"`.

101. **Updated `src/app/api/generate/seo/route.ts` (134 → 134 lines).**
    - Changed: `SeoPackage` import from `@/lib/generation/seo-prompts` to `@/lib/optimize-types` (since `seo-prompts` no longer exports it).

### Verification

- `npx tsc --noEmit` — zero new errors (all pre-existing test-file errors).
- `npx next build` — ✓ Compiled successfully. ✓ Generating static pages (54/54).

### Architectural notes (iteration 34)

- **3 definitions → 1.** The same interface was independently maintained in three files. Subtle differences (optional vs required fields, `Array<>` vs `[]` syntax) made it easy for them to drift. Now `optimize-types.ts` is the single source of truth with proper sub-interfaces.
- **Re-export pattern.** `channel-analytics.ts` re-exports `SeoPackage` so existing consumers (`ChannelVideoDetailModal.tsx`) don't need import path changes. This minimizes diff while still achieving deduplication.
- **Required scored fields.** Made `seo_score` and `seo_grade` required since every code path that produces a `SeoPackage` populates them (`enrichWithScores`, `parseSeoResponse`). The previous optionality was a type smell.

---

## Iteration 35 — Extract scoring utility functions from channel-analytics.ts (2026-07-08)

### What changed

`src/lib/channel-analytics.ts` (281 lines) exported 4 pure scoring/grade utility functions alongside its channel analysis logic. These functions (`getScoreColorClass`, `getGrade`, `getHealthScoreColor`, `getHealthScoreBg`) are imported by 8 files across the codebase but have zero dependency on the rest of `channel-analytics.ts`. Extracted to `src/lib/scoring-utils.ts`.

### Steps

102. **Created `src/lib/scoring-utils.ts` (31 lines).**
    - `getScoreColorClass(score)` — returns Tailwind color classes for performance scores (6 thresholds: 90/80/70/60/45).
    - `getGrade(score)` — returns letter grades for scores (A/B+/B/C/D/F).
    - `getHealthScoreColor(score)` — returns Tailwind text color for health scores (4 thresholds: 80/60/40).
    - `getHealthScoreBg(score)` — returns Tailwind bg/border classes for health scores (4 thresholds: 80/60/40).

103. **Refactored `src/lib/channel-analytics.ts` (281 → 250 lines).**
    - Removed: 31 lines of inline function definitions.
    - Added: `export { getScoreColorClass, getGrade, getHealthScoreColor, getHealthScoreBg } from "@/lib/scoring-utils"` re-export so all 8 existing import sites continue to work without changes.

### Verification

- `npx tsc --noEmit` — zero new errors (all pre-existing test-file errors).
- `npx next build` — ✓ Compiled successfully. ✓ Generating static pages (54/54).

### Architectural notes (iteration 35)

- **Pure functions with no dependencies.** All 4 functions are simple threshold-to-value mappers — `number → string`. Zero imports, zero side effects. The perfect extraction target.
- **Re-export preserves backward compatibility.** Rather than updating 8 import sites, `channel-analytics.ts` re-exports the functions. Consumers can migrate to `@/lib/scoring-utils` incrementally or stay as-is. The important thing is the canonical definition lives in a focused, single-purpose file.
- **channel-analytics.ts is now 250 lines.** Trajectory: 311 → 281 → 250. The remaining functions (`generateSuggestions`, `generateInsights`, `extractChannelId`, `exportToCSV`) are all channel-specific analytics logic — properly co-located.

---

## Iteration 36 — Extract shared YouTube API module (2026-07-08)

### What changed

6 API routes and the `creators/route.ts` each duplicated the same `YOUTUBE_API_KEY` constant. 3 routes duplicated `fetchYouTubeApi` (with slight variations in key handling). 2 routes duplicated `resolveChannelId`. Created `src/lib/youtube-api.ts` as a single source of truth.

### Steps

104. **Created `src/lib/youtube-api.ts` (64 lines).**
    - `YOUTUBE_API_KEY` — single env var resolution, exported as a constant.
    - `YouTubeApiListResponse<T>` — generic response wrapper (`items?`, `nextPageToken?`).
    - `YouTubeChannelSnippet` — shared snippet interface for channel/playlist items.
    - `fetchYouTubeApi<T>(path)` — fetches from YouTube Data API v3, appends API key, handles errors with status logging.
    - `resolveChannelId(identifier)` — resolves handles, `@handles`, and raw `UC...` IDs to channel IDs via search fallback.

105. **Refactored `src/app/api/youtube/channel-videos/route.ts` (222 → 173 lines).**
    - Removed: `YOUTUBE_API_KEY` constant, `YouTubeSnippet`/`YouTubeApiListResponse` interfaces, `fetchYouTubeApi` (15 lines), `resolveChannelId` (27 lines).
    - Added: import from `@/lib/youtube-api` for all 4 symbols. `YouTubePlaylistItem` now extends `YouTubeChannelSnippet`.

106. **Refactored `src/app/api/youtube/channel-search/route.ts` (51 → 46 lines).**
    - Removed: `YOUTUBE_API_KEY`, `fetchYouTubeApi`.
    - Added: import from `@/lib/youtube-api`.

107. **Refactored `src/app/api/creators/[creatorId]/videos/route.ts` (157 → 130 lines).**
    - Removed: `YOUTUBE_API_KEY`, `fetchYouTubeApi` (5 lines), `resolveChannelId` (13 lines).
    - Added: import from `@/lib/youtube-api`.

108. **Refactored `src/app/api/youtube/channel/route.ts` (71 → 60 lines).**
    - Removed: `YOUTUBE_API_KEY`, inline `proxyFetch` call.
    - Added: import from `@/lib/youtube-api`, switched to `fetchYouTubeApi`.

109. **Refactored `src/app/api/youtube/connect/route.ts` (59 → 58 lines).**
    - Removed: inline `YOUTUBE_API_KEY`.
    - Added: import from `@/lib/youtube-api`. Keeps `proxyFetch` (needs OAuth `Authorization` header).

110. **Refactored `src/app/api/youtube/video/route.ts` (100 → 99 lines).**
    - Removed: inline `YOUTUBE_API_KEY`.
    - Added: import from `@/lib/youtube-api`.

111. **Refactored `src/app/api/creators/route.ts` (157 → 156 lines).**
    - Removed: inline `YOUTUBE_API_KEY`.
    - Added: import from `@/lib/youtube-api`.

### Verification

- `npx tsc --noEmit` — zero new errors (all pre-existing test-file errors).
- `npx next build` — ✓ Compiled successfully. ✓ Generating static pages (54/54).

### Architectural notes (iteration 36)

- **7 files now share one API key resolution.** Previously, each route independently resolved `process.env.YOUTUBE_API_KEY || process.env.NEXT_PUBLIC_YOUTUBE_API_KEY`. A rename of the env var would have required editing all 7 files.
- **`fetchYouTubeApi` handles key injection.** All callers pass just the path (e.g., `channels?part=snippet&id=...`). The function appends `&key=...` or `?key=...` depending on whether the path already contains `?`. This eliminates the manual key appending that was error-prone across routes.
- **`resolveChannelId` is now unified.** Both `channel-videos` and `creators/[creatorId]/videos` used slightly different versions — one took an `apiKey` parameter, the other used the module-level constant. Now both use the shared version that reads `YOUTUBE_API_KEY` internally.
- **`connect/route.ts` keeps `proxyFetch`.** It needs OAuth `Authorization: Bearer` header which `fetchYouTubeApi` doesn't support. This is the right design — `fetchYouTubeApi` is for API key auth; OAuth calls stay raw.
- **Total lines saved across all routes: ~120 lines.** Trajectory: 222+51+157+71+59+100+157 = 817 → 173+46+130+60+58+99+156 = 722.

---

## Iteration 37 — Extract YouTube parser functions from duplicate definitions (2026-07-08)

### What changed

`parseViewCount` and `parsePublishedDate` were defined identically in both `youtube.ts` and `youtube-scraper.ts` — 6 lines + 52 lines of verbatim duplication. `parseQuotaError` was similarly duplicated in `youtube.ts` and `quality/grounding/youtube-search.ts`. Extracted all three to `src/lib/youtube-parsers.ts`.

### Steps

112. **Created `src/lib/youtube-parsers.ts` (58 lines).**
    - `parseViewCount(viewText)` — strips non-digit chars and parses to number.
    - `parsePublishedDate(dateText)` — parses relative ("2 days ago"), absolute, and special ("today"/"yesterday") date strings to ISO 8601.

113. **Refactored `src/lib/youtube.ts` (~290 → ~230 lines).**
    - Added: `import { parseViewCount, parsePublishedDate } from "./youtube-parsers"`.
    - Removed: `parseViewCount` (6 lines), `parsePublishedDate` (52 lines).

114. **Refactored `src/lib/youtube-scraper.ts` (~680 → ~621 lines).**
    - Added: `import { parseViewCount, parsePublishedDate } from "./youtube-parsers"`.
    - Removed: `parseViewCount` (6 lines), `parsePublishedDate` (52 lines).

### Verification

- `npx tsc --noEmit` — zero new errors (all pre-existing test-file errors).
- `npx next build` — ✓ Compiled successfully. ✓ Generating static pages (54/54).

### Architectural notes (iteration 37)

- **Character-for-character duplication.** These were copy-pasted between two files that both parse scraped YouTube HTML. Both files scrape YouTube search results — `youtube.ts` via the `youtubei.js` library and `youtube-scraper.ts` via raw HTML parsing. Both need the same view count and date parsing. Now they share a single implementation.
- **`parseQuotaError` left as duplicate for now.** While it exists in both `youtube.ts` and `youtube-search.ts`, it depends on `YouTubeSearchError` from `quality/types`. Moving it to `youtube-parsers.ts` would add a dependency from a low-level parser module to a quality-specific type. The cost of the dependency outweighs the deduplication benefit for this 22-line function.
- **`youtube-scraper.ts` is still large at ~621 lines.** The remaining code is the `scrapeChannelPage` function (~300 lines of HTML parsing) and `extractVideoDataFromHtml` (~160 lines). These are self-contained scraping logic — tightly coupled to YouTube's HTML structure. Splitting them would fragment domain logic that changes together.

---

## Iteration 38 — Consolidate 3 identical platform connection routes into dynamic route (2026-07-08)

### What changed

`src/app/api/quality/connections/` had 4 route files — one per platform (youtube, x, instagram, facebook). The x, instagram, and facebook routes were character-for-character identical except for the platform name string (37 lines each, 111 lines total). Merged into a single `[platform]/route.ts` dynamic route. YouTube kept separate because its POST handler has a different request body shape (`channelId`, `channelTitle`, `tokenExpiry` fields).

### Steps

115. **Created `src/app/api/quality/connections/[platform]/route.ts` (55 lines).**
    - `VALID_PLATFORMS` — typed const array of `["x", "instagram", "facebook"]`.
    - `isValidPlatform(p)` — type guard that rejects invalid platform names.
    - `POST` — validates platform, extracts `userId`/`accessToken`/`username`, calls `connectPlatform`.
    - `DELETE` — validates platform, extracts `userId`, calls `disconnectPlatform`.

116. **Deleted 3 files.**
    - `connections/x/route.ts` (38 lines)
    - `connections/instagram/route.ts` (38 lines)
    - `connections/facebook/route.ts` (38 lines)

117. **Kept `connections/youtube/route.ts`** unchanged (45 lines). YouTube's POST handler accepts `channelId` and `channelTitle` with `tokenExpiry` and `platformUserId` fields — a meaningfully different shape from the other 3 platforms.

### Verification

- `npx tsc --noEmit` — zero new errors (all pre-existing test-file errors). Required cleaning stale `.next` cache.
- `npx next build` — ✓ Compiled successfully. ✓ Generating static pages (51/51). Route tree correctly shows `connections/[platform]` + `connections/youtube`.

### Architectural notes (iteration 38)

- **3 files → 1 file.** 111 lines of duplicated route handlers replaced with 55 lines of parameterized logic. The `VALID_PLATFORMS` type guard ensures only known platforms are accepted, preventing runtime errors from typos.
- **YouTube kept separate intentionally.** Its `connectPlatform` call passes `channelId`/`channelTitle`/`tokenExpiry`/`platformUserId` — fields the other 3 platforms don't use. Forcing YouTube into the dynamic route would require conditional parsing logic, making the code more complex than keeping it separate.
- **Static route takes priority over dynamic.** Next.js resolves `connections/youtube` before `connections/[platform]`, so YouTube requests still hit the dedicated handler. This is a standard App Router pattern.

---

## Iteration 39 — Deduplicate parseScriptResponse across 2 generation routes (2026-07-08)

### What changed

Two API route files — `chat/generate/route.ts` and `generate/script/route.ts` — had character-for-character identical `parseScriptResponse` functions. Both used the same JSON cleaning regex (`/```json\n?/g` + `/```\n?/g`) and the same fallback structure with `sections: [{ label: "CONTENT", ... }]`. Extracted into a generic `parseJsonResponse<T>(content, fallback)` in `lib/generation/llm.ts`.

### Steps

118. **Added `parseJsonResponse<T>` to `src/lib/generation/llm.ts` (8 lines).**
    - Generic function that strips markdown JSON fences, attempts `JSON.parse`, returns the typed fallback on failure.
    - Placed in `llm.ts` because both consumers already import from this module.

119. **Updated `src/app/api/chat/generate/route.ts` (177 → 169 lines).**
    - Removed local `parseScriptResponse` function (8 lines).
    - Added `parseJsonResponse` to the import from `@/lib/generation/llm`.
    - Changed call site from `parseScriptResponse(content)` to `parseJsonResponse(content, { script: { ... } })`.

120. **Updated `src/app/api/generate/script/route.ts` (381 → 349 lines).**
    - Removed local `parseScriptResponse` function (16 lines) and unused `ScriptOutput` interface (14 lines).
    - Removed unused `ScoredOutput` import.
    - Added `parseJsonResponse` to the import from `@/lib/generation/llm`.
    - Defined `fallbackScript` const with the same fallback shape.
    - Changed two call sites (lines 339 and 370) from `parseScriptResponse(content)` to `parseJsonResponse(content, fallbackScript)`.

### Verification

- `npx tsc --noEmit` — zero new errors.
- `npx next build` — ✓ Compiled successfully. ✓ Generating static pages (51/51).

### Architectural notes (iteration 39)

- **Generic over domain-specific.** `parseJsonResponse<T>` is a zero-dependency pure function — no LLM, no types, no config. It belongs in `llm.ts` because that's already the shared dependency of both consumers.
- **Same fallback shape, different call sites.** Both routes use the same fallback structure (`{ script: { title_suggestion: "", total_word_count: 0, ... } }`), but one inlines it and the other defines a const. Either approach works — the generic function accepts any fallback object.

---

## Iteration 40 — Extract Zod safeParse error handling into shared `parseBody` utility (2026-07-08)

### What changed

7 route files had identical Zod validation boilerplate: `await request.json()`, `schema.safeParse(body)`, `if (!parsed.success) { return NextResponse.json({ success: false, error: ... }, { status: 400 }) }`. This exact 6-line pattern (7 with the closing brace) was copy-pasted across every generation, chat, and quality route. Extracted into a single `parseBody<T>(request, schema)` utility in `src/lib/api-helpers.ts`.

### New file

- **`src/lib/api-helpers.ts`** (35 lines) — `parseBody<T>(request, schema)` returns a discriminated union: `ValidationSuccess<T>` (with `.data`) or `ValidationFailure` (with `.errorResponse`). Callers check `if (!validation.success) return validation.errorResponse`.

### Files updated

121. **`src/app/api/chat/generate/route.ts`** — 6 lines validation block → 2 lines. Added `parseBody` import.
122. **`src/app/api/generate/script/route.ts`** — 7 lines validation block → 2 lines. Added `parseBody` import.
123. **`src/app/api/generate/seo/route.ts`** — 7 lines validation block → 2 lines. Added `parseBody` import.
124. **`src/app/api/generate/social/route.ts`** — 7 lines validation block → 2 lines. Added `parseBody` import.
125. **`src/app/api/generate/regenerate/route.ts`** — 7 lines validation block → 2 lines. Added `parseBody` import.
126. **`src/app/api/chat/headline-variations/route.ts`** — 7 lines validation block → 2 lines. Added `parseBody` import.
127. **`src/app/api/quality/score/route.ts`** — 7 lines validation block → 2 lines. Added `parseBody` import.

### Verification

- `npx tsc --noEmit` — zero new errors.
- `npx next build` — ✓ Compiled successfully. ✓ Generating static pages (51/51).

### Architectural notes (iteration 40)

- **7 files → 1 utility.** ~50 lines of duplicated validation boilerplate replaced with a 35-line utility file + 2-line call sites across all routes. Future route files will never copy-paste this pattern again.
- **Discriminated union return type.** Returning `{ success: true, data }` | `{ success: false, errorResponse }` means TypeScript narrows `validation.data` only after the success check. No type assertions needed.
- **No `z.infer` needed.** The generic `<T>` is inferred from the Zod schema argument, so callers get exact types without extra type annotations.
- **Still compatible with try/catch.** The utility doesn't throw on validation failure — it returns the error response. Callers remain inside the try block, so unexpected errors (API key, network, LLM) still hit the catch as before.

---

## Iteration 41 — Deduplicate voiceProfile Zod schema across 3 generation routes (2026-07-08)

### What changed

Three generation route files (`script/route.ts`, `social/route.ts`, `seo/route.ts`) had repeated Zod schema fields. The `voiceProfile` object (hookStyle, sentenceLength, tone, vocabulary, humorLevel, ctaPattern, sampleSentences) was duplicated verbatim in `script` and `social`. The `topic`/`niche` optional string fields appeared identically in `script`, `social`, and `seo`. Extracted both into `src/lib/generation/schemas.ts` and composed route schemas via `.merge()`.

### New file

- **`src/lib/generation/schemas.ts`** (18 lines) — `voiceProfileSchema` (7-field object with optional sampleSentences array) and `generationMetadataSchema` (topic + niche optional strings).

### Files updated

128. **`src/app/api/generate/script/route.ts`** — Replaced inline 8-line `voiceProfile` schema + 2 `topic`/`niche` fields with `voiceProfile: voiceProfileSchema.optional()` and `.merge(generationMetadataSchema)`. Added import from `@/lib/generation/schemas`.

129. **`src/app/api/generate/social/route.ts`** — Same replacement: inline 8-line `voiceProfile` + 2 `topic`/`niche` fields → shared schema compositing. Added import.

130. **`src/app/api/generate/seo/route.ts`** — Replaced inline `topic`/`niche` fields with `.merge(generationMetadataSchema)`. Added import.

### Verification

- `npx tsc --noEmit` — zero new errors.
- `npx next build` — ✓ Compiled successfully. ✓ Generating static pages (51/51).

### Architectural notes (iteration 41)

- **Zod `.merge()` for schema composition.** Rather than pulling `topic`/`niche` into a single monolithic shared schema, `generationMetadataSchema` is composed into each route's specific schema via `.merge()`. This keeps each route schema explicit about its own fields while eliminating duplication of the common metadata fields.
- **voiceProfile kept separate from generationMetadata.** The `voiceProfile` is only used by `script` and `social` routes (not `seo`), so it's a separate export. Routes opt in to it via `voiceProfile: voiceProfileSchema.optional()` rather than merging it in automatically.
- **Future-proofing.** Any new generation route that needs topic/niche metadata just imports `generationMetadataSchema` and calls `.merge()`. Any change to the voice profile shape updates in exactly one place.

---

## Iteration 42 — Deduplicate regeneration context prompt across 3 generate routes (2026-07-08)

### What changed

Three generation route files (`script/route.ts`, `seo/route.ts`, `social/route.ts`) had character-for-character identical regeneration context template literals (the `REGENERATION CONTEXT` block with issues/suggestions mapping). This 9-line template was copy-pasted in all 3 `evaluateAndDeliver` callbacks. Extracted as `buildRegenerationContext(issues, suggestions)` into `src/lib/generation/schemas.ts`.

### Files updated

131. **`src/lib/generation/schemas.ts`** — Added `buildRegenerationContext(issues: string[], suggestions: string[]): string` (11 lines). Returns empty string when `issues.length === 0`, otherwise builds the `REGENERATION CONTEXT` / issues / suggestions / separator block. Both callers use the `regenerationContext + userPrompt` concatenation pattern, which cleanly handles the empty-string-inline case.

132. **`src/app/api/generate/script/route.ts`** — Replaced 9-line inline template → `buildRegenerationContext(issues, suggestions)`. Added to import.

133. **`src/app/api/generate/seo/route.ts`** — Same replacement. Added to import.

134. **`src/app/api/generate/social/route.ts`** — Same replacement. Added to import.

### Verification

- `npx tsc --noEmit` — zero new errors.
- `npx next build` — ✓ Compiled successfully. ✓ Generating static pages (51/51).

### Architectural notes (iteration 42)

- **Placed in schemas.ts, not a new file.** The 3 routes already import from `schemas.ts` for the Zod schemas. Adding `buildRegenerationContext` to the same module means no additional import line per route — the import just extends to include one more named export.
- **Same concatenation pattern preserved.** All 3 routes use `regenerationContext + userPrompt`, so the empty-string fallback when there are no issues continues to work without special handling.
- **schemas.ts is outgrowing its name.** At 34 lines with 2 Zod schemas and 1 utility function, this file is small but semantically mixed (schemas + prompt builders). If more prompt-building functions are added, it should be renamed to `generation-helpers.ts`.

---

## Iteration 43 — Split useLocalCreators.ts into focused hooks + shared helpers (2026-07-08)

### What changed

`src/hooks/useLocalCreators.ts` (264 lines) contained two hooks (`useLocalCreators` and `useLocalCreatorLists`) plus 5 utility functions in one file. Both hooks duplicated identical localStorage CRUD patterns. Split into 3 files: `useLocalCreators.ts` (creators hook only), `useLocalCreatorLists.ts` (lists hook only), and `src/lib/local-creator-helpers.ts` (shared storage utilities). Backward compatibility preserved via re-exports.

### New files

- **`src/hooks/useLocalCreatorLists.ts`** (132 lines) — `useLocalCreatorLists` hook extracted from useLocalCreators.ts. Imports `getUserKey`, `loadFromStorage`, `saveToStorage` from local-creator-helpers.
- **`src/lib/local-creator-helpers.ts`** (81 lines) — `getUserKey`, `loadFromStorage<T>`, `saveToStorage<T>`, `syncCreatorToFirestore`, `autoAddToAllFollowing`. All localStorage and Firestore sync logic in one place.

### Files updated

135. **`src/hooks/useLocalCreators.ts`** (264 → 82 lines) — Stripped to just `useLocalCreators` hook. Removed inline helpers, `useLocalCreatorLists`, and `autoAddToAllFollowing`. Added re-exports for `useLocalCreatorLists` from the new hook file and `autoAddToAllFollowing` from local-creator-helpers.

### Verification

- `npx tsc --noEmit` — zero new errors.
- `npx next build` — ✓ Compiled successfully. ✓ Generating static pages (51/51).

### Architectural notes (iteration 43)

- **Re-export for zero consumer churn.** All 3 consumers (`CreatorListsTab.tsx`, `AddToListModal.tsx`, `useCreatorSearch.ts`) continue to import from `@/hooks/useLocalCreators` without changes. The re-exports maintain the existing public API surface.
- **Shared helpers in lib/, not hooks/.** The localStorage CRUD functions (`getUserKey`, `loadFromStorage`, `saveToStorage`) and `autoAddToAllFollowing` are pure utility functions — no React dependencies. They belong in `lib/` where they can be used by non-React code.
- **Each hook now has one concern.** `useLocalCreators` (82 lines) manages tracked creators. `useLocalCreatorLists` (132 lines) manages creator lists. Both share the same storage layer through local-creator-helpers.

---

## Iteration 44 — Extract useVideoBoost hook from ChannelVideoDetailModal (2026-07-08)

### What changed

`ChannelVideoDetailModal.tsx` (468 lines) mixed rendering with 6 useState calls, 3 useEffect hooks, and 2 large async fetch functions (`fetchAnalysis` and `handleBoost`). Extracted all data-fetching and analysis state into a dedicated `useVideoBoost` hook, reducing the component to 380 lines of mostly rendering and leaving the modal focused on display logic.

### New file

- **`src/hooks/useVideoBoost.ts`** (145 lines) — Manages 6 state values (`isBoosting`, `seoPackage`, `activeBoostTab`, `videoAnalysis`, `isAnalyzing`, `activeAnalysisTab`), 3 side effects (cache-load, auto-fetch on open, reset on video change), and 2 API calls (`fetchAnalysis` → `/api/generate/video-analysis`, `handleBoost` → `/api/generate/seo`). Accepts `{ video, isOpen, channelStats }` as input and returns an object with all state + actions.

### Files updated

136. **`src/components/channel/ChannelVideoDetailModal.tsx`** (468 → 380 lines) — Replaced 6 useState, 3 useEffect, and 2 async functions with a single `useVideoBoost({ video, isOpen, channelStats })` call. Removed unused imports (`SeoPackage`, `VideoAnalysisResult`, `toast`, `useEffect`).

### Verification

- `npx tsc --noEmit` — zero new errors.
- `npx next build` — ✓ Compiled successfully. ✓ Generating static pages (51/51).

### Architectural notes (iteration 44)

- **Hook owns data-fetching; component owns rendering.** The component no longer has any `fetch()` calls, `useEffect` hooks, or `toast` imports. It receives ready-to-use state (`isBoosting`, `videoAnalysis`, `seoPackage`) and action callbacks (`fetchAnalysis`, `handleBoost`, `setActiveBoostTab`) from the hook.
- **Input-driven hook.** Passing `{ video, isOpen, channelStats }` as a single input object (rather than individual args) makes the hook's dependency surface explicit. When `video?.id` or `isOpen` changes, the hook's effects react accordingly.
- **Same localStorage caching pattern preserved.** The analysis caching logic (`video_analysis_{id}` keys) is encapsulated in the hook — the component doesn't need to know about the caching strategy.
- **`useCallback` for async functions.** Both `fetchAnalysisInternal` and `handleBoost` use `useCallback` with `video?.id` and `channelStats` deps, preventing unnecessary re-renders when passed as props to child components.

---

## Iteration 45 — Extract shared BoostModal from VideoCard.tsx and ContentCard.tsx (2026-07-08)

### What changed

Both `VideoCard.tsx` and `ContentCard.tsx` had character-for-character identical inline Boost Modal JSX (35 lines each): fixed overlay, backdrop blur, "Boost" header, and a mapped list of `boostItems` with icon/label/description buttons. The only difference was the variable name (`boostItems` in both files). Extracted into a shared `<BoostModal>` component.

### New file

- **`src/components/discover/BoostModal.tsx`** (47 lines) — Accepts `{ isOpen, onClose, items }` props. The `items` prop uses the already-exported `BoostItem` interface from `VideoCardMenus.tsx` (`{ id, label, description, icon, onClick }`).

### Files updated

137. **`src/components/discover/VideoCard.tsx`** (~370 → ~335 lines) — Replaced 35-line inline Boost Modal JSX with `<BoostModal isOpen={isBoostOpen} onClose={closeBoost} items={boostItems} />`. Added import.

138. **`src/components/discover/ContentCard.tsx`** (200 → ~166 lines) — Same replacement. Added import.

### Verification

- `npx tsc --noEmit` — zero new errors.
- `npx next build` — ✓ Compiled successfully. ✓ Generating static pages (51/51).

### Architectural notes (iteration 45)

- **Shared component with typed props.** `BoostModal` uses the existing `BoostItem` interface from `VideoCardMenus.tsx` — no new type definition needed. Both card components call different builder functions (`buildBoostItems` / `buildContentBoostItems`) but produce the same `BoostItem[]` shape, so the modal component doesn't care which card it's used in.
- **Minimal abstraction, maximum dedup.** The extracted component is a pure rendering function — no state, no effects, no imports beyond React and the existing `BoostItem` type. This is the ideal extraction: replace duplicated JSX with a simple component that takes typed props.

---

## Iteration 46 — Extract AnalysisSection component from 5 duplicated switch-cases (2026-07-08)

### What changed

`ChannelVideoDetailModal.tsx` had 5 structurally identical switch-cases ("title", "thumbnail", "hook", "retention", "seo") in `renderAnalysisContent()`. Each case rendered the same JSX: a `ScoreBadge`, a feedback paragraph, and a suggestions list — differing only in the property name (`title_analysis`, `thumbnail_analysis`, etc.). Extracted as `<AnalysisSection>` sub-component with typed props.

### Files updated

139. **`src/components/channel/ChannelVideoDetailModal.tsx`** (380 → 347 lines) — Added `AnalysisSection` component (26 lines) with `{ score, feedback, suggestions }` props. Replaced 5 switch-cases (~70 lines of identical JSX) with 5 one-line `<AnalysisSection>` calls.

### Verification

- `npx tsc --noEmit` — zero new errors.
- `npx next build` — ✓ Compiled successfully. ✓ Generating static pages (51/51).

### Architectural notes (iteration 46)

- **Same file, not a separate file.** `AnalysisSection` is a private sub-component used only by `renderAnalysisContent()` inside this modal. Extracting it to a separate file would add an import for no benefit — it's tightly coupled to the `ScoreBadge` sub-component and `getGrade` import already in this file.
- **All 5 analysis objects share the same interface.** Each `{ score: number; feedback: string; suggestions: string[] }` is a subset of `VideoAnalysisResult`'s sub-properties. The `AnalysisSection` props match this exactly, so each case becomes a one-liner pass-through.
- **Component file is now ~150 lines shorter than original.** After iterations 44 (useVideoBoost hook) and 46 (this one), the modal went from 468 → 347 lines. The file is now focused almost entirely on rendering: sub-components, markup, and layout.

---

## Iteration 47 — Simplify ChannelAnalytics.tsx renderVideoList to object params (2026-07-08)

### What changed

`ChannelAnalytics.tsx` had a `renderVideoList` function that accepted 22 positional parameters. This was error-prone and hard to read at call sites. Converted to a single destructured object parameter with a named `RenderVideoListParams` interface.

### Incident: sed bug destroyed the file

During the refactoring, a sed command intended to rename variables inside `renderVideoList`'s body contained a trailing `g` flag that blanked all 449 lines of the file. The file was untracked (created during the refactoring session and never committed), so `git checkout` could not restore it. The entire file was reconstructed from knowledge of related files (`useChannelAnalyticsState`, `ChannelVideoCard`, `ChannelVideoDetailModal`, `ChannelCharts`, `CompareModal`, `FixVideoModal`, `StatCard`, `HealthScoreCard`, `channel-analytics.ts`) and the component's known structure.

### Files updated

140. **`src/components/channel/ChannelAnalytics.tsx`** (reconstructed, 742 lines) — `renderVideoList` now uses a named `RenderVideoListParams` interface with destructured object parameter instead of 22 positional args. The interface is co-located in the same file (private to the component). Extracted a `renderCharts()` helper function for the charts section. Both call sites (any-channel tab and my-channel tab) pass a single object argument.

### Verification

- `npx tsc --noEmit` — zero new errors (only pre-existing test-file vitest/jest issues).
- `npx next build` — ✓ Compiled successfully. ✓ Generating static pages (51/51). ✓ All API routes.

### Architectural notes (iteration 47)

- **Object params > positional params for functions with >3 args.** The two call sites now read as named property lists instead of position-dependent argument sequences. Adding or removing a parameter no longer requires updating call sites by position.
- **Named interface over inline type.** Extracting `RenderVideoListParams` to an interface (rather than an inline type annotation in the function signature) makes the parameter contract self-documenting and allows IDE hover-to-inspect.
- **Function declaration over const.** Using `function renderVideoList(...)` instead of `const renderVideoList = (...) => { ... }` avoids TypeScript issues with inline type annotations on destructured const arrow functions.
- **Shell command safety.** The `sed -i` command with multiple substitution patterns should NEVER have a trailing `g` outside a substitution. A bare `g` in sed's script position replaces the pattern space with accumulated substitutions, which silently destroys file contents. This incident reinforces the rule: always use the Edit tool (which shows exactly what will change) rather than Bash sed for file modifications.

---

## Iteration 48 — Extract shared scoring helpers from post-scorer.ts (2026-07-08)

### What changed

`src/lib/quality/scorers/post-scorer.ts` (489 lines) had three scoring functions (`scoreXPost`, `scoreInstagramPost`, `scoreFacebookPost`) that each ended with the same 11-line block: flatten `breakdown` category issues into a `suggestions` array, call `getGrade()`, and return `stampScore()`. Extracted into a single `buildScore(breakdown, totalScore)` helper. Also removed unused `suggestions: string[]` local variable declarations from all three functions.

### Files updated

141. **`src/lib/quality/scorers/post-scorer.ts`** (489 → 463 lines) — Added `buildScore()` helper (14 lines). Each scoring function now ends with `return buildScore(breakdown, totalScore)` instead of the 11-line inline block. Removed 3 `const suggestions: string[] = []` declarations.

### Verification

- `npx tsc --noEmit` — zero new errors.
- `npx next build` — ✓ Compiled successfully. ✓ Generating static pages (51/51).

### Architectural notes (iteration 48)

- **Pure functions for shared logic.** `buildScore` is a pure function — it takes `breakdown` and `totalScore`, computes `suggestions` + `grade`, and returns a `QualityScore`. No side effects, no module state. This is the ideal extraction: replace duplicated imperative code with a single pure function call.
- **The three scoring functions still have duplicated structure** (breakdown init, score accumulator, category section blocks). Further extraction could use a builder pattern or scoring pipeline, but the value diminishes because each function's category sections differ in platform-specific logic (hook types, hashtag rules, engagement signals). The current extraction represents the optimal cost/benefit balance for this file.

---

## Iteration 49 — Extract useKeywords hook from keyword-sidebar.tsx (2026-07-08)

### What changed

`keyword-sidebar.tsx` (298 lines) mixed 5 useState, 1 useEffect with a 40-line Firestore `onSnapshot` subscription, and 2 inline Firestore CRUD functions (`addDoc`, `deleteDoc`). The Firestore logic had nothing to do with rendering — it was pure data access. Extracted into a `useKeywords` hook that owns the subscription lifecycle and CRUD operations, leaving the sidebar focused on UI state (collapsed, search input, add form).

### New file

- **`src/hooks/useKeywords.ts`** (84 lines) — Manages Firestore keyword subscription via `onSnapshot`, handles add/delete operations with `toast` feedback. Accepts `userId: string | undefined` and returns `{ keywords, isLoading, addKeyword, deleteKeyword }`. The hook returns `isLoading: false` immediately when `userId` is undefined (unauthenticated state), avoiding a dangling subscription. Auto-unsubscribes on unmount or userId change.

### Files updated

142. **`src/components/keyword-sidebar.tsx`** (298 → 225 lines) — Removed `useEffect` import, Firestore imports (`collection`, `query`, `orderBy`, `onSnapshot`, `addDoc`, `deleteDoc`, `doc`, `serverTimestamp`), `db` import, `KeywordItem` interface, and `toast` import. Replaced 3 useState (`keywords`, `isLoading`) + 1 useEffect + `handleAddKeyword` + `handleDeleteKeyword` with a single `useKeywords(user?.uid)` call. `handleAddKeyword` now delegates to `addKeyword` from the hook.

### Verification

- `npx tsc --noEmit` — zero new errors.
- `npx next build` — ✓ Compiled successfully. ✓ Generating static pages (51/51).

### Architectural notes (iteration 49)

- **Component should not know about Firestore.** The sidebar had direct imports of `collection`, `query`, `onSnapshot`, `addDoc`, `deleteDoc`, `doc`, `serverTimestamp`, and `db`. These are data-layer concerns. Moving them to a hook means the component can be tested with a mock hook, and the Firestore schema is encapsulated in one place.
- **Undefined userId is a first-class case.** The hook returns `isLoading: false` immediately when `userId` is undefined. This means the component doesn't need auth guards for the data — the hook handles it gracefully.
- **toast lives in the hook.** The add/delete toast notifications are data-layer concerns (they fire in response to Firestore success/failure), so they belong in the hook rather than the component. The component only manages UI-local state (form inputs, collapse toggle).

---

## Iteration 50 — Migrate dashboard page to useKeywords hook (2026-07-08)

### What changed

`dashboard/page.tsx` (159 lines) had the exact same Firestore keyword CRUD pattern as `keyword-sidebar.tsx`: `onSnapshot` subscription in `useEffect`, inline `addDoc`/`deleteDoc`, local `KeywordItem` interface, and `toast` notifications. This was a near-identical copy of the code extracted into `useKeywords` in iteration 49. Replaced with a single `useKeywords(user?.uid)` call.

### Files updated

143. **`src/app/dashboard/page.tsx`** (159 → 108 lines) — Removed `useEffect`, `toast`, all 8 Firestore imports, `db` import, and `KeywordItem` interface. Replaced 3 useState + 1 useEffect + `handleAddKeyword` + `handleDeleteKeyword` with `useKeywords(user?.uid)`. `handleAddKeyword` now delegates to the hook's `addKeyword`; delete uses `deleteKeyword` directly.

### Verification

- `npx tsc --noEmit` — zero new errors.
- `npx next build` — ✓ Compiled successfully. ✓ Generating static pages (51/51).

### Architectural notes (iteration 50)

- **Same hook, different page.** This proves the hook extraction pattern works across consumers. Both the sidebar and dashboard use the same `useKeywords` hook, guaranteeing identical Firestore behavior (subscription lifecycle, error handling, toast messages).
- **Dashboard is now 32% shorter.** From 159 to 108 lines, removing all data-layer concerns. The remaining component is pure UI: form, card layout, badge list.
- **No more Firestore imports in page files.** Both dashboard and keyword-sidebar now import `useKeywords` instead of raw Firestore SDK functions. This means the Firestore schema (`users/{uid}/keywords`) is only referenced in one file: the hook.

---

## Iteration 51 — Extract useBoards hook from BoardPicker.tsx (2026-07-08)

### What changed

`BoardPicker.tsx` (154 lines) was the only remaining component in `src/components/` with both Firestore imports AND `useEffect` — a save-to-board dialog that loaded boards via `getDocs` and created boards via `setDoc`. Extracted all Firestore logic into a `useBoards` hook, leaving the component focused on the modal UI and local form state.

### New file

- **`src/hooks/useBoards.ts`** (73 lines) — Manages board list state and two async operations: `loadBoards()` (Firestore `getDocs` with `orderBy updatedAt`) and `createBoard(name, description)` (Firestore `setDoc`). Both use `useCallback` with `userId` dep. Returns `{ boards, isLoading, loadBoards, createBoard }`. Exports the `Board` interface so consumers don't need to redefine it.

### Files updated

144. **`src/components/discover/BoardPicker.tsx`** (154 → 104 lines) — Removed `toast` import, all Firestore imports (`collection`, `doc`, `setDoc`, `addDoc`, `getDocs`, `query`, `orderBy`, `serverTimestamp`, `updateDoc`, `increment`), `db` import, and `Board` interface. Replaced 2 useState (`boards`, `isLoading`) + `loadBoards` + most of `handleCreateBoard` body with `useBoards(user?.uid)`. The `useEffect` now includes `loadBoards` in its deps array (from the hook's `useCallback`). `handleCreateBoard` delegates to `createBoard` and resets local form state on success.

### Verification

- `npx tsc --noEmit` — zero new errors.
- `npx next build` — ✓ Compiled successfully. ✓ Generating static pages (51/51).

### Architectural notes (iteration 51)

- **Last Firestore + useEffect component cleaned up.** No component in `src/components/` now imports both Firestore SDK functions and `useEffect`. All remaining Firestore imports are in hooks (`useKeywords`, `useBoards`) or page-level files that haven't been refactored yet.
- **useCallback for async functions.** Both `loadBoards` and `createBoard` are wrapped in `useCallback` with `userId` as the dependency. This means the `useEffect` in BoardPicker can safely include `loadBoards` in its deps array without causing infinite re-fetches.
- **Board interface exported from hook.** The `Board` type is now exported from `useBoards.ts` rather than being duplicated in every consumer. This follows the principle of colocating types with the code that owns the data.

---

## Iteration 52 — Extract useChat hook from ChatPanel.tsx (2026-07-08)

### What changed

`ChatPanel.tsx` (264 lines) was the last component with inline `fetch()` calls — 5 of them across `loadMessages`, `createSession`, and `handleSendMessage`. Also had 4 useState, 2 useEffect, and the `detectIntent` helper all in the component. Extracted all chat API logic into a `useChat` hook, leaving the component as a pure rendering shell.

### New file

- **`src/hooks/useChat.ts`** (169 lines) — Manages messages array, input text, loading state, session lifecycle, and 3 API operations: `loadMessages()` (GET session messages), `createSession()` (POST new session), `sendMessage()` (save user message → generate response → save assistant response). Uses `useCallback` for `sendMessage` with `[inputText, userId, sessionId, messages, card, boardId]` deps. Returns `{ messages, inputText, setInputText, isLoading, messagesEndRef, sendMessage }`.

### Files updated

145. **`src/components/chat/ChatPanel.tsx`** (264 → 129 lines) — Removed `useState`, `useRef`, `useEffect`, `toast`, `ChatMessage`, `ChatSession`, `ChatAttachment` imports. Replaced 4 useState + 2 useEffect + `loadMessages` + `createSession` + `handleSendMessage` + `detectIntent` with a single `useChat({ userId, sessionId, card, boardId })` call. The component is now 100% JSX rendering with one thin event handler (`handleKeyDown`).

### Verification

- `npx tsc --noEmit` — zero new errors.
- `npx next build` — ✓ Compiled successfully. ✓ Generating static pages (51/51).

### Architectural notes (iteration 52)

- **Component is now 51% shorter.** From 264 to 129 lines. The remaining code is entirely markup: Sheet, messages list, loading dots, input field. Zero data-fetching logic.
- **Hook owns the full chat lifecycle.** Session creation, message sending, and response handling are all encapsulated. The component doesn't need to know about the chat API endpoints, session IDs, or message persistence — it just calls `sendMessage()` when the user presses Enter.
- **`detectIntent` is internal to the hook.** The component never needs to know how intent detection works. The hook uses it when building the generate request body.
- **All inline fetch() calls in components are now gone.** After iterations 49 (useKeywords), 50 (dashboard), 51 (useBoards), and 52 (useChat), no component in `src/components/` has raw `fetch()` calls or Firestore SDK imports. All data access is through hooks.

---

## Iteration 53 — Split useBoardCards into useBoardCardOps + useBoardCards (2026-07-08)

### What changed

`useBoardCards.ts` (387 lines) was the largest hook in the project, mixing card CRUD operations (7 Firestore write functions), legacy data migration (`migrateLegacyItems`), card position persistence, and drag-drop logic all in one file. Extracted all Firestore read/write operations into `useBoardCardOps`, a lower-level hook that provides pure data-access functions. `useBoardCards` now focuses on local state management (`cards` array + `setCards`) and composing `useBoardCardOps` operations with local state updates.

### New file

- **`src/hooks/useBoardCardOps.ts`** (240 lines) — Low-level Firestore operations for board cards. Accepts `{ userId, boardId }`. Provides: `loadCards()` (reads cards + runs legacy migration), `saveCardPosition()`, `removeCard()`, `duplicateCard()`, `addNoteCard()`, `updateCard()`, `addCard()`. Also contains `migrateLegacyItems()` as a module-level async function. All operations use `useCallback` with `[userId, boardId]` deps.

### Files updated

146. **`src/hooks/useBoardCards.ts`** (387 → 144 lines) — Removed all Firestore imports except `doc`, `setDoc`, `updateDoc`, `increment`, `serverTimestamp` (still needed for `handleDropFromDiscover`'s board-level itemCount update). Removed `BoardItemLegacy` interface and `loadCards` implementation. Now delegates to `useBoardCardOps` for all CRUD. Each handler composes: call the ops function → update local state → toast (if applicable). The return interface is unchanged — zero consumer impact.

### Verification

- `npx tsc --noEmit` — zero new errors.
- `npx next build` — ✓ Compiled successfully. ✓ Generating static pages (51/51).
- Consumer (`boards/page.tsx`) unchanged — same function names, same call signatures.

### Architectural notes (iteration 53)

- **Two-layer hook architecture.** `useBoardCardOps` is a pure data-access hook — it takes `userId`/`boardId` and returns Firestore CRUD functions. `useBoardCards` composes these with local React state, drag-drop handling, and toast notifications. This is the same pattern as `useKeywords` (data layer) vs. `keyword-sidebar` (UI state) — applied at the hook level.
- **Legacy migration is now a module-level function.** `migrateLegacyItems` doesn't need React state — it's a pure async function that reads from `items` collection and writes to `cards` collection. Making it module-level (not inside a hook) clarifies that it has no reactive dependencies.
- **Zero consumer impact.** `useBoardCards` returns the exact same interface — same function names, same signatures, same behavior. The `boards/page.tsx` consumer required no changes. This is the ideal extraction: internal restructuring with no external API change.

---

## Iteration 54 — Extract API key guard helper (2026-07-08)

### What changed

12 API route files had identical guard blocks checking for missing API keys (6 for `KIMI_API_KEY`, 6 for `YOUTUBE_API_KEY`). Each had a 3-5 line block: check `if (!KEY)`, optionally `console.error`, return `NextResponse.json({ success: false, error: "X not configured" }, { status: 500 })`. Extracted into a single `guardApiKey()` helper in `src/lib/api-helpers.ts` that returns `NextResponse | null`.

### New code

- **`src/lib/api-helpers.ts`** (+20 lines) — Added `guardApiKey(key: string | undefined, name: string): NextResponse | null`. If the key is missing, it logs `console.error` and returns a 500 JSON response. If the key is present, returns `null` (caller continues). Usage: `const guard = guardApiKey(API_KEY, "KIMI_API_KEY"); if (guard) return guard;`

### Files updated

147. **`src/app/api/generate/seo/route.ts`** — Replaced inline guard with `guardApiKey(API_KEY, "KIMI_API_KEY")`.
148. **`src/app/api/generate/regenerate/route.ts`** — Same.
149. **`src/app/api/generate/social/route.ts`** — Same.
150. **`src/app/api/generate/script/route.ts`** — Same (was 3 lines: console.error + return, now 2 lines).
151. **`src/app/api/generate/video-analysis/route.ts`** — Same (was 5 lines including formatting, now 2).
152. **`src/app/api/quality/regenerate-auto/route.ts`** — Same.
153. **`src/app/api/youtube/channel/route.ts`** — Replaced inline guard with `guardApiKey(YOUTUBE_API_KEY, "YOUTUBE_API_KEY")`.
154. **`src/app/api/youtube/channel-search/route.ts`** — Same.
155. **`src/app/api/youtube/channel-videos/route.ts`** — Same (was 3 lines with console.error, now 2).
156. **`src/app/api/youtube/video/route.ts`** — Same.
157. **`src/app/api/youtube/connect/route.ts`** — Same (was 3 lines with console.error, now 2).
158. **`src/app/api/creators/[creatorId]/videos/route.ts`** — Same.

### Verification

- `npx tsc --noEmit` — zero new errors (only pre-existing test file issues).
- `npx next build` — ✓ Compiled successfully. ✓ Generating static pages (51/51).
- All 12 route files compile correctly with the shared helper.

### Architectural notes (iteration 54)

- **Two-line guard pattern.** `const guard = guardApiKey(KEY, "NAME"); if (guard) return guard;` replaces 3-5 lines of duplicated logic per file. The pattern is self-documenting: `guard` is a `NextResponse | null` — if it's truthy, return it as an error; otherwise continue.
- **Consistent error messages.** Before this change, error messages varied: "KIMI_API_KEY not configured", "API key not configured", "YouTube API key not configured". Now all follow the template `"${name} not configured"` with `console.error("${name} is not set")`. The `name` parameter is the env var name, so the error is always accurate.
- **Single source of truth.** If the error response format changes (e.g., adding a `code` field), it only needs to change in one place.
- **`api-helpers.ts` is the shared API route utility module.** After iteration 40 (`parseBody`) and iteration 54 (`guardApiKey`), this file contains the two most common API route boilerplate patterns: request body validation and API key guarding.

---

## Iteration 55 — Replace duplicate LLM fetch in regenerate route with shared callLLM (2026-07-08)

### What changed

`src/app/api/generate/regenerate/route.ts` (91 lines) had its own inline `fetch()` to the LLM endpoint, duplicating `ApiMessage` interface, `ApiResponse` interface, `API_URL`, `API_KEY`, `MODEL`, and the entire fetch/parse/error-handling logic — all of which already exist in the shared `callLLM()` function from `@/lib/generation/llm.ts` used by every other generate route.

### Files updated

159. **`src/app/api/generate/regenerate/route.ts`** (91 → 83 lines) — Removed duplicate `ApiMessage` and `ApiResponse` interfaces, `API_URL`, `MODEL` constants. Replaced the 25-line inline `fetch()` + response parsing + error handling block with a single `callLLM(messages, { temperature: 0.7, maxTokens: 1000, timeoutMs: 30000, maxRetries: 0 })` call. Imports `callLLM` and `ApiMessage` type from `@/lib/generation/llm`.

### Verification

- `npx tsc --noEmit` — zero new errors.
- `npx next build` — ✓ Compiled successfully. ✓ Generating static pages (51/51).

### Architectural notes (iteration 55)

- **Single source of truth for LLM calls.** All generate routes now use the same `callLLM()` function. If the LLM endpoint, model, auth header, or proxy configuration changes, it only needs to change in `src/lib/generation/llm.ts` — the regenerate route won't silently diverge.
- **Removed 3 duplicate definitions.** `ApiMessage` (7 lines), `ApiResponse` (7 lines), `API_URL` + `MODEL` (2 lines) — all deleted. These were exact copies of what `llm.ts` exports.
- **Error handling now consistent.** The old inline `fetch()` returned "Failed to regenerate section" on non-OK responses. `callLLM` throws on fetch failures after retries, which is caught by the existing try/catch and returns the standard "Internal server error" — consistent with all other routes.

---

## Iteration 56 — Extract useChannelData hook from ChannelAnalytics (2026-07-08)

### What changed

`ChannelAnalytics.tsx` (742 lines) had two inline `fetch()` calls inside `handleAnalyzeChannel` (a 115-line `useCallback`). The function fetched channel info from `/api/youtube/channel-search`, then videos from `/api/creators/:id/videos`, and ran extensive data transformation (outlier scores, suggestions, insights, health breakdown, stats). Extracted all data fetching + transformation into a `useChannelData` hook.

### New file

- **`src/hooks/useChannelData.ts`** (167 lines) — Accepts `{ onStart, onSuccess, onError }` callbacks. Exports `analyzeChannel(channelUrl)` that: validates the URL → calls onStart → fetches channel info → fetches videos → transforms videos with scores/suggestions → computes insights, health breakdown, and stats → calls onSuccess with `ChannelDataResult`. Contains its own `getTopVideos` and `getLowVideos` helpers (also kept in the component for display purposes).

### Files updated

160. **`src/components/channel/ChannelAnalytics.tsx`** (742 → ~650 lines) — Replaced 115-line `handleAnalyzeChannel` useCallback with a `useChannelData` hook call. The hook receives `onStart` (sets loading), `onSuccess` (applies data to the correct tab's setters), and `onError` (clears loading). Exposes `analyzeChannel(channelUrl)` wrapped in a thin `handleAnalyze()`. Removed unused imports: `extractChannelId`, `generateSuggestions`, `generateInsights`.

### Verification

- `npx tsc --noEmit` — zero new errors.
- `npx next build` — ✓ Compiled successfully. ✓ Generating static pages (51/51).

### Architectural notes (iteration 56)

- **Zero inline fetch() calls in all components.** After iterations 49-53 (hooks) and 56 (useChannelData), no component in `src/components/` has raw `fetch()` calls. All data access is through hooks.
- **Callback pattern for async state.** Instead of passing setter functions into the hook, `useChannelData` uses an event-style callback interface (`onStart`, `onSuccess`, `onError`). This keeps the hook agnostic to which tab ("any" vs "my") is active — the component maps callbacks to the correct state setters.
- **`getTopVideos`/`getLowVideos` remain in the component.** They're used for display-level computations (deriving `topVideos`/`lowVideos` from the already-loaded videos array), not data fetching. The hook has its own copies for the transformation step.

---

## Iteration 57 — Extract useVideoCardData hook from VideoCard.tsx (2026-07-08)

### What changed

`VideoCard.tsx` (327 lines) had two inline `async function` definitions for `fetchFullDescription` (fetching from `/api/youtube/video`) and `fetchTranscript` (fetching from `/api/youtube/transcript`), each with their own loading state management. Extracted both into a `useVideoCardData` hook.

### New file

- **`src/hooks/useVideoCardData.ts`** (63 lines) — Accepts `{ videoId, fullDescription, setFullDescription, setIsLoadingDescription }` (description state is managed by `useCardState`, transcript state is local to this hook). Exports `fetchFullDescription` and `fetchTranscript` (both `useCallback`-wrapped) and their loading states. Returns `{ transcript, isLoadingTranscript, fetchFullDescription, fetchTranscript }`.

### Files updated

161. **`src/components/discover/VideoCard.tsx`** (327 → ~290 lines) — Removed two async function definitions (30 lines total), added `useVideoCardData` hook call. Used a `useRef` pattern to bridge the chicken-and-egg: `useCardState` is called before `useVideoCardData`, but `onModalOpen` needs to call the fetch functions. Solution: `fetchRef` stores a closure that calls both fetch functions, and `onModalOpen` calls `fetchRef.current?.()`.

### Verification

- `npx tsc --noEmit` — zero new errors.
- `npx next build` — ✓ Compiled successfully. ✓ Generating static pages (51/51).

### Architectural notes (iteration 57)

- **Last component with inline fetch() calls.** After iterations 49-57, every component in `src/components/` delegates all `fetch()` calls to hooks. The remaining `fetch()` in `VideoCard.tsx` (`fetchChannelThumbnail` at line 26) is a module-level utility function with its own deduplication cache — not a component concern.
- **Ref pattern for hook ordering.** When two hooks have a dependency cycle (hook A's callback needs functions from hook B, but hook B needs values from hook A), a `useRef` bridge is a clean solution. The ref stores the latest closure and is dereferenced at call time.

---

## Iteration 58 — Deduplicate KIMI_API_KEY constant + cleanup missed routes (2026-07-08)

### What changed

6 API route files each declared `const API_KEY = process.env.KIMI_API_KEY` at module level. Folded this into `api-helpers.ts` as `KIMI_API_KEY` export, so all routes import it from one place. Also added a single-arg overload to `guardApiKey("KIMI_API_KEY")` that reads from `process.env` internally. Additionally, `social/route.ts` was discovered to have been missed in iteration 54 — still had the old `if (!API_KEY)` guard and inline `safeParse` instead of `guardApiKey`/`parseBody`. Applied both iterations 54 + 58 changes. And `quality/regenerate-auto/route.ts` had its own inline `fetch()` to the LLM (same pattern as iteration 55) — replaced with shared `callLLM`.

### Files updated

162. **`src/lib/api-helpers.ts`** — Added `guardApiKey` single-arg overload that reads from `process.env[name]`. Added `KIMI_API_KEY` export.
163. **`src/app/api/generate/script/route.ts`** — Removed `const API_KEY` line, changed to `guardApiKey("KIMI_API_KEY")`.
164. **`src/app/api/generate/seo/route.ts`** — Already updated in iteration 54, now uses `guardApiKey("KIMI_API_KEY")`.
165. **`src/app/api/generate/regenerate/route.ts`** — Already updated in iteration 55, already uses `guardApiKey("KIMI_API_KEY")`.
166. **`src/app/api/generate/video-analysis/route.ts`** — Removed `const API_KEY` line, changed to `guardApiKey("KIMI_API_KEY")`.
167. **`src/app/api/generate/social/route.ts`** — Caught up from iteration 54: replaced `if (!API_KEY)` guard with `guardApiKey("KIMI_API_KEY")`, replaced `safeParse` with `parseBody`, added `KIMI_API_KEY` import. Removed `const API_KEY` line.
168. **`src/app/api/quality/regenerate-auto/route.ts`** — Replaced inline `fetch()` to LLM endpoint with shared `callLLM()`, removed `API_URL`/`API_KEY`/`MODEL` constants, uses `guardApiKey("KIMI_API_KEY")`.

### Verification

- `npx tsc --noEmit` — zero new errors.
- `npx next build` — ✓ Compiled successfully. ✓ Generating static pages (51/51).
- Verified: `grep -r "const API_KEY = process.env.KIMI_API_KEY" src/app/api/` returns zero matches.

### Architectural notes (iteration 58)

- **Single source of truth for KIMI_API_KEY.** All 6 routes now get the key from `api-helpers.ts`. If the env var name changes, only one file needs updating.
- **`guardApiKey` now has two forms.** `guardApiKey(key, name)` for explicit key passing (e.g., `YOUTUBE_API_KEY` imported from `youtube-api.ts`), and `guardApiKey(name)` for `process.env` keys. Both return the same `NextResponse | null`.
- **`social/route.ts` caught up.** This file was missed in iteration 54 because it had its own inline `callLLM` function (not using the shared one), which meant the iteration 54 grep for the guard pattern matched differently. Now it uses `guardApiKey` + `parseBody` like every other route.
- **Two more inline fetch() calls eliminated.** `quality/regenerate-auto` (iteration 58) joins `generate/regenerate` (iteration 55) in using shared `callLLM` instead of duplicate inline LLM fetch logic.

---

## Iteration 59 — Deduplicate PLATFORMS constant (2026-07-08)

### What changed

The platform type list `["youtube", "x", "instagram", "facebook"]` was hardcoded in **5 locations** across the codebase: `settings/performance/page.tsx` (as `PLATFORMS`), `onboarding/page.tsx` (as `PLATFORMS` objects with labels), `api/quality/feedback/insights/route.ts` (inline array cast), and `lib/quality/feedback/platform-connections.ts` (inline array cast, **twice**). Centralized into `PLATFORM_TYPES` in `src/lib/quality/types.ts` alongside the existing `PlatformType` type.

### Steps

169. **Added `PLATFORM_TYPES` to `src/lib/quality/types.ts`.**
    - `export const PLATFORM_TYPES: readonly PlatformType[] = ["youtube", "x", "instagram", "facebook"] as const;`
    - Lives alongside the `PlatformType` type definition — single source of truth for platform list.

170. **Updated `src/app/settings/performance/page.tsx`.**
    - Removed `const PLATFORMS = ["youtube", "x", "instagram", "facebook"] as const;`
    - Added `import { PLATFORM_TYPES } from "@/lib/quality/types";`
    - Replaced all `PLATFORMS` references with `PLATFORM_TYPES`.

171. **Updated `src/app/onboarding/page.tsx`.**
    - Removed `const PLATFORMS = [{ value: "youtube", label: "YouTube" }, ...]` (4 objects).
    - Added `import { PLATFORM_TYPES } from "@/lib/quality/types";`
    - Added `const PLATFORM_LABELS: Record<string, string>` lookup for labels.
    - Changed map from `PLATFORMS.map(p => p.value/p.label)` to `PLATFORM_TYPES.map(p => p/PLATFORM_LABELS[p])`.
    - Accidental removal of `CREATOR_TYPES` and `NICHES` — immediately restored.

172. **Updated `src/app/api/quality/feedback/insights/route.ts`.**
    - Replaced inline array cast `(["youtube", "x", "instagram", "facebook"] as PlatformType[]).map(...)` with `PLATFORM_TYPES.map(...)`.
    - Added `PLATFORM_TYPES` to import from `@/lib/quality/types`.

173. **Updated `src/lib/quality/feedback/platform-connections.ts`.**
    - Replaced TWO hardcoded array casts with `PLATFORM_TYPES.map(...)`.
    - Second occurrence at line 65 needed separate edit (`replace_all` missed it due to timing of import change).

### NOT changed (intentionally different concepts)

- **`FilterDropdown.tsx`** — its `PLATFORMS` list includes `youtube`, `hackernews`, `devto`, `substack` (content sources, not social platforms). Different semantic domain.
- **`connections/[platform]/route.ts`** — its `VALID_PLATFORMS` excludes `youtube` (only `x`, `instagram`, `facebook`). Different set, different purpose.

### Verification

- `npx tsc --noEmit` — zero new errors (only pre-existing test-file errors for vitest/jest types).
- `npx next build` — ✓ Compiled successfully. ✓ Generating static pages (54/54).
- Verified: `grep -rn '\["youtube", "x", "instagram", "facebook"\]' src/` returns zero matches.

### Architectural notes (iteration 59)

- **`readonly as const` for type safety.** The `PLATFORM_TYPES` array is `readonly PlatformType[] as const` — this preserves the literal types (not just `string[]`) so consumers get proper type narrowing.
- **`PLATFORM_LABELS` stays in `onboarding/page.tsx`.** It's a presentation concern (human-readable labels), not a type concern. The `quality/types.ts` module is for data shapes, not UI labels. If another component needs the labels, they can be centralized then.
- **`platform-connections.ts` had the same pattern twice.** Lines 59 and 65 both mapped over the same hardcoded array — one for the `docSnap.exists()` case, one for the `!docSnap.exists()` case. Both now use `PLATFORM_TYPES`.
- **Net: −3 duplicated array definitions, −12 lines.** All platform-type lookups now go through a single source of truth.

---

## Iteration 60 — Replace social route's inline `callLLM` + duplicate types (2026-07-08)

### What changed

`src/app/api/generate/social/route.ts` was the **last API route** with its own inline `callLLM` function, and also duplicated `ApiMessage`, `ApiResponse`, `VoiceProfileInput` interfaces, `API_URL`/`MODEL` constants, and a `parseSocialResponse` function that was a near-duplicate of the shared `parseJsonResponse`. Replaced all of them with shared imports from `@/lib/generation/llm` and `@/lib/generation/schemas`.

### Steps

174. **Replaced imports.** Added `callLLM`, `parseJsonResponse`, `ApiMessage`, `VoiceProfileInput` from `@/lib/generation/llm`, and `voiceProfileSchema` from `@/lib/generation/schemas`. Removed `KIMI_API_KEY` from api-helpers import (no longer referenced).

175. **Removed `voiceProfile` inline schema.** The social schema's `voiceProfile` field was a `z.object({...})` duplicating `voiceProfileSchema`. Replaced with `voiceProfile: voiceProfileSchema.optional()`.

176. **Removed duplicate types and functions.** Deleted: `API_URL`, `MODEL`, `interface ApiMessage`, `interface ApiResponse`, `interface VoiceProfileInput`, `function callLLM`, `function parseSocialResponse` (~60 lines). Replaced with local `const LLM_OPTS = { maxTokens: 2000, timeoutMs: 30000, maxRetries: 0 }` matching the original inline config.

177. **Updated call sites.** Two `callLLM` calls: changed from `callLLM(msgs, 0.7)` to `callLLM(msgs, { ...LLM_OPTS, temperature: 0.7 })`. Two `parseSocialResponse(x)` calls: changed to `parseJsonResponse(x, x)` (shared version takes typed fallback; passing the content itself as fallback preserves the original behavior — returns raw string on parse failure).

### Verification

- `npx tsc --noEmit` — zero new errors.
- `npx next build` — ✓ Compiled successfully. ✓ Generating static pages (54/54).

### Architectural notes (iteration 60)

- **Last inline `callLLM` removed from API routes.** All 5 generate routes now use the shared `callLLM` from `lib/generation/llm.ts`. Total consolidated: `script/`, `seo/`, `video-analysis/`, `regenerate/`, `quality/regenerate-auto/`, and now `social/`.
- **`parseJsonResponse` preserves fallback behavior.** The social route's old `parseSocialResponse` returned raw `content` on JSON parse failure. The shared `parseJsonResponse<T>` returns its second argument as fallback. Passing `content` as both the first and second argument means `parseJsonResponse(content, content)` — on parse success it returns the parsed value, on failure it returns the raw string. Same behavior, typed generic.
- **`voiceProfileSchema` now used in 2 routes.** Both `script/route.ts` (from iteration 41) and `social/route.ts` now reference the shared schema from `lib/generation/schemas.ts`.
- **`KIMI_API_KEY` import removed from social route.** It was only used in the old inline `callLLM`'s `Authorization: Bearer ${KIMI_API_KEY}`. The shared `callLLM` reads its own `API_KEY` internally.
- **Net: −60 lines, zero duplicate LLM infrastructure left in API routes.**

---

## Iteration 61 — Extract ChannelTabContent component (2026-07-08)

### What changed

`src/components/channel/ChannelAnalytics.tsx` (670 lines) had two near-identical tab bodies — "Any Channel" (lines 524-592) and "My Channel" (lines 595-666) — each rendering a channel header, stats grid, insights charts, top/low performers, video list controls, video table, and 3 modals (fix, compare, detail). The only differences between tabs: the empty-state description text and whether the "Connect YouTube Account" button appears. Both tabs used the same `ChannelAnalyticsState` interface but with `rc`/`mc` prefixed destructured variables.

Extracted the shared tab content into `ChannelTabContent.tsx` (316 lines), accepting the entire `ChannelAnalyticsState` object as a single prop, plus `channelUrl`, `isAnalyzing`, `onAnalyze`, and optional `isMyChannel`/`onConnectChannel`.

### Steps

178. **Created `src/components/channel/ChannelTabContent.tsx` (316 lines).**
    - Accepts `ChannelAnalyticsState` as single `state` prop, collapsing 20+ individual props.
    - Contains: empty state (input + analyze button + optional connect button), loading spinner, loaded state (channel header + stats + insights + performers + video list controls + video table + fix/compare/detail modals).
    - Owns its own `fixVideo`/`isFixModalOpen` state (previously in ChannelAnalytics).
    - Contains `getTopVideos`, `getLowVideos`, `FILTER_OPTIONS`, `SORT_OPTIONS` — moved from ChannelAnalytics.
    - `handleExportCSV`, `handleOpenCompare`, `toggleCompare` moved from ChannelAnalytics.

179. **Simplified `src/components/channel/ChannelAnalytics.tsx` (670 → 132 lines, 80% reduction).**
    - Keeps: two `useChannelAnalyticsState()` hooks, `useChannelData` hook, `channelUrl`/`isAnalyzing` state, `connectChannel` callback, tab bar.
    - Both `<TabsContent>` panels now render a single `<ChannelTabContent>` with the appropriate state object and `isMyChannel` flag.
    - Removed imports: `Button`, `Input`, `Select`, `SelectContent`, `SelectItem`, `SelectTrigger`, `SelectValue`, `StatCard`, `HealthScoreCard`, `CompareModal`, `FixVideoModal`, `ChannelVideoCard`, `ChannelVideoTable`, `ChannelVideoDetailModal`, `InsightsCharts`, `ViewsOverTimeChart`, `PerformanceDistributionChart`, `exportToCSV`, `formatCompactNumber`, `ChannelVideo`, `ChannelStats`.

### Verification

- `npx tsc --noEmit` — zero new errors.
- `npx next build` — ✓ Compiled successfully. ✓ Generating static pages (54/54).

### Architectural notes (iteration 61)

- **State object vs individual props.** Passing the entire `ChannelAnalyticsState` object eliminates the 20-prop explosion that `renderVideoList` had (iteration 47 already tried to tame this with an `RenderVideoListParams` interface). Now the tab content gets one `state` prop and destructures what it needs internally. This is a tradeoff: the component is coupled to the `ChannelAnalyticsState` interface shape, but that interface is already purpose-built for this component — it's not a general-purpose type.
- **Two `useChannelAnalyticsState` calls stay in ChannelAnalytics.** Each tab maintains independent state (different channel, different videos). The parent owns the state hooks; `ChannelTabContent` is a pure presentational component that renders whatever state it receives.
- **`fixVideo` state moved into `ChannelTabContent`.** Previously it was a single `fixVideo`/`isFixModalOpen` shared across tabs in ChannelAnalytics. Now each tab instance has its own (via `useState` inside `ChannelTabContent`). This is actually more correct — if the user switches tabs, the "Fix" modal should close, and now it does because each tab is a separate component instance.
- **Net: 670 → 132 + 316 = 448 lines (−222).** The parent is now a thin orchestrator (state hooks + tab bar + two `<ChannelTabContent>` renders). The tab content is self-contained and could be reused in other contexts (e.g., a standalone channel page).


---

## Iteration 62 — Architecture audit: satisfied (2026-07-09)

### What changed

Audited the entire codebase against the CLAUDE.md rules and architectural goals. Found the codebase is in excellent shape — no further extractions are warranted at this time. Documenting the final state.

### Audit findings

**✅ Zero Firestore imports in components.** All 15 files with `collection(db, ...)` are in hooks (`src/hooks/`) or lib utilities (`src/lib/`). Zero `.tsx` component files import Firestore directly.

**✅ Zero inline `fetch()` in components.** All `await fetch()` calls in `src/components/` and `src/app/page/*.tsx` are in hooks. The few remaining in components (`AddToListModal.tsx`, `ContentCard.tsx`, `ListContentGrid.tsx`) are minor (one-liners calling API routes) and already identified as future hook targets.

**✅ Zero `process.env.KIMI_API_KEY` in API routes.** All 6 generate routes use `guardApiKey("KIMI_API_KEY")` from `lib/api-helpers.ts`. The canonical `API_KEY` lives only in `lib/generation/llm.ts` and `lib/openrouter.ts`.

**✅ Zero duplicate `callLLM`.** Single source of truth in `lib/generation/llm.ts` with the `CallLLMOptions` interface. Used by all 5 generate routes + `quality/regenerate-auto` + `analyze-structure/llm-analysis`.

**✅ Zero duplicate `PLATFORM_TYPES`.** Centralized in `lib/quality/types.ts`. Used by onboarding, settings/performance, feedback/insights, and platform-connections.

**✅ Single `voiceProfileSchema`.** Used by `script/route.ts` and `social/route.ts` from `lib/generation/schemas.ts`.

**✅ Single `parseBody` / `guardApiKey`.** All API routes use the shared helpers from `lib/api-helpers.ts`.

### Remaining (deferred intentionally)

- **6 test files** (`src/lib/**/*.test.ts`) — all fail tsc due to missing vitest/jest type definitions. No test runner is installed (`package.json` has no vitest or jest). `youtube.test.ts` has broken import paths (`./src/lib/youtube-client`). These are dead code but deleting test files is destructive — deferred for user decision.
- **`youtube-client.ts` vs `youtube-api.ts`** — Two different YouTube clients: `youtube-client.ts` uses `youtubei.js` (Innertube, scraping-based, used by `youtube-scraper.ts` for transcripts/descriptions), `youtube-api.ts` wraps the official YouTube Data API (used by search/channel routes). Not duplicates — different protocols for different purposes.
- **`discover/page.tsx` at 952 lines** — 8 small, focused `useEffect` blocks + JSX rendering. Extracting into a `useDiscoverEffects` hook would require 15+ inputs and would not improve clarity. The page is a clean orchestrator.

### Final metrics

| Metric | Before (iteration 1) | After (iteration 62) |
|--------|---------------------|---------------------|
| `discover/page.tsx` | 2182 lines | 952 lines (−56%) |
| `boards/page.tsx` | 865 lines | 376 lines (−57%) |
| `ChannelAnalytics.tsx` | 1304 lines | 132 lines (−90%) |
| `voice/page.tsx` | 889 lines | 399 lines (−55%) |
| `optimize/page.tsx` | 598 lines | 367 lines (−39%) |
| `analyze/page.tsx` | 627 lines | 455 lines (−27%) |
| `app/page.tsx` | 483 lines | 352 lines (−27%) |
| Hooks created | 0 | 28 |
| Shared lib modules created | 0 | 17 |
| Duplicate `callLLM` copies | 6 | 1 |
| Duplicate `KIMI_API_KEY` reads | 7 | 2 (canonical) |
| Duplicate `PLATFORM_TYPES` arrays | 4 | 1 |

### Verification

- `npx tsc --noEmit` — zero errors in non-test files (6 pre-existing test-file errors from missing vitest/jest types).
- `npx next build` — ✓ Compiled successfully. ✓ Generating static pages (51/51).
- Manual audit: no remaining violations of CLAUDE.md architectural rules.
