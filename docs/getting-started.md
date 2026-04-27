# Getting Started

This guide takes you from zero to a running dev server with hot reload against your Webflow site.

## Prerequisites

| Tool | Version | Notes |
|------|---------|-------|
| [Bun](https://bun.sh) | ≥ 1.0 | Used as runtime, package manager, and CLI |
| Webflow site | Any plan | The free staging URL (`*.webflow.io`) is enough |
| Browser | Chrome or Firefox | Both grant `localhost` a mixed-content exception. Safari blocks it |

Check your Bun install:

```sh
bun --version
```

## 1. Scaffold a project

```sh
bun create github:USER/viteflow my-project
cd my-project
```

(Replace `USER/viteflow` with the GitHub repo path of your fork or the published template.)

This copies the template into `my-project/` and you can run `bun install` to pull dependencies:

```sh
bun install
```

You will see `vite`, `typescript`, `@types/node`, `@biomejs/biome`, and `vite-plugin-css-injected-by-js` installed.

## 2. Point at your Webflow staging site

Open `viteflow.config.ts`:

```ts
import { defineConfig } from './viteflow/config';

export default defineConfig({
	webflowStagingUrl: 'https://your-site.webflow.io',
	port: 5173,
	openOnDev: true,
});
```

Replace `https://your-site.webflow.io` with the URL Webflow gives you under **Project Settings → Site Details → Subdomain**. Trailing slash is optional.

If your site uses a custom staging domain (Webflow-hosted), use that instead.

## 3. Run the dev server

```sh
bun dev
```

You should see:

```
  VITE v6.4.2  ready in 158 ms

  ➜  Local:   http://localhost:5173/
```

If `openOnDev` is `true`, your browser opens `http://localhost:5173/`. The page renders **your Webflow staging site**, but the dev server has injected:

1. The Vite HMR client (so it can push updates to your browser)
2. A `<script type="module" src="/viteflow/main.ts" data-viteflow></script>` tag right before `</body>` that loads your custom code

You do **not** need to add anything to your Webflow project's Custom Code during development. The proxy handles everything.

## 4. Make your first edit

Open `src/global.ts` and add a line:

```ts
import type { RouteHandler } from '../viteflow/types';
import './styles.css';

const handler: RouteHandler = ({ path }) => {
	console.log('[viteflow:global] page loaded:', path);
	console.log('hello from viteflow!');
};

export default handler;
```

Save. Your browser updates instantly without a full page reload — the router re-runs, and your new `console.log` fires.

Open the browser DevTools console. You will see logs from `global.ts` and the matched route file.

## 5. Add a route

Webflow has a `/about` page? Create `src/about.ts`:

```ts
import type { RouteHandler } from '../viteflow/types';

const handler: RouteHandler = () => {
	const headings = document.querySelectorAll('h2');
	headings.forEach((h) => {
		h.style.color = 'red';
	});
};

export default handler;
```

Navigate to `http://localhost:5173/about`. The proxy fetches your Webflow `/about` page, your handler runs, all `<h2>` elements turn red.

## 6. Add a dynamic route

Webflow CMS produces URLs like `/blog/some-post-slug`. Create `src/blog/[slug].ts`:

```ts
import type { RouteHandler } from '../../viteflow/types';

const handler: RouteHandler = ({ params }) => {
	console.log('current post slug:', params.slug);
};

export default handler;
```

Visit `http://localhost:5173/blog/anything`. The handler logs `anything`.

## 7. Build for production

When you are ready to ship:

```sh
bun run build
```

This produces:

```
dist/main.js       # minified IIFE, contains everything (TS + CSS)
dist/main.js.map   # source map
```

Take the contents of `dist/main.js`, wrap in a `<script>` tag, and paste into Webflow Project Settings → Custom Code → Footer Code. Or host `main.js` on a CDN and reference it.

See [Production](./production.md) for full deploy details.

## Next steps

- Read [Routing](./routing.md) for the full filename → URL mapping rules
- Read [Handlers](./handlers.md) for the handler signature and lifecycle
- Read [Styles](./styles.md) for CSS, Sass, and PostCSS support
- Browse [Recipes](./recipes.md) for common third-party library integrations
