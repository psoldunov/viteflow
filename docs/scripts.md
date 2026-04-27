# Scripts

All scripts defined in `package.json`. Run with `bun run <name>` or the `bun <name>` shorthand for built-in script names.

| Command | What it does |
|---------|--------------|
| `bun dev` | Start the dev server. Boots Vite with the Webflow proxy plugin, opens your browser at `http://localhost:5173/` (configurable via `viteflow.config.ts`). HMR + source maps active. |
| `bun run build` | Build for production. Produces `dist/main.js` (minified IIFE with embedded CSS) and `dist/main.js.map` (sourcemap). |
| `bun run preview` | Run `vite preview`. Serves the built `dist/` at `http://localhost:4173/` so you can sanity-check the production bundle in isolation. |
| `bun run typecheck` | Run TypeScript in `--noEmit` mode. Prints type errors. Exit code is non-zero on failure (good for CI). |
| `bun run lint` | Run Biome's linter only. Reports issues without modifying files. |
| `bun run format` | Run Biome's formatter with `--write`. Reformats files in place. |
| `bun run check` | Run both linter and formatter with `--write`. Single command for "fix everything Biome can fix". |

## Recommended workflow

During active development:

```sh
bun dev           # one terminal
bun run check     # before committing
bun run typecheck # if you're touching types
```

Before deploying:

```sh
bun run check
bun run typecheck
bun run build
```

Pre-commit hook (optional):

```sh
# .git/hooks/pre-commit
#!/bin/sh
set -e
bun run check
bun run typecheck
```

```sh
chmod +x .git/hooks/pre-commit
```

## CI workflow

Minimum CI pipeline:

```yaml
- bun install --frozen-lockfile
- bun run check
- bun run typecheck
- bun run build
```

If any step fails, the pipeline fails. Bun returns non-zero exit codes on errors.
