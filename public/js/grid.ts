/**
 * Grid System — 20x20px cells
 *
 * Calculates visible columns/rows from window size.
 * Components are placed at (x, y) with (width, height) in grid units.
 * Resizing adds/removes columns and rows from the RIGHT and BOTTOM.
 * If removing a column/row would clip a component, the grid overflows
 * and scrollbars appear on the container.
 */

interface GridComponentEntry {
  el: HTMLElement;
  x: number;
  y: number;
  w: number;
  h: number;
  minW: number;
  minH: number;
  maxW: number | null;
  maxH: number | null;
  resizable: boolean;
  aspectRatio: number | null;
  config: GridComponentConfig;
}

interface GridComponentConfig {
  minWidth?: number;
  minHeight?: number;
  maxWidth?: number | null;
  maxHeight?: number | null;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  resizable?: boolean;
  aspectRatio?: number | null;
  [key: string]: unknown;
}

interface ResizeEdge {
  right: boolean;
  bottom: boolean;
}

interface ResizeStart {
  mouseX?: number;
  mouseY?: number;
  w?: number;
  h?: number;
}

const CELL_SIZE: number = 20;
const COMP_MIN_WIDTH: number = 8;
const COMP_MIN_HEIGHT: number = 5;

class Grid {
  container: HTMLElement;
  viewport: HTMLElement;
  storageKey: string | null;
  onComponentAdded: ((id: string, el: HTMLElement) => void) | null;
  onComponentRemoved: ((id: string) => void) | null;
  onLayoutChange: ((id: string, layout: { x: number; y: number; w: number; h: number }) => void) | null;
  bare: boolean;
  components: Map<string, GridComponentEntry>;
  editing: boolean;
  locked: boolean;

  private _dragTarget: string | null;
  private _dragOffset: { x: number; y: number };
  private _resizeTarget: string | null;
  private _resizeEdge: ResizeEdge | null;
  private _resizeStart: ResizeStart;
  private _resizeObserver: ResizeObserver | null;
  private _savedLayout: Record<string, { x: number; y: number; w: number; h: number }>;

  /**
   * @param containerEl - Scrollable container
   * @param viewportEl - Positioned viewport inside container
   * @param opts - Grid options
   */
  constructor(containerEl: HTMLElement, viewportEl: HTMLElement, opts: GridOpts & { locked?: boolean } = {}) {
    this.container = containerEl;
    this.viewport = viewportEl;
    this.storageKey = opts.storageKey !== undefined ? opts.storageKey : "timberborn-grid-layout";
    this.onComponentAdded = opts.onComponentAdded || null;
    this.onComponentRemoved = opts.onComponentRemoved || null;
    this.onLayoutChange = opts.onLayoutChange || null;
    this.bare = !!opts.bare;
    this.components = new Map();
    this.editing = false;
    this.locked = !!(opts as any).locked;

    // Drag state
    this._dragTarget = null;
    this._dragOffset = { x: 0, y: 0 };
    this._resizeTarget = null;
    this._resizeEdge = null;
    this._resizeStart = {};
    this._resizeObserver = null;

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

  get cols(): number {
    return Math.floor(this.container.clientWidth / CELL_SIZE);
  }

  get rows(): number {
    return Math.floor(this.container.clientHeight / CELL_SIZE);
  }

  /** Recalculate viewport size based on window and component extents */
  _recalc(): void {
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
  addComponent(id: string, el: HTMLElement, config: GridComponentConfig): void {
    const saved = this._savedLayout[id];
    const minW = config.minWidth ?? COMP_MIN_WIDTH;
    const minH = config.minHeight ?? COMP_MIN_HEIGHT;
    let maxW: number | null = config.maxWidth ?? null;
    let maxH: number | null = config.maxHeight ?? null;
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
  removeComponent(id: string): void {
    const comp = this.components.get(id);
    if (comp) {
      comp.el.remove();
      this.components.delete(id);
      this._recalc();
      if (this.onComponentRemoved) this.onComponentRemoved(id);
    }
  }

  /** Update a component's minimum size constraints, resizing up if needed */
  updateConstraints(id: string, { minW, minH }: { minW?: number; minH?: number }): void {
    const comp = this.components.get(id);
    if (!comp) return;
    if (minW !== undefined) comp.minW = minW;
    if (minH !== undefined) comp.minH = minH;
    let changed = false;
    if (comp.w < comp.minW) { comp.w = comp.minW; changed = true; }
    if (comp.h < comp.minH) { comp.h = comp.minH; changed = true; }
    if (changed) {
      comp.el.style.width = comp.w * CELL_SIZE + "px";
      comp.el.style.height = comp.h * CELL_SIZE + "px";
      this._recalc();
    }
  }

  /** Update a component's position and size */
  updateComponent(id: string, { x, y, w, h }: { x?: number; y?: number; w?: number; h?: number }): void {
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
  getComponent(id: string): GridComponentEntry | undefined {
    return this.components.get(id);
  }

  /** Set editing mode */
  setEditing(editing: boolean): void {
    this.editing = editing;
    this.viewport.classList.toggle("editing", editing);
    // Clear any inline cursor styles left from the previous mode
    for (const [, comp] of this.components) {
      comp.el.style.cursor = "";
    }
    if (!editing) {
      this._saveLayout();
    }
  }

  /** Save layout to localStorage and notify via callback */
  _saveLayout(): void {
    if (this.onLayoutChange) {
      for (const [id, comp] of this.components) {
        this.onLayoutChange(id, { x: comp.x, y: comp.y, w: comp.w, h: comp.h });
      }
    }
    if (!this.storageKey) return;
    const layout: Record<string, { x: number; y: number; w: number; h: number }> = {};
    for (const [id, comp] of this.components) {
      layout[id] = { x: comp.x, y: comp.y, w: comp.w, h: comp.h };
    }
    localStorage.setItem(this.storageKey, JSON.stringify(layout));
  }

  /** Load layout from localStorage */
  _loadLayout(): Record<string, { x: number; y: number; w: number; h: number }> {
    if (!this.storageKey) return {};
    try {
      return JSON.parse(localStorage.getItem(this.storageKey) as string) || {};
    } catch {
      return {};
    }
  }

  /** Setup drag and resize on a component element */
  _setupDrag(el: HTMLElement, id: string): void {
    // Cursor feedback on hover
    el.addEventListener("mousemove", (e: MouseEvent) => {
      if (this.locked || window.editorState?.activeComponentId) { el.style.cursor = ""; return; }
      if (this._dragTarget || this._resizeTarget || e.buttons & 1) return;
      const comp = this.components.get(id);
      if (!comp) return;

      if (this.editing) {
        // Editing mode: resize cursors only (no moving)
        if (!comp.resizable) { el.style.cursor = ""; return; }

        const canResizeH = comp.maxW === null || comp.maxW > comp.minW;
        const canResizeV = comp.maxH === null || comp.maxH > comp.minH;
        if (!canResizeH && !canResizeV) { el.style.cursor = ""; return; }

        const rect = el.getBoundingClientRect();
        const edgeThreshold = 8;
        const nearRight = canResizeH && e.clientX > rect.right - edgeThreshold;
        const nearBottom = canResizeV && e.clientY > rect.bottom - edgeThreshold;

        if (comp.aspectRatio) {
          el.style.cursor = (nearRight && nearBottom) ? "nwse-resize" : "";
        } else if (nearRight && nearBottom) {
          el.style.cursor = "nwse-resize";
        } else if (nearRight) {
          el.style.cursor = "ew-resize";
        } else if (nearBottom) {
          el.style.cursor = "ns-resize";
        } else {
          el.style.cursor = "";
        }
      } else {
        // Default mode: always grab cursor (drag to move)
        el.style.cursor = "grab";
      }
    });

    el.addEventListener("mousedown", (e: MouseEvent) => {
      if (this.locked || window.editorState?.activeComponentId) return;
      const comp = this.components.get(id);
      if (!comp) return;

      if (this.editing) {
        // Editing mode: resize only, no dragging
        if (!comp.resizable) return;

        const rect = el.getBoundingClientRect();
        const edgeThreshold = 8;
        let nearRight = e.clientX > rect.right - edgeThreshold;
        let nearBottom = e.clientY > rect.bottom - edgeThreshold;

        const canResizeH = comp.maxW === null || comp.maxW > comp.minW;
        const canResizeV = comp.maxH === null || comp.maxH > comp.minH;
        if (!canResizeH) nearRight = false;
        if (!canResizeV) nearBottom = false;

        if (comp.aspectRatio && !(nearRight && nearBottom)) {
          nearRight = false;
          nearBottom = false;
        }

        if (nearRight || nearBottom) {
          e.preventDefault();
          e.stopPropagation();
          this._resizeTarget = id;
          this._resizeEdge = { right: nearRight, bottom: nearBottom };
          this._resizeStart = {
            mouseX: e.clientX,
            mouseY: e.clientY,
            w: comp.w,
            h: comp.h,
          };
          document.addEventListener("mousemove", this._onMouseMove);
          document.addEventListener("mouseup", this._onMouseUp);
        }
      } else {
        // Default mode: drag to move (surface elements are not interactive here)
        e.preventDefault();
        e.stopPropagation();
        this._dragTarget = id;
        this._dragOffset = {
          x: e.clientX - comp.x * CELL_SIZE,
          y: e.clientY - comp.y * CELL_SIZE,
        };
        el.style.zIndex = "100";
        el.style.cursor = "grabbing";
        document.addEventListener("mousemove", this._onMouseMove);
        document.addEventListener("mouseup", this._onMouseUp);
      }
    });
  }

  _onMouseMove(e: MouseEvent): void {
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
      if (!comp) return;
      const dx = e.clientX - (this._resizeStart.mouseX || 0);
      const dy = e.clientY - (this._resizeStart.mouseY || 0);

      const update: { w?: number; h?: number } = {};
      if (comp.aspectRatio) {
        // Use the larger delta to drive both dimensions
        const dCells = Math.round(Math.max(dx, dy / comp.aspectRatio) / CELL_SIZE);
        update.w = (this._resizeStart.w || 0) + dCells;
        update.h = Math.round(((this._resizeStart.w || 0) + dCells) * comp.aspectRatio);
      } else {
        if (this._resizeEdge?.right) {
          update.w = (this._resizeStart.w || 0) + Math.round(dx / CELL_SIZE);
        }
        if (this._resizeEdge?.bottom) {
          update.h = (this._resizeStart.h || 0) + Math.round(dy / CELL_SIZE);
        }
      }
      this.updateComponent(id, update);
    }
  }

  _onMouseUp(): void {
    if (this._dragTarget) {
      const comp = this.components.get(this._dragTarget);
      if (comp) {
        comp.el.style.zIndex = "";
        comp.el.style.cursor = "grab";
      }
      this._dragTarget = null;
    }
    this._resizeTarget = null;
    this._resizeEdge = null;
    this._saveLayout();
    document.removeEventListener("mousemove", this._onMouseMove);
    document.removeEventListener("mouseup", this._onMouseUp);
  }

  /** Clean up observers and event listeners */
  destroy(): void {
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
