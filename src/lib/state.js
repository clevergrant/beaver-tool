// Dynamic device map: { name: { type: "lever"|"adapter", on: false } }
const devices = {};
const log = require("./log");
const { fetchDevices } = require("./gameClient");

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

// Update a single device's state, broadcast if changed, and optionally log.
function setDeviceState(name, on, type = "lever", source = null, user = null) {
  const prev = devices[name];
  if (prev && prev.on === on && prev.type === type) return;
  const wasToggle = prev && prev.on !== on;
  devices[name] = { type, on };
  if (wasToggle || !prev) {
    if (source) log.lever(name, on, source, user);
  }
  broadcast();
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
    const fetched = await fetchDevices(_gameApi);

    const anyOk = Object.keys(fetched).length > 0;
    if (_gameConnected !== anyOk) {
      _gameConnected = anyOk;
      if (_onGameStatus) _onGameStatus(anyOk);
      broadcast();
    }

    const seen = new Set();
    let changed = false;

    // Separate watch adapters from regular devices
    const watchAdapters = {};
    for (const [name, dev] of Object.entries(fetched)) {
      if (dev.type === "adapter" && name.startsWith("watch:")) {
        watchAdapters[name.slice(6)] = dev;
        continue;
      }
      seen.add(name);
      const prev = devices[name];
      if (!prev || prev.on !== dev.on || prev.type !== dev.type) {
        if (prev && prev.on !== dev.on) {
          log.lever(name, dev.on, "timberborn");
        }
        devices[name] = dev;
        changed = true;
      }
    }

    // Merge watch adapter state into their matched levers
    for (const [leverName, watchDev] of Object.entries(watchAdapters)) {
      const lever = devices[leverName];
      if (lever && lever.type === "lever" && lever.on !== watchDev.on) {
        log.lever(leverName, watchDev.on, "timberborn");
        lever.on = watchDev.on;
        changed = true;
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

// Fibonacci-backoff until first successful fetch, then steady-state polling.
// Backoff sequence starts at 0.5s: 0.5, 0.5, 1, 1.5, 2.5, 4, 6.5, ...
// Once connected, polls every STEADY_POLL_MS to pick up new/removed buildings.
const { STEADY_POLL_MS, BACKOFF_INIT_MS, BACKOFF_MAX_MS } = require("./config");

function startPolling() {
  let a = BACKOFF_INIT_MS, b = BACKOFF_INIT_MS;
  let stopped = false;
  let initialDone = false;

  async function tick() {
    if (stopped) return;
    await pollDevices();

    if (!initialDone && _gameConnected) {
      initialDone = true;
      log.game("Initial device state loaded");
    }

    // Connected: steady interval. Disconnected: fibonacci backoff.
    let delay;
    if (_gameConnected) {
      delay = STEADY_POLL_MS;
      a = BACKOFF_INIT_MS; b = BACKOFF_INIT_MS; // reset backoff for next disconnect
    } else {
      delay = a;
      const next = a + b;
      a = b;
      b = Math.min(next, BACKOFF_MAX_MS);
    }

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

module.exports = { devices, clients, broadcast, setDeviceState, setGameApi, startPolling, stopPolling, pollDevices, setTimeOfDay, getTimeOfDay: () => timeOfDay, onGameStatus, isGameConnected };
