import { WebSocketServer, WebSocket } from "ws";
import http from "http";
import * as c from "./colors";
import log from "./log";
import { devices, clients, getTimeOfDay, isGameConnected } from "./state";

export interface MgmtMessage {
  type: string;
  [key: string]: unknown;
}

export interface MgmtWebSocketServer extends WebSocketServer {
  broadcastMgmt(msg: MgmtMessage): void;
}

interface WebSocketOptions {
  onStatus?: (key: string, value: unknown) => void;
}

export default function setupWebSocket(server: http.Server, { onStatus }: WebSocketOptions = {}): MgmtWebSocketServer {
  const wss = new WebSocketServer({ server }) as MgmtWebSocketServer;

  const mgmtClients = new Set<WebSocket>();

  wss.on("connection", (ws: WebSocket, req: http.IncomingMessage) => {
    const url = new URL(req.url || "/", "http://localhost");
    const isMgmt = url.searchParams.get("mgmt") === "1";

    clients.add(ws);
    if (isMgmt) mgmtClients.add(ws);
    if (onStatus) onStatus("wsClients", clients.size);
    log.ws(`Client connected ${c.dim}(${clients.size} total${isMgmt ? ", mgmt" : ""})${c.reset}`);

    ws.send(JSON.stringify({ type: "state", devices, timeOfDay: getTimeOfDay(), gameConnected: isGameConnected() }));

    ws.on("close", () => {
      clients.delete(ws);
      mgmtClients.delete(ws);
      if (onStatus) onStatus("wsClients", clients.size);
      log.ws(`Client disconnected ${c.dim}(${clients.size} total)${c.reset}`);
    });
  });

  wss.broadcastMgmt = function (msg: MgmtMessage) {
    const data = JSON.stringify(msg);
    for (const ws of mgmtClients) {
      if (ws.readyState === WebSocket.OPEN) ws.send(data);
    }
  };

  return wss;
}
