import fs from "fs";
import path from "path";
import { spawn } from "child_process";
import { SHUTDOWN_POLL_MS, SHUTDOWN_RETRIES } from "./config";

export interface PidInfo {
  pid: number;
  port: number;
  startedAt: number;
}

type ServerStatus =
  | { running: true; info: PidInfo }
  | { running: false; info: null };

const APP_ROOT = path.join(__dirname, "..");
export const RUN_DIR = path.join(APP_ROOT, ".tb");
const LOG_DIR = path.join(APP_ROOT, "logs");
export const PID_FILE = path.join(RUN_DIR, "server.json");
export const LOG_FILE = path.join(LOG_DIR, "previous.log");

// Use bundled node.exe if it exists (installer build), otherwise system node
const BUNDLED_NODE = path.join(APP_ROOT, "node.exe");
const NODE_EXE = fs.existsSync(BUNDLED_NODE) ? BUNDLED_NODE : process.execPath;

function ensureRunDir(): void {
  if (!fs.existsSync(RUN_DIR)) fs.mkdirSync(RUN_DIR, { recursive: true });
}

export function writePidFile(port: number): void {
  ensureRunDir();
  fs.writeFileSync(PID_FILE, JSON.stringify({ pid: process.pid, port, startedAt: Date.now() }));
}

export function readPidFile(): PidInfo | null {
  try {
    return JSON.parse(fs.readFileSync(PID_FILE, "utf8")) as PidInfo;
  } catch {
    return null;
  }
}

export function clearPidFile(): void {
  try { fs.unlinkSync(PID_FILE); } catch {}
}

function isProcessAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

export function isServerRunning(): ServerStatus {
  const info = readPidFile();
  if (!info) return { running: false, info: null };
  if (!isProcessAlive(info.pid)) {
    clearPidFile();
    return { running: false, info: null };
  }
  return { running: true, info };
}

export function spawnServer(): number | undefined {
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

export async function stopServer(): Promise<boolean> {
  const status = isServerRunning();
  if (!status.running) return false;

  const { info } = status;

  // Try graceful shutdown via management API
  try {
    const res = await fetch(`http://localhost:${info.port}/_mgmt/stop`, { method: "POST" });
    if (res.ok) {
      // Wait for process to exit
      for (let i = 0; i < SHUTDOWN_RETRIES; i++) {
        await new Promise<void>((r) => setTimeout(r, SHUTDOWN_POLL_MS));
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
      await new Promise<void>((r) => setTimeout(r, SHUTDOWN_POLL_MS));
      if (!isProcessAlive(info.pid)) break;
    }
  } catch {}

  clearPidFile();
  return true;
}
