# Recipes

Common patterns for working with Webflow + viteflow.

## GSAP scroll animations

```sh
bun add gsap
```

```ts
// src/_lib/gsap.ts
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

export { gsap, ScrollTrigger };
```

```ts
// src/index.ts
import type { RouteHandler } from '../viteflow/types';
import { gsap, ScrollTrigger } from './_lib/gsap';

let triggers: ScrollTrigger[] = [];

const handler: RouteHandler = () => {
	// Cleanup previous run (HMR safety)
	triggers.forEach((t) => t.kill());
	triggers = [];

	gsap.utils.toArray<HTMLElement>('[data-fade-in]').forEach((el) => {
		const trigger = ScrollTrigger.create({
			trigger: el,
			start: 'top 80%',
			animation: gsap.from(el, { opacity: 0, y: 40, duration: 0.8 }),
		});
		triggers.push(trigger);
	});
};

export default handler;
```

In Webflow, add an attribute `data-fade-in` to any element you want to animate.

## jQuery (Webflow already loads it)

Webflow includes jQuery on every page. Reference it on `window`:

```ts
declare global {
	interface Window {
		$: JQueryStatic;
		jQuery: JQueryStatic;
	}
}

const handler: RouteHandler = () => {
	window.$('.cta').on('click', () => {
		console.log('clicked');
	});
};
```

To get the types, install jQuery types as a dev dep:

```sh
bun add -d @types/jquery
```

## Form submission with custom fetch

Take over a Webflow form so it submits via your API:

```ts
// src/contact.ts
import type { RouteHandler } from '../viteflow/types';

const handler: RouteHandler = () => {
	const form = document.querySelector<HTMLFormElement>('form#contact-form');
	if (!form || form.dataset.bound === 'true') return;
	form.dataset.bound = 'true';

	form.addEventListener('submit', async (e) => {
		e.preventDefault();
		const data = Object.fromEntries(new FormData(form).entries());

		const res = await fetch('https://your-api.com/contact', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(data),
		});

		if (res.ok) {
			form.querySelector<HTMLElement>('.w-form-done')?.style.setProperty('display', 'block');
			form.style.display = 'none';
		} else {
			form.querySelector<HTMLElement>('.w-form-fail')?.style.setProperty('display', 'block');
		}
	});
};

export default handler;
```

Webflow's form classes (`.w-form-done`, `.w-form-fail`) work for showing the success / fail state without changing your Webflow design.

## IntersectionObserver for lazy loading

```ts
// src/_lib/lazy-load.ts
export function lazyLoadImages(selector = 'img[data-src]'): () => void {
	const observer = new IntersectionObserver((entries) => {
		entries.forEach((entry) => {
			if (!entry.isIntersecting) return;
			const img = entry.target as HTMLImageElement;
			img.src = img.dataset.src ?? '';
			img.removeAttribute('data-src');
			observer.unobserve(img);
		});
	});

	document.querySelectorAll<HTMLImageElement>(selector).forEach((img) => {
		observer.observe(img);
	});

	return () => observer.disconnect();
}
```

```ts
// src/global.ts
import type { RouteHandler } from '../viteflow/types';
import { lazyLoadImages } from './_lib/lazy-load';

let cleanup: (() => void) | null = null;

const handler: RouteHandler = () => {
	cleanup?.();
	cleanup = lazyLoadImages();
};

export default handler;
```

## Reading Webflow CMS bindings

Webflow renders CMS data into HTML attributes and text. Read them:

```ts
const handler: RouteHandler = () => {
	const card = document.querySelector('.product-card');
	if (!card) return;

	const productId = card.getAttribute('data-product-id');
	const price = card.querySelector('.price')?.textContent;

	console.log({ productId, price });
};
```

In the Webflow Designer, bind CMS fields to attributes via the **+ Add Custom Attribute** option on any element.

## Page-scoped behavior using `body[data-wf-page]`

Webflow sets a `data-wf-page` attribute on `<html>` with a stable page ID. You can use this for routing logic without filenames if needed:

```ts
const handler: RouteHandler = () => {
	const pageId = document.documentElement.getAttribute('data-wf-page');
	if (pageId === '67abc...') {
		// homepage logic
	}
};
```

Prefer file-based routing where possible. This pattern is useful when one URL maps to multiple pages dynamically (rare).

## Tracking with Plausible / Fathom / Google Analytics

Most analytics scripts attach to `window`:

```ts
declare global {
	interface Window {
		plausible: (event: string, opts?: { props?: Record<string, string> }) => void;
	}
}

const handler: RouteHandler = () => {
	document.querySelectorAll('[data-track]').forEach((el) => {
		el.addEventListener('click', () => {
			window.plausible?.('CTA clicked', {
				props: { label: el.getAttribute('data-track') ?? '' },
			});
		});
	});
};
```

Add the analytics `<script>` once in Webflow Custom Code. Trigger custom events from viteflow handlers.

## Interactive components (modals, tabs, dropdowns)

Pattern: query the DOM, attach listeners, store cleanup.

```ts
// src/_components/modal.ts
export function bindModal(selector: string): () => void {
	const triggers = document.querySelectorAll<HTMLElement>(`${selector}-trigger`);
	const modal = document.querySelector<HTMLElement>(selector);
	if (!modal) return () => {};

	const open = () => modal.setAttribute('data-open', 'true');
	const close = () => modal.removeAttribute('data-open');

	triggers.forEach((t) => t.addEventListener('click', open));
	modal.querySelector('[data-close]')?.addEventListener('click', close);

	return () => {
		triggers.forEach((t) => t.removeEventListener('click', open));
	};
}
```

```ts
// src/index.ts
import type { RouteHandler } from '../viteflow/types';
import { bindModal } from './_components/modal';

let cleanup: (() => void) | null = null;

const handler: RouteHandler = () => {
	cleanup?.();
	cleanup = bindModal('.signup-modal');
};

export default handler;
```

In CSS, style the open/close states:

```css
.signup-modal {
	display: none;
}
.signup-modal[data-open='true'] {
	display: flex;
}
```

## Throttle / debounce DOM events

Don't reach for lodash. Write the helpers yourself:

```ts
// src/_lib/timing.ts
export function throttle<T extends (...args: never[]) => void>(
	fn: T,
	ms: number,
): (...args: Parameters<T>) => void {
	let last = 0;
	return (...args) => {
		const now = Date.now();
		if (now - last >= ms) {
			last = now;
			fn(...args);
		}
	};
}

export function debounce<T extends (...args: never[]) => void>(
	fn: T,
	ms: number,
): (...args: Parameters<T>) => void {
	let timer: ReturnType<typeof setTimeout> | null = null;
	return (...args) => {
		if (timer) clearTimeout(timer);
		timer = setTimeout(() => fn(...args), ms);
	};
}
```

## Conditional behavior by viewport

```ts
const handler: RouteHandler = () => {
	const isMobile = window.matchMedia('(max-width: 767px)').matches;
	if (isMobile) initMobileMenu();
	else initDesktopMenu();
};
```

For responsive behavior that changes on resize:

```ts
const mq = window.matchMedia('(max-width: 767px)');
mq.addEventListener('change', (e) => {
	if (e.matches) initMobileMenu();
	else initDesktopMenu();
});
```

Remember to clean up on HMR — store a cleanup function.

## Wait for fonts before measuring

Measuring text dimensions before web fonts load gives wrong values. Wait for them:

```ts
const handler: RouteHandler = async () => {
	await document.fonts.ready;
	const heading = document.querySelector<HTMLElement>('h1');
	if (heading) {
		console.log('measured width:', heading.getBoundingClientRect().width);
	}
};
```
