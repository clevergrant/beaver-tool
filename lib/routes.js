const fs = require("fs");
const path = require("path");
const c = require("./colors");
const log = require("./log");
const { devices, broadcast, setTimeOfDay, getTimeOfDay } = require("./state");

function collectBody(req) {
  return new Promise((resolve) => {
    const chunks = [];
    req.on("data", (chunk) => chunks.push(chunk));
    req.on("end", () => resolve(Buffer.concat(chunks).toString()));
  });
}

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
      // Strip ANSI codes for JSON output
      const strip = (s) => s.replace(/\x1b\[[0-9;]*m/g, "");
      const lines = (logBuffer || []).map(strip);
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
          if (devices[leverName]) {
            devices[leverName].on = on;
          } else {
            devices[leverName] = { type: "lever", on };
          }
          broadcast();
          log.lever(leverName, on, "web");
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

    // Webhook endpoints — game calls these
    const onMatch = pathname.match(/^\/on\/(.+)$/);
    if (onMatch) {
      const name = decodeURIComponent(onMatch[1]);
      collectBody(req).then(() => {
        if (devices[name]) {
          devices[name].on = true;
        } else {
          devices[name] = { type: "adapter", on: true };
        }
        broadcast();
        log.lever(name, true, "timberborn");
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ ok: true, device: name, on: true }));
      });
      return;
    }
    const offMatch = pathname.match(/^\/off\/(.+)$/);
    if (offMatch) {
      const name = decodeURIComponent(offMatch[1]);
      collectBody(req).then(() => {
        if (devices[name]) {
          devices[name].on = false;
        } else {
          devices[name] = { type: "adapter", on: false };
        }
        broadcast();
        log.lever(name, false, "timberborn");
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ ok: true, device: name, on: false }));
      });
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
