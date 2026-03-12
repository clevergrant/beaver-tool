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
