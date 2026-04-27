import { defineConfig } from 'vite';
import cssInjectedByJsPlugin from 'vite-plugin-css-injected-by-js';
import { pluginWebflowProxy } from './viteflow/plugin-webflow-proxy';
import viteflowConfig from './viteflow.config';

const port = viteflowConfig.port ?? 5173;

export default defineConfig({
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
});
