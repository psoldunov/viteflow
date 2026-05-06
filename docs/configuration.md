# Configuration

The single source of project-level configuration is `viteflow.config.ts` at the project root.

## File location

```
your-project/
├── viteflow.config.ts    ← edit this
├── viteflow/             ← framework internals (do not edit)
└── src/                  ← your code
```

## The `defineConfig` helper

```ts
import { defineConfig } from './viteflow/config';

export default defineConfig({
	webflowStagingUrl: 'https://your-site.webflow.io',
	port: 5173,
	openOnDev: true,
});
```

`defineConfig` is a typed identity function. It exists so your editor gives you autocomplete and inline documentation for every option. You could equally well do:

```ts
import type { ViteflowConfig } from './viteflow/config';

const config: ViteflowConfig = { webflowStagingUrl: '...' };
export default config;
```

But `defineConfig` is shorter.

## Options reference

### `webflowStagingUrl` (required, `string`)

The full URL of your Webflow site. The dev server fetches HTML from this URL and rewrites it to inject your custom code.

```ts
webflowStagingUrl: 'https://your-site.webflow.io';
```

Acceptable formats:

- `https://your-site.webflow.io` (default Webflow staging)
- `https://your-site.webflow.io/` (trailing slash is fine)
- `https://staging.example.com` (custom Webflow-hosted staging domain)

The protocol must be `https://` or `http://`. The path component is ignored — the dev server uses just the origin.

### `port` (optional, `number`, default `5173`)

The local port the dev server listens on.

```ts
port: 3000;
```

If the port is taken, Vite auto-increments. So if `5173` is busy, you get `5174` and a log line about it.

### `deploy` (optional, `object`)

Settings for `bun run deploy`. **Most users should leave this empty and configure deploy via `.env.local` instead** (see [Production → Strategy C](./production.md#strategy-c-auto-deploy-via-the-webflow-api-bun-run-deploy)). The config block exists for shipping a viteflow template with committed defaults; env values always win over it.

```ts
deploy: {
	siteId: '6123abc...',
	customDomains: ['603343111111111111111111'],
}
```

#### `deploy.siteId` (optional, `string`)

Webflow Site ID. **Prefer `WEBFLOW_SITE_ID` in `.env.local`** — that's read first. Setting `deploy.siteId` here only makes sense as a committed default for a template repo.

#### `deploy.customDomains` (optional, `string[]`)

Custom domain IDs (not URLs) to publish to when running `bun run deploy --live`. **Prefer `WEBFLOW_CUSTOM_DOMAINS` in `.env.local`** (comma-separated). Look IDs up via:

```sh
curl -H "Authorization: Bearer $WEBFLOW_API_TOKEN" \
     https://api.webflow.com/v2/sites/$WEBFLOW_SITE_ID/custom_domains
```

The Webflow staging subdomain is always published — this list is for production domains only.

### `openOnDev` (optional, `boolean`, default `true`)

When `true`, `bun dev` opens your default browser at `http://localhost:PORT/` after the server boots.

Set to `false` if you prefer to open the browser manually, or if you are running in CI / a remote dev container.

```ts
openOnDev: false;
```

## Vite config

The standard Vite config lives at `vite.config.ts`. It reads `viteflow.config.ts` and wires up:

- The Webflow proxy plugin
- The CSS-in-JS injector plugin
- The dev server port and auto-open behavior
- The production build (single-file IIFE with sourcemap and embedded CSS)

You can edit `vite.config.ts` if you need to add Vite plugins (PostCSS, Sass loader, etc.). See [Styles](./styles.md) for examples.

## TypeScript config

`tsconfig.json` ships with strict defaults:

- `target: ES2022`
- `module: ESNext`
- `moduleResolution: bundler`
- `strict: true`
- `noUnusedLocals: true`
- `noUnusedParameters: true`
- `isolatedModules: true`
- DOM and Node typings included

Run a one-off type check:

```sh
bun run typecheck
```

## Linter / formatter (Biome)

Biome handles both formatting and linting. Configuration is in `biome.json`. Defaults:

- Tab indentation
- Single quotes for JS/TS
- Recommended lint rules
- Auto-organize imports on save

Run:

```sh
bun run lint     # lint only
bun run format   # format only
bun run check    # lint + format with auto-fix
```

To customize rules, edit `biome.json`. See [Biome's docs](https://biomejs.dev/reference/configuration/) for the full schema.

## Environment variables

Two purposes:

1. **Configure viteflow itself.** `.env.local` is the recommended primary source — `viteflow.config.ts` is a fallback for committed defaults (useful when shipping a template). Env values always win.
2. **Inject build-time constants into client code** via Vite's standard `import.meta.env`.

### Configure via `.env.local`

Create `.env.local` at the project root (gitignored). Set whichever of these you need:

```
# Dev server:
WEBFLOW_STAGING_URL=https://my-other-staging.webflow.io
PORT=4000

# Auto-deploy (`bun run deploy`):
WEBFLOW_API_TOKEN=wfpat_...
WEBFLOW_SITE_ID=6123abc...
WEBFLOW_CUSTOM_DOMAINS=domain-id-1,domain-id-2   # only needed for --live
```

Precedence is always **env > config file**. Pairings:

| Setting | Env var | `viteflow.config.ts` field |
|---|---|---|
| Webflow staging URL | `WEBFLOW_STAGING_URL` | `webflowStagingUrl` |
| Dev server port | `PORT` | `port` |
| Webflow Site ID (for deploy) | `WEBFLOW_SITE_ID` | `deploy.siteId` |
| Custom domain IDs (for `--live`) | `WEBFLOW_CUSTOM_DOMAINS` (comma-separated) | `deploy.customDomains` |
| Webflow API token | `WEBFLOW_API_TOKEN` | *(env-only — never lives in the config file)* |

`openOnDev` is config-only.

`WEBFLOW_API_TOKEN` is read **only** by `viteflow/deploy.ts` — never by Vite or by your `/src` code — so it can't end up in `dist/main.js`.

Supported env files (Vite convention, picked up automatically):

| File | Loaded for | Tracked in git? |
|------|-----------|-----------------|
| `.env` | All modes | Yes (typically) |
| `.env.local` | All modes | **No** (gitignored) |
| `.env.development` | `bun dev` | Yes |
| `.env.development.local` | `bun dev` | **No** |
| `.env.production` | `bun run build` | Yes |
| `.env.production.local` | `bun run build` | **No** |
| `.env.example` | Reference template | Yes |

`.env.example` ships with the template documenting all supported variables. Copy it to `.env.local` to use:

```sh
cp .env.example .env.local
```

### Client-side variables

To expose a variable to your `/src` code, prefix with `VITE_`:

```
VITE_API_URL=https://api.example.com
```

```ts
// in any /src file
const apiUrl = import.meta.env.VITE_API_URL;
```

These are inlined at build time — they end up in `dist/main.js` as plain string literals. **Never put secrets in `VITE_*` variables** — anyone with the bundle can read them.

For secrets used by your handlers (API tokens, etc.), accept that they are visible in the bundle and treat them as public. If you need true secrets, your handlers should call your own backend, which holds the secrets server-side.
