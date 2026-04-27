# Development

This page explains how the dev server works, what you can do with it, and how to debug when something is off.

## The dev server in one paragraph

`bun dev` starts Vite. A custom Vite plugin (`viteflow/plugin-webflow-proxy.ts`) adds catch-all middleware that:

1. Lets Vite handle requests it knows about (your TS modules, the HMR client, source maps).
2. For everything else, fetches the same path from `webflowStagingUrl`, returns it. If the response is HTML, it injects the Vite HMR client and a `<script type="module" src="/viteflow/main.ts" data-viteflow></script>` tag before `</body>`.

You navigate around `http://localhost:5173/` exactly as if it were your live Webflow site. Your `/src` code runs on top of it. Edits hot-reload.

## Request flow

```
Browser                Dev server                     Webflow staging
   │                       │                                │
   │  GET /blog/hello      │                                │
   │──────────────────────▶│                                │
   │                       │  Vite middleware: not a known  │
   │                       │  asset → next()                │
   │                       │                                │
   │                       │  Proxy plugin:                 │
   │                       │  GET /blog/hello               │
   │                       │───────────────────────────────▶│
   │                       │                                │
   │                       │◀───────────────────────────────│
   │                       │   200 OK, text/html            │
   │                       │                                │
   │                       │  injectScript(html)            │
   │                       │  transformIndexHtml(html)      │
   │  200 OK, text/html    │                                │
   │◀──────────────────────│                                │
   │                       │                                │
   │  GET /viteflow/main.ts│                                │
   │──────────────────────▶│                                │
   │                       │  Vite serves transformed TS    │
   │  200 OK, text/javascript                               │
   │◀──────────────────────│                                │
   │                       │                                │
   │  GET /css/site.css    │                                │
   │──────────────────────▶│                                │
   │                       │  Vite: no match → next()       │
   │                       │  Proxy: GET /css/site.css      │
   │                       │───────────────────────────────▶│
   │                       │◀───────────────────────────────│
   │  200 OK, text/css     │                                │
   │◀──────────────────────│                                │
```

## What gets proxied

Anything Vite cannot serve from your local source tree:

- HTML pages from your Webflow site
- CDN-hosted assets that Webflow references with absolute paths (`/css/site.css`, `/images/...`)
- Form actions (Webflow forms POST to absolute paths)

What does **not** get proxied (Vite handles directly):

- `/viteflow/main.ts` — your bundle entry, transformed on the fly
- `/src/**/*.ts` — your route modules
- `/@vite/client` — Vite's HMR client script
- `/@id/*`, `/@fs/*`, `/node_modules/.vite/*` — Vite internals
- `/src/**/*.css` — your stylesheets, served + HMR by Vite

## Hot module replacement

When you save a file under `/src`:

1. Vite detects the file change.
2. Vite re-imports the changed module and any modules that imported it.
3. The router's `import.meta.glob` is reactive — it picks up new files, deleted files, and changed files.
4. The bundle entry (`viteflow/main.ts`) declared `import.meta.hot.accept('./router', ...)`, so when the router updates, viteflow re-runs `dispatch(window.location.pathname)`.

Net effect: the global handler runs again, then the matched route handler runs again, **on the live page**. No reload.

For CSS, Vite injects a fresh `<style>` tag inline. Old `<style>` tags get replaced. You see the new styles immediately.

### When HMR triggers a full reload

A full page reload happens when:

- You add or remove a route file (the router rebuilds, but the new module graph requires a reload to pick up new imports cleanly).
- You change `viteflow.config.ts` or `vite.config.ts` (the config is part of Vite's setup, not the runtime).
- A handler crashes during HMR re-dispatch in a way that breaks subsequent re-runs.

You'll see a console message from Vite when this happens.

## Console output

The dev server writes to **two places**:

### Terminal (server-side)

- Vite startup banner with the local URL
- Build / HMR notifications
- Proxy fetch errors (e.g. if your `webflowStagingUrl` is unreachable)

### Browser console (client-side)

- `[viteflow:global]` and `[viteflow:<route>]` logs from your handlers
- `[viteflow] no route matched for /xyz` warnings
- `[viteflow] handler error in /src/foo.ts (/foo)` errors
- `[vite] hot updated: /src/foo.ts` notifications from Vite's HMR

Open DevTools → Console to see them.

## Source maps

Inline source maps are enabled in dev. When your handler throws, the stack trace points at the original `.ts` file and line number, not the compiled output.

In production, source maps are emitted as a separate `dist/main.js.map` file. You decide whether to ship it (helpful for error tracking) or strip it (smaller transfer).

## Forms and external links

When the user submits a Webflow form, the form posts to `http://localhost:5173/...`. The proxy forwards GET and HEAD requests to Webflow but **not POST**. Form submissions in dev will fail with `Method Not Allowed` from Vite's middleware.

Workaround: temporarily disable form behavior in dev, or test form submissions against the live Webflow URL outside the proxy.

External links (anchors with absolute `https://...` URLs) work normally — they just navigate the browser away from `localhost`.

## CMS-driven URLs

Webflow CMS pages (collection pages) typically have URLs like `/blog/{slug}`. To handle them in viteflow:

```
src/blog/[slug].ts        ← matches every CMS post
```

Visit `http://localhost:5173/blog/any-real-slug`. The proxy fetches the post HTML from Webflow, your handler runs with `params.slug = 'any-real-slug'`.

If the slug doesn't exist in the CMS, Webflow returns a 404 page. The proxy passes that through — you see the 404, your handler still runs (the URL still matches `/blog/[slug]`).

If you want different behavior for unknown slugs, check `document.title` or a known DOM marker inside your handler.

## Debugging the proxy

If pages don't load:

1. **Check `webflowStagingUrl`.** Open it in your browser directly — does the site load?
2. **Check the terminal log.** Look for `[viteflow] proxy fetch failed for /xyz: ...`. Common causes:
   - Wrong staging URL (typo, wrong subdomain)
   - Network blocked (corporate firewall, VPN issue)
   - Webflow rate-limiting (rare)
3. **Check the browser network tab.** What status code did `localhost:5173/...` return? If 5xx, look at the response body for the upstream error.
4. **Curl the proxy directly:**

```sh
curl -i -H "Accept: text/html" http://localhost:5173/
```

Should return Webflow HTML with `data-viteflow` script tag injected.

## Mixed content (HTTPS staging vs HTTP localhost)

The dev server is HTTP. Your Webflow staging URL is HTTPS. When the browser loads `http://localhost:5173/` and the page references `https://cdn.prod.website-files.com/...` assets, it works fine — the proxy serves localhost HTTP, but resources can be HTTPS.

You will not run into mixed-content blocks in this direction. Mixed-content blocks only matter if you load the live HTTPS Webflow page and have it reference an HTTP localhost script — which **is not** the viteflow flow. Viteflow flips it: the localhost page is the "outer" page.

## Stopping the dev server

Ctrl+C in the terminal. If you started it with `nohup` or in the background, find the PID with `lsof -i :5173` and `kill PID`.
