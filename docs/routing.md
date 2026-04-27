# Routing

Viteflow scans `/src/**/*.ts` at startup and builds a route table. At runtime, the router matches `window.location.pathname` against the table and runs the matching handler.

## Filename rules

| File path | URL pathname |
|-----------|--------------|
| `src/global.ts` | runs on every page (not a route — see below) |
| `src/index.ts` | `/` |
| `src/about.ts` | `/about` |
| `src/blog.ts` | `/blog` |
| `src/blog/index.ts` | `/blog` (collides with `src/blog.ts` — error) |
| `src/blog/[slug].ts` | `/blog/:slug` (any segment after `/blog/`) |
| `src/shop/cart.ts` | `/shop/cart` |
| `src/shop/[id].ts` | `/shop/:id` |
| `src/shop/[id]/edit.ts` | `/shop/:id/edit` |

### Conversion algorithm

1. Strip the `/src` prefix and the `.ts` suffix.
2. If the result ends in `/index`, strip `/index` (so `/blog/index` becomes `/blog`).
3. If the result is empty, treat it as `/`.
4. Replace each `[name]` segment with `:name` to mark it as a dynamic parameter.

## Static vs dynamic segments

Static segments are literal strings: `about`, `blog`, `shop`. They match exactly and case-sensitively.

Dynamic segments use `[name]` syntax in the filename and become `:name` in the route pattern. They match any non-empty path segment that does not contain `/`.

```
src/blog/[slug].ts            →  /blog/:slug
src/users/[id]/posts/[postId].ts → /users/:id/posts/:postId
```

The values are passed to your handler as `params`:

```ts
const handler: RouteHandler = ({ params }) => {
	console.log(params.slug);
	console.log(params.id);
	console.log(params.postId);
};
```

URL-encoded characters are decoded automatically. `slug=hello%20world` becomes `params.slug === 'hello world'`.

## Match precedence

When multiple routes could match a path, viteflow picks the most specific one:

1. **Higher literal segment count wins.** `/blog/featured` beats `/blog/:slug` for the URL `/blog/featured`.
2. **Within the same literal count, fewer params wins.** Tiebreaker.

Example route table:

```
/users/me           ← literalCount=2, paramCount=0
/users/:id          ← literalCount=1, paramCount=1
/:section/:item     ← literalCount=0, paramCount=2
```

For URL `/users/me`, all three regex-match. Sort by precedence picks `/users/me` first.

For URL `/users/42`, `/users/me` doesn't regex-match. Next is `/users/:id` — picked.

## Path normalization

- Trailing slashes are ignored (except for `/`). `/about/` matches `src/about.ts`.
- Query strings and hashes are ignored. `/blog?utm=foo#section` matches `src/blog.ts`.
- Path matching is case-sensitive. `/About` does **not** match `src/about.ts`.

## The `global.ts` file

`src/global.ts` is special. It is not a route — it runs on **every page** before the matched route handler.

Use it for:

- Global imports (CSS, libraries you want everywhere)
- Body-level event listeners
- Cookie banners, analytics, navigation behaviors
- Setting up global state that route handlers depend on

```ts
import type { RouteHandler } from '../viteflow/types';
import './styles.css';
import 'gsap';

const handler: RouteHandler = ({ path }) => {
	console.log('page loaded:', path);
};

export default handler;
```

If `src/global.ts` does not exist, viteflow skips it silently.

## What is not supported

- **Catch-all routes.** No `[...rest].ts`. Route precisely or match a parent literal segment and inspect `window.location.pathname` yourself.
- **Optional segments.** `[[slug]]` does not work.
- **Nested layouts.** This is a router, not a UI framework. Webflow handles your layout.
- **Server-side anything.** All code runs in the browser.

## Adding a route while dev server runs

Just create the file. Vite picks up the new route on the next save. The router rebuilds, your browser hot-reloads, and the route is live.

If you create a file with the same pattern as an existing route (e.g. both `src/blog.ts` and `src/blog/index.ts`), the dev server throws a `Duplicate route` error in the console. Delete one of them.

## Checking route output

The router logs to the browser console:

- `[viteflow:global] page loaded: /some/path` — global handler ran
- `[viteflow] no route matched for /some/path` — no handler matched (warning)
- `[viteflow] handler error in src/blog.ts (/blog)` — your handler threw, error follows

Errors in a handler do **not** stop the global handler from running and do not prevent the page from rendering. They are logged and isolated.
