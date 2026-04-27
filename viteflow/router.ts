import type { RouteContext, RouteHandler, RouteModule } from './types';

const modules = import.meta.glob<RouteModule>('/src/**/*.ts', { eager: true });

type Route = {
	pattern: string;
	regex: RegExp;
	paramNames: string[];
	handler: RouteHandler;
	filePath: string;
	literalCount: number;
	paramCount: number;
};

function escapeLiteral(seg: string): string {
	return seg.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function compile(pattern: string): { regex: RegExp; paramNames: string[] } {
	const paramNames: string[] = [];
	const segments = pattern.split('/').filter(Boolean);
	const regexParts = segments.map((seg) => {
		if (seg.startsWith(':')) {
			paramNames.push(seg.slice(1));
			return '([^/]+)';
		}
		return escapeLiteral(seg);
	});
	const body = regexParts.length === 0 ? '' : `/${regexParts.join('/')}`;
	const regex = new RegExp(`^${body || '/'}/?$`);
	return { regex, paramNames };
}

function fileToPattern(filePath: string): string {
	let pattern = filePath.replace(/^\/src/, '').replace(/\.ts$/, '');
	if (pattern.endsWith('/index')) pattern = pattern.slice(0, -'/index'.length);
	if (pattern === '' || pattern === '/index') pattern = '/';
	return pattern.replace(/\[(\w+)\]/g, ':$1');
}

function buildRoutes(): {
	routes: Route[];
	globalHandler: RouteHandler | null;
} {
	const routes: Route[] = [];
	let globalHandler: RouteHandler | null = null;
	const seen = new Map<string, string>();

	for (const [filePath, mod] of Object.entries(modules)) {
		if (filePath === '/src/global.ts') {
			if (typeof mod.default === 'function') globalHandler = mod.default;
			continue;
		}

		// Skip files/folders starting with `_` — treated as private utilities.
		const pathSegments = filePath.split('/').filter(Boolean);
		if (pathSegments.some((s) => s.startsWith('_'))) continue;

		if (typeof mod.default !== 'function') {
			console.warn(`[viteflow] ${filePath} has no default export — skipped`);
			continue;
		}

		const pattern = fileToPattern(filePath);

		if (seen.has(pattern)) {
			throw new Error(
				`[viteflow] Duplicate route "${pattern}": ${seen.get(pattern)} and ${filePath}`,
			);
		}
		seen.set(pattern, filePath);

		const { regex, paramNames } = compile(pattern);
		const segments = pattern.split('/').filter(Boolean);
		const literalCount = segments.filter((s) => !s.startsWith(':')).length;

		routes.push({
			pattern,
			regex,
			paramNames,
			handler: mod.default,
			filePath,
			literalCount,
			paramCount: paramNames.length,
		});
	}

	routes.sort((a, b) => {
		if (a.literalCount !== b.literalCount)
			return b.literalCount - a.literalCount;
		return a.paramCount - b.paramCount;
	});

	return { routes, globalHandler };
}

const { routes, globalHandler } = buildRoutes();

function normalize(path: string): string {
	if (path.length > 1 && path.endsWith('/')) return path.slice(0, -1);
	return path;
}

function parseLocation(input: string): {
	path: string;
	searchParams: URLSearchParams;
	hash: string;
	id: string;
} {
	const url = new URL(input, 'http://localhost');
	const path = normalize(url.pathname);
	const hash = url.hash;
	const rawId = hash.startsWith('#') ? hash.slice(1) : hash;
	let id: string;
	try {
		id = decodeURIComponent(rawId);
	} catch {
		id = rawId;
	}
	return { path, searchParams: url.searchParams, hash, id };
}

export async function dispatch(rawInput: string): Promise<void> {
	const { path, searchParams, hash, id } = parseLocation(rawInput);
	const baseCtx: RouteContext = { params: {}, path, searchParams, hash, id };

	if (globalHandler) {
		try {
			await globalHandler(baseCtx);
		} catch (err) {
			console.error('[viteflow] global handler error', err);
		}
	}

	for (const route of routes) {
		const match = route.regex.exec(path);
		if (!match) continue;
		const params: Record<string, string> = {};
		route.paramNames.forEach((name, i) => {
			const raw = match[i + 1] ?? '';
			try {
				params[name] = decodeURIComponent(raw);
			} catch {
				params[name] = raw;
			}
		});
		try {
			await route.handler({ params, path, searchParams, hash, id });
		} catch (err) {
			console.error(
				`[viteflow] handler error in ${route.filePath} (${route.pattern})`,
				err,
			);
		}
		return;
	}

	console.warn('[viteflow] no route matched for', path);
}
