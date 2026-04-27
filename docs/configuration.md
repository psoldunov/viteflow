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

Viteflow does not require any environment variables for normal use. If you need to read environment variables in your `/src` code, use Vite's standard `import.meta.env` mechanism:

1. Create a `.env.local` file at the project root (gitignored by default — `.gitignore` ignores `*.log` but you should add `.env*` if you commit secrets to a public repo).
2. Prefix variables with `VITE_` to expose them to client code: `VITE_API_URL=https://api.example.com`
3. Read in `/src`:

```ts
const apiUrl = import.meta.env.VITE_API_URL;
```

These are inlined at build time — never put secrets in `VITE_*` variables, because they end up in `dist/main.js` plain text.
