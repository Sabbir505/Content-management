---
name: testing-discover-page
description: Test the TubeForge discover page end-to-end including scrapers, search, category filtering, platform filters, and outlier score. Use when verifying content scraper integrations or discover page UI changes.
---

# Testing TubeForge Discover Page & Scrapers

## Prerequisites

- Dev server running on port 3001 (`npm run dev`)
- `.env.local` with Firebase config and `YOUTUBE_API_KEY`
- A logged-in user (create via signup flow if needed)

## Devin Secrets Needed

- `YOUTUBE_API_KEY` — for YouTube Data API search results

## Starting the App

```bash
cd /home/ubuntu/repos/Content-management
npm run dev
```

Server runs on port **3001** (configured in package.json).

## API Scraper Testing

Test each scraper individually via the `/api/content/scrape` endpoint:

```bash
# YouTube (uses YouTube Data API - requires YOUTUBE_API_KEY)
curl -s "http://localhost:3001/api/youtube/search?query=productivity&maxResults=3"

# Substack (undocumented JSON archive - no auth needed)
curl -s "http://localhost:3001/api/content/scrape?platform=substack&publication=oneusefulthing&limit=3"

# X/Twitter (Nitter instances - often blocked from cloud IPs)
curl -s "http://localhost:3001/api/content/scrape?platform=x&query=tech&limit=3"

# Instagram (GraphQL endpoint - blocked from cloud IPs)
curl -s "http://localhost:3001/api/content/scrape?platform=instagram&hashtag=tech&limit=3"

# TikTok (page HTML parsing - blocked from cloud IPs)
curl -s "http://localhost:3001/api/content/scrape?platform=tiktok&query=coding&limit=3"

# LinkedIn (Google discovery + embed parsing - blocked from cloud IPs)
curl -s "http://localhost:3001/api/content/scrape?platform=linkedin&query=marketing&limit=3"

# Unified multi-source search
curl -s "http://localhost:3001/api/content/search?query=technology&limit=10"

# Parameter validation (should return 400)
curl -s "http://localhost:3001/api/content/scrape"
```

### Expected Results

- **YouTube**: Returns real video data with `outlierScore`, `title`, `channelTitle`, `viewCount`
- **Substack**: Returns real posts with `title`, `post_date`, `canonical_url`, `reactions`
- **X/Instagram/TikTok/LinkedIn**: Likely return `success: true` with empty `data` arrays from cloud servers (graceful failure due to IP blocks). This is expected behavior, not a bug.
- **Unified search**: DEV.to and Google News reliably return data; other sources may return empty
- **Param validation**: Returns HTTP 400 with error message

## UI Testing (Browser)

### Key Test Scenarios

1. **Content Loading**: Navigate to `/discover` — verify YouTube videos (with thumbnails, view counts, outlier scores) AND article cards (Google News, DEV.to) appear in the grid
2. **Category Filter**: Click any category pill (e.g., "Technology") — content should update, pill should highlight, trash icon appears on hover
3. **Search**: Type query in search bar and press Enter — content refreshes from all sources for that query
4. **Platform Filter**: Click "Filters" button → uncheck YouTube → video cards disappear, only articles remain. Re-check → videos return.
5. **Outlier Score**: In filters, change Min Outlier Score (e.g., 20x) → videos below that threshold disappear
6. **"All" Category**: Click "All" pill → full unfiltered content reloads

### Important Notes

- **Search + Category interaction**: If a category filter is active when you search, the combined filter may show no results. Reset to "All" before searching for best results.
- **Hot reload interference**: The Next.js dev server's Fast Refresh can cause "Failed to fetch" errors if it rebuilds during an API call. Wait for rebuilds to settle before testing.
- **Login required**: The discover page has an auth guard — you must be logged in. Use the signup flow at `/auth/signup` to create a test account.
- **Test account**: You can create one with any email/password via Firebase Auth.

## Content Sources in the App

| Source | Platform Filter | Reliability from Cloud |
|--------|----------------|----------------------|
| YouTube | "YouTube" checkbox | High (uses API key) |
| Google News | Shows when any non-YT platform active | High |
| DEV.to | Shows when any non-YT platform active | High |
| Substack | "Substack" checkbox | Medium (undocumented API) |
| X/Twitter | "X / Twitter" checkbox | Low (Nitter instances blocked) |
| Instagram | "Instagram" checkbox | Low (blocks server IPs) |
| TikTok | "TikTok" checkbox | Low (blocks server IPs) |
| LinkedIn | "LinkedIn" checkbox | Low (Google blocks server IPs) |

## Platform-to-Source Mapping

The UI uses platform names (`twitter`, `youtube`, etc.) but the content system uses source IDs:
- UI "twitter" → source "x"
- UI "youtube" → source "youtube" (videos are separate)
- UI "substack" → source "substack"
- UI "instagram" → source "instagram"
- UI "tiktok" → source "tiktok"
- UI "linkedin" → source "linkedin"
- Legacy sources (hackernews, reddit, devto, googlenews) show when any non-YouTube platform is active

## Common Issues

- **Empty discover page**: Check browser console for fetch errors. May be auth issue or dev server rebuilding.
- **Articles never showing**: Check the platform filter logic in `discover/page.tsx` — the `platformToSource` mapping and legacy source handling are the most common failure points.
- **Outlier filter not working**: The outlier score map uses string keys ("Any", "3x", "5x", "10x", "20x") → numeric values. Verify the `outlierScoreMap` in discover page.
