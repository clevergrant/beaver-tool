const c = require("./colors");
const WebSocket = require("ws");
const { WS_RECONNECT_MS, LOG_BUFFER } = require("./config");

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
  const MAX_LOG = LOG_BUFFER;

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
          // Only keep levers — adapters are not shown in the live view.
          // Watch adapters (watch:*) are already merged into lever state server-side.
          const devs = msg.devices || {};
          for (const key of Object.keys(devices)) {
            if (!(key in devs) || devs[key].type !== "lever") delete devices[key];
          }
          for (const [key, val] of Object.entries(devs)) {
            if (val.type === "lever") devices[key] = val;
          }
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
    }, WS_RECONNECT_MS);
  }

  // --- Rendering ---
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
      `${c.dim}${"─".repeat(cols)}${c.reset}`,
    ];

    const footer = commandMode
      ? [`${c.dim}${"─".repeat(cols)}${c.reset}`, `${c.cyan}>${c.reset} ${commandBuffer}${c.dim}_${c.reset}`]
      : [`${c.dim}${"─".repeat(cols)}${c.reset}`, `${c.dim} : command  q quit${c.reset}`];

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
        const names = Object.keys(devices).sort();
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
    if (key[0] === 58) { // colon — enter command mode
      commandMode = true;
      commandBuffer = "";
      render();
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
