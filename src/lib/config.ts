// --- Load .env (Node doesn't auto-load like Bun does) ---
import { readFileSync } from "fs";
import { resolve } from "path";

try {
  const envPath = resolve(__dirname, "..", "..", ".env");
  const envFile = readFileSync(envPath, "utf-8");
  for (const line of envFile.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq < 0) continue;
    const key = trimmed.slice(0, eq);
    const val = trimmed.slice(eq + 1);
    if (!process.env[key]) process.env[key] = val;
  }
} catch {}

// --- Deployment config (from .env) ---
export const PORT: number          = parseInt(process.env.TB_PORT || "") || 80;
export const GAME_API: string      = process.env.TB_GAME_API || "http://localhost:8080/api";
export const DISCORD_TOKEN: string = process.env.DISCORD_BOT_TOKEN || "";

// --- Internal tuning constants ---
export const STEADY_POLL_MS: number   = 5000;
export const BACKOFF_INIT_MS: number  = 500;
export const BACKOFF_MAX_MS: number   = 30000;
export const WS_RECONNECT_MS: number  = 2000;
export const LOG_BUFFER: number       = 200;
export const SHUTDOWN_POLL_MS: number = 100;
export const SHUTDOWN_RETRIES: number = 30;
