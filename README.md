# Outlierly (TubeForge)

Content discovery and creation tool for creators. Surfaces outlier-performing
videos and articles across YouTube, Hacker News, DEV.to, and Substack; lets you
block, filter, and track what you see; and provides an LLM-powered chat panel to
turn what you find into scripts, social posts, and headline variations.

> **Note on naming:** the UI brand is **Outlierly**, but the internal package
> name (`tubeforge`), storage keys, cookies, and window events stay as
> `tubeforge` for backward compatibility. Don't rename them.

## Tech stack

- **Next.js 16** (App Router) + **React 19** + **TypeScript** (strict)
- **Firebase** — Auth (email/password + Google) + Firestore
- **Tailwind CSS v4** + **shadcn/ui** (`@base-ui/react`)
- **TanStack React Query** for server state
- **Zod** for validation
- Scraping: `undici` (proxy-aware fetch), `youtube-transcript`, `youtubei.js`,
  `scrape-youtube`. (Browser-based scraping via `puppeteer-extra`/`playwright`
  is available but the only active content sources are Hacker News, DEV.to, and
  Substack.)

## Getting started

```bash
npm install
npm run dev      # http://localhost:3000
```

Production build / preview:

```bash
npm run build
npm run start
```

Lint: `npm run lint`. Type-check: `npm run typecheck`.

## Environment variables

Copy `env.local.example` to `.env.local` and fill in. Required keys:

| Var | Purpose |
|-----|---------|
| Firebase config | `NEXT_PUBLIC_FIREBASE_*` (apiKey, authDomain, projectId, etc.) |
| `YOUTUBE_API_KEY` | YouTube Data API v3 (server-only) |
| `KIMI_API_ENDPOINT` | LLM endpoint URL |
| `KIMI_API_KEY` | LLM bearer token |
| `KIMI_MODEL` | Default model id |
| `KIMI_USE_PROXY` | `true` to route LLM calls through the detected proxy |
| `HTTPS_PROXY` / `HTTP_PROXY` | Outbound proxy for `proxyFetch` (auto-detected on common local ports otherwise) |

Never commit `.env.local` (it is gitignored).

The app **builds and runs without any env vars** — Firebase features gracefully
degrade (no auth, no persistence) so open-source contributors can clone and run
immediately.

## Routes

| Route | Purpose |
|-------|---------|
| `/` | Home — onboarding status, daily streak, quick nav |
| `/discover` | Main research workspace (feed, filters, creators/lists/channel tabs, workspace board) |
| `/analyze` | Structure analysis results (video/article) |
| `/optimize` | SEO optimizer |
| `/voice` | Voice profile builder |
| `/channel` | Per-channel analytics |
| `/dashboard` | Dashboard |
| `/settings/performance` | Performance insights + platform connections + score calibration |
| `/onboarding` | New-user onboarding wizard |
| `/auth/login`, `/auth/signup` | Firebase auth |

API routes live under `/api/*` (YouTube, content, generation, chat, quality/feedback, llm).

## Architecture

- **`app/`** — Next.js routes (pages + API routes). Business logic belongs in `lib/`.
- **`components/`** — React components. `components/ui/` is shadcn/ui only (no custom logic).
- **`hooks/`** — one custom hook per file, returns an object. All API calls and
  Firestore access go through hooks (no inline `fetch()` in components).
- **`lib/`** — shared utilities, API clients, helpers. No React components.
- **`types/`** — TypeScript interfaces and types. No runtime code.

See `PLATFORM_GUIDE.md` for the full feature/data-flow reference and
`CLAUDE.md` / `AGENTS.md` for coding standards.

## Security

- Auth is enforced on all API routes via JWT signature verification (`jose` + Google JWKS).
- CSP, X-Frame-Options, and other security headers are set in `next.config.ts`.
- SSRF protection via `validateUrl` in `proxyFetch`.
- Firestore rules enforce per-user data isolation.

## Deployment

Build must pass before deploying: `npm run build` succeeds locally. Configure
all environment variables in the host. Netlify: use the `next` adapter with the
build command `npm run build`.
