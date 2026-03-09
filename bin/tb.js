#!/usr/bin/env node
const path = require("path");

// Ensure we can resolve lib/ modules
const LIB = path.join(__dirname, "..", "lib");
const c = require(path.join(LIB, "colors"));
const daemon = require(path.join(LIB, "daemon"));
const gameClient = require(path.join(LIB, "gameClient"));

const command = process.argv[2];
const args = process.argv.slice(3);

function usage() {
  console.log(`
${c.cyan}${c.bold}tb${c.reset} — Timberborn Colony CLI

${c.bold}Usage:${c.reset} tb <command> [args]

${c.bold}Server:${c.reset}
  ${c.cyan}start${c.reset}              Start the dashboard server in the background
  ${c.cyan}stop${c.reset}               Stop the background server
  ${c.cyan}restart${c.reset}            Stop and restart the server
  ${c.cyan}status${c.reset}             Show server & game status
  ${c.cyan}live${c.reset}               Enter full-screen live monitoring view
  ${c.cyan}log${c.reset}                Show recent server log

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

async function main() {
  switch (command) {
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
      console.log(`Run ${c.cyan}tb help${c.reset} for usage.`);
      process.exit(1);
  }
}

// --- Commands ---

async function cmdStart() {
  const { running, info } = daemon.isServerRunning();
  if (running) {
    console.log(`Server already running ${c.dim}(PID ${info.pid}, port ${info.port})${c.reset}`);
    return;
  }

  const pid = daemon.spawnServer();
  console.log(`Starting server... ${c.dim}(PID ${pid})${c.reset}`);

  // Wait for PID file to confirm startup
  let port;
  for (let i = 0; i < 30; i++) {
    await new Promise((r) => setTimeout(r, 100));
    const check = daemon.isServerRunning();
    if (check.running) {
      port = check.info.port;
      console.log(`${c.green}\u25CF${c.reset} Server started ${c.dim}(port ${port})${c.reset}`);
      break;
    }
  }

  if (!port) {
    console.log(`${c.yellow}\u25CF${c.reset} Server spawned but PID file not yet written. Check ${c.dim}tb status${c.reset}`);
    return;
  }

}

async function cmdStop() {
  const { running } = daemon.isServerRunning();
  if (!running) {
    console.log("Server is not running.");
    return;
  }

  console.log("Stopping server...");
  await daemon.stopServer();
  console.log(`${c.green}\u25CF${c.reset} Server stopped.`);
}

async function cmdRestart() {
  const { running } = daemon.isServerRunning();
  if (running) {
    console.log("Stopping server...");
    await daemon.stopServer();
    console.log(`${c.green}\u25CF${c.reset} Server stopped.`);
  }
  await cmdStart();
}

async function cmdStatus() {
  const { running, info } = daemon.isServerRunning();

  if (running) {
    // Fetch full status from management API
    try {
      const res = await fetch(`http://localhost:${info.port}/_mgmt/status`);
      const s = await res.json();
      const uptime = formatUptime(s.uptime);
      console.log(`${c.green}\u25CF${c.reset} ${c.bold}Server${c.reset}    running ${c.dim}(PID ${s.pid}, port ${s.port}, up ${uptime})${c.reset}`);
      console.log(`${dot(s.game)} ${c.bold}Game${c.reset}      ${s.game ? "connected" : "not connected"} ${c.dim}(${s.gameApi})${c.reset}`);
      console.log(`${dot(s.discord)} ${c.bold}Discord${c.reset}   ${s.discord ? `connected (${s.discordTag})` : "not connected"}${c.reset}`);
      console.log(`  ${c.bold}Devices${c.reset}   ${s.deviceCount} ${c.dim}(${Object.keys(s.devices).filter(n => s.devices[n].type === "lever").length} levers, ${Object.keys(s.devices).filter(n => s.devices[n].type === "adapter").length} adapters)${c.reset}`);
      console.log(`  ${c.bold}WS${c.reset}        ${s.wsClients} client${s.wsClients !== 1 ? "s" : ""}`);
    } catch {
      console.log(`${c.green}\u25CF${c.reset} Server PID ${info.pid} ${c.dim}(port ${info.port})${c.reset} — could not reach management API`);
    }
  } else {
    console.log(`${c.red}\u25CF${c.reset} ${c.bold}Server${c.reset}    not running`);
  }

  // Check game directly
  const gameUp = await gameClient.isGameRunning();
  if (!running) {
    console.log(`${dot(gameUp)} ${c.bold}Game${c.reset}      ${gameUp ? "reachable" : "not reachable"} ${c.dim}(${gameClient.GAME_API})${c.reset}`);
  }
}

async function cmdLive() {
  let { running, info } = daemon.isServerRunning();
  if (!running) {
    console.log("Server not running. Starting it first...");
    daemon.spawnServer();
    // Wait for it
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

  const { startLiveView } = require(path.join(LIB, "statusBar"));
  startLiveView({ port: info.port });
}

async function cmdLog() {
  const { running, info } = daemon.isServerRunning();
  if (!running) {
    // Try reading log file directly
    const fs = require("fs");
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
    const { lines } = await res.json();
    for (const line of lines) {
      console.log(line);
    }
  } catch (err) {
    console.log(`${c.red}Could not fetch logs:${c.reset} ${err.message}`);
  }
}

async function cmdDevices() {
  try {
    const devices = await gameClient.listDevices();
    const names = Object.keys(devices);
    if (names.length === 0) {
      console.log(`${c.dim}No devices found — is Timberborn running?${c.reset}`);
      return;
    }
    for (const name of names) {
      const d = devices[name];
      const dot = d.on ? `${c.green}\u25CF${c.reset}` : `${c.red}\u25CF${c.reset}`;
      console.log(`  ${dot} ${c.bold}${name}${c.reset} ${c.dim}(${d.type})${c.reset}`);
    }
  } catch (err) {
    console.log(`${c.red}Could not reach game API:${c.reset} ${err.message}`);
  }
}

async function cmdSwitch(onOff) {
  const name = args.join(" ");
  if (!name) {
    console.log(`Usage: tb ${onOff} <device name>`);
    process.exit(1);
  }
  try {
    const fn = onOff === "on" ? gameClient.switchOn : gameClient.switchOff;
    await fn(name);
    const symbol = onOff === "on" ? `${c.green}\u25CF ON${c.reset}` : `${c.red}\u25CF OFF${c.reset}`;
    console.log(`${c.bold}${name}${c.reset} ${symbol}`);
  } catch (err) {
    console.log(`${c.red}Error:${c.reset} ${err.message}`);
    process.exit(1);
  }
}

async function cmdToggle() {
  const name = args.join(" ");
  if (!name) {
    console.log("Usage: tb toggle <device name>");
    process.exit(1);
  }
  try {
    const on = await gameClient.toggle(name);
    const symbol = on ? `${c.green}\u25CF ON${c.reset}` : `${c.red}\u25CF OFF${c.reset}`;
    console.log(`${c.bold}${name}${c.reset} ${symbol}`);
  } catch (err) {
    console.log(`${c.red}Error:${c.reset} ${err.message}`);
    process.exit(1);
  }
}

async function cmdConfig() {
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
    console.log(`${c.red}Error:${c.reset} ${err.message}`);
  }
}

// --- Helpers ---

function dot(on) {
  return on ? `${c.green}\u25CF${c.reset}` : `${c.red}\u25CF${c.reset}`;
}

function formatUptime(seconds) {
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
