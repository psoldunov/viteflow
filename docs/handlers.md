# Handlers

Every route file (and `global.ts`) exports a default function — the **handler** — that viteflow calls when the URL matches.

## Signature

```ts
import type { RouteHandler } from '../viteflow/types';

const handler: RouteHandler = (ctx) => {
	// your code
};

export default handler;
```

The exported value must be a function. If a file under `/src` does not export a default function, viteflow skips it with a console warning.

## The context object

```ts
type RouteContext = {
	params: Record<string, string>;
	path: string;
};
```

### `params`

An object whose keys come from the dynamic segments in the route filename and whose values come from the URL.

| File | URL | `params` |
|------|-----|----------|
| `src/blog/[slug].ts` | `/blog/hello-world` | `{ slug: 'hello-world' }` |
| `src/users/[id]/posts/[postId].ts` | `/users/42/posts/9` | `{ id: '42', postId: '9' }` |
| `src/about.ts` | `/about` | `{}` |

For `global.ts`, `params` is always `{}` since it is not tied to a route pattern.

Values are always strings. If you need numbers, parse them yourself:

```ts
const id = Number(params.id);
if (!Number.isFinite(id)) throw new Error('invalid id');
```

URL-encoded characters are decoded automatically (`%20` → space).

### `path`

The normalized pathname of the current page. Trailing slashes are stripped except for the root `/`.

```ts
const handler: RouteHandler = ({ path }) => {
	if (path.startsWith('/admin')) {
		// shared admin behavior
	}
};
```

## Return value

The handler may return:

- `void` — synchronous handler, returns nothing
- `Promise<void>` — asynchronous handler

```ts
const handler: RouteHandler = async ({ params }) => {
	const data = await fetch(`/api/posts/${params.slug}`).then((r) => r.json());
	renderPost(data);
};

export default handler;
```

The router awaits async handlers but does not block other side effects. The Webflow page is already rendered when your handler runs.

## When handlers run

1. **Initial page load.** As soon as `dist/main.js` (or `/viteflow/main.ts` in dev) executes, the router runs `dispatch(window.location.pathname)`. The global handler runs first, then the matched route handler.
2. **Hot module replacement (dev only).** When you save a file under `/src`, Vite re-imports the changed module. The router re-runs `dispatch` against the current URL. The global handler runs first, then the matched route handler.

Webflow uses traditional full-page navigation. Each link click triggers a complete page reload, which runs the bundle from scratch. There is no SPA-style client-side routing in viteflow itself.

## Idempotency matters in dev

Because HMR re-runs your handler without unloading the previous run, side effects can stack up:

```ts
// BAD — every save adds a duplicate listener
const handler: RouteHandler = () => {
	document.querySelector('button')?.addEventListener('click', onClick);
};
```

After 5 saves, the button has 5 listeners.

Make handlers idempotent. Three patterns:

### Pattern 1: Marker attribute

```ts
const handler: RouteHandler = () => {
	const button = document.querySelector('button');
	if (!button || button.dataset.bound === 'true') return;
	button.dataset.bound = 'true';
	button.addEventListener('click', onClick);
};
```

### Pattern 2: Replace the element

```ts
const handler: RouteHandler = () => {
	const button = document.querySelector<HTMLButtonElement>('button');
	if (!button) return;
	const fresh = button.cloneNode(true) as HTMLButtonElement;
	button.replaceWith(fresh);
	fresh.addEventListener('click', onClick);
};
```

### Pattern 3: Module-scoped cleanup

```ts
let cleanup: (() => void) | null = null;

const handler: RouteHandler = () => {
	cleanup?.();

	const button = document.querySelector('button');
	if (!button) return;

	button.addEventListener('click', onClick);
	cleanup = () => button.removeEventListener('click', onClick);
};

export default handler;
```

Pattern 3 is the most general. It also self-documents what each handler owns.

## Error handling

If your handler throws (sync) or rejects (async), viteflow:

1. Catches the error so other handlers and the page itself are unaffected.
2. Logs `[viteflow] handler error in <filePath> (<pattern>)` to the console.

You do **not** need to wrap your handler in try/catch unless you want custom error reporting:

```ts
const handler: RouteHandler = async () => {
	try {
		await loadStuff();
	} catch (err) {
		Sentry.captureException(err);
		throw err;
	}
};
```

The same applies to the global handler — its errors are caught separately and do not prevent route handlers from running.

## Importing shared utilities

You can `import` shared utilities, types, or constants from other files inside `/src`. Vite resolves them at build time.

The router scans `/src/**/*.ts` and treats every match as a route candidate. To keep utility files out of the route table, prefix the file or folder with an underscore (`_`):

```
src/
  global.ts
  index.ts
  blog/[slug].ts
  _lib/dom.ts          ← ignored by router, importable from anywhere
  _lib/fetcher.ts      ← same
  _utils.ts            ← single-file convention also works
```

Any path segment starting with `_` is skipped silently. No "no default export" warning.

Import them normally:

```ts
// src/blog/[slug].ts
import type { RouteHandler } from '../../viteflow/types';
import { fetchPost } from '../_lib/fetcher';
import { qs } from '../_lib/dom';

const handler: RouteHandler = async ({ params }) => {
	const post = await fetchPost(params.slug);
	qs('h1').textContent = post.title;
};

export default handler;
```

If you forget the `_` prefix and the file does not have a default-export function, the router logs:

```
[viteflow] /src/lib/fetcher.ts has no default export — skipped
```

That is harmless but noisy. Prefer the `_` convention.
