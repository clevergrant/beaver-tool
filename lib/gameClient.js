const c = require("./colors");

const GAME_API = "http://localhost:300/api";

async function listDevices() {
  const [leversRes, adaptersRes] = await Promise.allSettled([
    fetch(`${GAME_API}/levers`),
    fetch(`${GAME_API}/adapters`),
  ]);

  const devices = {};

  if (leversRes.status === "fulfilled" && leversRes.value.ok) {
    const levers = await leversRes.value.json();
    for (const lever of levers) {
      devices[lever.name] = { type: "lever", on: !!lever.state };
    }
  }

  if (adaptersRes.status === "fulfilled" && adaptersRes.value.ok) {
    const adapters = await adaptersRes.value.json();
    for (const adapter of adapters) {
      devices[adapter.name] = { type: "adapter", on: !!adapter.state };
    }
  }

  return devices;
}

async function switchOn(name) {
  const res = await fetch(`${GAME_API}/switch-on/${encodeURIComponent(name)}`, { method: "POST" });
  if (!res.ok) throw new Error(`Game API returned ${res.status}`);
}

async function switchOff(name) {
  const res = await fetch(`${GAME_API}/switch-off/${encodeURIComponent(name)}`, { method: "POST" });
  if (!res.ok) throw new Error(`Game API returned ${res.status}`);
}

async function toggle(name) {
  const devices = await listDevices();
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

async function isGameRunning() {
  try {
    const res = await fetch(`${GAME_API}/levers`);
    return res.ok;
  } catch {
    return false;
  }
}

module.exports = { GAME_API, listDevices, switchOn, switchOff, toggle, isGameRunning };
