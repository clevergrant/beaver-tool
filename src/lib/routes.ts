import fs from "fs";
import path from "path";
import http from "http";
import * as c from "./colors";
import log from "./log";
import { devices, setDeviceState, setTimeOfDay, getTimeOfDay } from "./state";

const MIME_TYPES: Record<string, string> = {
  ".html": "text/html",
  ".css": "text/css",
  ".js": "application/javascript",
  ".json": "application/json",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
};

interface HandlerOptions {
  gameApi: string;
  port: number;
  staticDir: string;
  getStatus: () => Record<string, unknown>;
  logBuffer: string[];
}

function sendGameApiError(res: http.ServerResponse, err: Error): void {
  log.error("GAME", `API error: ${err.message}`);
  res.writeHead(502, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ error: "Could not reach game API" }));
}

export default function createHandler({ gameApi, port, staticDir, getStatus, logBuffer }: HandlerOptions) {
  return (req: http.IncomingMessage, res: http.ServerResponse) => {
    const url = new URL(req.url || "/", `http://localhost:${port}`);
    const pathname = url.pathname;

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

    if (pathname === "/" || pathname === "/index.html") {
      res.writeHead(200, { "Content-Type": "text/html" });
      res.end(fs.readFileSync(path.join(staticDir, "index.html")));
      return;
    }

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
        res.writeHead(200, { "Content-Type": MIME_TYPES[ext]! });
        res.end(fs.readFileSync(filePath));
        return;
      }
    }

    const switchMatch = pathname.match(/^\/api\/(switch-on|switch-off)\/(.+)$/);
    if (switchMatch) {
      const on = switchMatch[1] === "switch-on";
      const leverName = decodeURIComponent(switchMatch[2]!);
      const gameUrl = `${gameApi}/${switchMatch[1]}/${switchMatch[2]}`;
      fetch(gameUrl, { method: "POST" })
        .then(() => {
          setDeviceState(leverName, on, "lever", "web");
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ ok: true, device: leverName, on }));
        })
        .catch((err: Error) => sendGameApiError(res, err));
      return;
    }

    const colorMatch = pathname.match(/^\/api\/color\/(.+)\/([0-9a-fA-F]{6})$/);
    if (colorMatch) {
      const leverName = decodeURIComponent(colorMatch[1]!);
      const hex = colorMatch[2]!;
      const gameUrl = `${gameApi}/color/${colorMatch[1]}/${hex}`;
      fetch(gameUrl, { method: "POST" })
        .then(() => {
          log.game(`${c.bold}Color${c.reset} → ${c.dim}${leverName}${c.reset} #${hex}`);
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ ok: true, device: leverName, color: hex }));
        })
        .catch((err: Error) => sendGameApiError(res, err));
      return;
    }

    if (pathname === "/api/color-batch" && req.method === "POST") {
      let body = "";
      req.on("data", (chunk: Buffer) => { body += chunk; });
      req.on("end", async () => {
        let items: Array<{ name: string; color: string }>;
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

    const onMatch = pathname.match(/^\/on\/(.+)$/);
    if (onMatch) {
      let name = decodeURIComponent(onMatch[1]!);
      req.resume();
      const type = name.startsWith("watch:") ? (name = name.slice(6), "lever" as const) : "adapter" as const;
      setDeviceState(name, true, type, "timberborn");
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ ok: true, device: name, on: true }));
      return;
    }
    const offMatch = pathname.match(/^\/off\/(.+)$/);
    if (offMatch) {
      let name = decodeURIComponent(offMatch[1]!);
      req.resume();
      const type = name.startsWith("watch:") ? (name = name.slice(6), "lever" as const) : "adapter" as const;
      setDeviceState(name, false, type, "timberborn");
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ ok: true, device: name, on: false }));
      return;
    }

    const dayMatch = pathname.match(/^\/day\/(on|off)$/);
    if (dayMatch) {
      const tod = dayMatch[1] === "on" ? "day" : "night";
      setTimeOfDay(tod);
      log.game(`${c.bold}Time${c.reset} → ${c.dim}${tod}${c.reset}`);
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ ok: true, timeOfDay: tod }));
      return;
    }

    if (pathname === "/api/state") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ devices, timeOfDay: getTimeOfDay() }));
      return;
    }

    res.writeHead(404);
    res.end("Not found");
  };
}
