/**
 * Context Menu — Right-click on grid to add a device component
 * or a pre-built surface component.
 *
 * Exposes: initContextMenu({ getConfig, saveConfig, buildComponents, gridViewport })
 */

(function () {
  let menuEl = null;

  function dismiss() {
    if (menuEl) {
      menuEl.remove();
      menuEl = null;
    }
  }

  /**
   * Build a section header element.
   */
  function _header(text) {
    const h = document.createElement("div");
    h.className = "ctx-menu-header";
    h.textContent = text;
    return h;
  }

  /**
   * Build a separator element.
   */
  function _sep() {
    const s = document.createElement("div");
    s.className = "ctx-menu-sep";
    return s;
  }

  function show(x, y, { surfaceItems, onNew }) {
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

        menuEl.appendChild(row);
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

  function showComponentMenu(x, y, { componentEl, componentId, onDelete }) {
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
      if (componentEl && componentEl.openEditor) componentEl.openEditor();
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

  function initContextMenu({ getConfig, saveConfig, buildComponents, gridViewport }) {
    const gridContainer = gridViewport.parentElement;

    // Dismiss on any click
    document.addEventListener("click", dismiss);

    // Listen on the container (scroll wrapper) — more reliable than viewport
    gridContainer.addEventListener("contextmenu", (e) => {
      // Right-click on a component box: show delete menu (only when not editing)
      const box = e.target.closest(".component-box");
      if (box) {
        if (gridViewport.classList.contains("editing")) {
          dismiss();
          return;
        }
        // Don't show if an editor overlay is open
        if (document.querySelector(".editor-overlay")) {
          dismiss();
          return;
        }
        e.preventDefault();
        const componentId = box.getAttribute("component-id");
        showComponentMenu(e.clientX, e.clientY, {
          componentEl: box,
          componentId,
          onDelete: (id) => deleteComponent(id, { getConfig, saveConfig, buildComponents }),
        });
        return;
      }

      // Only handle right-clicks inside the grid area
      if (!gridContainer.contains(e.target)) {
        dismiss();
        return;
      }

      e.preventDefault();

      // Convert click position to grid coordinates
      const vpRect = gridViewport.getBoundingClientRect();
      const gridX = Math.floor((e.clientX - vpRect.left + gridContainer.scrollLeft) / CELL_SIZE);
      const gridY = Math.floor((e.clientY - vpRect.top + gridContainer.scrollTop) / CELL_SIZE);

      // Surface component items (only in editing mode)
      const surfaceItems = gridViewport.classList.contains("editing")
        ? window.SurfaceComponents.getAll().map(def => ({
            name: def.name,
            icon: def.icon,
            sizeLabel: def.resizable ? `${def.width}×${def.height}+` : `${def.width}×${def.height}`,
            action: () => addSurfaceComponent(def.type, gridX, gridY, { getConfig, saveConfig, buildComponents }),
          }))
        : [];

      const onNew = () => addBlankComponent(gridX, gridY, { getConfig, saveConfig, buildComponents });
      show(e.clientX, e.clientY, { surfaceItems, onNew });
    });
  }

  async function addBlankComponent(gridX, gridY, { getConfig, saveConfig, buildComponents }) {
    const config = getConfig();
    if (!config.components) config.components = [];

    const n = config.components.length + 1;
    const id = "panel-" + Date.now().toString(36);
    const comp = {
      id,
      name: "Panel " + n,
      x: gridX,
      y: gridY,
      minWidth: 8,
      minHeight: 6,
      color: "#d4cdb8",
      surface: [],
      circuitry: { nodes: [], edges: [] },
    };

    config.components.push(comp);
    buildComponents();
    await saveConfig(config);
  }

  async function addSurfaceComponent(type, gridX, gridY, { getConfig, saveConfig, buildComponents }) {
    const comp = window.SurfaceComponents.createConfig(type, gridX, gridY);
    if (!comp) return;

    const config = getConfig();
    if (!config.components) config.components = [];
    config.components.push(comp);

    buildComponents();
    await saveConfig(config);
  }

  async function deleteComponent(id, { getConfig, saveConfig, buildComponents }) {
    const config = getConfig();
    if (!config.components) return;
    config.components = config.components.filter(c => c.id !== id);
    buildComponents();
    await saveConfig(config);
  }

  window.initContextMenu = initContextMenu;
})();
