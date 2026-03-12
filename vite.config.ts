import { defineConfig, loadEnv } from "vite";
import type { Plugin } from "vite";
import { spawn, type ChildProcess } from "child_process";

function backendPlugin(): Plugin {
  let backend: ChildProcess | null = null;

  return {
    name: "backend-server",
    configureServer() {
      backend = spawn("tsx", ["src/server.ts"], {
        stdio: "inherit",
        shell: true,
      });
      backend.on("error", (err) => console.error("[backend]", err.message));
    },
    closeBundle() {
      backend?.kill();
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "TB_");
  const backendPort = parseInt(env.TB_PORT || "") || 80;

  return {
    root: "src/public",
    build: {
      outDir: "../dist/public",
      emptyOutDir: true,
    },
    server: {
      proxy: {
        "/api": `http://localhost:${backendPort}`,
        "/_mgmt": `http://localhost:${backendPort}`,
        "/on": `http://localhost:${backendPort}`,
        "/off": `http://localhost:${backendPort}`,
        "/day": `http://localhost:${backendPort}`,
        "/ws": { target: `ws://localhost:${backendPort}`, ws: true },
      },
    },
    plugins: [backendPlugin()],
  };
});
