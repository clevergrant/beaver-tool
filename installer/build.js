#!/usr/bin/env node
/**
 * Build script — assembles dist/ for Inno Setup compilation.
 *
 * Usage:  node installer/build.js
 *
 * Steps:
 *   1. Cleans and creates dist/
 *   2. Downloads portable node.exe (if not cached)
 *   3. Copies project files
 *   4. Runs npm install --production in dist/
 *   5. Copies tb.cmd wrapper
 *
 * After running, compile the installer:
 *   iscc installer/setup.iss
 */

const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");
const https = require("https");

const ROOT = path.join(__dirname, "..");
const DIST = path.join(ROOT, "dist");
const CACHE = path.join(__dirname, ".cache");

const NODE_VERSION = "22.14.0";
const NODE_URL = `https://nodejs.org/dist/v${NODE_VERSION}/win-x64/node.exe`;
const NODE_CACHED = path.join(CACHE, `node-${NODE_VERSION}.exe`);

const COPY_DIRS = ["bin", "lib", "public", "assets"];
const COPY_FILES = ["server.js", "package.json", "package-lock.json"];

// --- Helpers ---

function rmrf(dir) {
  if (fs.existsSync(dir)) fs.rmSync(dir, { recursive: true, force: true });
}

function mkdirp(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function copyDirSync(src, dest) {
  mkdirp(dest);
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDirSync(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

function download(url, dest) {
  return new Promise((resolve, reject) => {
    console.log(`  Downloading ${url}`);
    const follow = (url) => {
      https.get(url, (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          follow(res.headers.location);
          return;
        }
        if (res.statusCode !== 200) {
          reject(new Error(`HTTP ${res.statusCode} for ${url}`));
          return;
        }
        const total = parseInt(res.headers["content-length"], 10) || 0;
        let downloaded = 0;
        const file = fs.createWriteStream(dest);
        res.on("data", (chunk) => {
          downloaded += chunk.length;
          if (total) {
            const pct = ((downloaded / total) * 100).toFixed(0);
            process.stdout.write(`\r  ${pct}% (${(downloaded / 1e6).toFixed(1)} MB)`);
          }
        });
        res.pipe(file);
        file.on("finish", () => {
          file.close();
          console.log();
          resolve();
        });
      }).on("error", reject);
    };
    follow(url);
  });
}

// --- Main ---

async function main() {
  console.log("=== Timberborn Dashboard Installer Build ===\n");

  // 1. Clean dist/
  console.log("[1/5] Cleaning dist/...");
  rmrf(DIST);
  mkdirp(DIST);

  // 2. Download node.exe (cached)
  console.log(`[2/5] Node.js v${NODE_VERSION}...`);
  mkdirp(CACHE);
  if (fs.existsSync(NODE_CACHED)) {
    console.log("  Using cached node.exe");
  } else {
    await download(NODE_URL, NODE_CACHED);
  }
  fs.copyFileSync(NODE_CACHED, path.join(DIST, "node.exe"));

  // 3. Copy project files
  console.log("[3/5] Copying project files...");
  for (const dir of COPY_DIRS) {
    const src = path.join(ROOT, dir);
    if (fs.existsSync(src)) {
      copyDirSync(src, path.join(DIST, dir));
      console.log(`  ${dir}/`);
    }
  }
  for (const file of COPY_FILES) {
    const src = path.join(ROOT, file);
    if (fs.existsSync(src)) {
      fs.copyFileSync(src, path.join(DIST, file));
      console.log(`  ${file}`);
    }
  }

  // 4. npm install --production
  console.log("[4/5] Installing production dependencies...");
  execSync("npm install --omit=dev", {
    cwd: DIST,
    stdio: "inherit",
  });

  // 5. Copy tb.cmd wrapper
  console.log("[5/5] Adding tb.cmd wrapper...");
  fs.copyFileSync(path.join(__dirname, "tb.cmd"), path.join(DIST, "tb.cmd"));

  // Summary
  const size = getTotalSize(DIST);
  console.log(`\n=== Done! dist/ ready (${(size / 1e6).toFixed(1)} MB) ===`);
  console.log(`\nNext: compile the installer with Inno Setup:`);
  console.log(`  iscc installer/setup.iss\n`);
}

function getTotalSize(dir) {
  let total = 0;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) total += getTotalSize(p);
    else total += fs.statSync(p).size;
  }
  return total;
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
