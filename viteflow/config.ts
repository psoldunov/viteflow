export type ViteflowDeployConfig = {
	/**
	 * Webflow Site ID (24-char hex). Find it in Site Settings → General → Site ID.
	 * Prefer the WEBFLOW_SITE_ID env var; this is a committed-defaults fallback.
	 */
	siteId?: string;
};

export type ViteflowConfig = {
	/**
	 * Full URL of your Webflow staging site (e.g. "https://my-site.webflow.io").
	 * The dev server proxies this URL and injects the localhost script tag,
	 * so you don't need to edit Webflow Custom Code during development.
	 */
	webflowStagingUrl: string;

	/**
	 * Local dev server port. Default 5173.
	 */
	port?: number;

	/**
	 * Auto-open browser at http://localhost:PORT/ on `bun dev`. Default true.
	 */
	openOnDev?: boolean;

	/**
	 * Settings for `bun run deploy` — auto-publishes the built bundle to Webflow.
	 * Requires WEBFLOW_API_TOKEN in .env.local. The token is only read by the
	 * deploy script and never reaches the client bundle.
	 */
	deploy?: ViteflowDeployConfig;
};

function validate(config: ViteflowConfig): ViteflowConfig {
	if (
		typeof config.webflowStagingUrl !== 'string' ||
		config.webflowStagingUrl.length === 0
	) {
		throw new Error(
			'[viteflow] webflowStagingUrl is required and must be a non-empty string.',
		);
	}

	let parsed: URL;
	try {
		parsed = new URL(config.webflowStagingUrl);
	} catch {
		throw new Error(
			`[viteflow] webflowStagingUrl is not a valid URL: "${config.webflowStagingUrl}". Expected e.g. "https://example.webflow.io".`,
		);
	}

	if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
		throw new Error(
			`[viteflow] webflowStagingUrl must use http or https. Got "${parsed.protocol}".`,
		);
	}

	if (config.port !== undefined) {
		if (
			!Number.isInteger(config.port) ||
			config.port < 1 ||
			config.port > 65535
		) {
			throw new Error(
				`[viteflow] port must be an integer between 1 and 65535. Got ${config.port}.`,
			);
		}
	}

	if (config.openOnDev !== undefined && typeof config.openOnDev !== 'boolean') {
		throw new Error('[viteflow] openOnDev must be a boolean.');
	}

	if (config.deploy !== undefined) {
		if (typeof config.deploy !== 'object' || config.deploy === null) {
			throw new Error('[viteflow] deploy must be an object.');
		}
		if (config.deploy.siteId !== undefined) {
			if (
				typeof config.deploy.siteId !== 'string' ||
				config.deploy.siteId.length === 0
			) {
				throw new Error('[viteflow] deploy.siteId must be a non-empty string.');
			}
		}
	}

	const normalizedUrl = config.webflowStagingUrl.endsWith('/')
		? config.webflowStagingUrl
		: `${config.webflowStagingUrl}/`;

	return {
		...config,
		webflowStagingUrl: normalizedUrl,
	};
}

export function defineConfig(config: ViteflowConfig): ViteflowConfig {
	return validate(config);
}
