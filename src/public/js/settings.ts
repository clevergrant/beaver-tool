export interface DashboardSettings {
  paletteId: string;
  hueOffset: number;
}

const SETTINGS_KEY = "tb-settings";

const DEFAULTS: DashboardSettings = {
  paletteId: "vhs",
  hueOffset: 0,
};

type SettingsCallback = (s: DashboardSettings) => void;
const _listeners: SettingsCallback[] = [];

export function loadSettings(): DashboardSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return { ...DEFAULTS };
    const parsed = JSON.parse(raw);
    return {
      paletteId: typeof parsed.paletteId === "string" ? parsed.paletteId : DEFAULTS.paletteId,
      hueOffset: typeof parsed.hueOffset === "number" ? parsed.hueOffset : DEFAULTS.hueOffset,
    };
  } catch {
    return { ...DEFAULTS };
  }
}

export function saveSettings(s: DashboardSettings): void {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(s));
  for (const cb of _listeners) cb(s);
}

export function onSettingsChange(cb: SettingsCallback): void {
  _listeners.push(cb);
}

export function offSettingsChange(cb: SettingsCallback): void {
  const idx = _listeners.indexOf(cb);
  if (idx >= 0) _listeners.splice(idx, 1);
}
