/**
 * Context Menu — Right-click on grid to add a device component
 * or a pre-built surface component.
 */

import type { ComponentData } from '../types';
import { editorState } from './editor-state';
import { CELL_SIZE, COMP_MIN_WIDTH, COMP_MIN_HEIGHT } from './grid';
import { SurfaceComponents } from './surface-components';

interface SurfaceMenuItem {
  icon: string;
  name: string;
  sizeLabel: string;
  action: () => void;
}

interface ShowMenuOpts {
  surfaceItems: SurfaceMenuItem[];
  onNew: (() => void) | null;
}

interface ComponentMenuOpts {
  componentEl: HTMLElement;
  componentId: string;
  onDelete: (id: string) => void;
}

interface ConfigCallbacks {
  getConfig(): { title?: string; components: ComponentData[] };
  saveConfig(config: { title?: string; components: ComponentData[] }): Promise<void> | void;
  buildComponents(): void;
}

export interface ContextMenuCallbacks {
  getConfig(): { components: ComponentData[] };
  saveConfig(config: { components: ComponentData[] }): Promise<void> | void;
  buildComponents(): void;
  gridViewport: HTMLElement;
}

let menuEl: HTMLElement | null = null;

function dismiss(): void {
  if (menuEl) {
    menuEl.remove();
    menuEl = null;
  }
}

function _header(text: string): HTMLElement {
  const h = document.createElement("div");
  h.className = "ctx-menu-header";
  h.textContent = text;
  return h;
}

function _sep(): HTMLElement {
  const s = document.createElement("div");
  s.className = "ctx-menu-sep";
  return s;
}

function show(x: number, y: number, { surfaceItems, onNew }: ShowMenuOpts): void {
  dismiss();

  menuEl = document.createElement("div");
  menuEl.className = "ctx-menu";
  menuEl.style.left = x + "px";
  menuEl.style.top = y + "px";

  if (surfaceItems.length > 0) {
    menuEl.appendChild(_header("Surface Components"));

    for (const item of surfaceItems) {
      const row = document.createElement("div");
      row.className = "ctx-menu-item ctx-menu-surface-item";

      const icon = document.createElement("span");
      icon.className = "ctx-menu-surface-icon";
      icon.innerHTML = item.icon;

      const name = document.createElement("span");
      name.textContent = item.name;

      const tag = document.createElement("span");
      tag.className = "type-tag";
      tag.textContent = item.sizeLabel;

      row.appendChild(icon);
      row.appendChild(name);
      row.appendChild(tag);

      row.addEventListener("click", () => {
        item.action();
        dismiss();
      });

      menuEl!.appendChild(row);
    }

    menuEl.appendChild(_sep());
  }

  const newBtn = document.createElement("div");
  newBtn.className = "ctx-menu-item ctx-menu-new";
  newBtn.innerHTML = '<span class="ctx-menu-new-icon">+</span> <span>New Component</span>';
  newBtn.addEventListener("click", () => {
    if (onNew) onNew();
    dismiss();
  });
  menuEl.appendChild(newBtn);

  document.body.appendChild(menuEl);

  const rect = menuEl.getBoundingClientRect();
  if (rect.right > window.innerWidth) {
    menuEl.style.left = (x - rect.width) + "px";
  }
  if (rect.bottom > window.innerHeight) {
    menuEl.style.top = (y - rect.height) + "px";
  }
}

function showComponentMenu(x: number, y: number, { componentEl, componentId, onDelete }: ComponentMenuOpts): void {
  dismiss();

  menuEl = document.createElement("div");
  menuEl.className = "ctx-menu";
  menuEl.style.left = x + "px";
  menuEl.style.top = y + "px";

  const edit = document.createElement("div");
  edit.className = "ctx-menu-item";
  edit.innerHTML = '<span class="ctx-menu-edit-icon">&#x270E;</span> <span>Edit</span>';
  edit.addEventListener("click", () => {
    dismiss();
    if (componentEl && (componentEl as any).openEditor) (componentEl as any).openEditor();
  });
  menuEl.appendChild(edit);

  const del = document.createElement("div");
  del.className = "ctx-menu-item ctx-menu-delete";
  del.innerHTML = '<span class="ctx-menu-delete-icon">&#x2716;</span> <span>Delete</span>';
  del.addEventListener("click", () => {
    onDelete(componentId);
    dismiss();
  });
  menuEl.appendChild(del);

  document.body.appendChild(menuEl);

  const rect = menuEl.getBoundingClientRect();
  if (rect.right > window.innerWidth) {
    menuEl.style.left = (x - rect.width) + "px";
  }
  if (rect.bottom > window.innerHeight) {
    menuEl.style.top = (y - rect.height) + "px";
  }
}

export function initContextMenu({ getConfig, saveConfig, buildComponents, gridViewport }: ContextMenuCallbacks): void {
  const gridContainer = gridViewport.parentElement!;

  document.addEventListener("click", dismiss);

  gridContainer.addEventListener("contextmenu", (e: MouseEvent) => {
    const box = (e.target as HTMLElement).closest(".component-box") as HTMLElement | null;
    if (box) {
      if (gridViewport.classList.contains("editing")) {
        dismiss();
        return;
      }
      if (editorState?.activeComponentId) {
        dismiss();
        return;
      }
      e.preventDefault();
      const componentId = box.getAttribute("component-id") || "";
      showComponentMenu(e.clientX, e.clientY, {
        componentEl: box,
        componentId,
        onDelete: (id: string) => deleteComponent(id, { getConfig, saveConfig, buildComponents }),
      });
      return;
    }

    if (!gridContainer.contains(e.target as Node)) {
      dismiss();
      return;
    }

    e.preventDefault();

    const vpRect = gridViewport.getBoundingClientRect();
    const gridX = Math.floor((e.clientX - vpRect.left + gridContainer.scrollLeft) / CELL_SIZE);
    const gridY = Math.floor((e.clientY - vpRect.top + gridContainer.scrollTop) / CELL_SIZE);

    const surfaceItems: SurfaceMenuItem[] = [];

    const onNew = () => addBlankComponent(gridX, gridY, { getConfig, saveConfig, buildComponents });
    show(e.clientX, e.clientY, { surfaceItems, onNew });
  });
}

async function addBlankComponent(
  gridX: number,
  gridY: number,
  { getConfig, saveConfig, buildComponents }: ConfigCallbacks
): Promise<void> {
  const config = getConfig();
  if (!config.components) config.components = [];

  const n = config.components.length + 1;
  const id = "panel-" + Date.now().toString(36);
  const comp: ComponentData = {
    id,
    name: "Panel " + n,
    x: gridX,
    y: gridY,
    w: COMP_MIN_WIDTH,
    h: COMP_MIN_HEIGHT,
    minWidth: COMP_MIN_WIDTH,
    minHeight: COMP_MIN_HEIGHT,
    color: "#d4cdb8",
    surface: [],
    circuitry: { nodes: [], edges: [] },
  };

  config.components.push(comp);
  await saveConfig(config);
  buildComponents();
}

async function deleteComponent(
  id: string,
  { getConfig, saveConfig, buildComponents }: ConfigCallbacks
): Promise<void> {
  const config = getConfig();
  if (!config.components) return;
  config.components = config.components.filter((c: ComponentData) => c.id !== id);
  await saveConfig(config);
  buildComponents();
}
