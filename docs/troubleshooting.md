# Troubleshooting

Common issues and how to fix them.

## "no route matched for /xyz" in console

Your `/src` directory does not contain a file that maps to `/xyz`.

- Add `src/xyz.ts` for a literal segment.
- Add `src/[slug].ts` if `xyz` is one of many dynamic values.
- Check the [Routing](./routing.md) conversion table to see how filenames map to URLs.

This is a warning, not an error. The page still renders.

## "Duplicate route" error at startup

You have two files that produce the same route pattern. The most common collision:

```
src/blog.ts
src/blog/index.ts
```

Both produce `/blog`. Delete one of them.

The error message names the conflicting files explicitly.

## Page loads but my code doesn't run

1. Open the browser DevTools console.
2. Look for `[viteflow:global] page loaded: ...`. If you don't see it:
   - Check that the script tag is in the page source. View source on `localhost:5173/...` and search for `data-viteflow`.
   - In production: confirm your `<script src="...">` URL returns 200 in the Network tab.
3. Look for module loading errors. If `/viteflow/main.ts` returns a 5xx, restart `bun dev`.
4. Look for syntax errors in your `/src` files. Vite compiles on demand and reports errors in the terminal.

## "Failed to fetch" or proxy timeout

The dev server can't reach `webflowStagingUrl`.

1. Open the URL in a browser yourself. Does the site load?
2. Check the URL for typos in `viteflow.config.ts`.
3. If you're on a corporate VPN, Webflow staging URLs may be blocked.
4. Webflow rarely rate-limits but if you're hammering it during dev (e.g. autosave loop), wait a minute and retry.

The terminal log shows the exact upstream error.

## Mixed content warning in Safari

Safari blocks HTTP localhost from being referenced in HTTPS pages. This affects users who paste a `localhost` script tag into a live HTTPS Webflow site.

Viteflow's standard flow flips this — you load `http://localhost:5173/` directly, which proxies the Webflow HTML. So mixed content is not an issue for normal viteflow use.

If you need HTTPS on `localhost`, install `@vitejs/plugin-basic-ssl`:

```sh
bun add -d @vitejs/plugin-basic-ssl
```

```ts
// vite.config.ts
import basicSsl from '@vitejs/plugin-basic-ssl';

export default defineConfig({
	plugins: [
		basicSsl(),
		// ... other plugins
	],
	server: {
		https: true,
		// ...
	},
});
```

You'll see a self-signed certificate warning the first time. Accept it.

## "Cannot find module 'node:http'" type error

Run:

```sh
bun add -d @types/node
```

Already included in the template. If you removed it, re-add.

## Bundle is huge

Check what you imported. Common culprits:

- Importing all of lodash: `import _ from 'lodash'` adds ~70KB. Use `import debounce from 'lodash.debounce'` for individual utilities, or write the few you need by hand.
- Including a large icon library when you only use a few icons.
- Importing fonts from npm packages (use Webflow's font loading instead).

Inspect what's in the bundle:

```sh
bunx vite build --mode production
```

Then look at `dist/main.js` directly, or use a tool like `source-map-explorer`:

```sh
bun add -d source-map-explorer
bunx source-map-explorer dist/main.js
```

## HMR re-runs my handler but old behavior persists

Your handler is not idempotent. Each save adds new event listeners on top of old ones, or duplicates DOM elements.

Use a cleanup pattern. See [Handlers → Idempotency](./handlers.md#idempotency-matters-in-dev) for three patterns.

## Forms in dev fail with "Method Not Allowed"

The proxy forwards GET and HEAD only. POST submissions get rejected by Vite's middleware.

Workaround:
- Test forms against the live Webflow URL (not via the proxy).
- Or temporarily intercept the form `submit` event in your handler so it never reaches the network in dev.

A future version may add POST proxying.

## Vite reports "port 5173 in use"

A previous dev server is still running. Find and kill it:

```sh
lsof -i :5173
kill <PID>
```

Or let Vite pick the next available port automatically (it does by default — check the banner for the actual port).

## TypeScript errors I didn't write

The template ships with strict TypeScript. If you see complaints about unused variables, unhandled error types, or implicit `any`:

- For unused parameters, prefix with `_`: `function handler(_unused) { ... }` (or remove them entirely).
- Always type your error catches: `catch (err) { const message = err instanceof Error ? err.message : String(err); ... }`.
- For implicit any in third-party libraries, install their `@types/*` package.

If you want to relax these, edit `tsconfig.json`. But strict mode catches real bugs — usually worth keeping.

## Biome complains about formatting on commit

Run the auto-fixer:

```sh
bun run check
```

This formats and lints in one pass. Add it to a pre-commit hook to never see this complaint again:

```sh
# .git/hooks/pre-commit
#!/bin/sh
bun run check
```

Make it executable: `chmod +x .git/hooks/pre-commit`.

## Webflow CSS sometimes "wins" over my custom CSS

Webflow styles are loaded first; your `<style>` tag injects later. So in a tie, your styles win.

But CSS specificity matters more than order. If Webflow uses `.w-button.has-modifier` (specificity 0,2,0) and you write `.cta-button` (0,1,0), Webflow wins.

Fixes:
- Use the same class as Webflow but with higher specificity: `body .cta-button`.
- Add `!important` (sparingly).
- Override at a parent: `.section .cta-button`.

## Production bundle works locally with `bun run preview` but not on Webflow

Things to check:

1. **Did you publish?** Saving Webflow Custom Code is not enough. Click **Publish** in the Designer.
2. **Right script tag?** Inline scripts go inside `<script>...</script>`. CDN-hosted scripts use `<script src="..." defer></script>`. Don't mix.
3. **Console errors?** Open DevTools on the live site and read the actual error.
4. **CORS?** If your script makes fetch calls, the API needs to allow requests from your Webflow domain.

## Where to ask for help

If none of the above fixes your issue:

1. Check the GitHub issues for the template.
2. File a new issue with: Bun version, OS, the contents of `viteflow.config.ts` (with secrets redacted), the terminal output, and the browser console output.
