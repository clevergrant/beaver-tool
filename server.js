require("dotenv").config();
const path = require("path");
const http = require("http");
const c = require("./lib/colors");
const log = require("./lib/log");
const createHandler = require("./lib/routes");
const createDiscordBot = require("./lib/discord");
const setupWebSocket = require("./lib/websocket");
const { setGameApi: setStateGameApi, startPolling, stopPolling, onGameStatus, devices } = require("./lib/state");
const { writePidFile, clearPidFile } = require("./lib/daemon");

const PORT = process.env.TB_PORT ? parseInt(process.env.TB_PORT) : 3000;
const GAME_API = process.env.TB_GAME_API || "http://localhost:300/api";

// --- Headless mode (background server) ---
log.setHeadless(true);

// wss is assigned after server creation — declared here so onStatus can reference it
let wss;

// --- Status tracking ---
const status = {
  server: false,
  discord: false,
  discordTag: "",
  game: false,
  wsClients: 0,
  startedAt: Date.now(),
};

function onStatus(key, value) {
  status[key] = value;
  if (wss && wss.broadcastMgmt) {
    wss.broadcastMgmt({ type: "status", status: getStatus() });
  }
}

function getStatus() {
  return {
    ...status,
    uptime: Math.floor((Date.now() - status.startedAt) / 1000),
    deviceCount: Object.keys(devices).length,
    devices,
    pid: process.pid,
    port: PORT,
    gameApi: GAME_API,
  };
}

// --- Game API ---
setStateGameApi(GAME_API);
onGameStatus((connected) => {
  status.game = connected;
});

// --- HTTP Server ---
const server = http.createServer(
  createHandler({
    gameApi: GAME_API,
    port: PORT,
    staticDir: path.join(__dirname, "public"),
    getStatus,
    logBuffer: log.buffer,
  })
);

wss = setupWebSocket(server, { onStatus });
createDiscordBot({ gameApi: GAME_API, onStatus });

// Push log lines to management WS clients
log.onLog((line) => {
  if (wss && wss.broadcastMgmt) {
    wss.broadcastMgmt({ type: "log", line });
  }
});

// --- PID file ---
writePidFile(PORT);

// --- Cleanup ---
function cleanup() {
  clearPidFile();
  stopPolling();
}

process.on("exit", cleanup);
process.on("SIGINT", () => { cleanup(); process.exit(); });
process.on("SIGTERM", () => { cleanup(); process.exit(); });

// --- Start ---
server.listen(PORT, () => {
  status.server = true;
  startPolling();
  log.server(`Listening on port ${c.bold}${PORT}${c.reset}`);
  log.server(`Game API: ${c.dim}${GAME_API}${c.reset}`);
  if (process.env.DISCORD_BOT_TOKEN) {
    log.discord(`Bot accepting DMs`);
  }
});
