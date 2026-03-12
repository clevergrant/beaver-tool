const { WebSocketServer } = require("ws");
const c = require("./colors");
const log = require("./log");
const { devices, clients, getTimeOfDay, isGameConnected } = require("./state");

module.exports = function setupWebSocket(server, { onStatus } = {}) {
  const wss = new WebSocketServer({ server });

  // Management clients (tb live) get status + log updates
  const mgmtClients = new Set();

  wss.on("connection", (ws, req) => {
    const url = new URL(req.url, "http://localhost");
    const isMgmt = url.searchParams.get("mgmt") === "1";

    clients.add(ws);
    if (isMgmt) mgmtClients.add(ws);
    if (onStatus) onStatus("wsClients", clients.size);
    log.ws(`Client connected ${c.dim}(${clients.size} total${isMgmt ? ", mgmt" : ""})${c.reset}`);

    // Send current state on connect
    ws.send(JSON.stringify({ type: "state", devices, timeOfDay: getTimeOfDay(), gameConnected: isGameConnected() }));

    ws.on("close", () => {
      clients.delete(ws);
      mgmtClients.delete(ws);
      if (onStatus) onStatus("wsClients", clients.size);
      log.ws(`Client disconnected ${c.dim}(${clients.size} total)${c.reset}`);
    });
  });

  // Expose mgmt broadcast for status/log pushes
  wss.broadcastMgmt = function (msg) {
    const data = JSON.stringify(msg);
    for (const ws of mgmtClients) {
      if (ws.readyState === 1) ws.send(data);
    }
  };

  return wss;
};
