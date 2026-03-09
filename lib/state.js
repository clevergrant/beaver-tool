// Dynamic device map: { name: { type: "lever"|"adapter", on: false } }
const devices = {};
const log = require("./log");

let timeOfDay = "unknown"; // "day" | "night" | "unknown"

const clients = new Set();

function setTimeOfDay(tod) {
  if (timeOfDay !== tod) {
    timeOfDay = tod;
    broadcast();
  }
}

function broadcast() {
  const msg = JSON.stringify({ devices, timeOfDay, gameConnected: _gameConnected });
  for (const ws of clients) {
    if (ws.readyState === 1) ws.send(msg);
  }
}

let _gameApi = "";
let _pollTimer = null;
let _gameConnected = false;
let _onGameStatus = null;

function setGameApi(api) { _gameApi = api; }
function onGameStatus(cb) { _onGameStatus = cb; }
function isGameConnected() { return _gameConnected; }

async function pollDevices() {
  if (!_gameApi) return;

  try {
    const [leversRes, adaptersRes] = await Promise.allSettled([
      fetch(`${_gameApi}/levers`),
      fetch(`${_gameApi}/adapters`),
    ]);

    const anyOk = (leversRes.status === "fulfilled" && leversRes.value.ok) ||
                   (adaptersRes.status === "fulfilled" && adaptersRes.value.ok);
    if (_gameConnected !== anyOk) {
      _gameConnected = anyOk;
      if (_onGameStatus) _onGameStatus(anyOk);
      broadcast();
    }

    const seen = new Set();
    let changed = false;

    if (leversRes.status === "fulfilled" && leversRes.value.ok) {
      const levers = await leversRes.value.json();
      for (const lever of levers) {
        const name = lever.name;
        seen.add(name);
        const on = !!lever.state;
        if (!devices[name] || devices[name].on !== on || devices[name].type !== "lever") {
          if (devices[name] && devices[name].on !== on) {
            log.lever(name, on, "timberborn");
          }
          devices[name] = { type: "lever", on };
          changed = true;
        }
      }
    }

    if (adaptersRes.status === "fulfilled" && adaptersRes.value.ok) {
      const adapters = await adaptersRes.value.json();
      for (const adapter of adapters) {
        const name = adapter.name;
        seen.add(name);
        const on = !!adapter.state;
        if (!devices[name] || devices[name].on !== on || devices[name].type !== "adapter") {
          if (devices[name] && devices[name].on !== on) {
            log.lever(name, on, "timberborn");
          }
          devices[name] = { type: "adapter", on };
          changed = true;
        }
      }
    }

    // Remove devices that no longer exist in the game
    for (const name of Object.keys(devices)) {
      if (!seen.has(name)) {
        delete devices[name];
        changed = true;
      }
    }

    if (changed) {
      broadcast();
    }
  } catch (err) {
    if (_gameConnected) {
      _gameConnected = false;
      if (_onGameStatus) _onGameStatus(false);
      broadcast();
    }
  }
}

// Fibonacci-backoff initial poll: tries until first successful fetch, then stops.
// Sequence starts at 0.5s: 0.5, 0.5, 1, 1.5, 2.5, 4, 6.5, ...
function startPolling() {
  let a = 500, b = 500;
  let stopped = false;

  async function tick() {
    if (stopped) return;
    await pollDevices();
    if (_gameConnected) {
      log.game("Initial device state loaded");
      return; // success — stop polling
    }
    const delay = a;
    const next = a + b;
    a = b;
    b = next;
    _pollTimer = setTimeout(tick, delay);
  }

  tick();
  _stopPolling = () => { stopped = true; };
}

let _stopPolling = null;

function stopPolling() {
  if (_pollTimer) clearTimeout(_pollTimer);
  if (_stopPolling) _stopPolling();
}

module.exports = { devices, clients, broadcast, setGameApi, startPolling, stopPolling, pollDevices, setTimeOfDay, getTimeOfDay: () => timeOfDay, onGameStatus, isGameConnected };
