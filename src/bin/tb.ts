#!/usr/bin/env bun
import fs from "fs";
import path from "path";
import { execSync } from "child_process";
import * as c from "../lib/colors";
import * as daemon from "../lib/daemon";
import * as gameClient from "../lib/gameClient";

const command = process.argv[2];
const args = process.argv.slice(3);

function usage(): void {
  console.log(`
${c.cyan}${c.bold}beavers${c.reset} — Timberborn Colony CLI

${c.bold}Usage:${c.reset} beavers <command> [args]

${c.bold}Server:${c.reset}
  ${c.cyan}start${c.reset}              Start the dashboard server in the background
  ${c.cyan}stop${c.reset}               Stop the background server
  ${c.cyan}restart${c.reset}            Stop and restart the server
  ${c.cyan}status${c.reset}             Show server & game status
  ${c.cyan}live${c.reset}               Enter full-screen live monitoring view
  ${c.cyan}log${c.reset}                Show recent server log
  ${c.cyan}dev${c.reset}                Start the dev server (with backend)

${c.bold}Devices:${c.reset}
  ${c.cyan}devices${c.reset}            List all levers and adapters
  ${c.cyan}on${c.reset} <name>          Switch a lever on
  ${c.cyan}off${c.reset} <name>         Switch a lever off
  ${c.cyan}toggle${c.reset} <name>      Toggle a lever

${c.bold}Config:${c.reset}
  ${c.cyan}config${c.reset}             Show current dashboard config path
  ${c.cyan}config reload${c.reset}      Reload config on running server
`);
}

async function main(): Promise<void> {
  switch (command) {
    case "dev":
      return cmdDev();
    case "start":
      return cmdStart();
    case "stop":
      return cmdStop();
    case "restart":
      return cmdRestart();
    case "status":
      return cmdStatus();
    case "live":
    case "monitor":
      return cmdLive();
    case "log":
    case "logs":
      return cmdLog();
    case "devices":
    case "ls":
      return cmdDevices();
    case "on":
      return cmdSwitch("on");
    case "off":
      return cmdSwitch("off");
    case "toggle":
      return cmdToggle();
    case "config":
      return cmdConfig();
    case "help":
    case "--help":
    case "-h":
    case undefined:
      return usage();
    default:
      console.log(`${c.red}Unknown command:${c.reset} ${command}`);
      console.log(`Run ${c.cyan}beavers help${c.reset} for usage.`);
      process.exit(1);
  }
}

function cmdDev(): void {
  const root = path.resolve(__dirname, "../..");
  console.log(`${c.cyan}Starting dev server...${c.reset}`);
  execSync("bun dev.ts", { cwd: root, stdio: "inherit" });
}

async function cmdStart(): Promise<void> {
  const { running, info } = daemon.isServerRunning();
  if (running) {
    console.log(`Server already running ${c.dim}(PID ${info.pid}, port ${info.port})${c.reset}`);
    return;
  }

  const root = path.resolve(__dirname, "../..");
  const installed = fs.existsSync(path.join(root, "node.exe"));

  if (!installed) {
    // Ensure global `beavers` symlink points to this package
    try {
      execSync("beavers help", { stdio: "pipe" });
    } catch {
      console.log(`${c.dim}Linking beavers command...${c.reset}`);
      execSync("bun link", { cwd: root, stdio: "inherit" });
    }

    console.log(`${c.dim}Building...${c.reset}`);
    execSync("bun run build", { cwd: root, stdio: "inherit" });
  }

  const pid = daemon.spawnServer();
  console.log(`Starting server... ${c.dim}(PID ${pid})${c.reset}`);

  let port: number | undefined;
  for (let i = 0; i < 30; i++) {
    await new Promise((r) => setTimeout(r, 100));
    const check = daemon.isServerRunning();
    if (check.running) {
      port = check.info.port;
      console.log(`${c.green}●${c.reset} Server started ${c.dim}(port ${port})${c.reset}`);
      break;
    }
  }

  if (!port) {
    console.log(`${c.yellow}●${c.reset} Server spawned but PID file not yet written. Check ${c.dim}beavers status${c.reset}`);
    return;
  }
}

async function cmdStop(): Promise<void> {
  const { running } = daemon.isServerRunning();
  if (!running) {
    console.log("Server is not running.");
    return;
  }

  console.log("Stopping server...");
  await daemon.stopServer();
  console.log(`${c.green}●${c.reset} Server stopped.`);
}

async function cmdRestart(): Promise<void> {
  const { running } = daemon.isServerRunning();
  if (running) {
    console.log("Stopping server...");
    await daemon.stopServer();
    console.log(`${c.green}●${c.reset} Server stopped.`);
  }
  await cmdStart();
}

async function cmdStatus(): Promise<void> {
  const { running, info } = daemon.isServerRunning();

  if (running) {
    try {
      const res = await fetch(`http://localhost:${info.port}/_mgmt/status`);
      const s = await res.json() as Record<string, any>;
      const uptime = formatUptime(s.uptime);
      console.log(`${c.green}●${c.reset} ${c.bold}Server${c.reset}    running ${c.dim}(PID ${s.pid}, port ${s.port}, up ${uptime})${c.reset}`);
      console.log(`${c.dot(s.game)} ${c.bold}Game${c.reset}      ${s.game ? "connected" : "not connected"} ${c.dim}(${s.gameApi})${c.reset}`);
      console.log(`${c.dot(s.discord)} ${c.bold}Discord${c.reset}   ${s.discord ? `connected (${s.discordTag})` : "not connected"}${c.reset}`);
      console.log(`  ${c.bold}Devices${c.reset}   ${s.deviceCount} ${c.dim}(${Object.keys(s.devices).filter((n: string) => s.devices[n].type === "lever").length} levers, ${Object.keys(s.devices).filter((n: string) => s.devices[n].type === "adapter").length} adapters)${c.reset}`);
      console.log(`  ${c.bold}WS${c.reset}        ${s.wsClients} client${s.wsClients !== 1 ? "s" : ""}`);
    } catch {
      console.log(`${c.green}●${c.reset} Server PID ${info.pid} ${c.dim}(port ${info.port})${c.reset} — could not reach management API`);
    }
  } else {
    console.log(`${c.red}●${c.reset} ${c.bold}Server${c.reset}    not running`);
  }

  const gameUp = await gameClient.isGameRunning();
  if (!running) {
    console.log(`${c.dot(gameUp)} ${c.bold}Game${c.reset}      ${gameUp ? "reachable" : "not reachable"} ${c.dim}(${gameClient.getGameApi()})${c.reset}`);
  }
}

async function cmdLive(): Promise<void> {
  let { running, info } = daemon.isServerRunning();
  if (!running) {
    console.log("Server not running. Starting it first...");
    daemon.spawnServer();
    for (let i = 0; i < 30; i++) {
      await new Promise((r) => setTimeout(r, 100));
      const check = daemon.isServerRunning();
      if (check.running) {
        info = check.info;
        running = true;
        break;
      }
    }
    if (!running) {
      console.log(`${c.red}Failed to start server.${c.reset}`);
      process.exit(1);
    }
  }

  const { startLiveView } = await import("../lib/statusBar");
  startLiveView({ port: info!.port });
}

async function cmdLog(): Promise<void> {
  const { running, info } = daemon.isServerRunning();
  if (!running) {
    if (fs.existsSync(daemon.LOG_FILE)) {
      const lines = fs.readFileSync(daemon.LOG_FILE, "utf8").split("\n").slice(-50);
      for (const line of lines) {
        if (line) console.log(line);
      }
    } else {
      console.log("Server is not running and no log file found.");
    }
    return;
  }

  try {
    const res = await fetch(`http://localhost:${info.port}/_mgmt/log`);
    const { lines } = await res.json() as { lines: string[] };
    for (const line of lines) {
      console.log(line);
    }
  } catch (err) {
    console.log(`${c.red}Could not fetch logs:${c.reset} ${(err as Error).message}`);
  }
}

async function cmdDevices(): Promise<void> {
  try {
    const devices = await gameClient.fetchDevices();
    const names = Object.keys(devices);
    if (names.length === 0) {
      console.log(`${c.dim}No devices found — is Timberborn running?${c.reset}`);
      return;
    }
    for (const name of names) {
      const d = devices[name];
      console.log(c.formatDeviceLine(name, d?.type ?? "unknown", d?.on ?? false));
    }
  } catch (err) {
    console.log(`${c.red}Could not reach game API:${c.reset} ${(err as Error).message}`);
  }
}

async function cmdSwitch(onOff: string): Promise<void> {
  const name = args.join(" ");
  if (!name) {
    console.log(`Usage: beavers ${onOff} <device name>`);
    process.exit(1);
  }
  try {
    const fn = onOff === "on" ? gameClient.switchOn : gameClient.switchOff;
    await fn(name);
    const symbol = onOff === "on" ? `${c.green}● ON${c.reset}` : `${c.red}● OFF${c.reset}`;
    console.log(`${c.bold}${name}${c.reset} ${symbol}`);
  } catch (err) {
    console.log(`${c.red}Error:${c.reset} ${(err as Error).message}`);
    process.exit(1);
  }
}

async function cmdToggle(): Promise<void> {
  const name = args.join(" ");
  if (!name) {
    console.log("Usage: beavers toggle <device name>");
    process.exit(1);
  }
  try {
    const on = await gameClient.toggle(name);
    const symbol = on ? `${c.green}● ON${c.reset}` : `${c.red}● OFF${c.reset}`;
    console.log(`${c.bold}${name}${c.reset} ${symbol}`);
  } catch (err) {
    console.log(`${c.red}Error:${c.reset} ${(err as Error).message}`);
    process.exit(1);
  }
}

async function cmdConfig(): Promise<void> {
  const { running, info } = daemon.isServerRunning();
  if (!running) {
    console.log("Server is not running.");
    return;
  }
  try {
    const res = await fetch(`http://localhost:${info.port}/api/config`);
    const config = await res.json();
    console.log(`${c.bold}Config (in-memory):${c.reset}`);
    console.log(`${c.dim}${JSON.stringify(config, null, 2)}${c.reset}`);
  } catch (err) {
    console.log(`${c.red}Error:${c.reset} ${(err as Error).message}`);
  }
}

function formatUptime(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return `${h}h ${m}m`;
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
