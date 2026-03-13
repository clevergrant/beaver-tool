import type { ComponentData } from '../types';
import { COMP_MIN_WIDTH, COMP_MIN_HEIGHT } from './grid';
import { ErrorBus, IO0001, IO0002 } from './errors';

interface RootData {
  title: string;
  components: string[];
}

export interface StoreApi {
  getTitle(): string;
  setTitle(title: string): void;
  getComponentIds(): string[];
  readComponent(id: string): ComponentData | null;
  saveComponent(comp: ComponentData): void;
  updateComponent(id: string, partial: Partial<ComponentData>): ComponentData | null;
  removeComponent(id: string): void;
  saveLayout(id: string, layout: { x: number; y: number; w: number; h: number }): void;
  loadAll(): ComponentData[];
  migrateIfNeeded(): boolean;
}

const ROOT_KEY = "tb-tool-db";
const COMP_PREFIX = "tb-comp-";

function _readRoot(): RootData {
  try {
    return JSON.parse(localStorage.getItem(ROOT_KEY) as string) || { title: "Timberborn Colony Control", components: [] };
  } catch {
    ErrorBus.report(IO0001(ROOT_KEY));
    return { title: "Timberborn Colony Control", components: [] };
  }
}

function _writeRoot(root: RootData): void {
  localStorage.setItem(ROOT_KEY, JSON.stringify(root));
}

function _compKey(id: string): string {
  return COMP_PREFIX + id;
}

function readComponent(id: string): ComponentData | null {
  try {
    return JSON.parse(localStorage.getItem(_compKey(id)) as string);
  } catch {
    ErrorBus.report(IO0001(id));
    return null;
  }
}

function writeComponent(comp: ComponentData): void {
  localStorage.setItem(_compKey(comp.id), JSON.stringify(comp));
}

function deleteComponent(id: string): void {
  localStorage.removeItem(_compKey(id));
}

function getTitle(): string {
  return _readRoot().title || "Timberborn Colony Control";
}

function setTitle(title: string): void {
  const root = _readRoot();
  root.title = title;
  _writeRoot(root);
}

function getComponentIds(): string[] {
  return _readRoot().components || [];
}

function saveComponent(comp: ComponentData): void {
  writeComponent(comp);
  const root = _readRoot();
  if (!root.components.includes(comp.id)) {
    root.components.push(comp.id);
    _writeRoot(root);
  }
}

function updateComponent(id: string, partial: Partial<ComponentData>): ComponentData | null {
  const comp = readComponent(id);
  if (!comp) return null;
  Object.assign(comp, partial);
  writeComponent(comp);
  return comp;
}

function removeComponent(id: string): void {
  deleteComponent(id);
  const root = _readRoot();
  root.components = root.components.filter((cid: string) => cid !== id);
  _writeRoot(root);
}

function saveLayout(id: string, { x, y, w, h }: { x: number; y: number; w: number; h: number }): void {
  const comp = readComponent(id);
  if (!comp) return;
  comp.x = x;
  comp.y = y;
  comp.w = w;
  comp.h = h;
  writeComponent(comp);
}

function loadAll(): ComponentData[] {
  const ids = getComponentIds();
  const results: ComponentData[] = [];
  for (const id of ids) {
    const comp = readComponent(id);
    if (comp) results.push(comp);
  }
  return results;
}

function migrateIfNeeded(): boolean {
  const OLD_CONFIG_KEY = "timberborn-dashboard-config";
  const OLD_LAYOUT_KEY = "timberborn-grid-layout";

  const oldConfig = localStorage.getItem(OLD_CONFIG_KEY);
  if (!oldConfig) return false;

  try {
    const config = JSON.parse(oldConfig);
    let layout: Record<string, any> = {};
    try {
      layout = JSON.parse(localStorage.getItem(OLD_LAYOUT_KEY) || "{}") || {};
    } catch { /* ignore */ }

    const root: RootData = {
      title: config.title || "Timberborn Colony Control",
      components: [] as string[],
    };

    for (const comp of config.components || []) {
      const saved = layout[comp.id];
      if (saved) {
        comp.x = saved.x ?? comp.x ?? 0;
        comp.y = saved.y ?? comp.y ?? 0;
        comp.w = saved.w ?? comp.minWidth ?? COMP_MIN_WIDTH;
        comp.h = saved.h ?? comp.minHeight ?? COMP_MIN_HEIGHT;
      } else {
        comp.w = comp.w ?? comp.minWidth ?? COMP_MIN_WIDTH;
        comp.h = comp.h ?? comp.minHeight ?? COMP_MIN_HEIGHT;
      }

      root.components.push(comp.id);
      writeComponent(comp);
    }

    _writeRoot(root);

    localStorage.removeItem(OLD_CONFIG_KEY);
    localStorage.removeItem(OLD_LAYOUT_KEY);

    console.log("Store: migrated from old format", root.components.length, "components");
    return true;
  } catch (err) {
    ErrorBus.report(IO0002(err));
    return false;
  }
}

export const Store: StoreApi = {
  getTitle,
  setTitle,
  getComponentIds,
  readComponent,
  saveComponent,
  updateComponent,
  removeComponent,
  saveLayout,
  loadAll,
  migrateIfNeeded,
};
