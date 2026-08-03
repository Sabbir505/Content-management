<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# TubeForge — Project Rules & Coding Standards

## General Principles

- **Ship working code.** Prefer working features over perfect abstractions.
- **No premature optimization.** Three similar lines are better than an abstraction.
- **No unused code.** If something is unused, delete it completely.
- **No backwards-compatibility hacks.** If something is unused, remove it fully.
- **No feature flags for simple changes.** Change the code directly.

---

## File & Folder Structure

### Naming Conventions
- **Files:** kebab-case for everything except React components
  - Components: `PascalCase.tsx` (e.g., `VideoCard.tsx`)
  - Hooks: `camelCase.ts` (e.g., `useAuth.ts`)
  - Utilities: `camelCase.ts` (e.g., `youtube.ts`)
  - Types: `camelCase.ts` (e.g., `video.ts`)
- **Folders:** kebab-case (e.g., `components/discover/`, `lib/`)

### Organization
- Keep related files close. A component, its styles, and its tests should live near each other.
- `components/ui/` — shadcn/ui components only. Do not add custom logic here.
- `app/api/` — Next.js API routes only. Business logic belongs in `lib/`.
- `lib/` — Shared utilities, API clients, helpers. No React components.
- `hooks/` — Custom React hooks. One hook per file.
- `types/` — TypeScript interfaces and types. No runtime code.

---

## TypeScript

- **Strict mode enabled.** No `any` without a comment explaining why.
- **Prefer interfaces over types** for object shapes.
- **Use explicit return types** on exported functions.
- **No `ts-ignore`.** Use `ts-expect-error` with a comment if absolutely necessary.

```typescript
// Good
interface Video {
  id: string;
  title: string;
  views: number;
}

export function calculateOutlierScore(video: Video): number {
  // implementation
}

// Bad
function doThing(data: any) {
  // ...
}
```

---

## React & Next.js

### Components
- **Use server components by default.** Only mark as `'use client'` when using hooks, browser APIs, or event handlers.
- **One component per file.** Exception: small, closely related sub-components.
- **Props interface named `{ComponentName}Props`.**
- **Destructured props.** No `props.propName`.

```typescript
// Good
interface VideoCardProps {
  video: Video;
  onSelect: (id: string) => void;
}

export function VideoCard({ video, onSelect }: VideoCardProps) {
  // ...
}

// Bad
export function VideoCard(props: any) {
  // ...
}
```

### Hooks
- **Prefix with `use`.** `useAuth`, `useVoiceProfile`.
- **One hook per file.** Named after its purpose.
- **Return an object, not an array.** Easier to extend.

```typescript
// Good
export function useAuth() {
  const user = useContext(AuthContext);
  const login = useCallback(async (email: string, password: string) => {
    // ...
  }, []);
  return { user, login, isLoading };
}

// Bad
export function useAuth() {
  return [user, login, isLoading]; // Array return
}
```

### State Management
- **React Context for global state** (auth, voice profile, UI state).
- **React Query for server state** (API data, caching, synchronization).
- **useState/useReducer for local state** (forms, toggles, modals).
- **No Redux, no Zustand.** React Context + Query is sufficient.

### API Routes
- **One route per file.** Use nested folders for organization.
- **Return JSON with consistent shape:** `{ success: boolean, data?: T, error?: string }`
- **Validate inputs with Zod.**
- **Handle errors gracefully.** Return 400/500 with descriptive messages.

```typescript
// Good
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const validated = schema.parse(body);
    const result = await doSomething(validated);
    return Response.json({ success: true, data: result });
  } catch (error) {
    return Response.json({ success: false, error: error.message }, { status: 400 });
  }
}
```

---

## Styling

- **Tailwind CSS only.** No inline styles, no CSS-in-JS.
- **Use `cn()` utility** for conditional classes.
- **Responsive first.** Use `md:`, `lg:` prefixes, not `max-md:`.
- **Extract repeated patterns** to components, not to custom CSS classes.

```tsx
// Good
<div className={cn("flex items-center gap-2", isActive && "bg-primary")}>

// Bad
<div style={{ display: 'flex', alignItems: 'center' }}>
```

---

## shadcn/ui

- **Use shadcn components as-is.** Do not modify their internals.
- **Extend via composition.** Wrap shadcn components in your own components if needed.
- **Install via CLI:** `npx shadcn add <component>`
- **Do not copy shadcn source into your own files.** Import from `@/components/ui`.

---

## Firebase

- **Initialize lazily.** `lib/firebase.ts` lazily initializes Firebase on first access and gracefully degrades when env vars are missing (no auth, no persistence). Do not assume Firebase is always available.
- **Use Firestore rules** for security. Never trust client-side validation alone.
- **Batch writes** when updating multiple documents.
- **Index frequently queried fields.** Add composite indexes as needed.

---

## API Clients

- **Abstract external APIs.** Wrap YouTube Data API, LLM endpoint, etc. in `lib/` files.
- **Cache responses** where appropriate (React Query handles this).
- **Retry with exponential backoff** for transient failures.
- **Log errors** but do not expose internal details to the client.

---

## Testing

- **Test behavior, not implementation.** What the user sees, not how it's built.
- **One test file per component.** Named `{ComponentName}.test.tsx`.
- **Mock external APIs.** Do not hit real services in tests.
- **Test critical paths:** auth, generation flows, error states.
- **No test runner is currently configured.** Add one (Vitest or Jest) before writing new tests.

---

## Comments

- **No comments explaining what the code does.** Well-named identifiers do that.
- **Comments for WHY, not WHAT.** Hidden constraints, subtle invariants, workarounds.
- **If removing the comment wouldn't confuse a future reader, don't write it.**

```typescript
// Good — explains a workaround
// YouTube API returns dates in ISO 8601 but without timezone info
const date = parseISO(video.publishedAt + "Z");

// Bad — explains the obvious
// Increment the counter by 1
counter++;
```

---

## Error Handling

- **Validate at system boundaries.** User input, external APIs.
- **Do not add error handling for impossible scenarios.** Trust internal code.
- **Show user-friendly messages.** Log detailed errors server-side.
- **Never expose stack traces or internal details to the client.**

---

## Performance

- **Lazy load heavy components.** Use `next/dynamic` for large components.
- **Optimize images.** Use `next/image` with proper sizing.
- **Debounce user input.** Search, filters, form validation.
- **Memoize expensive computations.** `useMemo`, `useCallback` where profiling shows benefit.
- **Do not memoize everything by default.** React is fast enough.

---

## Git

- **Commit messages:** Imperative mood, concise. "Add script generator" not "Added script generator".
- **One logical change per commit.** Do not bundle unrelated changes.
- **No WIP commits in main.** Squash or fixup before merging.

---

## Security

- **Never commit secrets.** Use `.env.local`, add to `.gitignore`.
- **Validate all user input.** On both client and server.
- **Use parameterized queries / Firestore rules.** No SQL injection risk, but validate data shape.
- **Sanitize HTML.** If rendering user-generated content, use `DOMPurify`.
- **CSP headers.** Set Content-Security-Policy in Next.js config.
- **No eval, no dangerouslySetInnerHTML with untrusted data.**

---

## Deployment

- **Environment variables must be set before deployment.** The app builds without them, but features will be degraded.
- **Build passes before deploying.** `npm run build` must succeed locally.
- **Netlify:** Use `next` adapter, set build command and publish directory.
- **Local:** `npm run dev` for development, `npm run build` + `npm start` for production-like testing.
