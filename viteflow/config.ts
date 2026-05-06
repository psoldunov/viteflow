export type ViteflowDeployConfig = {
	/**
	 * Webflow Site ID (24-char hex). Find it in Site Settings → General → Site ID.
	 * Falls back to the WEBFLOW_SITE_ID env var if omitted.
	 */
	siteId?: string;

	/**
	 * IDs of custom domains to publish to on `bun run deploy --live`.
	 * Look these up via the Webflow API (`GET /v2/sites/{site_id}/custom_domains`).
	 * The Webflow staging subdomain is always published — this is for production only.
	 */
	customDomains?: string[];
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
			`[viteflow] webflowStagingUrl is not a valid URL: "${config.webflowStagingUrl}". Expected e.g. "https://your-site.webflow.io".`,
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
		if (config.deploy.customDomains !== undefined) {
			if (!Array.isArray(config.deploy.customDomains)) {
				throw new Error('[viteflow] deploy.customDomains must be an array.');
			}
			for (const id of config.deploy.customDomains) {
				if (typeof id !== 'string' || id.length === 0) {
					throw new Error(
						'[viteflow] deploy.customDomains entries must be non-empty strings.',
					);
				}
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
