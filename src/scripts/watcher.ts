import chokidar from "chokidar";
import { readdir, writeFile, stat, readFileSync } from "fs";
import { join, relative, dirname } from "path";
import { fileURLToPath } from "url";

/**
 * Starts file watcher to automatically update main.ts file with import strings for all files in the src directory.
 */
export default function startWatcher(mode: string = "dev"): void {
  // To handle __dirname in ES module
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = dirname(__filename);

  const srcDir = join(process.cwd(), "./src");
  const mainPath = join(process.cwd(), "./.viteflow/main.js");

  /**
   * Recursively reads a directory and its subdirectories to find all files.
   */
  function readDirRecursive(
    dir: string,
    callback: (err: NodeJS.ErrnoException | null, results?: string[]) => void,
  ): void {
    let results: string[] = [];

    readdir(dir, (err, list) => {
      if (err) return callback(err);

      let pending = list.length;
      if (!pending) return callback(null, results);

      list.forEach((file) => {
        let filePath = join(dir, file);

        stat(filePath, (err, stat) => {
          if (stat && stat.isDirectory()) {
            readDirRecursive(filePath, (err, res) => {
              if (err) {
                callback(err);
                return;
              }
              results = results.concat(res!);
              if (!--pending) callback(null, results);
            });
          } else {
            results.push(filePath);
            if (!--pending) callback(null, results);
          }
        });
      });
    });
  }

  /**
   * Generates import strings for specified files based on certain rules.
   */
  function fileRulesFunction(file: string): string {
    let importString = "";
    let relativePath = relative(
      join(process.cwd(), "./.viteflow/"),
      file,
    ).replace(/\\/g, "/");

    if (
      !relativePath.includes("/pages/") &&
      !relativePath.includes("/styles/") &&
      !relativePath.includes("/src/global")
    )
      return importString;

    const content = readFileSync(file, "utf-8");
    const exportDefault = content.match(/export default function ([^\(]+)/);

    if (relativePath.includes("/pages/")) {
      // Generates import strings for page components.
      if (exportDefault) {
        importString = `
            import ${exportDefault[1]} from '${relativePath}';
            if (window.location.pathname === '${relativePath.replace("../src/pages", "").replace(/\.(ts|tsx|js|jsx)$/, "")}') {
              ${exportDefault[1]}();
            }
            `;

        if (relativePath.includes("[slug]")) {
          importString = `
            import ${exportDefault[1]} from '${relativePath}';
            if (window.location.pathname.includes('${relativePath.replace("../src/pages", "").replace(/\[slug]\.(ts|tsx|js|jsx)$/, "")}')) {
              ${exportDefault[1]}();
            }
            `;
        }
        if (relativePath.includes("/pages/home")) {
          importString = `
            import ${exportDefault[1]} from '${relativePath}';
            if (window.location.pathname === '/') {
              ${exportDefault[1]}();
            }
            `;
        }
      }
    } else {
      // Handles import strings for non-page components.
      if (exportDefault) {
        importString = `import ${exportDefault[1]} from '${relativePath}';`;
      } else {
        importString = `import '${relativePath}';`;
      }
    }

    return importString;
  }

  /**
   * Updates the main.ts file by scanning the src directory for files to import and constructing their import strings.
   */
  function updateMainTs(): void {
    readDirRecursive(srcDir, (err, files) => {
      if (err) {
        console.error("Error reading src directory:", err);
        return;
      }

      const imports = files!
        .filter(
          (file) =>
            /\.(ts|js|tsx|jsx|css|scss|svg)$/.test(file) &&
            !file.endsWith("main.ts"),
        )
        .map(fileRulesFunction)
        .join("\n");

      const content = `// Auto-generated imports\n${imports}\n\n// Your main.ts code here\n`;
      writeFile(mainPath, content, (err) => {
        if (err) {
          console.error("Error writing to main.ts:", err);
        }
      });
    });
  }

  const persistent = mode === "build" ? false : true;

  // Initialize watching on the src directory.
  const watcher = chokidar.watch(srcDir, { persistent, depth: 99 });

  watcher
    .on("add", updateMainTs)
    .on("unlink", updateMainTs)
    .on("change", updateMainTs);

  if (mode === "dev") console.log("Watching for changes in src folder...");
}
