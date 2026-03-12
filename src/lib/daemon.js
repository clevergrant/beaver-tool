const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");
const { SHUTDOWN_POLL_MS, SHUTDOWN_RETRIES } = require("./config");

const APP_ROOT = path.join(__dirname, "..");
const RUN_DIR = path.join(APP_ROOT, ".tb");
const LOG_DIR = path.join(APP_ROOT, "logs");
const PID_FILE = path.join(RUN_DIR, "server.json");
const LOG_FILE = path.join(LOG_DIR, "previous.log");

// Use bundled node.exe if it exists (installer build), otherwise system node
const BUNDLED_NODE = path.join(APP_ROOT, "node.exe");
const NODE_EXE = fs.existsSync(BUNDLED_NODE) ? BUNDLED_NODE : process.execPath;


function ensureRunDir() {
  if (!fs.existsSync(RUN_DIR)) fs.mkdirSync(RUN_DIR, { recursive: true });
}

function writePidFile(port) {
  ensureRunDir();
  fs.writeFileSync(PID_FILE, JSON.stringify({ pid: process.pid, port, startedAt: Date.now() }));
}

function readPidFile() {
  try {
    return JSON.parse(fs.readFileSync(PID_FILE, "utf8"));
  } catch {
    return null;
  }
}

function clearPidFile() {
  try { fs.unlinkSync(PID_FILE); } catch {}
}

function isProcessAlive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function isServerRunning() {
  const info = readPidFile();
  if (!info) return { running: false, info: null };
  if (!isProcessAlive(info.pid)) {
    clearPidFile();
    return { running: false, info: null };
  }
  return { running: true, info };
}

function spawnServer() {
  ensureRunDir();
  if (!fs.existsSync(LOG_DIR)) fs.mkdirSync(LOG_DIR, { recursive: true });
  const logFd = fs.openSync(LOG_FILE, "w");
  const serverPath = path.join(APP_ROOT, "server.js");
  const child = spawn(NODE_EXE, [serverPath], {
    detached: true,
    stdio: ["ignore", logFd, logFd],
    cwd: APP_ROOT,
    env: { ...process.env, TB_HEADLESS: "1" },
    windowsHide: true,
  });
  child.unref();
  fs.closeSync(logFd);
  return child.pid;
}

async function stopServer() {
  const { running, info } = isServerRunning();
  if (!running) return false;

  // Try graceful shutdown via management API
  try {
    const res = await fetch(`http://localhost:${info.port}/_mgmt/stop`, { method: "POST" });
    if (res.ok) {
      // Wait for process to exit
      for (let i = 0; i < SHUTDOWN_RETRIES; i++) {
        await new Promise((r) => setTimeout(r, SHUTDOWN_POLL_MS));
        if (!isProcessAlive(info.pid)) {
          clearPidFile();
          return true;
        }
      }
    }
  } catch {}

  // Fallback: kill process
  try {
    process.kill(info.pid, "SIGTERM");
    for (let i = 0; i < SHUTDOWN_RETRIES; i++) {
      await new Promise((r) => setTimeout(r, SHUTDOWN_POLL_MS));
      if (!isProcessAlive(info.pid)) break;
    }
  } catch {}

  clearPidFile();
  return true;
}

module.exports = { writePidFile, readPidFile, clearPidFile, isServerRunning, spawnServer, stopServer, RUN_DIR, PID_FILE, LOG_FILE };
