import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import type { ViteflowConfig } from './config';
import { VITEFLOW_BUNDLE_MARKER } from './marker';
import { WebflowApi } from './webflow-api';

const ASSET_PREFIX = 'viteflow-bundle-';
const ASSET_SUFFIX = '.js.txt';
const BUNDLE_PATH = 'dist/main.js';

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

function shortNumber(n: number): string {
	if (n < 1024) return `${n} B`;
	if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
	return `${(n / (1024 * 1024)).toFixed(2)} MB`;
}

function checkArgs(argv: string[]): void {
	for (const arg of argv) {
		if (arg === '--help' || arg === '-h') {
			console.log(
				[
					'Usage: bun viteflow/deploy.ts',
					'',
					'Builds dist/main.js, uploads it to Webflow as a site asset, and prints',
					'a <script> tag for you to paste into Webflow → Project Settings → Custom',
					'Code → Footer Code. Re-running the script wipes the previous viteflow',
					'asset and gives you a new tag to paste.',
					'',
					'The printed tag is marked with `data-viteflow-bundle` so `bun dev` knows',
					'to strip it from the proxied page — no double-loading during development.',
				].join('\n'),
			);
			process.exit(0);
		}
		throw new Error(`Unknown deploy flag: ${arg}`);
	}
}

async function main(): Promise<void> {
	checkArgs(process.argv.slice(2));
	const config = await loadConfig();

	const siteId = (
		process.env.WEBFLOW_SITE_ID ??
		config.deploy?.siteId ??
		''
	).trim();
	const token = (process.env.WEBFLOW_API_TOKEN ?? '').trim();

	if (!siteId) {
		throw new Error(
			'[viteflow] Missing site ID. Set WEBFLOW_SITE_ID in .env.local (preferred) or deploy.siteId in viteflow.config.ts.',
		);
	}
	if (!token) {
		throw new Error(
			'[viteflow] Missing WEBFLOW_API_TOKEN. Add it to .env.local. The token needs the assets:read and assets:write scopes.',
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
	const fileName = `${ASSET_PREFIX}${Date.now()}${ASSET_SUFFIX}`;

	console.log(
		`[viteflow] bundle: ${shortNumber(bytes.byteLength)}, md5=${md5}`,
	);

	const api = new WebflowApi(token, siteId);

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

	console.log('[viteflow] cleaning up old viteflow asset(s)…');
	const assets = await api.listAssets();
	const oldAssets = assets.filter(
		(a) =>
			a.id !== created.id &&
			(a.originalFileName ?? a.displayName ?? '').startsWith(ASSET_PREFIX),
	);
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

	const scriptTag = `<script src="${hostedUrl}" ${VITEFLOW_BUNDLE_MARKER} defer></script>`;

	const sep = '─'.repeat(72);
	console.log('');
	console.log(sep);
	console.log(
		'Paste this into Webflow → Project Settings → Custom Code → Footer Code,',
	);
	console.log('then click Save Changes and Publish.');
	console.log('');
	console.log(scriptTag);
	console.log('');
	console.log(
		`The "${VITEFLOW_BUNDLE_MARKER}" attribute lets "bun dev" strip this tag`,
	);
	console.log(
		'from proxied pages so the deployed bundle and the localhost dev bundle',
	);
	console.log('never run side-by-side.');
	console.log(sep);
}

main().catch((err) => {
	console.error(err instanceof Error ? err.message : err);
	process.exit(1);
});
