/**
 * Bun fullstack dev server — replaces Vite for development.
 *
 * Serves the frontend from src/public/ with HMR,
 * spawns the backend server, and proxies API + WebSocket requests.
 */

import { spawn, type ChildProcess } from "child_process";
import type { BunPlugin, ServerWebSocket } from "bun";
import * as sass from "sass";
import path from "path";

// ---------------------------------------------------------------------------
// SCSS plugin — compiles .scss to CSS string exports for shadow DOM injection
// ---------------------------------------------------------------------------

const componentsDir = path
  .resolve(import.meta.dir, "src/public/components")
  .replaceAll("\\", "/");

const scssPlugin: BunPlugin = {
  name: "scss-loader",
  setup(build) {
    build.onLoad({ filter: /\.scss$/ }, async (args) => {
      const result = sass.compile(args.path);
      return {
        contents: `export default ${JSON.stringify(result.css)};`,
        loader: "js",
      };
    });
  },
};

// ---------------------------------------------------------------------------
// Environment
// ---------------------------------------------------------------------------

const backendPort = parseInt(process.env.TB_PORT || "") || 80;
const devPort = 5173;

// ---------------------------------------------------------------------------
// Spawn backend server
// ---------------------------------------------------------------------------

const backend: ChildProcess = spawn("bun", ["src/server.ts"], {
  stdio: "inherit",
  shell: true,
});
backend.on("error", (err: Error) => console.error("[backend]", err.message));

function cleanup(): void {
  backend.kill();
}
process.on("exit", cleanup);
process.on("SIGINT", () => {
  cleanup();
  process.exit();
});
process.on("SIGTERM", () => {
  cleanup();
  process.exit();
});

// ---------------------------------------------------------------------------
// WebSocket relay — maps client sockets to backend sockets
// ---------------------------------------------------------------------------

const wsBackendMap = new WeakMap<ServerWebSocket, WebSocket>();

// ---------------------------------------------------------------------------
// Dev server
// ---------------------------------------------------------------------------

const proxyPrefixes = ["/api", "/_mgmt", "/on", "/off", "/day"];

Bun.serve({
  port: devPort,
  development: {
    hmr: true,
    console: true,
  },
  routes: {
    "/*": import("./src/public/index.html"),
  },
  fetch(req, server) {
    const url = new URL(req.url);

    // WebSocket upgrade for /ws
    if (url.pathname === "/ws" && req.headers.get("upgrade") === "websocket") {
      const upgraded = server.upgrade(req);
      if (upgraded) return undefined;
      return new Response("WebSocket upgrade failed", { status: 500 });
    }

    // Proxy API routes to backend
    if (proxyPrefixes.some((p) => url.pathname.startsWith(p))) {
      return fetch(
        `http://localhost:${backendPort}${url.pathname}${url.search}`,
        {
          method: req.method,
          headers: req.headers,
          body:
            req.method !== "GET" && req.method !== "HEAD"
              ? req.body
              : undefined,
        },
      );
    }

    // Let Bun's route handler serve the frontend
    return undefined;
  },
  websocket: {
    open(ws: ServerWebSocket) {
      // Connect to backend WebSocket
      const backendWs = new WebSocket(
        `ws://localhost:${backendPort}/ws`,
      );
      wsBackendMap.set(ws, backendWs);

      backendWs.onmessage = (event: MessageEvent) => {
        ws.send(event.data as string);
      };
      backendWs.onclose = () => {
        ws.close();
      };
      backendWs.onerror = () => {
        ws.close();
      };
    },
    message(ws: ServerWebSocket, message: string | Buffer) {
      const backendWs = wsBackendMap.get(ws);
      if (backendWs?.readyState === WebSocket.OPEN) {
        backendWs.send(message);
      }
    },
    close(ws: ServerWebSocket) {
      const backendWs = wsBackendMap.get(ws);
      if (backendWs) {
        backendWs.close();
        wsBackendMap.delete(ws);
      }
    },
  },
  plugins: [scssPlugin],
});

console.log(`Dev server running at http://localhost:${devPort}`);
