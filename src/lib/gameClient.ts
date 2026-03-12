import { GAME_API } from "./config";

export interface Device {
  type: "lever" | "adapter";
  on: boolean;
}

export type DeviceMap = Record<string, Device>;

export interface LeverResponse {
  name: string;
  state: number | boolean;
  springReturn?: boolean;
}

export interface AdapterResponse {
  name: string;
  state: number | boolean;
}

let _gameApi: string = GAME_API;

export function setGameApi(url: string): void { _gameApi = url; }
export function getGameApi(): string { return _gameApi; }

export async function fetchDevices(apiUrl?: string): Promise<DeviceMap> {
  const base = apiUrl || _gameApi;
  const [leversRes, adaptersRes] = await Promise.allSettled([
    fetch(`${base}/levers`),
    fetch(`${base}/adapters`),
  ]);

  const devices: DeviceMap = {};

  if (leversRes.status === "fulfilled" && leversRes.value.ok) {
    const levers: LeverResponse[] = await leversRes.value.json();
    for (const lever of levers) {
      devices[lever.name] = { type: "lever", on: !!lever.state };
    }
  }

  if (adaptersRes.status === "fulfilled" && adaptersRes.value.ok) {
    const adapters: AdapterResponse[] = await adaptersRes.value.json();
    for (const adapter of adapters) {
      devices[adapter.name] = { type: "adapter", on: !!adapter.state };
    }
  }

  return devices;
}

async function _post(path: string): Promise<void> {
  const res = await fetch(`${_gameApi}/${path}`, { method: "POST" });
  if (!res.ok) throw new Error(`Game API returned ${res.status}`);
}

export async function switchOn(name: string): Promise<void> {
  await _post(`switch-on/${encodeURIComponent(name)}`);
}

export async function switchOff(name: string): Promise<void> {
  await _post(`switch-off/${encodeURIComponent(name)}`);
}

export async function toggle(name: string): Promise<boolean> {
  const devices = await fetchDevices();
  const dev = devices[name];
  if (!dev) throw new Error(`Unknown device: ${name}`);
  if (dev.type !== "lever") throw new Error(`${name} is an adapter (read-only)`);
  if (dev.on) {
    await switchOff(name);
  } else {
    await switchOn(name);
  }
  return !dev.on;
}

export async function setColor(name: string, rrggbb: string): Promise<void> {
  await _post(`color/${encodeURIComponent(name)}/${rrggbb}`);
}

export async function isGameRunning(): Promise<boolean> {
  try {
    const res = await fetch(`${_gameApi}/levers`);
    return res.ok;
  } catch {
    return false;
  }
}
