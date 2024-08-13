#!/usr/bin/env node

import startServer from "../scripts/server.js";
import startWatcher from "../scripts/watcher.js";
import startDeploy from "../scripts/deployer.js";
import fs from "fs";
import { join, dirname, resolve } from "path";
import { exec } from "child_process";
import { fileURLToPath } from "url";

interface Config {
  url: string;
  token: string;
  siteId: string;
}

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

console.log(`Looking for config at: ${configPath}`);

async function loadConfig(): Promise<void> {
  if (fs.existsSync(configPath)) {
    try {
      const module = await import(`file://${configPath}`);
      const config: Config = module.default;
      if (config.url) {
        process.env.WEBFLOW_API_URL = config.url;
        process.env.WEBFLOW_API_TOKEN = config.token;
        process.env.SITE_ID = config.siteId;
        console.log(`Using Webflow API URL from config: ${config.url}`);
      } else {
        console.error("The URL is not defined in viteflow.config.js");
        process.exit(1);
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

    startDeploy();
    return;
  }

  startServer();
  startWatcher();
}

main().catch(console.error);
