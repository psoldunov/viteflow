import { defineConfig } from "vite";
import cssInjectedByJsPlugin from "vite-plugin-css-injected-by-js";
import commonjs from "vite-plugin-commonjs";
import { resolve, join } from "path";

const processPath = process.cwd();

export default defineConfig({
  plugins: [cssInjectedByJsPlugin(), commonjs()],
  build: {
    rollupOptions: {
      input: join(processPath, "/.viteflow/main.js"),
      output: {
        entryFileNames: "main.js",
        assetFileNames: `[name].[ext]`,
      },
    },
  },
  resolve: {
    extensions: [".js", ".ts", ".jsx", ".tsx", ".json", ".css", ".scss"],
    alias: {
      "@": resolve(processPath, "./src"),
      "@pages": resolve(processPath, "./src/pages"),
      "@components": resolve(processPath, "./src/components"),
      "@styles": resolve(processPath, "./src/styles"),
      "@plugins": resolve(processPath, "./src/plugins"),
      "@functions": resolve(processPath, "./src/functions"),
    },
  },
});
