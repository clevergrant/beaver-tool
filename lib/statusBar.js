const c = require("./colors");
const WebSocket = require("ws");

/**
 * Start the live TUI view — connects to the running server over WebSocket
 * and renders a full-screen dashboard. This is invoked by `tb live`.
 */
function startLiveView({ port }) {
  const wsUrl = `ws://localhost:${port}/?mgmt=1`;

  const status = {
    server: false,
    discord: false,
    discordTag: "",
    game: false,
    wsClients: 0,
  };

  const devices = {};
  const logLines = [];
  const MAX_LOG = 200;

  let rotation = 0;
  let commandBuffer = "";
  let commandMode = false;
  let screenActive = false;
  let ws = null;
  let reconnectTimer = null;
  const serverApi = `http://localhost:${port}/api`;

  // --- WebSocket connection ---
  function connect() {
    ws = new WebSocket(wsUrl);

    ws.on("open", () => {
      status.server = true;
      render();
    });

    ws.on("message", (data) => {
      try {
        const msg = JSON.parse(data);

        if (msg.type === "state" || msg.devices) {
          // Device state update (initial or broadcast)
          const devs = msg.devices || {};
          // Sync devices object
          for (const key of Object.keys(devices)) {
            if (!(key in devs)) delete devices[key];
          }
          Object.assign(devices, devs);
          render();
        }

        if (msg.type === "status" && msg.status) {
          Object.assign(status, {
            server: msg.status.server,
            discord: msg.status.discord,
            discordTag: msg.status.discordTag,
            game: msg.status.game,
            wsClients: msg.status.wsClients,
          });
          render();
        }

        if (msg.type === "log" && msg.line) {
          logLines.push(msg.line);
          if (logLines.length > MAX_LOG) logLines.shift();
          render();
        }
      } catch {}
    });

    ws.on("close", () => {
      status.server = false;
      render();
      scheduleReconnect();
    });

    ws.on("error", () => {
      // error fires before close
    });
  }

  function scheduleReconnect() {
    if (reconnectTimer) return;
    reconnectTimer = setTimeout(() => {
      reconnectTimer = null;
      connect();
    }, 2000);
  }

  // --- Rendering ---
  function getBuildings() {
    return Object.keys(devices);
  }

  function rotatedBuildings() {
    const buildings = getBuildings();
    const len = buildings.length;
    if (len === 0) return [];
    return buildings.map((_, i) => buildings[(i + rotation) % len]);
  }

  function renderBuildingsRow() {
    const buildings = getBuildings();
    if (buildings.length === 0) return ` ${c.dim}(no devices)${c.reset}`;
    const ordered = rotatedBuildings();
    const items = ordered.map((name, i) => {
      const on = devices[name] && devices[name].on;
      const color = on ? c.green : c.dim;
      if (i === 0) {
        const bg = on ? c.bgGreen : c.bgCyan;
        return `${bg}${c.bold}[${name}]${c.reset}`;
      }
      return `${color}[${name}]${c.reset}`;
    }).join(" ");
    return ` ${c.dim}\u25C4${c.reset} ${items} ${c.dim}\u25BA${c.reset}`;
  }

  function enterAltScreen() {
    if (screenActive) return;
    screenActive = true;
    process.stdout.write("\x1b[?1049h\x1b[2J\x1b[1;1H\x1b[?25l");
  }

  function leaveAltScreen() {
    if (!screenActive) return;
    screenActive = false;
    process.stdout.write("\x1b[?25h\x1b[?1049l");
  }

  function render() {
    if (!screenActive) enterAltScreen();

    const cols = process.stdout.columns || 60;
    const rows = process.stdout.rows || 24;

    const statusDot = (on) => on ? `${c.green}\u25CF${c.reset}` : `${c.red}\u25CF${c.reset}`;

    const header = [
      `${c.cyan}${c.bold} Timberborn Colony Dashboard${c.reset}  ${statusDot(status.server)} server  ${statusDot(status.discord)} discord  ${statusDot(status.game)} game  ${c.dim}ws:${status.wsClients}${c.reset}`,
      renderBuildingsRow(),
      `${c.dim}${"─".repeat(cols)}${c.reset}`,
    ];

    const footer = commandMode
      ? [`${c.dim}${"─".repeat(cols)}${c.reset}`, `${c.cyan}>${c.reset} ${commandBuffer}${c.dim}_${c.reset}`]
      : [`${c.dim}${"─".repeat(cols)}${c.reset}`, `${c.dim} ←/→ rotate  space toggle  : command  q quit${c.reset}`];

    const logSpace = rows - header.length - footer.length - 1;
    const visibleLogs = logLines.slice(-Math.max(0, logSpace));

    let frame = "\x1b[2;1H";
    for (const line of header) {
      frame += line + "\x1b[K\n";
    }
    for (const line of visibleLogs) {
      frame += line + "\x1b[K\n";
    }
    for (let i = visibleLogs.length; i < logSpace; i++) {
      frame += "\x1b[K\n";
    }
    for (const line of footer) {
      frame += line + "\x1b[K\n";
    }

    process.stdout.write(frame);
  }

  // --- Device control ---
  function selectNext() {
    const buildings = getBuildings();
    if (buildings.length === 0) return;
    rotation = (rotation + 1) % buildings.length;
    render();
  }

  function selectPrev() {
    const buildings = getBuildings();
    if (buildings.length === 0) return;
    rotation = (rotation - 1 + buildings.length) % buildings.length;
    render();
  }

  function toggleSelected() {
    const buildings = getBuildings();
    if (buildings.length === 0) return;
    const name = buildings[rotation % buildings.length];
    const dev = devices[name];
    if (!dev || dev.type !== "lever") return;

    const action = dev.on ? "switch-off" : "switch-on";
    fetch(`${serverApi}/${action}/${encodeURIComponent(name)}`, { method: "POST" })
      .then((res) => {
        if (!res.ok) throw new Error(`Server returned ${res.status}`);
      })
      .catch((err) => {
        logLines.push(`${c.red}Toggle error:${c.reset} ${err.message}`);
        render();
      });
  }

  // --- Command handling ---
  function handleCommandInput(cmd) {
    const parts = cmd.split(/\s+/);
    const command = parts[0].toLowerCase();

    switch (command) {
      case "help":
        logLines.push(`${c.bold}Commands:${c.reset}  ${c.cyan}help${c.reset} | ${c.cyan}devices${c.reset} | ${c.cyan}toggle <name>${c.reset} | ${c.cyan}on <name>${c.reset} | ${c.cyan}off <name>${c.reset} | ${c.cyan}reload${c.reset} | ${c.cyan}quit${c.reset}`);
        render();
        break;
      case "devices":
      case "ls": {
        const names = Object.keys(devices);
        if (names.length === 0) {
          logLines.push(`${c.dim}No devices connected${c.reset}`);
        } else {
          for (const name of names) {
            const d = devices[name];
            const dot = d.on ? `${c.green}\u25CF${c.reset}` : `${c.red}\u25CF${c.reset}`;
            logLines.push(`  ${dot} ${c.bold}${name}${c.reset} ${c.dim}(${d.type})${c.reset}`);
          }
        }
        render();
        break;
      }
      case "toggle": {
        const name = parts.slice(1).join(" ");
        const dev = devices[name];
        if (!dev) {
          logLines.push(`${c.red}Unknown device:${c.reset} ${name}`);
          render();
          break;
        }
        if (dev.type !== "lever") {
          logLines.push(`${c.red}${name} is an adapter (read-only)${c.reset}`);
          render();
          break;
        }
        const toggleAction = dev.on ? "switch-off" : "switch-on";
        fetch(`${serverApi}/${toggleAction}/${encodeURIComponent(name)}`, { method: "POST" })
          .then((res) => { if (!res.ok) throw new Error(`Server returned ${res.status}`); })
          .catch((err) => { logLines.push(`${c.red}Error:${c.reset} ${err.message}`); render(); });
        break;
      }
      case "on":
      case "off": {
        const name = parts.slice(1).join(" ");
        const action = command === "on" ? "switch-on" : "switch-off";
        fetch(`${serverApi}/${action}/${encodeURIComponent(name)}`, { method: "POST" })
          .then((res) => { if (!res.ok) throw new Error(`Server returned ${res.status}`); })
          .catch((err) => { logLines.push(`${c.red}Error:${c.reset} ${err.message}`); render(); });
        break;
      }
      case "reload":
        fetch(`http://localhost:${port}/_mgmt/reload`, { method: "POST" })
          .then(() => { logLines.push(`${c.yellow}[CONFIG]${c.reset} Reloaded`); render(); })
          .catch((err) => { logLines.push(`${c.red}Error:${c.reset} ${err.message}`); render(); });
        break;
      case "quit":
      case "exit":
      case "q":
        shutdown();
        break;
      default:
        logLines.push(`${c.red}Unknown command:${c.reset} ${command}. Type ${c.cyan}help${c.reset} for a list.`);
        render();
    }
  }

  // --- Key handling ---
  function handleKey(key) {
    if (commandMode) {
      if (key[0] === 27) { // Escape
        commandMode = false;
        commandBuffer = "";
        render();
      } else if (key[0] === 13) { // Enter
        const cmd = commandBuffer.trim();
        commandMode = false;
        commandBuffer = "";
        if (cmd) handleCommandInput(cmd);
        render();
      } else if (key[0] === 127 || key[0] === 8) { // Backspace
        commandBuffer = commandBuffer.slice(0, -1);
        render();
      } else if (key[0] >= 32 && key[0] < 127) {
        commandBuffer += String.fromCharCode(key[0]);
        render();
      }
      return;
    }

    if (key[0] === 3 || key[0] === 113) { // Ctrl+C or 'q'
      shutdown();
      return;
    }
    if (key[0] === 32) toggleSelected(); // space
    if (key[0] === 58) { // colon — enter command mode
      commandMode = true;
      commandBuffer = "";
      render();
    }
    if (key[0] === 27 && key[1] === 91) {
      if (key[2] === 67) selectNext();  // right
      else if (key[2] === 68) selectPrev(); // left
    }
  }

  function shutdown() {
    if (reconnectTimer) clearTimeout(reconnectTimer);
    if (ws) ws.close();
    leaveAltScreen();
    process.exit();
  }

  // Clean up alt screen on exit
  process.on("exit", leaveAltScreen);
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
  process.stdout.on("resize", () => render());

  // --- Start ---
  if (process.stdin.isTTY) {
    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.on("data", (key) => handleKey(key));
  }

  connect();
}

module.exports = { startLiveView };
