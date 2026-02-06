#!/usr/bin/env bun
/**
 * Run the Typography experiment harness
 *
 * Usage: bun experiments/typography/run.ts
 *
 * Starts a Vite dev server for the font system experiment.
 */

import { spawn } from "child_process";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(__dirname, "../..");

console.log("Typography Experiment: Font System Tester\n");
console.log("Starting experiment server...\n");

const viteProcess = spawn(
  "bunx",
  [
    "vite",
    "--config",
    join(__dirname, "vite.config.ts"),
    "--open",
  ],
  {
    cwd: projectRoot,
    stdio: "inherit",
  }
);

viteProcess.on("error", (err) => {
  console.error("Failed to start Vite:", err);
  process.exit(1);
});

process.on("SIGINT", () => {
  viteProcess.kill();
  process.exit(0);
});
