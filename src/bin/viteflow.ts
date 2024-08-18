// #!/usr/bin/env node

import { exec } from "child_process";
import fs from "fs";
import { dirname, join, resolve } from "path";
import { fileURLToPath } from "url";
import startDeploy from "../scripts/deployer";
import startServer from "../scripts/server";
import startWatcher from "../scripts/watcher";
import type { Config } from "../../types";

// Use dynamic import to load the viteflow.config.js from the root of the consumer project
const configPath = resolve(process.cwd(), "./viteflow.config.js");
const mainPath = resolve(process.cwd(), "./.viteflow/main.js");

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Locate vite
let vitePath = resolve(process.cwd(), "./node_modules/.bin/vite");
let viteConfigPath = join(__dirname, "../config/vite.config.js");

// Check if mainTsPath exists and create it if it doesn't
if (!fs.existsSync(mainPath)) {
  fs.mkdirSync(dirname(mainPath), { recursive: true });
  fs.writeFileSync(mainPath, "");
}

let siteUrl = "";
let siteId = "";

console.log(`Looking for config at: ${configPath}`);

async function loadConfig(): Promise<void> {
  if (fs.existsSync(configPath)) {
    try {
      const module = await import(`file://${configPath}`);
      const config: Config = module.default;
      if (config.url) {
        process.env.WEBFLOW_API_URL = config.url;
        console.log(`Using Webflow API URL from config: ${config.url}`);
      } else {
        console.error("The URL is not defined in viteflow.config.js");
        process.exit(1);
      }

      if (config.siteId) {
        siteId = config.siteId;
      } else {
        console.error("The Site ID is not defined in viteflow.config.js");
        process.exit(1);
      }

      if (config.token) {
        token = config.token;
      }
    } catch (error) {
      console.error("Error loading config:", error);
      process.exit(1);
    }
  } else {
    console.error("No viteflow.config.js found in the project root.");
    process.exit(1);
  }
}

const args = process.argv.slice(2);

async function main(): Promise<void> {
  await loadConfig();

  if (args[0] === "--build" || args[0] === "--deploy") {
    startWatcher("build");

    // Execute vite build command
    exec(`${vitePath} build -c ${viteConfigPath}`, (error, stdout, stderr) => {
      if (error) {
        console.error(`Error: ${error.message}`);
        return;
      }
      if (stderr) {
        console.error(`stderr: ${stderr}`);
        return;
      }
      console.log(`stdout: ${stdout}`);
    });

    if (args[0] === "--build") return;

    await startDeploy(token, siteId);
    return;
  }

  startServer();
  startWatcher();
}

main().catch(console.error);
