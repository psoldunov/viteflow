import type { ServerResponse } from 'node:http';
import type { HtmlTagDescriptor, Plugin, ViteDevServer } from 'vite';
import type { ViteflowConfig } from './config';

const ALLOWED_RESPONSE_HEADERS = new Set([
	'content-type',
	'cache-control',
	'etag',
	'last-modified',
	'expires',
	'vary',
	'content-disposition',
	'accept-ranges',
]);

function buildUpstreamUrl(baseUrl: URL, reqUrl: string): URL | null {
	const cleanPath = reqUrl.startsWith('/') ? reqUrl.slice(1) : reqUrl;
	let target: URL;
	try {
		target = new URL(cleanPath, baseUrl);
	} catch {
		return null;
	}
	if (target.origin !== baseUrl.origin) return null;
	return target;
}

async function proxyHtml(
	server: ViteDevServer,
	res: ServerResponse,
	upstream: Response,
	reqUrl: string,
): Promise<void> {
	const raw = await upstream.text();
	const html = await server.transformIndexHtml(reqUrl, raw);
	res.statusCode = upstream.status;
	res.setHeader('Content-Type', 'text/html; charset=utf-8');
	res.end(html);
}

async function proxyAsset(
	res: ServerResponse,
	upstream: Response,
): Promise<void> {
	res.statusCode = upstream.status;
	upstream.headers.forEach((value, key) => {
		if (ALLOWED_RESPONSE_HEADERS.has(key.toLowerCase())) {
			res.setHeader(key, value);
		}
	});
	const buf = Buffer.from(await upstream.arrayBuffer());
	res.end(buf);
}

const VITEFLOW_TAG: HtmlTagDescriptor = {
	tag: 'script',
	attrs: {
		type: 'module',
		src: '/viteflow/main.ts',
		'data-viteflow': '',
	},
	injectTo: 'body',
};

export function pluginWebflowProxy(config: ViteflowConfig): Plugin {
	let baseUrl: URL | null = null;
	try {
		baseUrl = new URL(config.webflowStagingUrl);
	} catch {
		baseUrl = null;
	}

	return {
		name: 'viteflow:webflow-proxy',
		transformIndexHtml() {
			return [VITEFLOW_TAG];
		},
		configureServer(server) {
			return () => {
				server.middlewares.use(async (req, res, next) => {
					if (!baseUrl) return next();
					if (req.method !== 'GET' && req.method !== 'HEAD') return next();

					const url = req.url ?? '/';
					const accept = String(req.headers.accept ?? '');
					const wantsHtml = accept.includes('text/html');

					const target = buildUpstreamUrl(baseUrl, url);
					if (!target) return next();

					let upstream: Response;
					try {
						upstream = await fetch(target.toString(), {
							method: req.method,
							redirect: 'follow',
							headers: {
								'User-Agent': 'viteflow-dev',
								accept: accept || '*/*',
							},
						});
					} catch (err) {
						server.config.logger.error(
							`[viteflow] proxy fetch failed for ${url}: ${(err as Error).message}`,
						);
						return next();
					}

					const upstreamType = upstream.headers.get('content-type') ?? '';
					const isHtmlResponse = upstreamType.includes('text/html');

					try {
						if (wantsHtml || isHtmlResponse) {
							await proxyHtml(server, res, upstream, url);
						} else {
							await proxyAsset(res, upstream);
						}
					} catch (err) {
						next(err);
					}
				});
			};
		},
	};
}
