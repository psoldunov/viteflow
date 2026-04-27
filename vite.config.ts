import { defineConfig, loadEnv } from 'vite';
import cssInjectedByJsPlugin from 'vite-plugin-css-injected-by-js';
import baseConfig from './viteflow.config';
import { pluginWebflowProxy } from './viteflow/plugin-webflow-proxy';

export default defineConfig(({ mode }) => {
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
		plugins: [
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
