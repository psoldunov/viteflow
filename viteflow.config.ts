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
	 * Settings for `bun run deploy`. Uncomment and fill in to enable auto-deploy.
	 * Requires WEBFLOW_API_TOKEN in .env.local.
	 */
	// deploy: {
	// 	siteId: 'your-webflow-site-id',
	// 	customDomains: [],
	// },
});
