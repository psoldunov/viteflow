import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import type { ViteflowConfig } from './config';
import { WebflowApi } from './webflow-api';

const ASSET_PREFIX = 'viteflow-bundle-';
const ASSET_SUFFIX = '.js.txt';
const SCRIPT_DISPLAY_NAME = 'viteflow-bundle';
const BUNDLE_PATH = 'dist/main.js';

type CliOptions = {
	publish: boolean;
	live: boolean;
};

function parseArgs(argv: string[]): CliOptions {
	const opts: CliOptions = { publish: true, live: false };
	for (const arg of argv) {
		if (arg === '--no-publish') opts.publish = false;
		else if (arg === '--live') opts.live = true;
		else if (arg === '--help' || arg === '-h') {
			console.log(
				[
					'Usage: bun viteflow/deploy.ts [options]',
					'',
					'Builds dist/main.js, uploads it to Webflow as an asset, registers a',
					'hosted script, applies it just before </body>, and publishes the site.',
					'',
					'Options:',
					'  --no-publish   Apply the script but skip the publish step.',
					'  --live         Also publish to deploy.customDomains. Default is staging only.',
					'  -h, --help     Show this help.',
				].join('\n'),
			);
			process.exit(0);
		} else {
			throw new Error(`Unknown deploy flag: ${arg}`);
		}
	}
	return opts;
}

async function loadConfig(): Promise<ViteflowConfig> {
	const path = resolve(process.cwd(), 'viteflow.config.ts');
	const mod = (await import(pathToFileURL(path).href)) as {
		default: ViteflowConfig;
	};
	if (!mod.default) {
		throw new Error(
			'[viteflow] viteflow.config.ts must default-export a config.',
		);
	}
	return mod.default;
}

function md5Hex(bytes: Uint8Array): string {
	return createHash('md5').update(bytes).digest('hex');
}

function sriSha384(bytes: Uint8Array): string {
	return `sha384-${createHash('sha384').update(bytes).digest('base64')}`;
}

function nowVersion(): string {
	return `1.0.${Math.floor(Date.now() / 1000)}`;
}

function shortNumber(n: number): string {
	if (n < 1024) return `${n} B`;
	if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
	return `${(n / (1024 * 1024)).toFixed(2)} MB`;
}

async function main(): Promise<void> {
	const opts = parseArgs(process.argv.slice(2));
	const config = await loadConfig();

	const siteId = (
		process.env.WEBFLOW_SITE_ID ??
		config.deploy?.siteId ??
		''
	).trim();
	const token = (process.env.WEBFLOW_API_TOKEN ?? '').trim();

	if (!siteId) {
		throw new Error(
			'[viteflow] Missing site ID. Set deploy.siteId in viteflow.config.ts or WEBFLOW_SITE_ID in .env.local.',
		);
	}
	if (!token) {
		throw new Error(
			'[viteflow] Missing WEBFLOW_API_TOKEN. Add it to .env.local. The token needs custom_code:write, assets:write, and sites:write scopes.',
		);
	}

	const bundlePath = resolve(process.cwd(), BUNDLE_PATH);
	let bundle: Buffer;
	try {
		bundle = await readFile(bundlePath);
	} catch {
		throw new Error(
			`[viteflow] ${BUNDLE_PATH} not found. Run "bun run build" first (or use "bun run deploy" which builds for you).`,
		);
	}

	const bytes = new Uint8Array(bundle);
	const md5 = md5Hex(bytes);
	const sri = sriSha384(bytes);
	const fileName = `${ASSET_PREFIX}${Date.now()}${ASSET_SUFFIX}`;
	const version = nowVersion();

	console.log(
		`[viteflow] bundle: ${shortNumber(bytes.byteLength)}, md5=${md5}, sri=${sri.slice(0, 24)}…`,
	);

	const api = new WebflowApi(token, siteId);

	console.log('[viteflow] looking up existing viteflow scripts…');
	const allScripts = await api.listRegisteredScripts();
	const staleScriptIds = new Set(
		allScripts
			.filter((s) => s.displayName === SCRIPT_DISPLAY_NAME)
			.map((s) => s.id),
	);
	const applied = await api.getAppliedCustomCode();
	const keepApplied = applied.filter((s) => !staleScriptIds.has(s.id));

	console.log(
		`[viteflow] found ${staleScriptIds.size} stale registered script(s); preserving ${keepApplied.length} other applied script(s).`,
	);

	console.log('[viteflow] uploading bundle as Webflow asset…');
	const created = await api.createAsset(fileName, md5);
	await api.uploadAssetBinary(
		created.uploadUrl,
		created.uploadDetails,
		bytes,
		created.contentType ?? 'text/plain',
		fileName,
	);
	const hostedUrl = created.hostedUrl ?? created.assetUrl;
	if (!hostedUrl) {
		throw new Error(
			'[viteflow] Asset upload succeeded but Webflow returned no hosted URL.',
		);
	}
	console.log(`[viteflow] uploaded → ${hostedUrl}`);

	console.log('[viteflow] registering hosted script…');
	const registered = await api.registerHostedScript({
		hostedLocation: hostedUrl,
		integrityHash: sri,
		version,
		displayName: SCRIPT_DISPLAY_NAME,
		canCopy: true,
	});

	console.log('[viteflow] applying script to footer (before </body>)…');
	await api.upsertCustomCode([
		...keepApplied,
		{
			id: registered.id,
			version,
			location: 'footer',
			attributes: { 'data-viteflow': '' },
		},
	]);

	if (staleScriptIds.size > 0) {
		console.log(
			`[viteflow] cleaning up ${staleScriptIds.size} old registered script(s)…`,
		);
		for (const id of staleScriptIds) {
			try {
				await api.deleteRegisteredScript(id);
			} catch (err) {
				console.warn(
					`[viteflow] could not delete old script ${id}: ${(err as Error).message}`,
				);
			}
		}
	}

	console.log('[viteflow] cleaning up old viteflow asset(s)…');
	const assets = await api.listAssets();
	const stale = assets.filter((a) =>
		(a.originalFileName ?? a.displayName ?? '').startsWith(ASSET_PREFIX),
	);
	const oldAssets = stale.filter((a) => a.id !== created.id);
	for (const a of oldAssets) {
		try {
			await api.deleteAsset(a.id);
		} catch (err) {
			console.warn(
				`[viteflow] could not delete old asset ${a.id}: ${(err as Error).message}`,
			);
		}
	}
	if (oldAssets.length > 0) {
		console.log(`[viteflow] deleted ${oldAssets.length} old asset(s).`);
	}

	if (!opts.publish) {
		console.log('[viteflow] --no-publish set; skipping publish.');
		console.log('[viteflow] done.');
		return;
	}

	const customDomains = opts.live ? config.deploy?.customDomains : undefined;
	console.log(
		`[viteflow] publishing (subdomain${opts.live ? ' + custom domains' : ''})…`,
	);
	await api.publish({
		publishToWebflowSubdomain: true,
		...(customDomains && customDomains.length > 0 ? { customDomains } : {}),
	});

	console.log('[viteflow] done.');
}

main().catch((err) => {
	console.error(err instanceof Error ? err.message : err);
	process.exit(1);
});
