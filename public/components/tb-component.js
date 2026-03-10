/**
 * <tb-component> — Main component box for the dashboard grid.
 *
 * Renders as a colored box on the grid showing the surface display.
 * Right-click to open in full-screen editor mode with surface/circuitry toggle.
 * The editor expands from the box's grid position to fill the screen.
 * Switching modes: surface slides up-right revealing circuitry underneath.
 *
 * Surface elements are created once and stay in the shadow DOM at all times —
 * they are never reparented or destroyed during the editor lifecycle.
 *
 * Attributes:
 *   name        - Display name
 *   color       - Base color of the box (CSS color)
 *   component-id - Unique ID
 *
 * Properties:
 *   surfaceElements - Array of surface element configs
 *   circuitryData   - Object with nodes[] and edges[]
 */
class TbComponent extends HTMLElement {
  static get observedAttributes() {
    return ["name", "color", "component-id"];
  }

  /** Compute min grid constraints for a toggle given orientation + size */
  static _toggleConstraints(orientation, size) {
    const isHoriz = orientation === "horizontal";
    // vertical: small=1x2, medium=2x3, large=3x3
    // horizontal: swap W↔H
    const table = {
      small:  { w: 1, h: 2 },
      medium: { w: 2, h: 3 },
      large:  { w: 3, h: 3 },
    };
    const entry = table[size] || table.medium;
    return isHoriz
      ? { minW: entry.h, minH: entry.w }
      : { minW: entry.w, minH: entry.h };
  }

  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._open = false;
    this._closing = false;
    this._mode = "surface"; // "surface" | "circuitry"
    this._surfaceElements = [];
    this._circuitryData = { nodes: [], edges: [] };
    this._animating = false;
    this._surfaceGrid = null;
    this._surfaceIdCounter = 0;

    this.shadowRoot.innerHTML = `
      <style>
        ${window.PANEL_BASE_STYLES}

        :host {
          display: block;
          width: 100%;
          height: 100%;
        }

        /* ── Editor Mode ── */
        :host(.editing) {
          border-radius: 8px;
          box-shadow: 0 8px 40px rgba(0,0,0,0.8);
        }

        .surface-view {
          width: 100%;
          height: 100%;
          position: relative;
          border-radius: 6px;
          overflow: hidden;
        }

        :host(.editing) .surface-view {
          border-radius: 8px;
          z-index: 2;
          transition: transform 0.5s cubic-bezier(0.4, 0, 0.2, 1);
        }

        :host(.editing.circuitry-active) .surface-view {
          transform: translate(100%, -100%);
        }

        .surface-screws-bottom {
          position: absolute;
          bottom: 0;
          left: 0;
          right: 0;
          pointer-events: none;
        }
        ${window.SCREW_STYLES(".surface-view", ".surface-screws-bottom", { size: 6, offset: 4 })}

        .surface-elements {
          position: relative;
          width: 100%;
          height: 100%;
        }

        /* ── Editor Backdrop (shadow DOM element hidden; page-level backdrop used instead) ── */
        .editor-backdrop {
          display: none;
        }

        /* ── Editor Handles ── */
        .editor-handles {
          display: none;
        }

        :host(.editing) .editor-handles {
          display: block;
          position: absolute;
          inset: 0;
          z-index: 10;
        }

        .surface-handle {
          position: absolute;
          cursor: grab;
          border-radius: 3px;
          outline: 1px solid transparent;
          outline-offset: -1px;
          transition: outline-color 0.15s, box-shadow 0.15s;
          z-index: 2;
        }

        .surface-handle:hover {
          outline-color: color-mix(in srgb, var(--comp-hl, #ffaa20) 50%, transparent);
          box-shadow: 0 0 8px color-mix(in srgb, var(--comp-hl, #ffaa20) 15%, transparent);
        }

        .surface-handle:active {
          cursor: grabbing;
        }

        .surface-handle.no-resize {
          cursor: grab;
        }

        .surface-resize-handle {
          position: absolute;
          right: 0;
          bottom: 0;
          width: 12px;
          height: 12px;
          background: linear-gradient(135deg, transparent 50%, color-mix(in srgb, var(--comp-hl, #ffaa20) 70%, transparent) 50%);
          border-radius: 0 0 3px 0;
          cursor: nwse-resize;
          opacity: 0;
          transition: opacity 0.15s;
          z-index: 3;
        }

        .surface-handle:hover .surface-resize-handle,
        .surface-handle.resizing .surface-resize-handle {
          opacity: 1;
        }

        /* ── Ghost Preview ── */
        .editor-ghost {
          position: absolute;
          border-radius: 4px;
          border: 2px dashed color-mix(in srgb, var(--comp-hl, #ffaa20) 60%, transparent);
          background: color-mix(in srgb, var(--comp-hl, #ffaa20) 8%, transparent);
          pointer-events: none;
          z-index: 10;
          transition: opacity 0.15s;
          display: none;
        }

        .editor-ghost.blocked {
          border-color: rgba(255,68,68,0.6);
          background: rgba(255,68,68,0.08);
        }

        /* ── Properties Panel ── */
        .surface-props-panel {
          position: absolute;
          background: #2a2a26;
          border: 1px solid #5a5a52;
          border-radius: 4px;
          padding: 6px 8px;
          z-index: 20;
          box-shadow: 0 4px 12px rgba(0,0,0,0.5);
          min-width: 180px;
        }

        .surface-props-row {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 3px 0;
        }

        .surface-props-check {
          accent-color: var(--comp-hl, #ffaa20);
          width: 14px;
          height: 14px;
          cursor: pointer;
          flex-shrink: 0;
        }

        .surface-props-label {
          font-family: 'Share Tech Mono', monospace;
          font-size: 0.6rem;
          color: #8a8a7a;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          flex-shrink: 0;
          min-width: 32px;
        }

        .surface-props-input {
          flex: 1;
          background: #1a1a18;
          border: 1px solid #4a4a42;
          border-radius: 3px;
          color: #e0ddd0;
          font-family: 'Share Tech Mono', monospace;
          font-size: 0.6rem;
          padding: 2px 5px;
          outline: none;
          min-width: 0;
        }

        .surface-props-input:focus {
          border-color: var(--comp-hl, #ffaa20);
        }

        .surface-props-input:disabled {
          opacity: 0.35;
          cursor: not-allowed;
        }

        /* ── Grid Dots (editing mode only) ── */
        :host(.editing) .surface-elements::before {
          content: '';
          position: absolute;
          inset: var(--cell-size);
          background-image: radial-gradient(circle, rgba(0,0,0,0.15) 2px, transparent 2px);
          background-size: var(--cell-size) var(--cell-size);
          pointer-events: none;
          z-index: 5;
        }

        /* ── Circuitry View ── */
        .circuitry-view {
          display: none;
        }

        :host(.editing) .circuitry-view {
          display: block;
          position: absolute;
          inset: 0;
          border-radius: 8px;
          overflow: hidden;
          z-index: 1;
        }

        /* ── Editor Toolbar ── */
        .editor-toolbar {
          display: none;
        }

        :host(.editing) .editor-toolbar {
          display: flex;
          position: absolute;
          top: -40px;
          right: 0;
          z-index: 10;
          gap: 4px;
        }

        .editor-toolbar button {
          background: #2a2a28;
          border: none;
          border-radius: 6px;
          color: #aaa;
          padding: 6px;
          cursor: pointer;
          transition: all 0.2s;
          display: flex;
          align-items: center;
          justify-content: center;
          width: 32px;
          height: 32px;
          box-shadow: 0 1px 3px rgba(0,0,0,0.4);
        }

        .editor-toolbar button:hover {
          background: #3a3a36;
          color: #fff;
          box-shadow: 0 3px 8px rgba(0,0,0,0.5);
          transform: translateY(-1px);
        }

        .editor-toolbar button.active {
          background: color-mix(in srgb, var(--comp-hl, #ffaa20) 15%, #2a2a28);
          color: var(--comp-hl, #ffaa20);
          box-shadow: 0 2px 6px color-mix(in srgb, var(--comp-hl, #ffaa20) 25%, transparent);
        }
      </style>

      <div class="editor-backdrop"></div>

      <div class="circuitry-view">
        <tb-node-editor></tb-node-editor>
      </div>

      <div class="surface-view" part="surface">
        <div class="surface-elements"></div>
        <div class="surface-screws-bottom"></div>
        <div class="editor-handles"></div>
        <div class="editor-ghost"></div>
      </div>

      <div class="editor-toolbar">
        <button class="mode-surface active" title="Surface Display">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>
        </button>
        <button class="mode-circuitry" title="Node Graph">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="5" cy="6" r="2"/><circle cx="19" cy="6" r="2"/><circle cx="5" cy="18" r="2"/><circle cx="19" cy="18" r="2"/><path d="M7 6h10M7 18h10M5 8v8M19 8v8"/></svg>
        </button>
        <button class="mode-close" title="Close Editor">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </div>
    `;

    this._surfaceView = this.shadowRoot.querySelector(".surface-view");
    this._surfaceElementsContainer = this.shadowRoot.querySelector(".surface-elements");
    this._editorHandles = this.shadowRoot.querySelector(".editor-handles");
    this._editorGhost = this.shadowRoot.querySelector(".editor-ghost");
    this._editorBackdrop = this.shadowRoot.querySelector(".editor-backdrop");
    this._nodeEditor = this.shadowRoot.querySelector("tb-node-editor");
    this._circuitryView = this.shadowRoot.querySelector(".circuitry-view");

    // Editor is now opened via right-click context menu (see context-menu.js)
  }

  connectedCallback() {
    this._render();
    this._initSurfaceGrid();
    // Apply circuitry node parameters to surface elements on first load
    this._syncLabelConfig();
    this._syncToggleConfig();
    this._syncRainbowConfig();
  }

  attributeChangedCallback() {
    this._render();
  }

  get surfaceElements() { return this._surfaceElements; }
  set surfaceElements(val) {
    this._surfaceElements = val || [];
  }

  get circuitryData() { return this._circuitryData; }
  set circuitryData(val) {
    this._circuitryData = val || { nodes: [], edges: [] };
  }

  /** Initialize the inner surface Grid for managing surface components */
  _initSurfaceGrid() {
    if (this._surfaceGrid) return;
    this._surfaceGrid = new Grid(this._surfaceView, this._surfaceElementsContainer, {
      storageKey: null,
      listenToWindowResize: false,
      bare: true,
      locked: true,
      onComponentAdded: (id, el) => {
        if (el instanceof TbSurfaceComponent) {
          el._onAttachedToSurface(this);
        }
      },
      onComponentRemoved: (id) => {
        // Find and clean up the corresponding circuitry node
        this._unregisterSurfaceNodeById(id);
      },
    });
  }

  /**
   * Add a surface element to this component's surface grid.
   * Assigns a surface-id if not already set.
   * @param {HTMLElement} el - The surface component element
   * @param {Object} config - Grid placement config { x, y, minWidth, minHeight, ... }
   * @returns {string} The surface-id assigned to the element
   */
  addSurfaceElement(el, config = {}) {
    this._initSurfaceGrid();

    // Assign a stable surface-id
    let sid = el.getAttribute("surface-id");
    if (!sid) {
      sid = this._generateSurfaceId(el.tagName.toLowerCase());
      el.setAttribute("surface-id", sid);
    }

    // Read size constraints from the component class
    const constraints = el.constructor.sizeConstraints || { minW: 1, minH: 1, maxW: null, maxH: null };

    // Default to minimum dimensions; clamp provided values to constraints
    let w = config.width || constraints.minW;
    let h = config.height || constraints.minH;
    w = Math.max(w, constraints.minW);
    h = Math.max(h, constraints.minH);
    if (constraints.maxW !== null) w = Math.min(w, constraints.maxW);
    if (constraints.maxH !== null) h = Math.min(h, constraints.maxH);

    // Clamp max to never be below min
    const maxW = constraints.maxW !== null && constraints.maxW < constraints.minW ? constraints.minW : constraints.maxW;
    const maxH = constraints.maxH !== null && constraints.maxH < constraints.minH ? constraints.minH : constraints.maxH;

    // Only resizable if at least one axis has room between min and max
    const canResizeH = maxW === null || maxW > constraints.minW;
    const canResizeV = maxH === null || maxH > constraints.minH;
    const resizable = config.resizable !== false && (canResizeH || canResizeV);

    this._surfaceGrid.addComponent(sid, el, {
      x: config.x || 0,
      y: config.y || 0,
      width: w,
      height: h,
      minWidth: constraints.minW,
      minHeight: constraints.minH,
      maxWidth: maxW,
      maxHeight: maxH,
      resizable,
    });

    return sid;
  }

  /**
   * Remove a surface element by its surface-id.
   * Also removes its circuitry node and edges.
   */
  removeSurfaceElement(surfaceId) {
    if (this._surfaceGrid) {
      this._surfaceGrid.removeComponent(surfaceId);
    }
  }

  /** Generate a unique surface-id for a new element */
  _generateSurfaceId(tagName) {
    const prefix = tagName.replace("tb-", "");
    let sid;
    do {
      this._surfaceIdCounter++;
      sid = `${prefix}-${this._surfaceIdCounter}`;
    } while (
      this._surfaceGrid &&
      this._surfaceGrid.getComponent(sid)
    );
    return sid;
  }

  /**
   * Register a surface component as a circuitry node.
   * Called automatically when a TbSurfaceComponent is added to the surface grid.
   */
  _registerSurfaceNode(surfaceComponent) {
    const sid = surfaceComponent.surfaceId;
    if (!sid) return;

    const nodeId = "surface-" + sid;
    const ports = surfaceComponent.constructor.circuitryPorts || { inputs: [], outputs: [] };
    const type = surfaceComponent.tagName.toLowerCase().replace("tb-", "surface-");

    // Don't add if already exists
    if (this._circuitryData.nodes.find(n => n.id === nodeId)) return;

    // Place above the rightmost existing node (accounting for position + width)
    let spawnX = 100;
    let spawnY = 100;
    const NODE_WIDTH = 140; // approximate rendered node width
    if (this._circuitryData.nodes.length > 0) {
      let rightmost = null;
      let maxRight = -Infinity;
      for (const n of this._circuitryData.nodes) {
        const right = (n.x || 0) + NODE_WIDTH;
        if (right > maxRight) {
          maxRight = right;
          rightmost = n;
        }
      }
      if (rightmost) {
        spawnX = rightmost.x;
        spawnY = (rightmost.y || 0) - 120;
      }
    }

    const nodeData = {
      id: nodeId,
      type: type,
      x: spawnX,
      y: spawnY,
      config: {
        surfaceId: sid,
        ports: ports,
        surfaceManaged: true,
        label: surfaceComponent.getAttribute("label") || sid,
      },
    };

    this._circuitryData.nodes.push(nodeData);

    // If the editor is open, also add to the live node editor
    if (this._open && this._nodeEditor) {
      this._nodeEditor.addExternalNode(nodeData);
    }

    this._emitCircuitryChange();
  }

  /**
   * Unregister a surface component's circuitry node by surface-id.
   * Removes the node and any edges connected to it.
   */
  _unregisterSurfaceNodeById(surfaceId) {
    const nodeId = "surface-" + surfaceId;
    const nodeIdx = this._circuitryData.nodes.findIndex(n => n.id === nodeId);
    if (nodeIdx === -1) return;

    this._circuitryData.nodes.splice(nodeIdx, 1);
    this._circuitryData.edges = this._circuitryData.edges.filter(
      e => e.from !== nodeId && e.to !== nodeId
    );

    this._emitCircuitryChange();
  }

  _unregisterSurfaceNode(surfaceComponent) {
    if (surfaceComponent.surfaceId) {
      this._unregisterSurfaceNodeById(surfaceComponent.surfaceId);
    }
  }

  /**
   * Sync label node config (text, overwriteText) to surface label elements.
   * Also resolves connected device names from edges.
   */
  _syncLabelConfig() {
    const { nodes, edges } = this._circuitryData;
    if (!nodes?.length) return;

    for (const node of nodes) {
      if (node.type !== "surface-label" || !node.config?.surfaceManaged) continue;
      const sid = node.config.surfaceId;
      const surfaceEl = this.shadowRoot?.querySelector(`[surface-id="${sid}"]`);
      if (!surfaceEl) continue;

      // Sync override toggle
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

      // Resolve connected device name from edges
      for (const edge of edges) {
        if (edge.to !== node.id) continue;
        const sourceNode = nodes.find(n => n.id === edge.from);
        const deviceName = sourceNode?.config?.device
          || sourceNode?.config?.label
          || sourceNode?.config?.surfaceId
          || "";
        if (deviceName) surfaceEl.deviceText = deviceName;
      }
    }
  }

  _syncToggleConfig() {
    const { nodes } = this._circuitryData;
    if (!nodes?.length) return;

    for (const node of nodes) {
      if (node.type !== "surface-toggle" || !node.config?.surfaceManaged) continue;
      const sid = node.config.surfaceId;
      const surfaceEl = this.shadowRoot?.querySelector(`[surface-id="${sid}"]`);
      if (!surfaceEl) continue;

      const orientation = node.config.orientation || "vertical";
      if (orientation !== "vertical") {
        surfaceEl.setAttribute("orientation", orientation);
      } else {
        surfaceEl.removeAttribute("orientation");
      }

      const size = node.config.size || "medium";
      surfaceEl.setAttribute("size", size);

      // Update grid constraints and resize to fit the new shape
      if (this._surfaceGrid) {
        const c = TbComponent._toggleConstraints(orientation, size);
        this._surfaceGrid.updateConstraints(sid, c);
        // Force the element to match at least the new minimums
        // (updateConstraints grows, but orientation swap may need both axes)
        const comp = this._surfaceGrid.getComponent(sid);
        if (comp) {
          // Resize to match the new constraints exactly — both grow and shrink.
          // Toggle size presets define the intended allocation, so clamp to it.
          if (comp.w !== c.minW || comp.h !== c.minH) {
            this._surfaceGrid.updateComponent(sid, { w: c.minW, h: c.minH });
          }
        }
        // Sync editor handle if editor is open
        if (this._editorItems) {
          const item = this._editorItems.get(sid);
          const comp2 = this._surfaceGrid.getComponent(sid);
          if (item && comp2) {
            item.w = comp2.w;
            item.h = comp2.h;
            item.el.style.width = comp2.w * CELL_SIZE + "px";
            item.el.style.height = comp2.h * CELL_SIZE + "px";
          }
        }
      }

      const switchStyle = node.config.style || "squared";
      if (switchStyle !== "squared") {
        surfaceEl.setAttribute("switch-style", switchStyle);
      } else {
        surfaceEl.removeAttribute("switch-style");
      }
    }
  }

  _syncRainbowConfig() {
    const { nodes } = this._circuitryData;
    if (!nodes?.length) return;

    for (const node of nodes) {
      if (node.type !== "surface-rainbow" || !node.config?.surfaceManaged) continue;
      const sid = node.config.surfaceId;
      const surfaceEl = this.shadowRoot?.querySelector(`[surface-id="${sid}"]`);
      if (!surfaceEl) continue;

      const fps = node.config.fps;
      if (fps && parseFloat(fps) > 0) {
        surfaceEl.setAttribute("fps", String(fps));
      }
    }
  }

  /** Emit circuitry change event for config persistence */
  _emitCircuitryChange() {
    this.dispatchEvent(new CustomEvent("component-config-change", {
      bubbles: true,
      detail: {
        id: this.getAttribute("component-id"),
        property: "circuitry",
        value: this._circuitryData,
      },
    }));
  }

  /**
   * Get the current surface layout as a serializable config array.
   * Used for persisting surface element positions.
   */
  _getSurfaceConfig() {
    if (!this._surfaceGrid) return [];
    const result = [];
    for (const [id, comp] of this._surfaceGrid.components) {
      const el = comp.el;
      const type = el.tagName.toLowerCase().replace("tb-", "");
      const entry = {
        type,
        surfaceId: id,
        x: comp.x,
        y: comp.y,
        width: comp.w,
        height: comp.h,
        props: {},
      };

      // Capture relevant attributes as props
      for (const attr of el.attributes) {
        if (attr.name === "surface-id" || attr.name === "class" || attr.name === "style") continue;
        entry.props[attr.name] = attr.value;
      }
      if (el.dataset.binding) {
        entry.props.binding = el.dataset.binding;
      }

      result.push(entry);
    }
    return result;
  }

  /**
   * Copy a single surface element + its connected circuitry to session clipboard.
   */
  _copySurfaceElement(surfaceId) {
    if (!this._surfaceGrid) return;
    const comp = this._surfaceGrid.getComponent(surfaceId);
    if (!comp) return;

    const el = comp.el;
    const type = el.tagName.toLowerCase().replace("tb-", "");
    const surface = {
      type,
      surfaceId,
      x: comp.x,
      y: comp.y,
      width: comp.w,
      height: comp.h,
      props: {},
    };
    for (const attr of el.attributes) {
      if (attr.name === "surface-id" || attr.name === "class" || attr.name === "style") continue;
      surface.props[attr.name] = attr.value;
    }
    if (el.dataset.binding) {
      surface.props.binding = el.dataset.binding;
    }

    // Gather circuitry: the surface node + all connected nodes and edges
    const circuitry = this._circuitryData || { nodes: [], edges: [] };
    const surfaceNodeId = "surface-" + surfaceId;
    const connectedEdges = circuitry.edges.filter(
      e => e.from === surfaceNodeId || e.to === surfaceNodeId
    );
    const connectedNodeIds = new Set([surfaceNodeId]);
    for (const edge of connectedEdges) {
      connectedNodeIds.add(edge.from);
      connectedNodeIds.add(edge.to);
    }
    const nodes = circuitry.nodes.filter(n => connectedNodeIds.has(n.id));

    sessionStorage.setItem("tb-clipboard", JSON.stringify({
      surface,
      nodes,
      edges: connectedEdges,
    }));
  }

  /**
   * Paste a surface element from session clipboard at the given grid position.
   */
  _pasteSurfaceElement(gridX, gridY, compId) {
    const raw = sessionStorage.getItem("tb-clipboard");
    if (!raw) return;
    let clip;
    try { clip = JSON.parse(raw); } catch { return; }
    if (!clip.surface) return;

    const src = clip.surface;

    // Check if position is free
    if (!this._isSurfaceAreaFree(gridX, gridY, src.width, src.height, this._editorItems)) return;

    // Create the new surface element
    const newEl = document.createElement("tb-" + src.type);
    // Apply props as attributes
    for (const [key, val] of Object.entries(src.props || {})) {
      if (key === "binding") {
        newEl.dataset.binding = val;
      } else {
        newEl.setAttribute(key, val);
      }
    }

    this.addSurfaceElement(newEl, {
      x: gridX,
      y: gridY,
      width: src.width,
      height: src.height,
    });

    const newSid = newEl.getAttribute("surface-id");
    const newComp = this._surfaceGrid.getComponent(newSid);
    const actualW = newComp ? newComp.w : src.width;
    const actualH = newComp ? newComp.h : src.height;
    const handle = this._createEditorHandle(
      newSid, gridX, gridY, actualW, actualH,
      newComp ? newComp.resizable : true, compId
    );
    this._editorHandles.appendChild(handle);
    this._editorItems.set(newSid, {
      el: handle, x: gridX, y: gridY,
      w: actualW, h: actualH, resizable: newComp ? newComp.resizable : true,
    });

    // Remap and add circuitry nodes and edges
    const oldSurfaceNodeId = "surface-" + src.surfaceId;
    const newSurfaceNodeId = "surface-" + newSid;
    const nodeIdMap = { [oldSurfaceNodeId]: newSurfaceNodeId };

    // Merge the original surface node's config into the auto-registered one
    // (addSurfaceElement creates a bare node; we need to preserve size, orientation, etc.)
    const origSurfaceNode = (clip.nodes || []).find(n => n.id === oldSurfaceNodeId);
    if (origSurfaceNode) {
      const registeredNode = this._circuitryData.nodes.find(n => n.id === newSurfaceNodeId);
      if (registeredNode) {
        Object.assign(registeredNode.config, origSurfaceNode.config);
        // Fix IDs to point to the new surface element
        registeredNode.config.surfaceId = newSid;
        registeredNode.config.label = newSid;
      }
    }

    for (const node of (clip.nodes || [])) {
      if (node.id === oldSurfaceNodeId) continue; // surface node already handled above
      const newNodeId = node.id + "-" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
      nodeIdMap[node.id] = newNodeId;
      const clonedNode = JSON.parse(JSON.stringify(node));
      clonedNode.id = newNodeId;
      // Offset position so pasted nodes don't stack exactly
      clonedNode.x = (clonedNode.x || 0) + 40;
      clonedNode.y = (clonedNode.y || 0) + 40;
      this._circuitryData.nodes.push(clonedNode);
    }

    for (const edge of (clip.edges || [])) {
      const newEdge = {
        ...edge,
        from: nodeIdMap[edge.from] || edge.from,
        to: nodeIdMap[edge.to] || edge.to,
      };
      this._circuitryData.edges.push(newEdge);
    }

    // Apply circuitry-driven config (size, orientation, label overrides, etc.)
    this._syncToggleConfig();
    this._syncLabelConfig();
    this._syncRainbowConfig();

    // Update the editor handle to match the (potentially changed) size
    const updatedComp = this._surfaceGrid.getComponent(newSid);
    if (updatedComp && this._editorItems.has(newSid)) {
      const item = this._editorItems.get(newSid);
      item.w = updatedComp.w;
      item.h = updatedComp.h;
      item.el.style.width = updatedComp.w * CELL_SIZE + "px";
      item.el.style.height = updatedComp.h * CELL_SIZE + "px";
    }

    this._emitSurfaceChange(compId);
    this._emitCircuitryChange();
  }

  _render() {
    const color = this.getAttribute("color") || "#d4cdb8";
    const name = this.getAttribute("name") || "";

    this._surfaceView.style.background = color;

    // Set highlight color custom property for CSS
    const hl = TbComponent.computeHighlight(color);
    this.style.setProperty("--comp-hl", hl);
  }

  /**
   * Compute a bright complementary highlight color from bgColor.
   * Only the hue changes (180° shift); saturation and lightness stay fixed.
   * For near-neutral backgrounds, falls back to cyan.
   */
  static computeHighlight(hexColor) {
    let hex = (hexColor || "#d4cdb8").replace("#", "");
    if (hex.length === 3) hex = hex[0]+hex[0]+hex[1]+hex[1]+hex[2]+hex[2];
    const r = parseInt(hex.substr(0, 2), 16) / 255;
    const g = parseInt(hex.substr(2, 2), 16) / 255;
    const b = parseInt(hex.substr(4, 2), 16) / 255;

    const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
    let h = 0, s = 0;
    if (mx !== mn) {
      const d = mx - mn;
      const l = (mx + mn) / 2;
      s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn);
      if (mx === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
      else if (mx === g) h = ((b - r) / d + 2) / 6;
      else h = ((r - g) / d + 4) / 6;
    }

    // Complementary hue; cyan for neutrals
    const nh = s < 0.1 ? 0.5 : (h + 0.5) % 1;

    // Fixed bright saturation and lightness
    const ns = 0.85;
    const nl = 0.65;

    // HSL → RGB
    const q = nl < 0.5 ? nl * (1 + ns) : nl + ns - nl * ns;
    const p = 2 * nl - q;
    const f = (t) => {
      t = ((t % 1) + 1) % 1;
      return t < 1/6 ? p+(q-p)*6*t : t < 0.5 ? q : t < 2/3 ? p+(q-p)*(2/3-t)*6 : p;
    };
    const hr = f(nh + 1/3), hg = f(nh), hb = f(nh - 1/3);

    const x = (v) => Math.round(v * 255).toString(16).padStart(2, "0");
    return `#${x(hr)}${x(hg)}${x(hb)}`;
  }

  /** Open the editor — expands from the box's grid position to center of screen */
  openEditor() { return this._openEditor(); }
  _openEditor() {
    if (this._open || this._animating || this._closing) return;
    if (window.editorState?.activeComponentId != null) return;
    this._animating = true;

    const rect = this.getBoundingClientRect();
    const color = this.getAttribute("color") || "#d4cdb8";
    const compId = this.getAttribute("component-id") || "";
    const darkerColor = this._darkenColor(color, 0.4);
    const highlightColor = TbComponent.computeHighlight(color);

    // Set circuitry view colors
    this._circuitryView.style.background = darkerColor;
    this._circuitryView.style.border = `3px solid ${color}`;

    // Set CELL_SIZE CSS variable for grid dots
    this.style.setProperty("--cell-size", CELL_SIZE + "px");

    // Save original grid-relative inline styles for restoration on close
    this._savedGridStyles = {
      position: this.style.position,
      left: this.style.left,
      top: this.style.top,
      width: this.style.width,
      height: this.style.height,
      zIndex: this.style.zIndex,
      overflow: this.style.overflow,
      transition: this.style.transition,
    };

    // Show page-level backdrop (covers all other component boxes)
    this._pageBackdrop = document.querySelector(".editor-page-backdrop");
    if (!this._pageBackdrop) {
      this._pageBackdrop = document.createElement("div");
      this._pageBackdrop.className = "editor-page-backdrop";
      document.body.appendChild(this._pageBackdrop);
    }
    this._pageBackdrop.classList.add("active");

    // Switch to fixed positioning at the box's current viewport position
    // Override overflow:hidden and z-index:1 from .component-box
    this.style.position = "fixed";
    this.style.left = rect.left + "px";
    this.style.top = rect.top + "px";
    this.style.width = rect.width + "px";
    this.style.height = rect.height + "px";
    this.style.zIndex = "1000";
    this.classList.add("editor-open");

    // Save viewport rect for close animation
    this._gridRect = { left: rect.left, top: rect.top, width: rect.width, height: rect.height };

    // Force the browser to commit the initial position before adding the transition
    this.getBoundingClientRect();

    // Now apply the transition and editing class
    const ease = "0.4s cubic-bezier(0.4, 0, 0.2, 1)";
    this.style.transition = `left ${ease}, top ${ease}, width ${ease}, height ${ease}`;
    this.classList.add("editing");

    // Unlock surface grid so elements can be dragged/resized in the editor
    if (this._surfaceGrid) this._surfaceGrid.locked = false;

    // Load circuitry data into node editor
    if (this._nodeEditor && this._circuitryData) {
      this._nodeEditor.loadData(this._circuitryData);
    }

    // Pass live device state so node editor can list real buildings
    if (this._nodeEditor && typeof deviceState !== "undefined") {
      this._nodeEditor.setDevices(deviceState);
    }

    // Set legend color from component color
    if (this._nodeEditor) {
      this._nodeEditor.highlightColor = color;
    }

    // Color FAB — appended to body so it sits at page bottom-right
    const colorSelector = document.createElement("tb-color-selector");
    colorSelector.className = "color-selector";
    colorSelector.setAttribute("color", color);
    document.body.appendChild(colorSelector);
    this._colorFab = colorSelector;

    // Ghost element for placement preview
    this._editorGhost.style.display = "none";

    // Track editor handles for collision detection
    this._editorItems = new Map();

    // Create transparent handles over each surface element
    if (this._surfaceGrid) {
      for (const [id, comp] of this._surfaceGrid.components) {
        const handle = this._createEditorHandle(
          id, comp.x, comp.y, comp.w, comp.h, comp.resizable, compId
        );
        this._editorHandles.appendChild(handle);
        this._editorItems.set(id, {
          el: handle, x: comp.x, y: comp.y,
          w: comp.w, h: comp.h, resizable: comp.resizable,
        });
      }
    }

    // Right-click context menu on the surface — adds elements via inner Grid
    this._dismissSurfaceMenu = () => {
      if (this._surfaceMenu) { this._surfaceMenu.remove(); this._surfaceMenu = null; }
      this._editorGhost.style.display = "none";
    };

    document.addEventListener("click", this._dismissSurfaceMenu);

    this._surfaceContextHandler = (e) => {
      // Don't show on existing surface element handles
      if (e.target.closest(".surface-handle")) return;
      e.preventDefault();
      this._dismissSurfaceMenu();

      const elementTypes = [
        { type: "led",    tag: "tb-led",    name: "LED Indicator", icon: "●" },
        { type: "label",  tag: "tb-label",  name: "Label",         icon: "A" },
        { type: "dial",   tag: "tb-dial",   name: "Dial",          icon: "◔" },
        { type: "toggle", tag: "tb-toggle", name: "Toggle Switch", icon: "⏻" },
        { type: "alert",  tag: "tb-alert",  name: "Alert",         icon: "⚠" },
        { type: "color-picker", tag: "tb-color-picker", name: "Color Picker", icon: "🎨" },
        { type: "rainbow", tag: "tb-rainbow", name: "Rainbow", icon: "🌈" },
      ].map(et => {
        const tmp = document.createElement(et.tag);
        const sc = tmp.constructor.sizeConstraints || { minW: 1, minH: 1 };
        return { ...et, w: sc.defaultW || sc.minW, h: sc.defaultH || sc.minH };
      });

      // Calculate grid position from click (clamped to 1-cell margin)
      const surfaceRect = this._surfaceView.getBoundingClientRect();
      const gridX = Math.max(1, Math.floor((e.clientX - surfaceRect.left) / CELL_SIZE));
      const gridY = Math.max(1, Math.floor((e.clientY - surfaceRect.top) / CELL_SIZE));

      const surfaceMenu = document.createElement("div");
      surfaceMenu.className = "ctx-menu";
      surfaceMenu.style.left = e.clientX + "px";
      surfaceMenu.style.top = e.clientY + "px";

      // Paste option (if clipboard has data)
      const clipData = sessionStorage.getItem("tb-clipboard");
      if (clipData) {
        let clip;
        try { clip = JSON.parse(clipData); } catch { /* ignore */ }
        if (clip && clip.surface) {
          const fits = this._isSurfaceAreaFree(gridX, gridY, clip.surface.width, clip.surface.height, this._editorItems);
          const pasteBtn = document.createElement("div");
          pasteBtn.className = "ctx-menu-item" + (fits ? "" : " disabled");
          pasteBtn.innerHTML = '<span class="ctx-menu-paste-icon">&#x1F4CB;</span> <span>Paste (' + clip.surface.type + ')</span>';

          if (fits) {
            pasteBtn.addEventListener("mouseenter", () => {
              this._editorGhost.style.display = "";
              this._editorGhost.style.left = gridX * CELL_SIZE + "px";
              this._editorGhost.style.top = gridY * CELL_SIZE + "px";
              this._editorGhost.style.width = clip.surface.width * CELL_SIZE + "px";
              this._editorGhost.style.height = clip.surface.height * CELL_SIZE + "px";
              this._editorGhost.classList.remove("blocked");
            });
            pasteBtn.addEventListener("mouseleave", () => {
              this._editorGhost.style.display = "none";
            });
            pasteBtn.addEventListener("click", () => {
              this._pasteSurfaceElement(gridX, gridY, compId);
              this._editorGhost.style.display = "none";
              this._dismissSurfaceMenu();
            });
          }

          surfaceMenu.appendChild(pasteBtn);

          const sep = document.createElement("div");
          sep.className = "ctx-menu-sep";
          surfaceMenu.appendChild(sep);
        }
      }

      const hdr = document.createElement("div");
      hdr.className = "ctx-menu-header";
      hdr.textContent = "Add Surface Element";
      surfaceMenu.appendChild(hdr);

      for (const et of elementTypes) {
        const fits = this._isSurfaceAreaFree(gridX, gridY, et.w, et.h, this._editorItems);

        const row = document.createElement("div");
        row.className = "ctx-menu-item" + (fits ? "" : " disabled");

        const icon = document.createElement("span");
        icon.className = "ctx-menu-surface-icon";
        icon.textContent = et.icon;

        const name = document.createElement("span");
        name.textContent = et.name;

        const tag = document.createElement("span");
        tag.className = "type-tag";
        tag.textContent = `${et.w}\u00d7${et.h}`;

        row.appendChild(icon);
        row.appendChild(name);
        row.appendChild(tag);

        // Ghost preview on hover
        row.addEventListener("mouseenter", () => {
          this._editorGhost.style.display = "";
          this._editorGhost.style.left = gridX * CELL_SIZE + "px";
          this._editorGhost.style.top = gridY * CELL_SIZE + "px";
          this._editorGhost.style.width = et.w * CELL_SIZE + "px";
          this._editorGhost.style.height = et.h * CELL_SIZE + "px";
          this._editorGhost.classList.toggle("blocked", !fits);
        });

        row.addEventListener("mouseleave", () => {
          this._editorGhost.style.display = "none";
        });

        if (fits) {
          row.addEventListener("click", () => {
            // Create the surface element and add it to the inner grid
            const newEl = document.createElement(et.tag);
            this.addSurfaceElement(newEl, {
              x: gridX,
              y: gridY,
              width: et.w,
              height: et.h,
            });

            // Get the assigned surface-id and read actual clamped size from grid
            const newSid = newEl.getAttribute("surface-id");
            const newComp = this._surfaceGrid.getComponent(newSid);
            const actualW = newComp ? newComp.w : et.w;
            const actualH = newComp ? newComp.h : et.h;
            const handle = this._createEditorHandle(
              newSid, gridX, gridY, actualW, actualH,
              newComp ? newComp.resizable : true, compId
            );
            this._editorHandles.appendChild(handle);
            this._editorItems.set(newSid, {
              el: handle, x: gridX, y: gridY,
              w: actualW, h: actualH, resizable: newComp ? newComp.resizable : true,
            });

            this._emitSurfaceChange(compId);
            this._editorGhost.style.display = "none";
            this._dismissSurfaceMenu();
          });
        }

        surfaceMenu.appendChild(row);
      }

      document.body.appendChild(surfaceMenu);
      this._surfaceMenu = surfaceMenu;

      // Keep within viewport
      const menuRect = surfaceMenu.getBoundingClientRect();
      if (menuRect.right > window.innerWidth) {
        surfaceMenu.style.left = (e.clientX - menuRect.width) + "px";
      }
      if (menuRect.bottom > window.innerHeight) {
        surfaceMenu.style.top = (e.clientY - menuRect.height) + "px";
      }
    };

    this._surfaceView.addEventListener("contextmenu", this._surfaceContextHandler);

    // Animate to center of screen
    const centerX = (window.innerWidth - rect.width) / 2;
    const centerY = (window.innerHeight - rect.height) / 2;

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        this.style.left = centerX + "px";
        this.style.top = centerY + "px";
      });
    });

    this._animating = false;
    this._open = true;
    this._mode = "surface";

    // Update global editor state
    window.editorState.activeComponentId = compId;
    window.editorState.mode = "surface";

    // Store original frame size for restoring when switching back to surface
    const margin = parseInt(getComputedStyle(document.documentElement).getPropertyValue("--editor-margin")) || 40;
    this._origFrame = {
      width: rect.width,
      height: rect.height,
      left: centerX,
      top: centerY,
    };

    // Mode switching
    const surfaceBtn = this.shadowRoot.querySelector(".mode-surface");
    const circuitryBtn = this.shadowRoot.querySelector(".mode-circuitry");
    const closeBtn = this.shadowRoot.querySelector(".mode-close");

    this._modeSurfaceHandler = (e) => {
      e.stopPropagation();
      this.classList.remove("circuitry-active");
      surfaceBtn.classList.add("active");
      circuitryBtn.classList.remove("active");
      if (colorSelector) colorSelector.style.display = "";
      this._mode = "surface";
      window.editorState.mode = "surface";

      // Sync circuitry changes to surface elements
      if (this._nodeEditor) {
        this._circuitryData = this._nodeEditor.getData();
        this._syncLabelConfig();
        this._syncToggleConfig();
        this._syncRainbowConfig();
      }

      // Animate back to original size
      this.style.left = this._origFrame.left + "px";
      this.style.top = this._origFrame.top + "px";
      this.style.width = this._origFrame.width + "px";
      this.style.height = this._origFrame.height + "px";
    };

    this._modeCircuitryHandler = (e) => {
      e.stopPropagation();
      this.classList.add("circuitry-active");
      circuitryBtn.classList.add("active");
      surfaceBtn.classList.remove("active");
      if (colorSelector) colorSelector.style.display = "none";
      this._mode = "circuitry";
      window.editorState.mode = "circuitry";

      // Animate to fill viewport minus margin
      this.style.left = margin + "px";
      this.style.top = margin + "px";
      this.style.width = (window.innerWidth - margin * 2) + "px";
      this.style.height = (window.innerHeight - margin * 2) + "px";
    };

    this._modeCloseHandler = (e) => {
      e.stopPropagation();
      this._closeEditor();
    };

    surfaceBtn.addEventListener("click", this._modeSurfaceHandler);
    circuitryBtn.addEventListener("click", this._modeCircuitryHandler);
    closeBtn.addEventListener("click", this._modeCloseHandler);

    // Backdrop click to close (page-level backdrop)
    this._backdropHandler = () => { this._closeEditor(); };
    this._pageBackdrop.addEventListener("click", this._backdropHandler);

    // Color change
    if (colorSelector) {
      this._colorChangeHandler = (e) => {
        const newColor = e.detail.color;
        this.setAttribute("color", newColor);
        this._circuitryView.style.background = this._darkenColor(newColor, 0.4);
        this._circuitryView.style.borderColor = newColor;

        // Update highlight color for editor UI
        const newHighlight = TbComponent.computeHighlight(newColor);
        this.style.setProperty("--comp-hl", newHighlight);

        // Update node editor legend colors
        if (this._nodeEditor) this._nodeEditor.highlightColor = newColor;

        // Dispatch event for config save
        this.dispatchEvent(new CustomEvent("component-config-change", {
          bubbles: true,
          detail: { id: compId, property: "color", value: newColor },
        }));
      };
      colorSelector.addEventListener("color-change", this._colorChangeHandler);
    }

    // Escape to close
    this._escHandler = (e) => {
      if (e.key === "Escape") this._closeEditor();
    };
    document.addEventListener("keydown", this._escHandler);
  }

  /** Close editor with reverse animation back to grid position */
  _closeEditor() {
    if (!this._open || this._closing) return;
    this._closing = true;

    // Lock surface grid so elements can't be dragged from the dashboard
    if (this._surfaceGrid) this._surfaceGrid.locked = true;

    // Save node editor data before closing
    if (this._nodeEditor) {
      this._circuitryData = this._nodeEditor.getData();
      this.dispatchEvent(new CustomEvent("component-config-change", {
        bubbles: true,
        detail: {
          id: this.getAttribute("component-id"),
          property: "circuitry",
          value: this._circuitryData,
        },
      }));
    }

    // Clean up properties panel
    if (this._propsPanel) {
      this._propsPanel.remove();
      this._propsPanel = null;
    }

    // Clean up surface context menu
    if (this._dismissSurfaceMenu) {
      this._dismissSurfaceMenu();
      document.removeEventListener("click", this._dismissSurfaceMenu);
    }

    // Remove color FAB
    if (this._colorFab) {
      this._colorFab.remove();
      this._colorFab = null;
    }

    // Sync label/toggle config so surface elements reflect circuitry changes
    this._syncLabelConfig();
    this._syncToggleConfig();
    this._syncRainbowConfig();

    // Persist the surface config
    this._emitSurfaceChange(this.getAttribute("component-id"));

    // Hide page-level backdrop
    if (this._pageBackdrop) {
      this._pageBackdrop.classList.remove("active");
    }

    // Animate back to grid box position
    this.style.left = this._gridRect.left + "px";
    this.style.top = this._gridRect.top + "px";
    this.style.width = this._gridRect.width + "px";
    this.style.height = this._gridRect.height + "px";

    // Remove circuitry mode if active
    this.classList.remove("circuitry-active");

    // After close animation completes: clean up listeners, classes, and styles
    setTimeout(() => {
      // Remove event listeners
      document.removeEventListener("keydown", this._escHandler);
      if (this._pageBackdrop) {
        this._pageBackdrop.removeEventListener("click", this._backdropHandler);
      }
      this._surfaceView.removeEventListener("contextmenu", this._surfaceContextHandler);

      const surfaceBtn = this.shadowRoot.querySelector(".mode-surface");
      const circuitryBtn = this.shadowRoot.querySelector(".mode-circuitry");
      const closeBtn = this.shadowRoot.querySelector(".mode-close");
      surfaceBtn.removeEventListener("click", this._modeSurfaceHandler);
      circuitryBtn.removeEventListener("click", this._modeCircuitryHandler);
      closeBtn.removeEventListener("click", this._modeCloseHandler);

      // Remove editing mode and restore original grid-managed inline styles
      this.classList.remove("editing", "editor-open");

      if (this._savedGridStyles) {
        this.style.position = this._savedGridStyles.position;
        this.style.left = this._savedGridStyles.left;
        this.style.top = this._savedGridStyles.top;
        this.style.width = this._savedGridStyles.width;
        this.style.height = this._savedGridStyles.height;
        this.style.zIndex = this._savedGridStyles.zIndex;
        this.style.overflow = this._savedGridStyles.overflow;
        this.style.transition = this._savedGridStyles.transition;
        this._savedGridStyles = null;
      }

      // Clear editor handles
      this._editorHandles.innerHTML = "";
      this._editorItems = null;

      // Reset toolbar button states
      surfaceBtn.classList.add("active");
      circuitryBtn.classList.remove("active");

      // Reset state
      this._open = false;
      this._closing = false;
      window.editorState.activeComponentId = null;
      window.editorState.mode = "dashboard";
    }, 400);
  }

  /** Create a transparent handle overlay for a surface element in the editor */
  _createEditorHandle(surfaceId, x, y, w, h, resizable, compId) {
    const handle = document.createElement("div");
    handle.className = "surface-handle" + (resizable ? "" : " no-resize");
    handle.dataset.surfaceId = surfaceId;
    handle.style.left = x * CELL_SIZE + "px";
    handle.style.top = y * CELL_SIZE + "px";
    handle.style.width = w * CELL_SIZE + "px";
    handle.style.height = h * CELL_SIZE + "px";

    if (resizable) {
      const resizeEl = document.createElement("div");
      resizeEl.className = "surface-resize-handle";

      // Set cursor based on which axes can actually resize
      const gridComp = this._surfaceGrid ? this._surfaceGrid.getComponent(surfaceId) : null;
      if (gridComp) {
        const canH = gridComp.maxW === null || gridComp.maxW > gridComp.minW;
        const canV = gridComp.maxH === null || gridComp.maxH > gridComp.minH;
        if (canH && !canV) resizeEl.style.cursor = "ew-resize";
        else if (!canH && canV) resizeEl.style.cursor = "ns-resize";
      }

      handle.appendChild(resizeEl);

      resizeEl.addEventListener("mousedown", (e) => {
        e.preventDefault();
        e.stopPropagation();
        this._startSurfaceResize(handle, surfaceId, e, compId);
      });
    }

    handle.addEventListener("mousedown", (e) => {
      if (e.button !== 0) return;
      // Use a drag threshold so clicks pass through to interactive elements
      const startX = e.clientX;
      const startY = e.clientY;
      let dragging = false;

      const onMove = (me) => {
        if (!dragging && (Math.abs(me.clientX - startX) > 3 || Math.abs(me.clientY - startY) > 3)) {
          dragging = true;
          this._startSurfaceDrag(handle, surfaceId, e, compId);
        }
      };

      const onUp = () => {
        document.removeEventListener("mousemove", onMove);
        document.removeEventListener("mouseup", onUp);
      };

      document.addEventListener("mousemove", onMove);
      document.addEventListener("mouseup", onUp);
    });

    // Double-click to open overwritable properties panel
    handle.addEventListener("dblclick", (e) => {
      e.stopPropagation();
      const origEl = this._surfaceGrid ? this._surfaceGrid.getComponent(surfaceId)?.el : null;
      if (origEl) this._showPropertiesPanel(handle, origEl, surfaceId, compId);
    });

    // Right-click context menu for this surface element (copy / delete)
    handle.addEventListener("contextmenu", (e) => {
      e.preventDefault();
      e.stopPropagation();
      this._dismissSurfaceMenu();

      const menu = document.createElement("div");
      menu.className = "ctx-menu";
      menu.style.left = e.clientX + "px";
      menu.style.top = e.clientY + "px";

      // Copy
      const copy = document.createElement("div");
      copy.className = "ctx-menu-item";
      copy.innerHTML = '<span class="ctx-menu-copy-icon">&#x1F4CB;</span> <span>Copy</span>';
      copy.addEventListener("click", () => {
        this._copySurfaceElement(surfaceId);
        this._dismissSurfaceMenu();
      });
      menu.appendChild(copy);

      // Delete
      const del = document.createElement("div");
      del.className = "ctx-menu-item ctx-menu-delete";
      del.innerHTML = '<span class="ctx-menu-delete-icon">&#x2716;</span> <span>Delete</span>';
      del.addEventListener("click", () => {
        if (this._nodeEditor) {
          this._nodeEditor.removeNode("surface-" + surfaceId);
        }
        this.removeSurfaceElement(surfaceId);
        handle.remove();
        if (this._editorItems) this._editorItems.delete(surfaceId);
        this._emitSurfaceChange(compId);
        this._dismissSurfaceMenu();
      });
      menu.appendChild(del);

      document.body.appendChild(menu);
      this._surfaceMenu = menu;

      // Keep within viewport
      const menuRect = menu.getBoundingClientRect();
      if (menuRect.right > window.innerWidth) {
        menu.style.left = (e.clientX - menuRect.width) + "px";
      }
      if (menuRect.bottom > window.innerHeight) {
        menu.style.top = (e.clientY - menuRect.height) + "px";
      }
    });

    return handle;
  }

  /**
   * Show a floating properties panel for a surface element's overwritable properties.
   * Each overwritable property gets a checkbox (enable overwrite) + input (custom value).
   */
  _showPropertiesPanel(handle, origEl, surfaceId, compId) {
    // Dismiss any existing panel
    if (this._propsPanel) {
      this._propsPanel.remove();
      this._propsPanel = null;
    }

    const overwritable = origEl.constructor.overwritableProperties || [];
    if (!overwritable.length) return;

    const panel = document.createElement("div");
    panel.className = "surface-props-panel";

    // Position panel below the handle
    const handleRect = handle.getBoundingClientRect();
    const surfaceRect = this._surfaceView.getBoundingClientRect();
    panel.style.left = (handleRect.left - surfaceRect.left) + "px";
    panel.style.top = (handleRect.bottom - surfaceRect.top + 4) + "px";

    for (const prop of overwritable) {
      const row = document.createElement("div");
      row.className = "surface-props-row";

      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.className = "surface-props-check";
      checkbox.checked = origEl.hasAttribute(prop.overwriteAttr);
      checkbox.title = `Enable ${prop.label} overwrite`;

      const label = document.createElement("label");
      label.className = "surface-props-label";
      label.textContent = prop.label;

      const input = document.createElement("input");
      input.type = prop.type || "text";
      input.className = "surface-props-input";
      input.value = origEl.getAttribute(prop.name) || "";
      input.placeholder = "device value";
      input.disabled = !checkbox.checked;

      // Sync checkbox → attribute on original element
      checkbox.addEventListener("change", () => {
        if (checkbox.checked) {
          origEl.setAttribute(prop.overwriteAttr, "");
        } else {
          origEl.removeAttribute(prop.overwriteAttr);
        }
        input.disabled = !checkbox.checked;
        this._emitSurfaceChange(compId);
      });

      // Sync input → attribute on original element
      input.addEventListener("input", () => {
        origEl.setAttribute(prop.name, input.value);
        this._emitSurfaceChange(compId);
      });

      row.appendChild(checkbox);
      row.appendChild(label);
      row.appendChild(input);
      panel.appendChild(row);
    }

    this._editorHandles.appendChild(panel);
    this._propsPanel = panel;

    // Dismiss when clicking outside the panel
    const dismiss = (e) => {
      if (panel.contains(e.target) || handle.contains(e.target)) return;
      panel.remove();
      this._propsPanel = null;
      document.removeEventListener("mousedown", dismiss);
    };
    // Delay listener to avoid immediate dismissal from the dblclick event
    requestAnimationFrame(() => {
      document.addEventListener("mousedown", dismiss);
    });
  }

  /** Start dragging a surface element in the editor */
  _startSurfaceDrag(handle, surfaceId, startEvent, compId) {
    const item = this._editorItems ? this._editorItems.get(surfaceId) : null;
    if (!item) return;

    const startMouseX = startEvent.clientX;
    const startMouseY = startEvent.clientY;
    const startX = item.x;
    const startY = item.y;
    const maxCols = Math.floor(this._surfaceView.clientWidth / CELL_SIZE);
    const maxRows = Math.floor(this._surfaceView.clientHeight / CELL_SIZE);

    const onMove = (e) => {
      const dx = e.clientX - startMouseX;
      const dy = e.clientY - startMouseY;
      // Enforce 1-cell margin around the edges
      const newX = Math.max(1, Math.min(maxCols - 1 - item.w, startX + Math.round(dx / CELL_SIZE)));
      const newY = Math.max(1, Math.min(maxRows - 1 - item.h, startY + Math.round(dy / CELL_SIZE)));

      handle.style.left = newX * CELL_SIZE + "px";
      handle.style.top = newY * CELL_SIZE + "px";
      item.x = newX;
      item.y = newY;
      // Move the actual surface element in real time
      if (this._surfaceGrid) {
        this._surfaceGrid.updateComponent(surfaceId, { x: newX, y: newY });
      }
    };

    const onUp = () => {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
      this._emitSurfaceChange(compId);
    };

    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  }

  /** Start resizing a surface element in the editor */
  _startSurfaceResize(handle, surfaceId, startEvent, compId) {
    const item = this._editorItems ? this._editorItems.get(surfaceId) : null;
    if (!item) return;

    const gridComp = this._surfaceGrid ? this._surfaceGrid.getComponent(surfaceId) : null;
    const minW = gridComp ? gridComp.minW : 1;
    const minH = gridComp ? gridComp.minH : 1;
    const maxW = gridComp ? gridComp.maxW : null;
    const maxH = gridComp ? gridComp.maxH : null;
    const startMouseX = startEvent.clientX;
    const startMouseY = startEvent.clientY;
    const startW = item.w;
    const startH = item.h;
    const maxCols = Math.floor(this._surfaceView.clientWidth / CELL_SIZE);
    const maxRows = Math.floor(this._surfaceView.clientHeight / CELL_SIZE);

    // Per-axis: only resize axes where max > min
    const canResizeH = maxW === null || maxW > minW;
    const canResizeV = maxH === null || maxH > minH;

    // Lock cursor and keep resize UI visible for the entire drag
    const resizeCursor = canResizeH && canResizeV ? "nwse-resize" : canResizeH ? "ew-resize" : "ns-resize";
    document.body.style.cursor = resizeCursor;
    document.body.style.userSelect = "none";
    handle.classList.add("resizing");

    const onMove = (e) => {
      const dx = e.clientX - startMouseX;
      const dy = e.clientY - startMouseY;
      let newW = startW;
      let newH = startH;
      if (canResizeH) {
        newW = Math.max(minW, Math.min(maxCols - 1 - item.x, startW + Math.round(dx / CELL_SIZE)));
        if (maxW !== null) newW = Math.min(newW, maxW);
      }
      if (canResizeV) {
        newH = Math.max(minH, Math.min(maxRows - 1 - item.y, startH + Math.round(dy / CELL_SIZE)));
        if (maxH !== null) newH = Math.min(newH, maxH);
      }

      handle.style.width = newW * CELL_SIZE + "px";
      handle.style.height = newH * CELL_SIZE + "px";
      item.w = newW;
      item.h = newH;
      // Resize the actual surface element in real time
      if (this._surfaceGrid) {
        this._surfaceGrid.updateComponent(surfaceId, { w: newW, h: newH });
      }
    };

    const onUp = () => {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      handle.classList.remove("resizing");
      this._emitSurfaceChange(compId);
    };

    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  }

  /**
   * Compute the minimum grid size needed for this component to fit all
   * surface elements (plus the 1-cell margin on each side).
   */
  _computeRequiredMinSize() {
    if (!this._surfaceGrid || this._surfaceGrid.components.size === 0) {
      return { minW: COMP_MIN_WIDTH, minH: COMP_MIN_HEIGHT };
    }
    let maxRight = 0;
    let maxBottom = 0;
    for (const comp of this._surfaceGrid.components.values()) {
      maxRight = Math.max(maxRight, comp.x + comp.w);
      maxBottom = Math.max(maxBottom, comp.y + comp.h);
    }
    // +1 for the margin on the far side
    return {
      minW: Math.max(COMP_MIN_WIDTH, maxRight + 1),
      minH: Math.max(COMP_MIN_HEIGHT, maxBottom + 1),
    };
  }

  /** Emit surface config change for persistence */
  _emitSurfaceChange(compId) {
    const minSize = this._computeRequiredMinSize();
    this.dispatchEvent(new CustomEvent("component-config-change", {
      bubbles: true,
      detail: {
        id: compId,
        property: "surface",
        value: this._getSurfaceConfig(),
        minWidth: minSize.minW,
        minHeight: minSize.minH,
      },
    }));
  }

  /** Check if a grid area is free on the surface for placing a new element */
  _isSurfaceAreaFree(gridX, gridY, w, h, editorItems, excludeId) {
    const maxCols = Math.floor(this._surfaceView.clientWidth / CELL_SIZE);
    const maxRows = Math.floor(this._surfaceView.clientHeight / CELL_SIZE);
    // Enforce 1-cell margin around the edges (matches the dot-grid inset)
    if (gridX < 1 || gridY < 1 || gridX + w > maxCols - 1 || gridY + h > maxRows - 1) return false;

    for (const [id, item] of editorItems) {
      if (id === excludeId) continue;
      if (gridX < item.x + item.w && gridX + w > item.x &&
          gridY < item.y + item.h && gridY + h > item.y) {
        return false;
      }
    }
    return true;
  }

  /** Darken a CSS hex color by a factor (0 = black, 1 = unchanged) */
  _darkenColor(color, factor) {
    // Parse hex
    let hex = color.replace("#", "");
    if (hex.length === 3) hex = hex[0]+hex[0]+hex[1]+hex[1]+hex[2]+hex[2];
    const r = Math.round(parseInt(hex.substr(0, 2), 16) * factor);
    const g = Math.round(parseInt(hex.substr(2, 2), 16) * factor);
    const b = Math.round(parseInt(hex.substr(4, 2), 16) * factor);
    return `rgb(${r}, ${g}, ${b})`;
  }
}

customElements.define("tb-component", TbComponent);
