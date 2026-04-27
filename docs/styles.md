# Styles

Viteflow ships with full CSS support: import styles from any TypeScript file, get HMR in dev, and end up with a single self-contained `dist/main.js` in production.

## Plain CSS

Create a `.css` file under `/src` and import it from a TypeScript file:

```css
/* src/styles.css */
:root {
	--accent: #ff5722;
}

.cta-button {
	background: var(--accent);
	color: white;
	transition: transform 200ms ease;
}

.cta-button:hover {
	transform: translateY(-2px);
}
```

```ts
// src/global.ts
import './styles.css';
```

The CSS now applies on every page (because `global.ts` runs everywhere).

## Per-route CSS

You can scope CSS to a single route by importing it from that route's handler:

```ts
// src/checkout.ts
import type { RouteHandler } from '../viteflow/types';
import './_styles/checkout.css';

const handler: RouteHandler = () => {
	// ...
};

export default handler;
```

In production the bundle still has all CSS embedded — it is just included when the matching JS module is included. With `inlineDynamicImports: true` (Vite's lib mode default), every CSS import ends up in the same `<style>` tag.

The naming `_styles/` uses the underscore convention so it is not scanned as a route. See [Handlers → Importing shared utilities](./handlers.md#importing-shared-utilities).

## How it works

### Dev

Vite handles CSS natively. When you import `./styles.css` from `global.ts`, the dev server:

1. Transforms the import into a JS module that injects a `<style>` tag.
2. Wires HMR so saved CSS edits update the page **without a reload**. You see the new styles in milliseconds.

### Production

The Vite plugin [`vite-plugin-css-injected-by-js`](https://github.com/marco-prontera/vite-plugin-css-injected-by-js) (configured in `vite.config.ts`) takes the extracted CSS and inlines it into a runtime `<style>` injection inside `dist/main.js`.

Result: **one file**, no separate `.css` for you to host or paste. When the bundle runs in the browser, it appends a `<style>` tag to `<head>` containing all your CSS.

## Sass

Vite supports Sass out of the box if you install the preprocessor:

```sh
bun add -d sass
```

Now you can import `.scss` files:

```scss
// src/styles.scss
$accent: #ff5722;

.cta-button {
	background: $accent;
}
```

```ts
import './styles.scss';
```

No additional Vite config needed.

## PostCSS

Vite also auto-detects PostCSS. Add a `postcss.config.js` at the project root and Vite picks it up:

```js
// postcss.config.js
export default {
	plugins: {
		autoprefixer: {},
		'postcss-preset-env': { stage: 2 },
	},
};
```

Install whichever PostCSS plugins you need:

```sh
bun add -d autoprefixer postcss-preset-env
```

## CSS modules

Files matching `*.module.css` are treated as CSS modules:

```css
/* src/_components/card.module.css */
.card {
	border: 1px solid #ddd;
	padding: 1rem;
}
```

```ts
import styles from '../_components/card.module.css';

document.querySelector('.product')?.classList.add(styles.card);
```

Class names are hashed at build time so they cannot collide with Webflow's classes.

## Targeting Webflow elements

Webflow exposes useful selectors you can rely on:

- Class selectors set in the Designer: `.your-class-name`
- Element IDs: `#your-element`
- Webflow-generated classes: `.w-button`, `.w-form`, etc. (avoid relying on these — they may change)
- CMS bindings: `[data-w-cms]`
- The `body` `data-wf-page` attribute, useful for page-level scoping

For maintainability, prefer adding stable class names in the Designer and targeting those.

## Loading order

1. Webflow's own CSS loads first (from the staging or production HTML).
2. Your bundle runs and injects its `<style>` tag, which lands in `<head>` after Webflow's stylesheets — so your styles win on specificity ties.

If you need to override Webflow with the same selector, use either higher specificity (`html .your-class`) or `!important`.

## CSS-in-JS / Tailwind

Viteflow does not bundle Tailwind by default (the original Biome config had Tailwind class sorting; that was removed in this template). If you want Tailwind:

1. `bun add -d tailwindcss postcss autoprefixer`
2. `bunx tailwindcss init -p`
3. Update `tailwind.config.js`:

```js
export default {
	content: ['./src/**/*.{ts,html}'],
	theme: { extend: {} },
	plugins: [],
};
```

4. Create `src/_styles/tailwind.css`:

```css
@tailwind base;
@tailwind components;
@tailwind utilities;
```

5. Import in `global.ts`:

```ts
import './_styles/tailwind.css';
```

The full Tailwind output gets bundled into `dist/main.js`. Use Tailwind's content scanning to keep the bundle small.
