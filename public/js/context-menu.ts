/**
 * Context Menu — Right-click on grid to add a device component
 * or a pre-built surface component.
 *
 * Exposes: initContextMenu({ getConfig, saveConfig, buildComponents, gridViewport })
 */

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

(function (): void {
  let menuEl: HTMLElement | null = null;

  function dismiss(): void {
    if (menuEl) {
      menuEl.remove();
      menuEl = null;
    }
  }

  /**
   * Build a section header element.
   */
  function _header(text: string): HTMLElement {
    const h = document.createElement("div");
    h.className = "ctx-menu-header";
    h.textContent = text;
    return h;
  }

  /**
   * Build a separator element.
   */
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

    // --- Surface Components section ---
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

    // Keep menu within viewport
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

    // Edit
    const edit = document.createElement("div");
    edit.className = "ctx-menu-item";
    edit.innerHTML = '<span class="ctx-menu-edit-icon">&#x270E;</span> <span>Edit</span>';
    edit.addEventListener("click", () => {
      dismiss();
      if (componentEl && (componentEl as any).openEditor) (componentEl as any).openEditor();
    });
    menuEl.appendChild(edit);

    // Delete
    const del = document.createElement("div");
    del.className = "ctx-menu-item ctx-menu-delete";
    del.innerHTML = '<span class="ctx-menu-delete-icon">&#x2716;</span> <span>Delete</span>';
    del.addEventListener("click", () => {
      onDelete(componentId);
      dismiss();
    });
    menuEl.appendChild(del);

    document.body.appendChild(menuEl);

    // Keep menu within viewport
    const rect = menuEl.getBoundingClientRect();
    if (rect.right > window.innerWidth) {
      menuEl.style.left = (x - rect.width) + "px";
    }
    if (rect.bottom > window.innerHeight) {
      menuEl.style.top = (y - rect.height) + "px";
    }
  }

  function initContextMenu({ getConfig, saveConfig, buildComponents, gridViewport }: ContextMenuCallbacks): void {
    const gridContainer = gridViewport.parentElement!;

    // Dismiss on any left-click outside the menu
    document.addEventListener("click", dismiss);

    // Listen on the container (scroll wrapper) — more reliable than viewport
    gridContainer.addEventListener("contextmenu", (e: MouseEvent) => {
      // Right-click on a component box: show delete menu (only when not editing)
      const box = (e.target as HTMLElement).closest(".component-box") as HTMLElement | null;
      if (box) {
        if (gridViewport.classList.contains("editing")) {
          dismiss();
          return;
        }
        // Don't show if any component editor is open
        if (window.editorState?.activeComponentId) {
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

      // Only handle right-clicks inside the grid area
      if (!gridContainer.contains(e.target as Node)) {
        dismiss();
        return;
      }

      e.preventDefault();

      // Convert click position to grid coordinates
      const vpRect = gridViewport.getBoundingClientRect();
      const gridX = Math.floor((e.clientX - vpRect.left + gridContainer.scrollLeft) / CELL_SIZE);
      const gridY = Math.floor((e.clientY - vpRect.top + gridContainer.scrollTop) / CELL_SIZE);

      // Surface components (LED, Label, etc.) are only for component surfaces,
      // not the main dashboard grid — so we pass an empty list here.
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

  async function addSurfaceComponent(
    type: string,
    gridX: number,
    gridY: number,
    { getConfig, saveConfig, buildComponents }: ConfigCallbacks
  ): Promise<void> {
    const comp = window.SurfaceComponents.createConfig(type, gridX, gridY);
    if (!comp) return;

    const config = getConfig();
    if (!config.components) config.components = [];
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

  window.initContextMenu = initContextMenu;
})();
