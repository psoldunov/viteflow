import express, { Express } from 'express';
import { ViteDevServer } from 'vite';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

export default function startServer(): void {
  // Constants
  const port: number | string = process.env.PORT || 5173;
  const base: string = process.env.BASE || '/';
  const webflowUrl: string = process.env.WEBFLOW_API_URL || '';

  // Check if webflowUrl is set
  if (!webflowUrl) {
    console.error('Please set webflowUrl in the configuration file.');
    process.exit(1);
  }

  // Create HTTP server
  const app: Express = express();

  // Creates a Vite server instance
  const createViteServer = async (): Promise<ViteDevServer> => {
    const { createServer } = await import('vite');
    const vite = await createServer({
      configFile: join(__dirname, '../config/vite.config.js'),
      server: {
        middlewareMode: true,
        hmr: {
          host: 'localhost',
        },
      },
      appType: 'custom',
      base,
    });
    return vite;
  };

  createViteServer().then((vite) => {
    app.use(vite.middlewares);

    // Serve HTML
    app.use('*', async (req, res) => {
      try {
        const url = req.originalUrl.replace(base, '');

        let template: string = '';

        await fetch(`${webflowUrl}/${url}`)
          .then((response) => response.text())
          .then((data) => {
            template = data;
          })
          .catch((error) => {
            console.error('Error fetching data:', error);
          });

        template = template.replace(
          '</head>',
          `<script type="module" src="/.viteflow/main.js" defer></script></head>`
        );

        let content = await vite.transformIndexHtml(url, template);

        res.status(200).set({ 'Content-Type': 'text/html' }).send(content);
      } catch (e) {
        vite?.ssrFixStacktrace(e as Error);
        console.log((e as Error).stack);
        res.status(500).end((e as Error).stack);
      }
    });

    // Start HTTP server
    app.listen(port, () => {
      console.log(`Development server started at http://localhost:${port}`);
    });
  });
}
