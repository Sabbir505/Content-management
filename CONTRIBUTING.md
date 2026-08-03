# Contributing to TubeForge

Thanks for your interest in contributing! This guide will help you get the project running locally.

## Prerequisites

- **Node.js** >= 18.18.0 (check with `node --version`)
- **npm** >= 9 (comes with Node.js)

## Getting Started

1. **Fork and clone the repository**
   ```bash
   git clone https://github.com/YOUR_USERNAME/tubeforge.git
   cd tubeforge
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   ```bash
   cp env.local.example .env.local
   # Edit .env.local and fill in your Firebase and API keys
   ```

   The app **can build and run without Firebase config** — auth and database features will be unavailable, but the UI and scraping will work.

4. **Start the development server**
   ```bash
   npm run dev
   ```
   Open [http://localhost:3000](http://localhost:3000) in your browser.

## Required Services

| Service | Purpose | How to get |
|---------|---------|------------|
| Firebase | Auth + Firestore | [firebase.google.com](https://firebase.google.com) — create a project, enable Email/Password auth, create a Firestore database |
| YouTube Data API v3 | Channel/video data | [Google Cloud Console](https://console.cloud.google.com) — enable YouTube Data API, create an API key |
| LLM Provider | AI generation | Default uses Kimi-compatible endpoint. Set `KIMI_API_ENDPOINT`, `KIMI_API_KEY`, and `KIMI_MODEL` |

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start dev server on port 3000 |
| `npm run build` | Production build |
| `npm run start` | Start production server |
| `npm run lint` | Run ESLint |
| `npm run typecheck` | TypeScript type check |

## Project Structure

```
src/
  app/           # Next.js routes (pages + API routes)
  components/    # React components
  hooks/         # Custom React hooks
  lib/           # Utilities, API clients, scrapers
  types/         # TypeScript interfaces
```

## Coding Standards

See [`AGENTS.md`](./AGENTS.md) for the full coding standards. Key points:

- **TypeScript strict mode** — no `any` without a comment
- **Server components by default** — only mark `'use client'` when needed
- **One component per file**
- **Tailwind CSS only** — no inline styles
- **Zod for validation** — all API inputs validated

## Submitting Changes

1. Create a feature branch: `git checkout -b feature/my-feature`
2. Make your changes
3. Ensure `npm run typecheck` passes
4. Ensure `npm run build` passes
5. Commit with a clear message: `Add feature X` (imperative mood)
6. Open a pull request

## Questions?

Open an issue or discussion on GitHub.
