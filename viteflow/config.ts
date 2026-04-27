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
