#!/usr/bin/env bun
/**
 * Run the CodeMirror experiment harness
 *
 * Usage: bun experiments/codemirror/run.ts
 *
 * This script:
 * 1. Regenerates test fixtures (for stable testing)
 * 2. Starts a Vite dev server for the experiment
 */

import { spawn } from "child_process";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(__dirname, "../..");

console.log("🔧 CodeMirror Experiment 1: Hidden Syntax\n");

// Step 1: Regenerate fixtures
console.log("📝 Regenerating test fixtures...\n");

const generateResult = Bun.spawnSync({
  cmd: ["bun", "run", join(__dirname, "generate-fixtures.ts")],
  cwd: projectRoot,
  stdout: "inherit",
  stderr: "inherit",
});

if (generateResult.exitCode !== 0) {
  console.error("\n❌ Failed to generate fixtures");
  process.exit(1);
}

// Step 2: Start Vite dev server for the experiment
console.log("\n🚀 Starting experiment server...\n");

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

// Handle Ctrl+C gracefully
process.on("SIGINT", () => {
  viteProcess.kill();
  process.exit(0);
});
