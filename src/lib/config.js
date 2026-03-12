require("dotenv").config();

// --- Deployment config (from .env) ---
const PORT          = parseInt(process.env.TB_PORT) || 3000;
const GAME_API      = process.env.TB_GAME_API || "http://localhost:8080/api";
const DISCORD_TOKEN = process.env.DISCORD_BOT_TOKEN || "";

// --- Internal tuning constants ---
const STEADY_POLL_MS   = 5000;
const BACKOFF_INIT_MS  = 500;
const BACKOFF_MAX_MS   = 30000;
const WS_RECONNECT_MS  = 2000;
const LOG_BUFFER       = 200;
const SHUTDOWN_POLL_MS = 100;
const SHUTDOWN_RETRIES = 30;

module.exports = {
  PORT, GAME_API, DISCORD_TOKEN,
  STEADY_POLL_MS, BACKOFF_INIT_MS, BACKOFF_MAX_MS,
  WS_RECONNECT_MS, LOG_BUFFER, SHUTDOWN_POLL_MS, SHUTDOWN_RETRIES,
};
