# viteflow

Lean Webflow custom-code dev server with HMR + source maps. Bun + Vite + TypeScript. Next.js-style file-based routing.

The dev server **proxies your Webflow staging site** through localhost and **auto-injects the localhost script tag** — no need to edit Webflow Custom Code while developing.

## Documentation

Full guides live in [`/docs`](./docs/README.md):

- [Getting Started](./docs/getting-started.md) — install and run your first dev session
- [Configuration](./docs/configuration.md) — `viteflow.config.ts` reference
- [Routing](./docs/routing.md) — file-based routing rules
- [Handlers](./docs/handlers.md) — handler signature, lifecycle, idempotency
- [Styles](./docs/styles.md) — CSS, Sass, PostCSS, Tailwind
- [Development](./docs/development.md) — proxy mechanics, HMR, debugging
- [Production](./docs/production.md) — building and deploying
- [Recipes](./docs/recipes.md) — GSAP, jQuery, forms, lazy loading, more
- [Troubleshooting](./docs/troubleshooting.md) — common errors and fixes
- [Architecture](./docs/architecture.md) — internals and customization
- [Scripts](./docs/scripts.md) — every `package.json` command

## Quickstart

```sh
bun create psoldunov/viteflow my-project
cd my-project
bun install
```

Edit `viteflow.config.ts`:

```ts
export default defineConfig({
	webflowStagingUrl: 'https://your-site.webflow.io',
});
```

Run dev:

```sh
bun dev
```

Browser opens `http://localhost:5173/` showing your Webflow staging site with localhost JS injected. Edits in `/src` hot-reload instantly. Source maps point at original `.ts` files.

## Routing snapshot

| File | URL |
|------|-----|
| `src/global.ts` | every page (runs first) |
| `src/index.ts` | `/` |
| `src/about.ts` | `/about` |
| `src/blog.ts` | `/blog` |
| `src/blog/[slug].ts` | `/blog/:slug` |
| `src/_lib/*.ts` | not routes — private utility files (underscore prefix) |

See [Routing](./docs/routing.md) for the full rules.

## Handler shape

```ts
import type { RouteHandler } from '../viteflow/types';

const handler: RouteHandler = ({ params, path }) => {
	// your DOM code, GSAP animations, event listeners, etc.
};

export default handler;
```

See [Handlers](./docs/handlers.md) for context object, async, error handling, and idempotency patterns.

## Build

```sh
bun run build
```

Single file `dist/main.js` (minified IIFE with embedded CSS) + `dist/main.js.map`. Paste into Webflow Custom Code or host on a CDN. See [Production](./docs/production.md).

## Layout

```
viteflow/                      # framework internals (don't edit)
  main.ts                      # bundle entry
  router.ts                    # match + dispatch
  types.ts                     # RouteHandler, RouteContext
  config.ts                    # ViteflowConfig + defineConfig
  plugin-webflow-proxy.ts      # Vite plugin: proxy + script injection
src/                           # your code
  global.ts                    # runs everywhere
  styles.css                   # bundled into dist/main.js
  index.ts                     # /
  about.ts                     # /about
  blog.ts                      # /blog
  blog/[slug].ts               # /blog/:slug
  _lib/                        # private utilities (underscore = ignored by router)
viteflow.config.ts             # your staging URL + dev options
vite.config.ts                 # Vite config (proxy + CSS inlining)
biome.json                     # linter + formatter
tsconfig.json                  # strict TS
package.json
docs/                          # full documentation
```

## License

MIT
