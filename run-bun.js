#!/usr/bin/env node
/**
 * Locates the bun executable and forwards all arguments to it.
 * Used in package.json scripts so they work even when bun isn't in PATH.
 */
const { execFileSync } = require("child_process");
const path = require("path");
const fs = require("fs");

function findBun() {
  // Check if bun is already in PATH
  try {
    execFileSync("bun", ["--version"], { stdio: "ignore" });
    return "bun";
  } catch {}

  // Common install locations
  const home = process.env.USERPROFILE || process.env.HOME || "";
  const candidates = [
    path.join(home, ".bun", "bin", "bun.exe"),
    path.join(home, ".bun", "bin", "bun"),
  ];

  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
  }

  console.error("Error: bun not found. Install it: https://bun.sh");
  process.exit(1);
}

const bun = findBun();
const args = process.argv.slice(2);

try {
  execFileSync(bun, args, { stdio: "inherit", cwd: process.cwd() });
} catch (e) {
  process.exit(e.status || 1);
}
