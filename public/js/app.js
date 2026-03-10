/**
 * App — Main bootstrap and coordinator for Timberborn Dashboard.
 *
 * Loads component data from the two-layer Store (localStorage),
 * places them on the grid via an async placement queue,
 * and connects WebSocket for live device state updates.
 */

let ws;
let grid;
let deviceState = {};

/** In-memory component data keyed by id, loaded from Store. */
const componentData = new Map();

const gridContainer = document.getElementById("grid-container");
const gridViewport = document.getElementById("grid-viewport");
const connLed = document.getElementById("conn-led");
const connText = document.getElementById("conn-text");
const editBtn = document.getElementById("edit-btn");
const editIcon = document.getElementById("edit-icon");
const editLabel = document.getElementById("edit-label");

let editing = false;

// --- Grid Init (no built-in layout persistence — Store handles it) ---

grid = new Grid(gridContainer, gridViewport, {
  storageKey: null,
  onLayoutChange: (id, pos) => Store.saveLayout(id, pos),
});

// --- Edit Toggle ---

editBtn.addEventListener("click", () => {
  editing = !editing;
  grid.setEditing(editing);

  if (editing) {
    editBtn.classList.add("active");
    editIcon.innerHTML = "&#128295;"; // wrench
    editLabel.textContent = "Editing";
  } else {
    editBtn.classList.remove("active");
    editIcon.innerHTML = "&#128297;"; // nut & bolt
    editLabel.textContent = "Locked";
  }
});

// --- Placement Queue ---
// Components are loaded asynchronously one at a time so each can validate
// its position against components already on the board.

const _placementQueue = [];
let _placementRunning = false;

function enqueueComponent(comp) {
  _placementQueue.push(comp);
  _drainQueue();
}

async function _drainQueue() {
  if (_placementRunning) return;
  _placementRunning = true;
  while (_placementQueue.length > 0) {
    const comp = _placementQueue.shift();
    _placeComponent(comp);
    // Yield to the browser so rendering can interleave
    await new Promise(r => setTimeout(r, 0));
  }
  _placementRunning = false;
}

/**
 * Validate and place a single component on the grid.
 * Nudges position if it overlaps an already-placed component.
 */
function _placeComponent(comp) {
  let x = comp.x ?? 0;
  let y = comp.y ?? 0;
  const w = comp.w ?? comp.minWidth ?? COMP_MIN_WIDTH;
  const h = comp.h ?? comp.minHeight ?? COMP_MIN_HEIGHT;

  // Simple overlap resolution: shift down until clear
  for (const [, existing] of grid.components) {
    if (_rectsOverlap(x, y, w, h, existing.x, existing.y, existing.w, existing.h)) {
      y = existing.y + existing.h;
    }
  }

  // Write adjusted position back if it changed
  if (x !== (comp.x ?? 0) || y !== (comp.y ?? 0)) {
    comp.x = x;
    comp.y = y;
    Store.saveLayout(comp.id, { x, y, w, h });
  }

  componentData.set(comp.id, comp);
  createComponentElement(comp, x, y, w, h);
}

function _rectsOverlap(x1, y1, w1, h1, x2, y2, w2, h2) {
  return x1 < x2 + w2 && x1 + w1 > x2 && y1 < y2 + h2 && y1 + h1 > y2;
}

// --- Config Loading (from Store) ---

function loadConfig() {
  Store.migrateIfNeeded();

  document.querySelector(".header-title").textContent = Store.getTitle();

  // Load component IDs from root key, then enqueue each for async placement
  const ids = Store.getComponentIds();
  for (const id of ids) {
    const comp = Store.readComponent(id);
    if (comp) {
      enqueueComponent(comp);
    }
  }
}

// --- Build / Rebuild Components ---
// Called when the in-memory component set changes (add/delete).

function buildComponents() {
  const currentIds = new Set(Store.getComponentIds());

  // Remove components no longer in store
  for (const [id] of grid.components) {
    if (!currentIds.has(id)) {
      grid.removeComponent(id);
      componentData.delete(id);
    }
  }

  // Add new components not yet on grid
  for (const id of currentIds) {
    if (!grid.getComponent(id)) {
      const comp = Store.readComponent(id);
      if (comp) enqueueComponent(comp);
    } else {
      // Update existing
      const comp = Store.readComponent(id);
      if (comp) {
        componentData.set(comp.id, comp);
        updateComponentElement(comp);
      }
    }
  }
}

function createComponentElement(comp, x, y, w, h) {
  const el = document.createElement("tb-component");
  el.setAttribute("component-id", comp.id);
  el.setAttribute("name", comp.name || comp.id);
  el.setAttribute("color", comp.color || "#d4cdb8");

  // Set circuitry data BEFORE building surface elements, so that
  // auto-registered surface nodes can check for existing entries
  el.circuitryData = comp.circuitry || { nodes: [], edges: [] };

  // Build surface elements from config
  buildSurfaceElements(el, comp.surface || []);

  // Listen for config changes from the component (color, circuitry)
  el.addEventListener("component-config-change", (e) => {
    handleComponentConfigChange(e.detail);
  });

  const gridOpts = {
    x,
    y,
    width: w,
    minWidth: comp.minWidth || COMP_MIN_WIDTH,
    minHeight: comp.minHeight || COMP_MIN_HEIGHT,
    height: h,
  };

  // Surface component constraints
  if (comp.resizable === false) gridOpts.resizable = false;
  if (comp.aspectRatio) gridOpts.aspectRatio = comp.aspectRatio;

  grid.addComponent(comp.id, el, gridOpts);
}

function updateComponentElement(comp) {
  const gridComp = grid.getComponent(comp.id);
  if (!gridComp) return;
  const el = gridComp.el.querySelector("tb-component") || gridComp.el;

  if (el.tagName === "TB-COMPONENT") {
    el.setAttribute("name", comp.name || comp.id);
    el.setAttribute("color", comp.color || "#d4cdb8");
  }
}

// --- Surface Element Builder ---

function buildSurfaceElements(parentEl, elements) {
  for (let i = 0; i < elements.length; i++) {
    const elem = elements[i];
    const child = createSurfaceElement(elem, i);
    if (child) {
      // Set surface-id from config if available, otherwise auto-generated
      if (elem.surfaceId) {
        child.setAttribute("surface-id", elem.surfaceId);
      }

      // Use the component's inner surface grid
      parentEl.addSurfaceElement(child, {
        x: elem.x || 0,
        y: elem.y || 0,
        width: elem.width || 2,
        height: elem.height || 2,
        resizable: elem.resizable !== false,
      });
    }
  }
}

function createSurfaceElement(elem, index) {
  const props = elem.props || {};

  switch (elem.type) {
    case "led": {
      const el = document.createElement("tb-led");
      if (props.color) el.setAttribute("color", props.color);
      if (props.size) el.setAttribute("size", props.size);
      if (props.label) el.setAttribute("label", props.label);
      if (props.labelPos) el.setAttribute("label-pos", props.labelPos);
      if (props.pulse) el.setAttribute("pulse", "");
      el.dataset.binding = props.binding || "";
      return el;
    }
    case "label": {
      const el = document.createElement("tb-label");
      if (props.text) el.setAttribute("text", props.text);
      if (props["overwrite-text"] != null) el.setAttribute("overwrite-text", "");
      if (props.style) el.setAttribute("style-type", props.style);
      if (props.fontSize) el.setAttribute("font-size", props.fontSize);
      if (props.align) el.setAttribute("align", props.align);
      if (props.color) el.setAttribute("color", props.color);
      return el;
    }
    case "dial": {
      const el = document.createElement("tb-dial");
      if (props.size) el.setAttribute("size", props.size);
      el.dataset.binding = props.binding || "";
      return el;
    }
    case "toggle": {
      const el = document.createElement("tb-toggle");
      if (props.label) el.setAttribute("label", props.label);
      el.setAttribute("name", props.name || "");
      el.dataset.binding = props.binding || "";
      el.addEventListener("toggle-change", (e) => {
        // Legacy direct binding
        handleToggle(e.detail.name, e.detail.on);
        // Circuitry-based: walk edges from this toggle's surface node
        if (el.surfaceId && el.parentComponent) {
          handleToggleViaCircuitry(el.parentComponent, el.surfaceId, e.detail.on);
        }
      });
      return el;
    }
    case "alert": {
      const el = document.createElement("tb-alert");
      if (props.color) el.setAttribute("color", props.color);
      if (props.size) el.setAttribute("size", props.size);
      if (props.mode) el.setAttribute("mode", props.mode);
      if (props.speed) el.setAttribute("speed", props.speed);
      if (props.label) el.setAttribute("label", props.label);
      el.dataset.binding = props.binding || "";
      return el;
    }
    default:
      console.warn(`Unknown surface element type: ${elem.type}`);
      return null;
  }
}

// --- Device State Binding ---

function applyDeviceState(devices) {
  deviceState = devices;

  for (const [id, comp] of componentData) {
    const gridComp = grid.getComponent(id);
    if (!gridComp) continue;

    const tbComp = gridComp.el.querySelector("tb-component") || gridComp.el;
    if (!tbComp || tbComp.tagName !== "TB-COMPONENT") continue;

    // --- Circuitry-based propagation ---
    // Walk edges: device nodes → surface nodes
    const circuitry = tbComp.circuitryData;
    if (circuitry && circuitry.nodes && circuitry.edges) {
      propagateDeviceStateViaCircuitry(tbComp, circuitry, devices);
    }

    // --- Legacy data-binding fallback ---
    let boundElements = [];
    if (tbComp.shadowRoot) {
      boundElements = [...tbComp.shadowRoot.querySelectorAll("[data-binding]")];
    }
    const lightBound = tbComp.querySelectorAll("[data-binding]");
    boundElements = [...boundElements, ...lightBound];

    for (const boundEl of boundElements) {
      const binding = boundEl.dataset.binding;
      if (!binding) continue;

      const parts = binding.split(".");
      const deviceName = parts[0];
      const prop = parts[1] || "on";

      const device = devices[deviceName];
      if (!device) continue;

      const value = device[prop];
      if (value !== undefined && typeof value === "boolean") {
        boundEl.on = value;
      }
    }
  }
}

/**
 * Walk circuitry edges to propagate device state to surface components.
 * Device nodes (lever/adapter) with a matching device name get their state,
 * then edges carry that state to connected surface node inputs.
 */
function propagateDeviceStateViaCircuitry(tbComp, circuitry, devices) {
  const { nodes, edges } = circuitry;
  if (!nodes.length) return;

  // Build a map of node outputs: nodeId -> { portName: value }
  const nodeOutputs = {};

  for (const node of nodes) {
    if (node.type === "lever" || node.type === "adapter") {
      const deviceName = node.config?.device;
      if (deviceName && devices[deviceName]) {
        const device = devices[deviceName];
        nodeOutputs[node.id] = { "out-0": !!device.on };
      }
    }
    // Surface nodes that are outputs (e.g. toggle) get their state from the element
    if (node.config?.surfaceManaged && node.config?.ports?.outputs?.length) {
      const surfaceEl = findSurfaceElement(tbComp, node.config.surfaceId);
      if (surfaceEl && typeof surfaceEl.on !== "undefined") {
        nodeOutputs[node.id] = { "out-0": !!surfaceEl.on };
      }
    }
  }

  // Apply label text for surface-label nodes (works with or without edges).
  // Device-supplied text goes to the deviceText property (ephemeral).
  // The label component decides what to display based on overwrite state.
  const connectedLabels = new Set();

  // First, sync overwriteText / text config from circuitry nodes to surface elements
  for (const node of nodes) {
    if (node.type !== "surface-label" || !node.config?.surfaceManaged) continue;
    const surfaceEl = findSurfaceElement(tbComp, node.config.surfaceId);
    if (!surfaceEl) continue;

    // Sync the override toggle
    if (node.config.overwriteText) {
      surfaceEl.setAttribute("overwrite-text", "");
    } else {
      surfaceEl.removeAttribute("overwrite-text");
    }
    // Sync custom text
    if (node.config.text) {
      surfaceEl.setAttribute("text", node.config.text);
    } else {
      surfaceEl.removeAttribute("text");
    }
  }

  for (const edge of edges) {
    const targetNode = nodes.find(n => n.id === edge.to);
    if (targetNode?.type === "surface-label" && targetNode.config?.surfaceManaged) {
      connectedLabels.add(targetNode.id);
      const surfaceEl = findSurfaceElement(tbComp, targetNode.config.surfaceId);
      if (!surfaceEl) continue;

      // Derive device text from the source node
      const sourceNode = nodes.find(n => n.id === edge.from);
      const deviceName = sourceNode?.config?.device
        || sourceNode?.config?.label
        || sourceNode?.config?.surfaceId
        || "";
      surfaceEl.deviceText = deviceName;
    }
  }

  // Standalone label nodes (no edge connection) — no device text to supply
  // Their display is controlled entirely by their own text attribute + overwrite flag

  // Walk edges to propagate boolean state to non-label surface node inputs
  for (const edge of edges) {
    const outputVal = nodeOutputs[edge.from]?.[edge.fromPort];
    if (outputVal === undefined) continue;

    const targetNode = nodes.find(n => n.id === edge.to);
    if (!targetNode?.config?.surfaceManaged) continue;
    if (targetNode.type === "surface-label") continue; // already handled above

    const surfaceEl = findSurfaceElement(tbComp, targetNode.config.surfaceId);
    if (surfaceEl) surfaceEl.on = outputVal;
  }
}

/**
 * Find a surface element by its surface-id within a tb-component.
 * Checks both the shadow DOM and the editor overlay (elements are
 * temporarily reparented to the overlay while the editor is open).
 */
function findSurfaceElement(tbComp, surfaceId) {
  if (!surfaceId) return null;
  if (tbComp.shadowRoot) {
    const el = tbComp.shadowRoot.querySelector(`[surface-id="${surfaceId}"]`);
    if (el) return el;
  }
  if (tbComp._overlay) {
    return tbComp._overlay.querySelector(`[surface-id="${surfaceId}"]`);
  }
  return null;
}

// --- Toggle Handler ---

async function handleToggle(name, on) {
  if (!name) return;
  const endpoint = on
    ? `/api/switch-on/${encodeURIComponent(name)}`
    : `/api/switch-off/${encodeURIComponent(name)}`;
  try {
    await fetch(endpoint, { method: "POST" });
  } catch (err) {
    console.error("Toggle failed:", err);
  }
}

/**
 * Handle toggle changes via circuitry: walk edges from the toggle's surface node
 * to find connected device (lever) nodes and send API calls.
 */
function handleToggleViaCircuitry(tbComp, surfaceId, on) {
  const circuitry = tbComp.circuitryData;
  if (!circuitry?.nodes?.length || !circuitry?.edges?.length) return;

  const nodeId = "surface-" + surfaceId;

  // Find edges from this surface node's output
  for (const edge of circuitry.edges) {
    if (edge.from !== nodeId) continue;

    // Find the target node
    const targetNode = circuitry.nodes.find(n => n.id === edge.to);
    if (targetNode?.type === "lever" && targetNode.config?.device) {
      handleToggle(targetNode.config.device, on);
    }
  }
}

// --- Config Save (per-component via Store) ---

function saveConfig(cfg) {
  if (cfg) {
    // Full config object passed (from context menu add/delete).
    // Sync title and all components to Store.
    if (cfg.title) Store.setTitle(cfg.title);
    for (const comp of cfg.components || []) {
      // Merge current grid position into the component before saving
      const gridComp = grid.getComponent(comp.id);
      if (gridComp) {
        comp.x = gridComp.x;
        comp.y = gridComp.y;
        comp.w = gridComp.w;
        comp.h = gridComp.h;
      }
      Store.saveComponent(comp);
      componentData.set(comp.id, comp);
    }
    // Remove components no longer in the config
    const newIds = new Set((cfg.components || []).map(c => c.id));
    for (const existingId of Store.getComponentIds()) {
      if (!newIds.has(existingId)) {
        Store.removeComponent(existingId);
        componentData.delete(existingId);
      }
    }
  }
}

/** Return a config-shaped object for backwards compat with context menu. */
function getConfig() {
  return {
    title: Store.getTitle(),
    components: Store.loadAll(),
  };
}

// --- Config Change Handler ---

async function handleComponentConfigChange(detail) {
  const comp = componentData.get(detail.id) || Store.readComponent(detail.id);
  if (!comp) return;

  if (detail.property === "color") {
    comp.color = detail.value;
  } else if (detail.property === "circuitry") {
    comp.circuitry = detail.value;
  } else if (detail.property === "surface") {
    comp.surface = detail.value;
    // Recalculate minimum size to fit all surface elements
    if (detail.minWidth !== undefined || detail.minHeight !== undefined) {
      comp.minWidth = detail.minWidth;
      comp.minHeight = detail.minHeight;
      grid.updateConstraints(detail.id, {
        minW: detail.minWidth,
        minH: detail.minHeight,
      });
    }
  }

  // Merge grid position
  const gridComp = grid.getComponent(detail.id);
  if (gridComp) {
    comp.x = gridComp.x;
    comp.y = gridComp.y;
    comp.w = gridComp.w;
    comp.h = gridComp.h;
  }

  Store.saveComponent(comp);
  componentData.set(comp.id, comp);
}

// --- WebSocket ---

function connect() {
  ws = new WebSocket(`ws://${location.host}`);

  ws.onopen = () => {
    // WS connected to dashboard server; game status comes via messages
  };

  ws.onclose = () => {
    connLed.setAttribute("color", "red");
    connLed.removeAttribute("on");
    connText.textContent = "Link Down";
    setTimeout(connect, 2000);
  };

  ws.onmessage = (e) => {
    try {
      const data = JSON.parse(e.data);

      // Update game connection LED
      if (data.gameConnected !== undefined) {
        if (data.gameConnected) {
          connLed.setAttribute("color", "green");
          connLed.setAttribute("on", "");
          connText.textContent = "Link Active";
        } else {
          connLed.setAttribute("color", "red");
          connLed.removeAttribute("on");
          connText.textContent = "No Game";
        }
      }

      if (data.devices) {
        applyDeviceState(data.devices);
      }
    } catch (err) {
      console.error("WS parse error:", err);
    }
  };
}

// --- Context Menu ---
initContextMenu({
  getConfig,
  saveConfig,
  buildComponents,
  gridViewport,
});

// --- Boot ---
loadConfig();
connect();
