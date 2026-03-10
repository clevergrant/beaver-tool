/**
 * Grid System — 20x20px cells
 *
 * Calculates visible columns/rows from window size.
 * Components are placed at (x, y) with (width, height) in grid units.
 * Resizing adds/removes columns and rows from the RIGHT and BOTTOM.
 * If removing a column/row would clip a component, the grid overflows
 * and scrollbars appear on the container.
 */

const CELL_SIZE = 20;
const COMP_MIN_WIDTH = 8;
const COMP_MIN_HEIGHT = 5;

class Grid {
  /**
   * @param {HTMLElement} containerEl - Scrollable container
   * @param {HTMLElement} viewportEl - Positioned viewport inside container
   * @param {Object} [opts]
   * @param {string|null} [opts.storageKey] - localStorage key for layout persistence (null to disable)
   * @param {boolean} [opts.listenToWindowResize] - Listen to window resize (default true; false uses ResizeObserver)
   * @param {Function} [opts.onComponentAdded] - Callback(id, el) when a component is added
   * @param {Function} [opts.onComponentRemoved] - Callback(id) when a component is removed
   * @param {Function} [opts.onLayoutChange] - Callback(id, {x, y, w, h}) when a component moves/resizes
   * @param {boolean} [opts.bare] - If true, don't add component-box class or box styling
   */
  constructor(containerEl, viewportEl, opts = {}) {
    this.container = containerEl;
    this.viewport = viewportEl;
    this.storageKey = opts.storageKey !== undefined ? opts.storageKey : "timberborn-grid-layout";
    this.onComponentAdded = opts.onComponentAdded || null;
    this.onComponentRemoved = opts.onComponentRemoved || null;
    this.onLayoutChange = opts.onLayoutChange || null;
    this.bare = !!opts.bare;
    this.components = new Map(); // id -> { el, x, y, w, h, minW, minH, config }
    this.editing = false;

    // Drag state
    this._dragTarget = null;
    this._dragOffset = { x: 0, y: 0 };
    this._resizeTarget = null;
    this._resizeEdge = null;
    this._resizeStart = {};

    this._onMouseMove = this._onMouseMove.bind(this);
    this._onMouseUp = this._onMouseUp.bind(this);

    this._savedLayout = this._loadLayout();
    this._recalc();

    const listenToWindow = opts.listenToWindowResize !== false;
    if (listenToWindow) {
      window.addEventListener("resize", () => this._recalc());
    } else {
      this._resizeObserver = new ResizeObserver(() => this._recalc());
      this._resizeObserver.observe(this.container);
    }
  }

  get cols() {
    return Math.floor(this.container.clientWidth / CELL_SIZE);
  }

  get rows() {
    return Math.floor(this.container.clientHeight / CELL_SIZE);
  }

  /** Recalculate viewport size based on window and component extents */
  _recalc() {
    const windowCols = this.cols;
    const windowRows = this.rows;

    let maxRight = 0;
    let maxBottom = 0;
    for (const comp of this.components.values()) {
      maxRight = Math.max(maxRight, comp.x + comp.w);
      maxBottom = Math.max(maxBottom, comp.y + comp.h);
    }

    const vpCols = Math.max(windowCols, maxRight);
    const vpRows = Math.max(windowRows, maxBottom);

    this.viewport.style.width = vpCols * CELL_SIZE + "px";
    this.viewport.style.height = vpRows * CELL_SIZE + "px";
  }

  /** Place a component on the grid */
  addComponent(id, el, config) {
    const saved = this._savedLayout[id];
    const minW = config.minWidth ?? COMP_MIN_WIDTH;
    const minH = config.minHeight ?? COMP_MIN_HEIGHT;
    let maxW = config.maxWidth ?? null;
    let maxH = config.maxHeight ?? null;
    // If max is smaller than min, treat it as min (no resize room)
    if (maxW !== null && maxW < minW) maxW = minW;
    if (maxH !== null && maxH < minH) maxH = minH;
    const x = saved?.x ?? config.x ?? 0;
    const y = saved?.y ?? config.y ?? 0;
    let w = saved?.w ?? config.width ?? minW;
    let h = saved?.h ?? config.height ?? minH;
    // Clamp to size constraints
    w = Math.max(w, minW);
    h = Math.max(h, minH);
    if (maxW !== null) w = Math.min(w, maxW);
    if (maxH !== null) h = Math.min(h, maxH);

    if (!this.bare) {
      el.classList.add("component-box");
      if (config.resizable === false) el.classList.add("no-resize");
    } else {
      el.style.position = "absolute";
    }
    el.style.left = x * CELL_SIZE + "px";
    el.style.top = y * CELL_SIZE + "px";
    el.style.width = w * CELL_SIZE + "px";
    el.style.height = h * CELL_SIZE + "px";
    el.dataset.gridId = id;

    const resizable = config.resizable !== false;       // default true
    const aspectRatio = config.aspectRatio || null;      // e.g. 1 for square

    this.viewport.appendChild(el);
    this.components.set(id, { el, x, y, w, h, minW, minH, maxW, maxH, resizable, aspectRatio, config });

    this._setupDrag(el, id);
    this._recalc();

    if (this.onComponentAdded) this.onComponentAdded(id, el);
  }

  /** Remove a component from the grid */
  removeComponent(id) {
    const comp = this.components.get(id);
    if (comp) {
      comp.el.remove();
      this.components.delete(id);
      this._recalc();
      if (this.onComponentRemoved) this.onComponentRemoved(id);
    }
  }

  /** Update a component's position and size */
  updateComponent(id, { x, y, w, h }) {
    const comp = this.components.get(id);
    if (!comp) return;
    if (x !== undefined) comp.x = x;
    if (y !== undefined) comp.y = y;
    if (w !== undefined) {
      comp.w = Math.max(w, comp.minW);
      if (comp.maxW !== null) comp.w = Math.min(comp.w, comp.maxW);
    }
    if (h !== undefined) {
      comp.h = Math.max(h, comp.minH);
      if (comp.maxH !== null) comp.h = Math.min(comp.h, comp.maxH);
    }

    comp.el.style.left = comp.x * CELL_SIZE + "px";
    comp.el.style.top = comp.y * CELL_SIZE + "px";
    comp.el.style.width = comp.w * CELL_SIZE + "px";
    comp.el.style.height = comp.h * CELL_SIZE + "px";

    this._recalc();
  }

  /** Get component data */
  getComponent(id) {
    return this.components.get(id);
  }

  /** Set editing mode */
  setEditing(editing) {
    this.editing = editing;
    this.viewport.classList.toggle("editing", editing);
    if (!editing) {
      // Clear any inline cursor styles left from drag/resize hover
      for (const [, comp] of this.components) {
        comp.el.style.cursor = "";
      }
      this._saveLayout();
    }
  }

  /** Save layout to localStorage and notify via callback */
  _saveLayout() {
    if (this.onLayoutChange) {
      for (const [id, comp] of this.components) {
        this.onLayoutChange(id, { x: comp.x, y: comp.y, w: comp.w, h: comp.h });
      }
    }
    if (!this.storageKey) return;
    const layout = {};
    for (const [id, comp] of this.components) {
      layout[id] = { x: comp.x, y: comp.y, w: comp.w, h: comp.h };
    }
    localStorage.setItem(this.storageKey, JSON.stringify(layout));
  }

  /** Load layout from localStorage */
  _loadLayout() {
    if (!this.storageKey) return {};
    try {
      return JSON.parse(localStorage.getItem(this.storageKey)) || {};
    } catch {
      return {};
    }
  }

  /** Setup drag and resize on a component element */
  _setupDrag(el, id) {
    // Cursor feedback on hover in edit mode
    el.addEventListener("mousemove", (e) => {
      if (!this.editing) return;
      const comp = this.components.get(id);
      if (!comp) return;

      if (!comp.resizable) {
        el.style.cursor = "move";
        return;
      }

      // Per-axis resizability: only allow if there's room between min and max
      const canResizeH = comp.maxW === null || comp.maxW > comp.minW;
      const canResizeV = comp.maxH === null || comp.maxH > comp.minH;

      if (!canResizeH && !canResizeV) {
        el.style.cursor = "move";
        return;
      }

      const rect = el.getBoundingClientRect();
      const edgeThreshold = 8;
      const nearRight = canResizeH && e.clientX > rect.right - edgeThreshold;
      const nearBottom = canResizeV && e.clientY > rect.bottom - edgeThreshold;

      if (comp.aspectRatio) {
        // Aspect-ratio-locked: only corner resize
        if (nearRight && nearBottom) {
          el.style.cursor = "nwse-resize";
        } else {
          el.style.cursor = "move";
        }
      } else if (nearRight && nearBottom) {
        el.style.cursor = "nwse-resize";
      } else if (nearRight) {
        el.style.cursor = "ew-resize";
      } else if (nearBottom) {
        el.style.cursor = "ns-resize";
      } else {
        el.style.cursor = "move";
      }
    });

    el.addEventListener("mousedown", (e) => {
      if (!this.editing) return;

      const comp = this.components.get(id);
      if (!comp) return;

      // Check if near edge for resize (8px threshold)
      const rect = el.getBoundingClientRect();
      const edgeThreshold = 8;
      let nearRight = e.clientX > rect.right - edgeThreshold;
      let nearBottom = e.clientY > rect.bottom - edgeThreshold;

      // Non-resizable components: never enter resize mode
      if (!comp.resizable) {
        nearRight = false;
        nearBottom = false;
      }

      // Per-axis: block resize on axes with no room between min and max
      const canResizeH = comp.maxW === null || comp.maxW > comp.minW;
      const canResizeV = comp.maxH === null || comp.maxH > comp.minH;
      if (!canResizeH) nearRight = false;
      if (!canResizeV) nearBottom = false;

      // Aspect-ratio-locked: only allow corner (both edges) resize
      if (comp.aspectRatio && !(nearRight && nearBottom)) {
        nearRight = false;
        nearBottom = false;
      }

      if (nearRight || nearBottom) {
        // Resize
        e.preventDefault();
        e.stopPropagation();
        this._resizeTarget = id;
        this._resizeEdge = { right: nearRight, bottom: nearBottom };
        this._resizeStart = {
          mouseX: e.clientX,
          mouseY: e.clientY,
          w: this.components.get(id).w,
          h: this.components.get(id).h,
        };
        document.addEventListener("mousemove", this._onMouseMove);
        document.addEventListener("mouseup", this._onMouseUp);
      } else {
        // Drag
        e.preventDefault();
        e.stopPropagation();
        this._dragTarget = id;
        const comp = this.components.get(id);
        this._dragOffset = {
          x: e.clientX - comp.x * CELL_SIZE,
          y: e.clientY - comp.y * CELL_SIZE,
        };
        el.style.zIndex = "10";
        document.addEventListener("mousemove", this._onMouseMove);
        document.addEventListener("mouseup", this._onMouseUp);
      }
    });
  }

  _onMouseMove(e) {
    if (this._dragTarget) {
      const id = this._dragTarget;
      const comp = this.components.get(id);
      const rawX = e.clientX - this._dragOffset.x;
      const rawY = e.clientY - this._dragOffset.y;
      const x = Math.max(0, Math.round(rawX / CELL_SIZE));
      const y = Math.max(0, Math.round(rawY / CELL_SIZE));
      this.updateComponent(id, { x, y });
    }

    if (this._resizeTarget) {
      const id = this._resizeTarget;
      const comp = this.components.get(id);
      const dx = e.clientX - this._resizeStart.mouseX;
      const dy = e.clientY - this._resizeStart.mouseY;

      const update = {};
      if (comp.aspectRatio) {
        // Use the larger delta to drive both dimensions
        const dCells = Math.round(Math.max(dx, dy / comp.aspectRatio) / CELL_SIZE);
        update.w = this._resizeStart.w + dCells;
        update.h = Math.round((this._resizeStart.w + dCells) * comp.aspectRatio);
      } else {
        if (this._resizeEdge.right) {
          update.w = this._resizeStart.w + Math.round(dx / CELL_SIZE);
        }
        if (this._resizeEdge.bottom) {
          update.h = this._resizeStart.h + Math.round(dy / CELL_SIZE);
        }
      }
      this.updateComponent(id, update);
    }
  }

  _onMouseUp() {
    if (this._dragTarget) {
      const comp = this.components.get(this._dragTarget);
      if (comp) comp.el.style.zIndex = "1";
      this._dragTarget = null;
    }
    this._resizeTarget = null;
    this._resizeEdge = null;
    this._saveLayout();
    document.removeEventListener("mousemove", this._onMouseMove);
    document.removeEventListener("mouseup", this._onMouseUp);
  }

  /** Clean up observers and event listeners */
  destroy() {
    if (this._resizeObserver) {
      this._resizeObserver.disconnect();
      this._resizeObserver = null;
    }
    document.removeEventListener("mousemove", this._onMouseMove);
    document.removeEventListener("mouseup", this._onMouseUp);
  }
}

window.Grid = Grid;
window.CELL_SIZE = CELL_SIZE;
window.COMP_MIN_WIDTH = COMP_MIN_WIDTH;
window.COMP_MIN_HEIGHT = COMP_MIN_HEIGHT;
