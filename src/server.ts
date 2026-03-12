import fs from "fs";
import path from "path";
import http from "http";
import { PORT, GAME_API, DISCORD_TOKEN } from "./lib/config";
import * as c from "./lib/colors";
import log from "./lib/log";
import createHandler from "./lib/routes";
import createDiscordBot from "./lib/discord";
import setupWebSocket from "./lib/websocket";
import type { MgmtWebSocketServer } from "./lib/websocket";
import { setGameApi as setStateGameApi, startPolling, stopPolling, onGameStatus, devices } from "./lib/state";
import { writePidFile, clearPidFile } from "./lib/daemon";

log.setHeadless(true);

let wss: MgmtWebSocketServer | null = null;

const status = {
  server: false,
  discord: false,
  discordTag: "",
  game: false,
  wsClients: 0,
  startedAt: Date.now(),
};

function onStatus(key: string, value: unknown): void {
  (status as Record<string, unknown>)[key] = value;
  if (wss && wss.broadcastMgmt) {
    wss.broadcastMgmt({ type: "status", status: getStatus() });
  }
}

function getStatus(): Record<string, unknown> {
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

setStateGameApi(GAME_API);
onGameStatus((connected: boolean) => {
  status.game = connected;
});

/** Resolve static dir: prefer build output, fall back to source public/ */
function resolveStaticDir(): string {
  const buildDir = path.join(__dirname, "..", "dist", "public");
  if (fs.existsSync(path.join(buildDir, "index.html"))) return buildDir;
  return path.join(__dirname, "..", "src", "public");
}

const server = http.createServer(
  createHandler({
    gameApi: GAME_API,
    port: PORT,
    staticDir: resolveStaticDir(),
    getStatus,
    logBuffer: log.buffer,
  })
);

wss = setupWebSocket(server, { onStatus });
createDiscordBot({ gameApi: GAME_API, onStatus });

log.onLog((line: string) => {
  if (wss && wss.broadcastMgmt) {
    wss.broadcastMgmt({ type: "log", line });
  }
});

writePidFile(PORT);

function cleanup(): void {
  clearPidFile();
  stopPolling();
}

process.on("exit", cleanup);
process.on("SIGINT", () => { cleanup(); process.exit(); });
process.on("SIGTERM", () => { cleanup(); process.exit(); });

server.listen(PORT, () => {
  status.server = true;
  startPolling();
  log.server(`Listening on port ${c.bold}${PORT}${c.reset}`);
  log.server(`Game API: ${c.dim}${GAME_API}${c.reset}`);
  if (DISCORD_TOKEN) {
    log.discord(`Bot accepting DMs`);
  }
});
