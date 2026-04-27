# Architecture

How viteflow works under the hood. Skip this unless you're customizing the framework or debugging it.

## File layout

```
your-project/
├── viteflow/                       # framework internals
│   ├── main.ts                     # bundle entry, served at /viteflow/main.ts in dev
│   ├── router.ts                   # file-based router
│   ├── types.ts                    # public types (RouteHandler, RouteContext)
│   ├── config.ts                   # ViteflowConfig type + defineConfig helper
│   └── plugin-webflow-proxy.ts     # Vite plugin: HTML proxy + script injection
├── src/                            # your code
│   ├── global.ts                   # runs on every page
│   ├── styles.css                  # imported by global.ts → embedded in bundle
│   ├── index.ts                    # /
│   ├── about.ts                    # /about
│   ├── blog.ts                     # /blog
│   ├── blog/
│   │   └── [slug].ts               # /blog/:slug
│   └── _lib/                       # private utilities (not routes; underscore prefix)
├── viteflow.config.ts              # your config: webflowStagingUrl, port, openOnDev
├── vite.config.ts                  # Vite config (proxy plugin, CSS injector, build options)
├── tsconfig.json                   # strict TypeScript
├── biome.json                      # linter + formatter config
├── package.json                    # dependencies + scripts
└── dist/                           # build output (gitignored)
    ├── main.js
    └── main.js.map
```

## Bundle entry: `viteflow/main.ts`

```ts
import { dispatch } from './router';

dispatch(window.location.pathname);

if (import.meta.hot) {
	import.meta.hot.accept('./router', (newMod) => {
		if (newMod && typeof newMod.dispatch === 'function') {
			newMod.dispatch(window.location.pathname);
		}
	});
}
```

Three responsibilities:

1. Import the router.
2. Run `dispatch` on initial page load.
3. Re-run `dispatch` when the router module hot-updates (HMR only — `import.meta.hot` is `undefined` in production).

This is the only file the user's HTML loads. Everything else is reachable transitively.

## Router: `viteflow/router.ts`

### Discovery

```ts
const modules = import.meta.glob<RouteModule>('/src/**/*.ts', { eager: true });
```

Vite resolves this glob at build time:
- In **dev**, returns a map of file paths to lazily-evaluated modules. With `{ eager: true }` they're imported immediately so the router has all handlers up front.
- In **prod**, the glob is statically replaced with an inline map of imports, all bundled into `dist/main.js`.

### Filtering

For each entry:
1. If `filePath === '/src/global.ts'`, store its default export as the global handler. Skip route-table entry.
2. If any path segment starts with `_`, skip silently (private utility).
3. If the module has no default function export, skip with a console warning.
4. Otherwise, convert the file path to a route pattern and add to the route table.

### Path → pattern conversion

```
/src/index.ts             →  /
/src/about.ts             →  /about
/src/blog.ts              →  /blog
/src/blog/index.ts        →  /blog
/src/blog/[slug].ts       →  /blog/:slug
/src/[a]/[b]/[c].ts       →  /:a/:b/:c
```

Algorithm:
1. Strip leading `/src` and trailing `.ts`.
2. If ends with `/index`, strip `/index`.
3. If empty, set to `/`.
4. Replace `[name]` with `:name`.

Each pattern is compiled to a regex with capture groups for params:

```
/blog/:slug    →  /^\/blog\/([^/]+)\/?$/
```

### Sort by specificity

Routes are sorted before dispatch so the most specific route always matches first:

1. Higher literal-segment count wins.
2. Within the same literal count, fewer params wins (tiebreaker).

This means `/users/me` is matched before `/users/:id` for the URL `/users/me`.

### Dispatch

```ts
async function dispatch(rawPath: string): Promise<void> {
	const path = normalize(rawPath);
	if (globalHandler) {
		try { await globalHandler({ params: {}, path }); }
		catch (err) { console.error('[viteflow] global handler error', err); }
	}
	for (const route of routes) {
		const match = route.regex.exec(path);
		if (!match) continue;
		const params = extractParams(route.paramNames, match);
		try { await route.handler({ params, path }); }
		catch (err) { console.error(`[viteflow] handler error in ${route.filePath}`, err); }
		return;
	}
	console.warn('[viteflow] no route matched for', path);
}
```

- Trailing slashes normalized away (except for `/`).
- Global handler runs first, errors caught.
- First matching route wins (because sorted by specificity).
- Handler errors caught so they don't break subsequent runs.

## Vite plugin: `viteflow/plugin-webflow-proxy.ts`

A Vite plugin that adds catch-all middleware to the dev server. Two layers:

### Layer 1: Vite's built-in middleware

Serves anything in your source tree:
- `/viteflow/main.ts` (transpiled to JS on the fly)
- `/src/**/*.ts` (transpiled)
- `/src/**/*.css` (extracted, served, HMR-tracked)
- `/@vite/client` (HMR client)
- `/@id/*`, `/@fs/*`, `/node_modules/.vite/*` (Vite internals)

These are handled before our custom middleware sees the request.

### Layer 2: Our middleware (registered post-Vite)

The plugin returns a function from `configureServer`, which Vite calls **after** all internal middleware is registered. This puts our handler at the end of the chain — only requests Vite could not serve reach us.

For each unhandled request:
1. Skip if not GET or HEAD (POST goes through Vite's normal flow, which will 405 it).
2. Build upstream URL: `webflowStagingUrl` + `req.url`.
3. Fetch from upstream with `User-Agent: viteflow-dev`.
4. Inspect the response:
   - If the client accepts HTML or the response Content-Type is HTML → call `proxyHtml`.
   - Otherwise → call `proxyAsset`.

#### `proxyHtml`

```ts
let html = await upstream.text();
html = injectScript(html);              // strip prior viteflow tag, inject new one
html = await server.transformIndexHtml(reqUrl, html);  // Vite injects /@vite/client
res.setHeader('Content-Type', 'text/html; charset=utf-8');
res.end(html);
```

`injectScript` is idempotent: it removes any existing `<script ... data-viteflow ...>` tag before adding a new one. Safe to re-run on every request.

`transformIndexHtml` is Vite's standard hook that adds the HMR client script and applies any `transformIndexHtml` plugin hooks.

#### `proxyAsset`

Streams the upstream body to the client, copying response headers (excluding hop-by-hop ones like `Content-Length` and `Content-Encoding` since the body is re-encoded).

## Vite config: `vite.config.ts`

```ts
export default defineConfig({
	plugins: [
		pluginWebflowProxy(viteflowConfig),
		cssInjectedByJsPlugin({ topExecutionPriority: false }),
	],
	appType: 'custom',
	server: { port, host: 'localhost', open },
	build: {
		lib: {
			entry: 'viteflow/main.ts',
			formats: ['iife'],
			name: 'Viteflow',
			fileName: () => 'main.js',
		},
		sourcemap: true,
		outDir: 'dist',
		emptyOutDir: true,
	},
});
```

Key bits:

- **`appType: 'custom'`**: tells Vite not to apply its default HTML serving / SPA fallback. We control non-asset URLs entirely via our middleware.
- **`build.lib`**: produces a library-style bundle. `formats: ['iife']` makes it self-contained and safe to drop into any HTML. `name: 'Viteflow'` names the global the IIFE attaches to (we don't actually use it, but lib mode requires it).
- **`fileName: () => 'main.js'`**: forces the output filename regardless of format.
- **`cssInjectedByJsPlugin`**: bridges the gap between Vite's lib mode (which would normally emit a separate `.css` file) and our goal of single-file output.

## Build pipeline

`bun run build` → `vite build`:

1. Vite walks the import graph from `viteflow/main.ts`.
2. `import.meta.glob('/src/**/*.ts', { eager: true })` is statically replaced with inline imports of every matching file. Every route module is now part of the graph.
3. CSS imports are extracted, bundled, and handed to `cssInjectedByJsPlugin` which converts them to a `<style>` tag injection.
4. esbuild minifies the JS.
5. Output: `dist/main.js` (IIFE, ~3KB+) and `dist/main.js.map` (sourcemap).

## Why these choices

### Why Vite, not webpack / esbuild / rollup directly?

- Vite gives us native HMR for both JS and CSS for free.
- Vite's plugin system is tiny and well-documented.
- `import.meta.glob` is the killer feature — file-based routing without a custom build step.
- esbuild is the underlying minifier already.

### Why IIFE, not ESM?

- IIFE works in any HTML context, including plain `<script>` tags. ESM requires `<script type="module">`, which is fine, but adds friction when pasting into Webflow Custom Code (some users hit issues with module scripts and Webflow's interactions).
- IIFE bundles inline all imports into a single self-executing function. Perfect for "one file you can paste anywhere."

### Why proxy, not a static dev preview?

The proxy approach means you develop **against your real Webflow design**, with all interactions, animations, and CMS data live. No mocking. No drift. When you publish, the only difference is the script source (localhost → CDN/inline).

### Why no Express?

The original viteflow used Express. We use Vite's built-in `connect`-based middleware (which Express extends). Same API, fewer dependencies.

### Why Bun?

- Faster install (`bun install` is 2-3x faster than `npm install`).
- Single binary to run JS / TS / package management without separate tooling.
- Bun-flavored `bun create github:...` scaffolding is the simplest distribution mechanism we could think of.
- No Bun-specific runtime APIs are used in the bundle (it runs in browsers), so projects can swap to Node or Deno locally if they need to.

## Extending the template

Common customizations:

| Goal | Where to edit |
|------|---------------|
| Add a Vite plugin (Sass, PostCSS, Tailwind) | `vite.config.ts`, in the `plugins` array |
| Change the dev port | `viteflow.config.ts`, `port` field |
| Change the script tag injection point | `viteflow/plugin-webflow-proxy.ts`, `INJECTED_TAG` and `injectScript` |
| Add catch-all routes | `viteflow/router.ts`, extend `fileToPattern` and `compile` |
| Add per-route cleanup | `viteflow/router.ts` `dispatch` — invoke `handler.cleanup` between dispatches |
| Add HTTPS dev | `vite.config.ts` + `@vitejs/plugin-basic-ssl` |
| Add OAuth / auth headers to proxy | `viteflow/plugin-webflow-proxy.ts`, the `fetch` call |
