/**
 * <tb-component> — Main component box for the dashboard grid.
 *
 * Renders as a colored box on the grid showing the surface display.
 * Click to open in full-screen editor mode with surface/circuitry toggle.
 * The open animation expands from the box's grid position to fill the screen.
 * Switching modes: surface slides up-right revealing circuitry underneath.
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

  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._open = false;
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

        .surface-view {
          width: 100%;
          height: 100%;
          position: relative;
          border-radius: 6px;
          overflow: hidden;
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
      </style>

      <div class="surface-view" part="surface">
        <div class="surface-elements"></div>
        <div class="surface-screws-bottom"></div>
      </div>
    `;

    this._surfaceView = this.shadowRoot.querySelector(".surface-view");
    this._surfaceElementsContainer = this.shadowRoot.querySelector(".surface-elements");

    // Editor is now opened via right-click context menu (see context-menu.js)
  }

  connectedCallback() {
    this._render();
    this._initSurfaceGrid();
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
    this._surfaceIdCounter++;
    const type = tagName.replace("tb-", "");
    return `${type}-${Date.now()}-${this._surfaceIdCounter}`;
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

    // If the editor overlay is open, also add to the live node editor
    if (this._overlay) {
      const nodeEditor = this._overlay.querySelector("tb-node-editor");
      if (nodeEditor) {
        nodeEditor.addExternalNode(nodeData);
      }
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
      let surfaceEl = this.shadowRoot?.querySelector(`[surface-id="${sid}"]`);
      // Element may be in the overlay while the editor is open
      if (!surfaceEl && this._overlay) {
        surfaceEl = this._overlay.querySelector(`[surface-id="${sid}"]`);
      }
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

  /** Open the editor overlay — centers the box on screen at its current size */
  openEditor() { return this._openEditor(); }
  _openEditor() {
    if (this._open || this._animating) return;
    this._animating = true;

    const rect = this.getBoundingClientRect();
    const color = this.getAttribute("color") || "#d4cdb8";
    const compId = this.getAttribute("component-id") || "";

    // Compute darker background for circuitry
    const darkerColor = this._darkenColor(color, 0.4);
    const highlightColor = TbComponent.computeHighlight(color);

    // Create overlay
    const overlay = document.createElement("div");
    overlay.className = "editor-overlay";
    overlay.innerHTML = `
      <div class="editor-backdrop"></div>
      <div class="editor-frame">
        <div class="editor-modes">
          <div class="editor-circuitry" style="background: ${darkerColor}; border: 3px solid ${color};">
            <tb-node-editor></tb-node-editor>
          </div>
          <div class="editor-surface" style="background: ${color};">
            <div class="editor-surface-content"></div>
          </div>
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
      </div>
    `;

    // Color FAB — appended to body so it sits at page bottom-right
    const colorSelector = document.createElement("tb-color-selector");
    colorSelector.className = "color-selector";
    colorSelector.setAttribute("color", color);
    document.body.appendChild(colorSelector);
    this._colorFab = colorSelector;

    const frame = overlay.querySelector(".editor-frame");
    const modes = overlay.querySelector(".editor-modes");
    const surfaceBtn = overlay.querySelector(".mode-surface");
    const circuitryBtn = overlay.querySelector(".mode-circuitry");
    const closeBtn = overlay.querySelector(".mode-close");
    const nodeEditor = overlay.querySelector("tb-node-editor");

    // Set legend color from component color
    if (nodeEditor) {
      nodeEditor.highlightColor = color;
    }

    // Load circuitry data into node editor
    if (nodeEditor && this._circuitryData) {
      nodeEditor.loadData(this._circuitryData);
    }

    // Pass live device state so node editor can list real buildings
    if (nodeEditor && typeof deviceState !== "undefined") {
      nodeEditor.setDevices(deviceState);
    }

    // Editor surface and interactive elements
    const editorSurface = overlay.querySelector(".editor-surface");
    const surfaceContent = overlay.querySelector(".editor-surface-content");
    surfaceContent.style.cssText = "position:relative;width:100%;height:100%;";

    // Ghost element for placement preview
    const ghost = document.createElement("div");
    ghost.className = "surface-ghost";
    ghost.style.display = "none";
    editorSurface.appendChild(ghost);

    // Track editor wrappers for collision detection
    const editorItems = new Map();

    // Populate the editor surface with interactive wrappers
    if (this._surfaceGrid) {
      for (const [id, comp] of this._surfaceGrid.components) {
        const wrapper = this._createEditorWrapper(
          comp.el, id, comp.x, comp.y, comp.w, comp.h, comp.resizable,
          editorItems, editorSurface, compId
        );
        surfaceContent.appendChild(wrapper);
        editorItems.set(id, {
          el: wrapper, x: comp.x, y: comp.y,
          w: comp.w, h: comp.h, resizable: comp.resizable,
        });
      }
    }

    // Right-click context menu on the surface editor — adds elements via inner Grid
    let surfaceMenu = null;

    const dismissSurfaceMenu = () => {
      if (surfaceMenu) { surfaceMenu.remove(); surfaceMenu = null; }
      ghost.style.display = "none";
    };

    document.addEventListener("click", dismissSurfaceMenu);

    editorSurface.addEventListener("contextmenu", (e) => {
      // Don't show on existing surface element wrappers
      if (e.target.closest(".surface-el-wrapper")) return;
      e.preventDefault();
      dismissSurfaceMenu();

      const elementTypes = [
        { type: "led",    tag: "tb-led",    name: "LED Indicator", icon: "●" },
        { type: "label",  tag: "tb-label",  name: "Label",         icon: "A" },
        { type: "dial",   tag: "tb-dial",   name: "Dial",          icon: "◔" },
        { type: "toggle", tag: "tb-toggle", name: "Toggle Switch", icon: "⏻" },
        { type: "alert",  tag: "tb-alert",  name: "Alert Light",   icon: "△" },
      ].map(et => {
        const tmp = document.createElement(et.tag);
        const sc = tmp.constructor.sizeConstraints || { minW: 1, minH: 1 };
        return { ...et, w: sc.minW, h: sc.minH };
      });

      // Calculate grid position from click (clamped to 1-cell margin)
      const surfaceRect = editorSurface.getBoundingClientRect();
      const gridX = Math.max(1, Math.floor((e.clientX - surfaceRect.left) / CELL_SIZE));
      const gridY = Math.max(1, Math.floor((e.clientY - surfaceRect.top) / CELL_SIZE));

      surfaceMenu = document.createElement("div");
      surfaceMenu.className = "ctx-menu";
      surfaceMenu.style.left = e.clientX + "px";
      surfaceMenu.style.top = e.clientY + "px";

      const hdr = document.createElement("div");
      hdr.className = "ctx-menu-header";
      hdr.textContent = "Add Surface Element";
      surfaceMenu.appendChild(hdr);

      for (const et of elementTypes) {
        const fits = this._isSurfaceAreaFree(gridX, gridY, et.w, et.h, editorItems);

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
          ghost.style.display = "";
          ghost.style.left = gridX * CELL_SIZE + "px";
          ghost.style.top = gridY * CELL_SIZE + "px";
          ghost.style.width = et.w * CELL_SIZE + "px";
          ghost.style.height = et.h * CELL_SIZE + "px";
          ghost.classList.toggle("blocked", !fits);
        });

        row.addEventListener("mouseleave", () => {
          ghost.style.display = "none";
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
            const wrapper = this._createEditorWrapper(
              newEl, newSid, gridX, gridY, actualW, actualH,
              newComp ? newComp.resizable : true,
              editorItems, editorSurface, compId
            );
            surfaceContent.appendChild(wrapper);
            editorItems.set(newSid, {
              el: wrapper, x: gridX, y: gridY,
              w: actualW, h: actualH, resizable: newComp ? newComp.resizable : true,
            });

            this._emitSurfaceChange(compId);
            ghost.style.display = "none";
            dismissSurfaceMenu();
          });
        }

        surfaceMenu.appendChild(row);
      }

      document.body.appendChild(surfaceMenu);

      // Keep within viewport
      const menuRect = surfaceMenu.getBoundingClientRect();
      if (menuRect.right > window.innerWidth) {
        surfaceMenu.style.left = (e.clientX - menuRect.width) + "px";
      }
      if (menuRect.bottom > window.innerHeight) {
        surfaceMenu.style.top = (e.clientY - menuRect.height) + "px";
      }
    });

    // Start frame at the box's current position
    frame.style.position = "absolute";
    frame.style.left = rect.left + "px";
    frame.style.top = rect.top + "px";
    frame.style.width = rect.width + "px";
    frame.style.height = rect.height + "px";
    frame.style.transition = "all 0.4s cubic-bezier(0.4, 0, 0.2, 1)";

    document.body.appendChild(overlay);
    overlay.style.setProperty("--comp-hl", highlightColor);
    overlay.classList.add("open");

    // Animate to center of screen at current size
    const centerX = (window.innerWidth - rect.width) / 2;
    const centerY = (window.innerHeight - rect.height) / 2;

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        frame.style.left = centerX + "px";
        frame.style.top = centerY + "px";
        // width and height stay the same — no expansion
      });
    });

    // Hide the grid box while the editor is open
    this.closest(".component-box").style.visibility = "hidden";

    this._animating = false;
    this._open = true;
    this._overlay = overlay;
    this._mode = "surface";
    this._dismissSurfaceMenu = dismissSurfaceMenu;

    // Store original frame size for restoring when switching back to surface
    const margin = parseInt(getComputedStyle(document.documentElement).getPropertyValue("--editor-margin")) || 40;
    this._origFrame = {
      width: rect.width,
      height: rect.height,
      left: (window.innerWidth - rect.width) / 2,
      top: (window.innerHeight - rect.height) / 2,
    };

    // Mode switching
    surfaceBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      modes.classList.remove("circuitry-active");
      surfaceBtn.classList.add("active");
      circuitryBtn.classList.remove("active");
      if (colorSelector) colorSelector.style.display = "";
      this._mode = "surface";

      // Animate frame back to original size
      frame.style.left = this._origFrame.left + "px";
      frame.style.top = this._origFrame.top + "px";
      frame.style.width = this._origFrame.width + "px";
      frame.style.height = this._origFrame.height + "px";
    });

    circuitryBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      modes.classList.add("circuitry-active");
      circuitryBtn.classList.add("active");
      surfaceBtn.classList.remove("active");
      if (colorSelector) colorSelector.style.display = "none";
      this._mode = "circuitry";

      // Animate frame to fill viewport minus margin
      frame.style.left = margin + "px";
      frame.style.top = margin + "px";
      frame.style.width = (window.innerWidth - margin * 2) + "px";
      frame.style.height = (window.innerHeight - margin * 2) + "px";
    });

    // Close
    closeBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      this._closeEditor();
    });

    overlay.querySelector(".editor-backdrop").addEventListener("click", () => {
      this._closeEditor();
    });

    // Color change
    if (colorSelector) {
      colorSelector.addEventListener("color-change", (e) => {
        const newColor = e.detail.color;
        this.setAttribute("color", newColor);
        overlay.querySelector(".editor-surface").style.background = newColor;
        const circuitry = overlay.querySelector(".editor-circuitry");
        circuitry.style.background = this._darkenColor(newColor, 0.4);
        circuitry.style.borderColor = newColor;

        // Update highlight color for editor UI
        const newHighlight = TbComponent.computeHighlight(newColor);
        overlay.style.setProperty("--comp-hl", newHighlight);

        // Update node editor legend colors
        if (nodeEditor) nodeEditor.highlightColor = newColor;

        // Dispatch event for config save
        this.dispatchEvent(new CustomEvent("component-config-change", {
          bubbles: true,
          detail: { id: compId, property: "color", value: newColor },
        }));
      });
    }

    // Escape to close
    this._escHandler = (e) => {
      if (e.key === "Escape") this._closeEditor();
    };
    document.addEventListener("keydown", this._escHandler);
  }

  /** Close editor with reverse animation back to grid position */
  _closeEditor() {
    if (!this._open || !this._overlay) return;

    const rect = this.getBoundingClientRect();
    const frame = this._overlay.querySelector(".editor-frame");

    // Save node editor data before closing
    const nodeEditor = this._overlay.querySelector("tb-node-editor");
    if (nodeEditor) {
      this._circuitryData = nodeEditor.getData();
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

    // Animate back to box position
    frame.style.left = rect.left + "px";
    frame.style.top = rect.top + "px";
    frame.style.width = rect.width + "px";
    frame.style.height = rect.height + "px";

    // Remove color FAB
    if (this._colorFab) {
      this._colorFab.remove();
      this._colorFab = null;
    }

    // Restore live surface elements back to the surface grid container,
    // then sync label config so elements are findable in the shadow DOM
    this._restoreSurfaceElements();
    this._syncLabelConfig();

    setTimeout(() => {
      this._overlay.remove();
      this._overlay = null;
      this._open = false;
      // Show the grid box again
      const box = this.closest(".component-box");
      if (box) box.style.visibility = "";
    }, 400);

    document.removeEventListener("keydown", this._escHandler);
  }

  /** Restore live surface elements from editor wrappers back to the surface grid */
  _restoreSurfaceElements() {
    if (!this._surfaceGrid) return;
    for (const [, comp] of this._surfaceGrid.components) {
      const el = comp.el;
      delete el._savedStyles;
      // Reapply grid positioning from current component values
      // (which include any drag/resize changes made during editing)
      el.style.position = "absolute";
      el.style.left = comp.x * CELL_SIZE + "px";
      el.style.top = comp.y * CELL_SIZE + "px";
      el.style.width = comp.w * CELL_SIZE + "px";
      el.style.height = comp.h * CELL_SIZE + "px";
      // Move back to the surface grid container
      this._surfaceElementsContainer.appendChild(el);
    }
  }

  /** Create an interactive wrapper for a surface element in the editor */
  _createEditorWrapper(origEl, surfaceId, x, y, w, h, resizable, editorItems, editorSurface, compId) {
    const wrapper = document.createElement("div");
    wrapper.className = "surface-el-wrapper" + (resizable ? "" : " no-resize");
    wrapper.dataset.surfaceId = surfaceId;
    wrapper.style.left = x * CELL_SIZE + "px";
    wrapper.style.top = y * CELL_SIZE + "px";
    wrapper.style.width = w * CELL_SIZE + "px";
    wrapper.style.height = h * CELL_SIZE + "px";

    // Use the actual live element (not a clone) so it receives state updates
    // Save original inline styles for restoration when editor closes
    origEl._savedStyles = {
      position: origEl.style.position,
      left: origEl.style.left,
      top: origEl.style.top,
      width: origEl.style.width,
      height: origEl.style.height,
    };
    origEl.style.position = "";
    origEl.style.left = "";
    origEl.style.top = "";
    origEl.style.width = "100%";
    origEl.style.height = "100%";
    wrapper.appendChild(origEl);

    if (resizable) {
      const handle = document.createElement("div");
      handle.className = "surface-resize-handle";

      // Set cursor based on which axes can actually resize
      const gridComp = this._surfaceGrid ? this._surfaceGrid.getComponent(surfaceId) : null;
      if (gridComp) {
        const canH = gridComp.maxW === null || gridComp.maxW > gridComp.minW;
        const canV = gridComp.maxH === null || gridComp.maxH > gridComp.minH;
        if (canH && !canV) handle.style.cursor = "ew-resize";
        else if (!canH && canV) handle.style.cursor = "ns-resize";
      }

      wrapper.appendChild(handle);

      handle.addEventListener("mousedown", (e) => {
        e.preventDefault();
        e.stopPropagation();
        this._startSurfaceResize(wrapper, surfaceId, e, editorItems, editorSurface, compId);
      });
    }

    wrapper.addEventListener("mousedown", (e) => {
      if (e.button !== 0) return;
      // Use a drag threshold so clicks pass through to interactive elements
      const startX = e.clientX;
      const startY = e.clientY;
      let dragging = false;

      const onMove = (me) => {
        if (!dragging && (Math.abs(me.clientX - startX) > 3 || Math.abs(me.clientY - startY) > 3)) {
          dragging = true;
          this._startSurfaceDrag(wrapper, surfaceId, e, editorItems, editorSurface, compId);
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
    wrapper.addEventListener("dblclick", (e) => {
      e.stopPropagation();
      this._showPropertiesPanel(wrapper, origEl, surfaceId, editorSurface, compId);
    });

    // Right-click context menu to delete this surface element
    wrapper.addEventListener("contextmenu", (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (this._dismissSurfaceMenu) this._dismissSurfaceMenu();

      const menu = document.createElement("div");
      menu.className = "ctx-menu";
      menu.style.left = e.clientX + "px";
      menu.style.top = e.clientY + "px";

      const del = document.createElement("div");
      del.className = "ctx-menu-item ctx-menu-delete";
      del.innerHTML = '<span class="ctx-menu-delete-icon">&#x2716;</span> <span>Delete</span>';
      del.addEventListener("click", () => {
        // Remove the corresponding node from the live node editor
        const nodeEditor = this._overlay ? this._overlay.querySelector("tb-node-editor") : null;
        if (nodeEditor) {
          nodeEditor.removeNode("surface-" + surfaceId);
        }
        this.removeSurfaceElement(surfaceId);
        wrapper.remove();
        editorItems.delete(surfaceId);
        this._emitSurfaceChange(compId);
        menu.remove();
      });
      menu.appendChild(del);

      document.body.appendChild(menu);

      // Keep within viewport
      const menuRect = menu.getBoundingClientRect();
      if (menuRect.right > window.innerWidth) {
        menu.style.left = (e.clientX - menuRect.width) + "px";
      }
      if (menuRect.bottom > window.innerHeight) {
        menu.style.top = (e.clientY - menuRect.height) + "px";
      }

      // Dismiss on next click
      const dismissOnce = () => {
        menu.remove();
        document.removeEventListener("click", dismissOnce);
      };
      document.addEventListener("click", dismissOnce);
    });

    return wrapper;
  }

  /**
   * Show a floating properties panel for a surface element's overwritable properties.
   * Each overwritable property gets a checkbox (enable overwrite) + input (custom value).
   */
  _showPropertiesPanel(wrapper, origEl, surfaceId, editorSurface, compId) {
    // Dismiss any existing panel
    if (this._propsPanel) {
      this._propsPanel.remove();
      this._propsPanel = null;
    }

    const overwritable = origEl.constructor.overwritableProperties || [];
    if (!overwritable.length) return;

    const panel = document.createElement("div");
    panel.className = "surface-props-panel";

    // Position panel below the wrapper
    const wrapperRect = wrapper.getBoundingClientRect();
    const surfaceRect = editorSurface.getBoundingClientRect();
    panel.style.left = (wrapperRect.left - surfaceRect.left) + "px";
    panel.style.top = (wrapperRect.bottom - surfaceRect.top + 4) + "px";

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

      // Sync checkbox → attribute on original element + clone
      checkbox.addEventListener("change", () => {
        const clone = wrapper.querySelector(origEl.tagName.toLowerCase());
        if (checkbox.checked) {
          origEl.setAttribute(prop.overwriteAttr, "");
          if (clone) clone.setAttribute(prop.overwriteAttr, "");
        } else {
          origEl.removeAttribute(prop.overwriteAttr);
          if (clone) clone.removeAttribute(prop.overwriteAttr);
        }
        input.disabled = !checkbox.checked;
        this._emitSurfaceChange(compId);
      });

      // Sync input → attribute on original element + clone
      input.addEventListener("input", () => {
        const clone = wrapper.querySelector(origEl.tagName.toLowerCase());
        origEl.setAttribute(prop.name, input.value);
        if (clone) clone.setAttribute(prop.name, input.value);
        this._emitSurfaceChange(compId);
      });

      row.appendChild(checkbox);
      row.appendChild(label);
      row.appendChild(input);
      panel.appendChild(row);
    }

    editorSurface.appendChild(panel);
    this._propsPanel = panel;

    // Dismiss when clicking outside the panel
    const dismiss = (e) => {
      if (panel.contains(e.target) || wrapper.contains(e.target)) return;
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
  _startSurfaceDrag(wrapper, surfaceId, startEvent, editorItems, editorSurface, compId) {
    const item = editorItems.get(surfaceId);
    if (!item) return;

    const startMouseX = startEvent.clientX;
    const startMouseY = startEvent.clientY;
    const startX = item.x;
    const startY = item.y;
    const maxCols = Math.floor(editorSurface.clientWidth / CELL_SIZE);
    const maxRows = Math.floor(editorSurface.clientHeight / CELL_SIZE);

    const onMove = (e) => {
      const dx = e.clientX - startMouseX;
      const dy = e.clientY - startMouseY;
      // Enforce 1-cell margin around the edges
      const newX = Math.max(1, Math.min(maxCols - 1 - item.w, startX + Math.round(dx / CELL_SIZE)));
      const newY = Math.max(1, Math.min(maxRows - 1 - item.h, startY + Math.round(dy / CELL_SIZE)));

      wrapper.style.left = newX * CELL_SIZE + "px";
      wrapper.style.top = newY * CELL_SIZE + "px";
      item.x = newX;
      item.y = newY;
    };

    const onUp = () => {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
      if (this._surfaceGrid) {
        this._surfaceGrid.updateComponent(surfaceId, { x: item.x, y: item.y });
        // Restore editor-mode styles that updateComponent overwrites
        const el = this._surfaceGrid.getComponent(surfaceId)?.el;
        if (el) {
          el.style.position = "";
          el.style.left = "";
          el.style.top = "";
          el.style.width = "100%";
          el.style.height = "100%";
        }
      }
      this._emitSurfaceChange(compId);
    };

    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  }

  /** Start resizing a surface element in the editor */
  _startSurfaceResize(wrapper, surfaceId, startEvent, editorItems, editorSurface, compId) {
    const item = editorItems.get(surfaceId);
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
    const maxCols = Math.floor(editorSurface.clientWidth / CELL_SIZE);
    const maxRows = Math.floor(editorSurface.clientHeight / CELL_SIZE);

    // Per-axis: only resize axes where max > min
    const canResizeH = maxW === null || maxW > minW;
    const canResizeV = maxH === null || maxH > minH;

    // Lock cursor and keep resize UI visible for the entire drag
    const resizeCursor = canResizeH && canResizeV ? "nwse-resize" : canResizeH ? "ew-resize" : "ns-resize";
    document.body.style.cursor = resizeCursor;
    document.body.style.userSelect = "none";
    wrapper.classList.add("resizing");

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

      wrapper.style.width = newW * CELL_SIZE + "px";
      wrapper.style.height = newH * CELL_SIZE + "px";
      item.w = newW;
      item.h = newH;
    };

    const onUp = () => {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      wrapper.classList.remove("resizing");
      if (this._surfaceGrid) {
        this._surfaceGrid.updateComponent(surfaceId, { w: item.w, h: item.h });
        // updateComponent sets inline pixel sizes on the element, which would
        // override the CSS "100%" rule and break continuous re-centering on the
        // next resize drag. Restore percentage sizing so the element keeps
        // stretching to fill its editor wrapper.
        const el = this._surfaceGrid.getComponent(surfaceId)?.el;
        if (el) { el.style.width = "100%"; el.style.height = "100%"; }
      }
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
