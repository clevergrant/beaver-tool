let _gameApi = "http://localhost:300/api";

function setGameApi(url) { _gameApi = url; }
function getGameApi() { return _gameApi; }

async function fetchDevices(apiUrl) {
  const base = apiUrl || _gameApi;
  const [leversRes, adaptersRes] = await Promise.allSettled([
    fetch(`${base}/levers`),
    fetch(`${base}/adapters`),
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
  const res = await fetch(`${_gameApi}/switch-on/${encodeURIComponent(name)}`, { method: "POST" });
  if (!res.ok) throw new Error(`Game API returned ${res.status}`);
}

async function switchOff(name) {
  const res = await fetch(`${_gameApi}/switch-off/${encodeURIComponent(name)}`, { method: "POST" });
  if (!res.ok) throw new Error(`Game API returned ${res.status}`);
}

async function toggle(name) {
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

async function isGameRunning() {
  try {
    const res = await fetch(`${_gameApi}/levers`);
    return res.ok;
  } catch {
    return false;
  }
}

module.exports = { setGameApi, getGameApi, fetchDevices, switchOn, switchOff, toggle, isGameRunning };
