import { defineConfig } from './viteflow/config';

export default defineConfig({
	/**
	 * Replace with your Webflow staging URL.
	 * Usually https://YOUR-SITE.webflow.io
	 */
	webflowStagingUrl: 'https://your-site.webflow.io',

	port: 5173,

	/** Open Webflow staging on `bun dev`. Set false for local /index.html preview. */
	openOnDev: true,

	/**
	 * Settings for `bun run deploy`. Prefer setting WEBFLOW_SITE_ID in .env.local
	 * over editing this — env always wins. Uncomment for committed defaults.
	 */
	// deploy: {
	// 	siteId: 'your-webflow-site-id',
	// },
});
