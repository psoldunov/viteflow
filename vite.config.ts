import { defineConfig, loadEnv, type ModuleNode, type Plugin } from 'vite';
import cssInjectedByJsPlugin from 'vite-plugin-css-injected-by-js';
import { pluginWebflowProxy } from './viteflow/plugin-webflow-proxy';
import baseConfig from './viteflow.config';

function fullReloadOnProjectChanges(): Plugin {
	return {
		name: 'viteflow:full-reload-on-project-changes',
		apply: 'serve',
		handleHotUpdate({ file, modules, server, timestamp }) {
			const normalizedFile = file.replace(/\\/g, '/');
			const shouldReload =
				normalizedFile.includes('/src/') ||
				normalizedFile.includes('/viteflow/');

			if (!shouldReload) return;

			const invalidatedModules = new Set<ModuleNode>();
			for (const mod of modules) {
				server.moduleGraph.invalidateModule(
					mod,
					invalidatedModules,
					timestamp,
					true,
				);
			}

			server.ws.send({ type: 'full-reload' });
			return [];
		},
	};
}

export default defineConfig(({ command, mode }) => {
	const fileEnv = loadEnv(mode, process.cwd(), '');
	// Shell env (process.env) wins over .env files; both win over viteflow.config.ts.
	const stagingFromEnv = (
		process.env.WEBFLOW_STAGING_URL ?? fileEnv.WEBFLOW_STAGING_URL
	)?.trim();
	const portFromEnv = process.env.PORT ?? fileEnv.PORT;

	const viteflowConfig = {
		...baseConfig,
		webflowStagingUrl: stagingFromEnv || baseConfig.webflowStagingUrl,
	};

	const port = Number(portFromEnv) || viteflowConfig.port || 5173;

	return {
		define: {
			'process.env.NODE_ENV': JSON.stringify(
				command === 'build' ? 'production' : 'development',
			),
		},
		plugins: [
			fullReloadOnProjectChanges(),
			pluginWebflowProxy(viteflowConfig),
			cssInjectedByJsPlugin({ topExecutionPriority: false }),
		],
		appType: 'custom',
		server: {
			port,
			host: 'localhost',
			strictPort: false,
			open: viteflowConfig.openOnDev !== false ? '/' : undefined,
		},
		build: {
			lib: {
				entry: 'viteflow/main.ts',
				formats: ['iife'],
				name: 'Viteflow',
				fileName: () => 'main.js',
			},
			sourcemap: true,
			outDir: 'dist',
			emptyOutDir: true,
		},
	};
});
