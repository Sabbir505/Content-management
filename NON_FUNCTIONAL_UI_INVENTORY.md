# TubeForge — Non-Functional UI Inventory

> **⚠️ Superseded — the dead-button inventory is resolved.**
> A full re-audit (2026-07-24) traced every `onClick`/`href` in `src/app/**`
> and `src/components/**` to its handler body and found **zero dead buttons**.
> The items listed below were fixed during subsequent work:
> - The ContentChatPanel header **New chat** / **Link** buttons now call
>   `resetChat` / `handleGenerateLink` from `useContentChat`.
> - The VideoCard/ContentCard **"Not in my language"** / **"Hide this creator"**
>   context-menu items now call `blockLanguage` / `blockCreator` and dispatch the
>   `tubeforge-blocklist-updated` event (see `VideoCardMenus.tsx` /
>   `ContentCardMenus.tsx`).
> - Several entries referenced now-deleted files (`src/app/boards/page.tsx`,
>   `src/components/board/BoardCanvas.tsx`, `src/app/creators/page.tsx`) that
>   were removed when board/creator management moved into the `/discover`
>   workspace.
>
> The tables below are retained as a historical record of what was flagged and
> since addressed. Verify against the live code before acting on any row.

A complete audit of buttons, nav items, features, and inputs that don't work or are placeholders.

---

## 1. Dead Buttons (empty onClick / no handler)

| # | File | Line | Element | Currently Does |
|---|------|------|---------|----------------|
| 1 | `src/components/discover/VideoCard.tsx` | 211 | Context menu: "Not in my language" | Nothing (`() => {}`) |
| 2 | `src/components/discover/VideoCard.tsx` | 221 | Context menu: "Hide this creator" | Nothing |
| 3 | `src/components/discover/VideoCard.tsx` | 456 | Modal header "Hide" button | No onClick |
| 4 | `src/components/discover/ContentCard.tsx` | 151 | Context menu: "Not in my language" | Nothing |
| 5 | `src/components/discover/ContentCard.tsx` | 161 | Context menu: "Hide this creator" | Nothing |
| 6 | `src/components/discover/ContentCard.tsx` | 351 | Modal header "Hide" button | No onClick |
| 7 | `src/components/discover/ContentChatPanel.tsx` | 241-256 | Header buttons: New chat, Fork, Link | No onClick (only close works) |
| 8 | `src/app/discover/page.tsx` | 1227 | Chat input "+" attach button | No onClick |
| 9 | `src/app/discover/page.tsx` | 1232 | Chat input settings/gear button | No onClick |
| 10 | `src/app/discover/page.tsx` | 1243-1259 | Quick pills: Start Writing, Creator Research, Topic Research, Watchlist Overview | No onClick |
| 11 | `src/app/discover/page.tsx` | 1095 | Board "Share" button | No onClick |
| 12 | `src/app/discover/page.tsx` | 1284-1335 | Card context menu items: Color, Move to Board, Download, Rename, Reference on Board | No onClick |
| 13 | `src/app/boards/page.tsx` | 623-634 | Sidebar: "Academy" and "Help & Support" | No onClick |
| 14 | `src/components/board/BoardCanvas.tsx` | 125-127 | "Move to Board" and "Reference to Board" callbacks | Empty `() => {}` |
| 15 | `src/components/discover/ListContentGrid.tsx` | 167 | "Save to board" on videos | Toast only, no actual save |

---

## 2. Placeholder Nav / Menus

| # | File | Line | Element | Issue |
|---|------|------|---------|-------|
| 16 | `src/components/AppSidebar.tsx` | 126-146 | "More" dropdown: Skills, Highlights, Identities, Capture, Customize sidebar | Only close menu, no action |
| 17 | `src/components/command/CommandPalette.tsx` | 51-58 | "Go to Creators" command | Routes to `/discover` (label mismatch) |

---

## 3. Static Features / Mock Data

| # | File | Line | Element | Issue |
|---|------|------|---------|-------|
| 18 | `src/app/page.tsx` | 101 | "Daily streak" badge | Random number each load, not persisted |
| 19 | `src/app/page.tsx` | 238-258 | "Getting started" onboarding | Step 1 always marked complete (initial state = 0) |
| 20 | `src/components/AppSidebar.tsx` | 271-279 | Settings: "Dark Mode" toggle | Static "Always on for now", can't toggle |
| 21 | `src/components/chat/ChatPanel.tsx` | 124 | `userVoice` parameter | Hardcoded, voice profile setting unused |
| 22 | `src/app/settings/performance/page.tsx` | 72 | Platform "Connect" buttons (YouTube/X/IG/FB) | Toast only, no OAuth flow |

---

## 4. Filters / Tabs That Don't Filter

| # | File | Line | Element | Issue |
|---|------|------|---------|-------|
| 23 | `src/app/discover/page.tsx` | 138 | `activeTab` state (all/videos/articles) | No UI control to switch tabs |
| 24 | `src/app/discover/page.tsx` | 153-157 | Language filter | State set, never applied to results |
| 25 | `src/app/discover/page.tsx` | 154-156 | Followers filter | State set, never applied |
| 26 | `src/app/discover/page.tsx` | 152 | Format filters (Substack articles/notes, IG reels/carousel) | State set, never applied |

---

## 5. Form Inputs Not Wired Up

| # | File | Line | Element | Issue |
|---|------|------|---------|-------|
| 27 | `src/app/discover/page.tsx` | 1218-1239 | Workspace right-pane chat textarea | No submit handler, no send button onClick, placeholder mentions @mentions and /skills that aren't implemented |

---

## Summary

- **15** dead buttons
- **2** placeholder nav items
- **5** static/mock features
- **4** filters/tabs that don't filter
- **1** unwired form input

**Total: 27 non-functional items**
