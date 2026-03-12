import type WebSocket from "ws";
import log from "./log";
import { fetchDevices } from "./gameClient";
import type { Device, DeviceMap } from "./gameClient";
import { STEADY_POLL_MS, BACKOFF_INIT_MS, BACKOFF_MAX_MS } from "./config";

// Dynamic device map: { name: { type: "lever"|"adapter", on: false } }
export const devices: DeviceMap = {};

let timeOfDay: string = "unknown"; // "day" | "night" | "unknown"

export const clients: Set<WebSocket> = new Set();

export function setTimeOfDay(tod: string): void {
  if (timeOfDay !== tod) {
    timeOfDay = tod;
    broadcast();
  }
}

export function getTimeOfDay(): string {
  return timeOfDay;
}

export function broadcast(): void {
  const msg = JSON.stringify({ devices, timeOfDay, gameConnected: _gameConnected });
  for (const ws of clients) {
    if (ws.readyState === 1) ws.send(msg);
  }
}

// Update a single device's state, broadcast if changed, and optionally log.
export function setDeviceState(
  name: string,
  on: boolean,
  type: Device["type"] = "lever",
  source: string | null = null,
  user: string | null = null,
): void {
  const prev = devices[name];
  if (prev && prev.on === on && prev.type === type) return;
  const wasToggle = prev && prev.on !== on;
  devices[name] = { type, on };
  if (wasToggle || !prev) {
    if (source) log.lever(name, on, source, user ?? undefined);
  }
  broadcast();
}

let _gameApi = "";
let _pollTimer: ReturnType<typeof setTimeout> | null = null;
let _gameConnected = false;
let _onGameStatus: ((connected: boolean) => void) | null = null;

export function setGameApi(api: string): void { _gameApi = api; }
export function onGameStatus(cb: ((connected: boolean) => void) | null): void { _onGameStatus = cb; }
export function isGameConnected(): boolean { return _gameConnected; }

export async function pollDevices(): Promise<void> {
  if (!_gameApi) return;

  try {
    const fetched = await fetchDevices(_gameApi);

    const anyOk = Object.keys(fetched).length > 0;
    if (_gameConnected !== anyOk) {
      _gameConnected = anyOk;
      if (_onGameStatus) _onGameStatus(anyOk);
      broadcast();
    }

    const seen = new Set<string>();
    let changed = false;

    // Separate watch adapters from regular devices
    const watchAdapters: DeviceMap = {};
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
let _stopPolling: (() => void) | null = null;

export function startPolling(): void {
  let a = BACKOFF_INIT_MS, b = BACKOFF_INIT_MS;
  let stopped = false;
  let initialDone = false;

  async function tick(): Promise<void> {
    if (stopped) return;
    await pollDevices();

    if (!initialDone && _gameConnected) {
      initialDone = true;
      log.game("Initial device state loaded");
    }

    // Connected: steady interval. Disconnected: fibonacci backoff.
    let delay: number;
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

export function stopPolling(): void {
  if (_pollTimer) clearTimeout(_pollTimer);
  if (_stopPolling) _stopPolling();
}
