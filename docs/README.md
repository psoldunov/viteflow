# Viteflow Documentation

Reusable Bun + Vite template for building Webflow custom JavaScript with HMR, source maps, and production bundling.

## Table of Contents

1. [Getting Started](./getting-started.md) — install, configure, run your first dev session
2. [Configuration](./configuration.md) — `viteflow.config.ts` reference
3. [Routing](./routing.md) — file-based routing rules and conventions
4. [Handlers](./handlers.md) — handler signature, context object, async behavior
5. [Styles](./styles.md) — CSS imports, dev HMR, production inlining
6. [Development](./development.md) — how the proxy works, HMR behavior, debugging
7. [Production](./production.md) — building, shipping to Webflow, CDN hosting
8. [Recipes](./recipes.md) — patterns for GSAP, jQuery, IntersectionObserver, fetch, idempotency
9. [Troubleshooting](./troubleshooting.md) — common errors and fixes
10. [Architecture](./architecture.md) — internals, file layout, request flow
11. [Scripts](./scripts.md) — reference for every `package.json` script

## Quickstart

```sh
bun create github:USER/viteflow my-project
cd my-project
bun install
```

Edit `viteflow.config.ts`:

```ts
export default defineConfig({
	webflowStagingUrl: 'https://your-site.webflow.io',
});
```

Run:

```sh
bun dev
```

Browser opens `http://localhost:5173/`. You see your Webflow staging site with localhost JS injected. Edit any `/src` file, see changes instantly.

## What you get

- File-based routing for `window.location.pathname` (Next.js style)
- Hot module replacement on TypeScript and CSS edits
- Source maps in dev so console errors point at original `.ts` lines
- Single-file IIFE production bundle with embedded CSS
- Zero edits to your Webflow site during development
- Strict TypeScript + Biome linting + formatter out of the box

## Prerequisites

- [Bun](https://bun.sh) ≥ 1.0
- A Webflow site with a published staging URL (the free `*.webflow.io` URL works)
- Chrome or Firefox for development
