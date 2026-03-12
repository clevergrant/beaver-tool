const fs = require("fs");
const path = require("path");
const c = require("./colors");
const log = require("./log");
const { devices, setDeviceState, setTimeOfDay, getTimeOfDay } = require("./state");

const MIME_TYPES = {
  ".html": "text/html",
  ".css": "text/css",
  ".js": "application/javascript",
  ".json": "application/json",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
};

module.exports = function createHandler({ gameApi, port, staticDir, getStatus, logBuffer }) {
  return (req, res) => {
    const url = new URL(req.url, `http://localhost:${port}`);
    const pathname = url.pathname;

    // --- Management API ---
    if (pathname === "/_mgmt/status") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify(getStatus()));
      return;
    }

    if (pathname === "/_mgmt/stop" && req.method === "POST") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ ok: true }));
      setTimeout(() => process.exit(0), 100);
      return;
    }

    if (pathname === "/_mgmt/log") {
      const lines = (logBuffer || []).map(c.stripAnsi);
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ lines }));
      return;
    }

    // Serve frontend — index
    if (pathname === "/" || pathname === "/index.html") {
      res.writeHead(200, { "Content-Type": "text/html" });
      res.end(fs.readFileSync(path.join(staticDir, "index.html")));
      return;
    }

    // Serve static assets
    const ext = path.extname(pathname);
    if (ext && MIME_TYPES[ext]) {
      const filePath = path.join(staticDir, pathname);
      const resolved = path.resolve(filePath);
      if (!resolved.startsWith(path.resolve(staticDir))) {
        res.writeHead(403);
        res.end("Forbidden");
        return;
      }
      if (fs.existsSync(filePath)) {
        res.writeHead(200, { "Content-Type": MIME_TYPES[ext] });
        res.end(fs.readFileSync(filePath));
        return;
      }
    }

    // Lever switch-on/off — proxy to game API
    const switchMatch = pathname.match(/^\/api\/(switch-on|switch-off)\/(.+)$/);
    if (switchMatch) {
      const on = switchMatch[1] === "switch-on";
      const leverName = decodeURIComponent(switchMatch[2]);
      const gameUrl = `${gameApi}/${switchMatch[1]}/${switchMatch[2]}`;
      fetch(gameUrl, { method: "POST" })
        .then(() => {
          setDeviceState(leverName, on, "lever", "web");
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ ok: true, device: leverName, on }));
        })
        .catch((err) => {
          log.error("GAME", `API error: ${err.message}`);
          res.writeHead(502, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "Could not reach game API" }));
        });
      return;
    }

    // Lever color — proxy to game API
    const colorMatch = pathname.match(/^\/api\/color\/(.+)\/([0-9a-fA-F]{6})$/);
    if (colorMatch) {
      const leverName = decodeURIComponent(colorMatch[1]);
      const hex = colorMatch[2];
      const gameUrl = `${gameApi}/color/${colorMatch[1]}/${hex}`;
      fetch(gameUrl, { method: "POST" })
        .then(() => {
          log.game(`${c.bold}Color${c.reset} → ${c.dim}${leverName}${c.reset} #${hex}`);
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ ok: true, device: leverName, color: hex }));
        })
        .catch((err) => {
          log.error("GAME", `API error: ${err.message}`);
          res.writeHead(502, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "Could not reach game API" }));
        });
      return;
    }

    // Batch color endpoint — send multiple lever colors in one request
    if (pathname === "/api/color-batch" && req.method === "POST") {
      let body = "";
      req.on("data", (chunk) => { body += chunk; });
      req.on("end", async () => {
        let items;
        try {
          items = JSON.parse(body);
        } catch {
          res.writeHead(400, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "Invalid JSON" }));
          return;
        }
        let sent = 0, failed = 0;
        for (const { name, color } of items) {
          try {
            await fetch(`${gameApi}/color/${encodeURIComponent(name)}/${color}`, { method: "POST" });
            sent++;
          } catch {
            failed++;
          }
        }
        if (sent > 0) {
          log.game(`${c.bold}ColorBatch${c.reset} → ${c.dim}${sent} pixels${c.reset}${failed ? ` (${failed} failed)` : ""}`);
        }
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ ok: true, sent, failed }));
      });
      return;
    }

    // Webhook endpoints — game calls these
    const onMatch = pathname.match(/^\/on\/(.+)$/);
    if (onMatch) {
      let name = decodeURIComponent(onMatch[1]);
      req.resume(); // drain request body
      const type = name.startsWith("watch:") ? (name = name.slice(6), "lever") : "adapter";
      setDeviceState(name, true, type, "timberborn");
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ ok: true, device: name, on: true }));
      return;
    }
    const offMatch = pathname.match(/^\/off\/(.+)$/);
    if (offMatch) {
      let name = decodeURIComponent(offMatch[1]);
      req.resume(); // drain request body
      const type = name.startsWith("watch:") ? (name = name.slice(6), "lever") : "adapter";
      setDeviceState(name, false, type, "timberborn");
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ ok: true, device: name, on: false }));
      return;
    }

    // Time of day
    const dayMatch = pathname.match(/^\/day\/(on|off)$/);
    if (dayMatch) {
      const tod = dayMatch[1] === "on" ? "day" : "night";
      setTimeOfDay(tod);
      log.game(`${c.bold}Time${c.reset} \u2192 ${c.dim}${tod}${c.reset}`);
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ ok: true, timeOfDay: tod }));
      return;
    }

    // State API
    if (pathname === "/api/state") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ devices, timeOfDay: getTimeOfDay() }));
      return;
    }

    res.writeHead(404);
    res.end("Not found");
  };
};
