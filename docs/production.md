# Production

How to take what you built locally and ship it to your Webflow site.

## Build

```sh
bun run build
```

This runs `vite build` and produces:

```
dist/
├── main.js          # minified IIFE bundle, single file, contains everything
└── main.js.map      # source map
```

Defaults:

- **Format**: IIFE (immediately-invoked function expression). Safe to drop into any HTML, no module loader needed.
- **Minified**: Yes (esbuild minifier).
- **Sourcemap**: Yes, separate file.
- **CSS**: Embedded — `vite-plugin-css-injected-by-js` inlines all your stylesheets and injects them as a `<style>` tag at runtime. No separate `.css` to ship.
- **Dependencies**: Bundled. Any library you import in `/src` (jQuery, GSAP, Swiper, etc.) becomes part of `main.js`.

A typical bundle is a few KB if you write vanilla DOM code, or 100–300 KB if you bring GSAP and similar libraries.

## Three deployment strategies

You have three choices for shipping `dist/main.js` to your Webflow site.

### Strategy A: Paste inline into Webflow Custom Code (simplest)

Best for: small bundles (<10KB), zero infrastructure, easy rollback.

1. Run `bun run build`.
2. Open `dist/main.js` in your editor.
3. Copy the entire contents.
4. In Webflow, go to **Project Settings → Custom Code → Footer Code**.
5. Paste, wrapped in a `<script>` tag:

```html
<script>
/* paste contents of dist/main.js here */
</script>
```

6. Click **Save Changes** at the top.
7. **Publish** your site (Designer → top right → Publish).

Trade-offs:
- Fastest to ship, no extra hosting.
- Updates require a re-paste and re-publish.
- The bundle counts toward Webflow's 10,000-character limit on Project-level Custom Code. Inline scripts in page-level Custom Code have a smaller per-page limit (~10KB).

If your bundle exceeds the limit, use Strategy B.

### Strategy B: Host on a CDN, reference by URL

Best for: bundles over a few KB, frequent updates, sites where you control deploys.

Pick any static host:

- **GitHub Pages** + a release tag
- **Cloudflare Pages**
- **Vercel** (`bunx vercel deploy`)
- **Netlify** (`netlify deploy --prod`)
- **AWS S3 + CloudFront**
- **jsDelivr** (auto-CDN for any GitHub release)

Upload `dist/main.js` to the host. Get a public URL like:

```
https://cdn.example.com/my-project/main.js
```

In Webflow Custom Code → Footer Code, reference it:

```html
<script src="https://cdn.example.com/my-project/main.js" defer></script>
```

Publish. Done.

To update: rebuild, upload the new `main.js` (overwrite or version it), and the next page load picks it up. Use cache-busting via query string or content-hashed filenames if you cache aggressively.

### Strategy C: Auto-deploy via the Webflow API (`bun run deploy`)

Best for: hands-off deploys, CI pipelines, anyone who'd rather not paste code.

`bun run deploy` builds the bundle, uploads it to Webflow as a site asset, registers it as a hosted custom-code script applied to the footer (just before `</body>`), and publishes the site. Re-running it replaces the previous viteflow script and wipes the old asset — no duplicates, no manual cleanup.

**Setup:**

1. Create an API token in Webflow: **Site Settings → Apps & Integrations → API access**. Grant scopes:
   - `custom_code:write`
   - `assets:write`
   - `sites:write`
2. Find your **Site ID** at **Site Settings → General → Site ID**.
3. Copy `.env.example` to `.env.local` and set:

   ```
   WEBFLOW_API_TOKEN=wfpat_...
   ```

4. Set `deploy.siteId` in `viteflow.config.ts` (or set `WEBFLOW_SITE_ID` in `.env.local` to override per-developer):

   ```ts
   export default defineConfig({
   	webflowStagingUrl: 'https://your-site.webflow.io',
   	deploy: {
   		siteId: '6123abc...',
   	},
   });
   ```

**Run:**

```sh
bun run deploy            # build, upload, apply, publish to staging subdomain
bun run deploy --no-publish   # apply without publishing (preview in Webflow Designer)
bun run deploy --live     # also publish to deploy.customDomains
```

**How it works (and the one caveat):**

- The bundle is uploaded as `viteflow-bundle-<timestamp>.js.txt`. Webflow's Assets API doesn't accept raw `.js`, but it accepts `.txt`. Browsers run `<script src="...txt">` tags fine because classic scripts don't strictly enforce JS MIME — but if Webflow's CDN ever starts sending `X-Content-Type-Options: nosniff` with `text/plain` for assets, this will stop working. Today (2026), it works reliably.
- viteflow tags the registered script with `displayName: "viteflow-bundle"`. On every deploy it lists registered scripts, removes any with that name, and only the new one is applied. Other scripts you've applied via the Webflow UI or other integrations are preserved.
- The API has a publish rate limit of **1 per minute**. Back-to-back `bun run deploy` calls within a minute will succeed up to the apply step but fail at publish; just wait a minute and re-run, or use `--no-publish` then publish manually.
- Each deploy creates a fresh asset URL with a fresh SRI hash. Webflow's CDN edge cache is bypassed, so changes show up on the next page load (no `?v=` cache-bust needed).

**To get custom domain IDs** (for `deploy.customDomains`):

```sh
curl -H "Authorization: Bearer $WEBFLOW_API_TOKEN" \
     https://api.webflow.com/v2/sites/$WEBFLOW_SITE_ID/custom_domains
```

Copy each domain `id` (not the URL) into the array.

#### Cache-busting

If your CDN sets long `Cache-Control: max-age` headers, change the script URL each release:

```html
<script src="https://cdn.example.com/my-project/main.js?v=2026-04-27" defer></script>
```

Or have your CI rename files: `main.abc123.js`, and update the script tag automatically. (Beyond the scope of this template.)

## A note on `defer` vs `async`

The injected dev tag uses `type="module"`, which is implicitly deferred. For production:

- **`defer`** (recommended): script downloads in parallel, runs after HTML parsing completes. Predictable order, minimal blocking.
- **`async`**: script downloads in parallel, runs as soon as ready. Order is not guaranteed.
- **No attribute**: script blocks HTML parsing. Don't.

Webflow places its own scripts (`webflow.js`, jQuery if enabled) before `</body>`. Your script after them, with `defer`, gives you access to a fully parsed DOM and Webflow's runtime.

## Preview a production build locally

```sh
bun run preview
```

This runs `vite preview` against `dist/`. Vite serves the built file at `http://localhost:4173/` so you can confirm the bundle works in isolation before deploying.

To preview with the Webflow page wrapped, your easiest option is to deploy and check on staging.

## Source maps in production

`bun run build` always emits `dist/main.js.map`. You have three choices:

1. **Ship it.** Browsers won't fetch it unless DevTools is open, so there's no overhead for end users. Useful for debugging production issues.
2. **Strip it.** Edit `vite.config.ts` and set `build.sourcemap: false`. Smaller `dist/`, no source visible to end users.
3. **Upload to error tracker.** If you use Sentry, BugSnag, or similar, upload the map there and strip from production. Errors get readable stack traces in your dashboard, but the source isn't exposed publicly.

## Continuous deployment

If your `/src` lives in git, automate `bun run build` on push:

### GitHub Actions example

```yaml
# .github/workflows/build.yml
name: Build viteflow bundle

on:
  push:
    branches: [main]

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v2
      - run: bun install --frozen-lockfile
      - run: bun run build
      - run: bun run typecheck
      - run: bun run lint
      - uses: actions/upload-artifact@v4
        with:
          name: main-bundle
          path: dist/
```

Add a deploy step that uploads `dist/main.js` to your CDN of choice.

## Rolling back

Both deployment strategies support rollback:

- **Strategy A**: re-paste a previous version and re-publish. Webflow keeps a publish history under **Project Settings → Backups**.
- **Strategy B**: revert to a previous file on your CDN, or change the script tag URL back to a prior version.

Always tag releases (`git tag v1.2.3`) so you can build any past version with `git checkout v1.2.3 && bun run build`.

## Verifying a deploy

After publishing, on the live site:

1. Open DevTools → Network tab.
2. Reload the page.
3. Confirm `main.js` (your script) loads with status 200 and the expected file size.
4. Check Console for `[viteflow:global] page loaded: /...` messages. If you see them, your code is running.

If you don't see those logs but you do see your script in Network, check that the `<script>` tag is in the **published** HTML — view source on the live page.
