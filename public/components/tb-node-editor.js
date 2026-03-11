/**
 * <tb-node-editor> — Node graph editor for component circuitry.
 *
 * Infinite scroll canvas with draggable nodes and bezier connections.
 * Pan by middle-mouse dragging the background. Left-drag draws a selection
 * rectangle; shift-click toggles individual nodes. Selected nodes move together.
 * Has a re-center button to return to the origin.
 *
 * Usage:
 *   const editor = document.querySelector('tb-node-editor');
 *   editor.loadData({ nodes: [...], edges: [...] });
 *   const data = editor.getData();
 */
class TbNodeEditor extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });

    this._nodes = [];
    this._edges = [];
    this._pan = { x: 0, y: 0 };
    this._panning = false;
    this._panStart = { x: 0, y: 0 };
    this._connecting = null; // { nodeId, portType, portIndex, startX, startY }
    this._nextNodeId = 0;
    this._devices = {}; // live game devices (levers & adapters)
    this._selectedNodes = new Set(); // IDs of selected nodes
    this._selectionRect = null; // { startX, startY, _shift } in client coords

    this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: block;
          width: 100%;
          height: 100%;
          position: relative;
          overflow: hidden;
          font-family: 'Share Tech Mono', monospace;
        }

        .canvas {
          position: absolute;
          inset: 0;
          cursor: grab;
          overflow: hidden;
        }

        .canvas:active {
          cursor: grabbing;
        }

        .canvas-inner {
          position: absolute;
          width: 1px;
          height: 1px;
          transform-origin: 0 0;
        }


        svg.connections {
          position: absolute;
          top: 0;
          left: 0;
          overflow: visible;
          pointer-events: none;
          z-index: 1;
        }

        svg.connections path {
          fill: none;
          stroke: #ffaa20;
          stroke-width: 2;
          opacity: 0.7;
        }

        svg.connections path.temp-connection {
          stroke-dasharray: 6 4;
          opacity: 0.5;
        }

        .node {
          position: absolute;
          background: #2a2a28;
          border: 1px solid #5a5a54;
          border-radius: 4px;
          min-width: 140px;
          font-size: 0.65rem;
          color: #e0ddd0;
          box-shadow: 0 2px 8px rgba(0,0,0,0.5);
          cursor: move;
          z-index: 2;
          user-select: none;
          min-height: 44px;
        }

        .node:hover {
          border-color: #8a8a7a;
        }

        .node.selected {
          border-color: #60a0ff;
          box-shadow: 0 0 10px rgba(96,160,255,0.3), 0 2px 8px rgba(0,0,0,0.5);
        }

        .selection-rect {
          position: fixed;
          border: 1px solid rgba(96,160,255,0.6);
          background: rgba(96,160,255,0.08);
          pointer-events: none;
          z-index: 0;
          display: none;
        }

        .node-header {
          padding: 4px 8px;
          border-radius: 3px 3px 0 0;
          font-size: 0.55rem;
          letter-spacing: 0.1em;
          text-transform: uppercase;
          border-bottom: 1px solid #4a4a44;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .node-header.input { background: #1a2a1a; color: #30ff60; }
        .node-header.output { background: #2a2a1a; color: #ffaa20; }
        .node-header.transform { background: #1a1a2a; color: #60a0ff; }

        .node-delete {
          cursor: pointer;
          opacity: 0.4;
          font-size: 0.7rem;
        }
        .node-delete:hover { opacity: 1; color: #ff3030; }

        .node-body {
          padding: 6px 8px;
          font-size: 0.6rem;
          color: #aaa;
        }

        .port {
          position: absolute;
          width: 10px;
          height: 10px;
          border-radius: 50%;
          background: #5a5a54;
          border: 2px solid #3a3a36;
          cursor: crosshair;
          z-index: 3;
          transition: background 0.15s;
        }

        .port:hover {
          background: #ffaa20;
          box-shadow: 0 0 6px rgba(255,170,32,0.5);
        }

        .port.input-port { left: -5px; }
        .port.output-port { right: -5px; }

        .port-label {
          position: absolute;
          font-size: 0.5rem;
          color: #777;
          white-space: nowrap;
        }

        .port-label.input-label { left: 10px; }
        .port-label.output-label { right: 10px; }

        .label-input {
          background: #1a1a18;
          border: 1px solid #4a4a44;
          border-radius: 2px;
          color: #e0ddd0;
          font-family: 'Share Tech Mono', monospace;
          font-size: 0.6rem;
          padding: 2px 6px;
          width: calc(100% - 16px);
          outline: none;
        }

        .label-input:focus {
          border-color: #60a0ff;
        }

        .label-input::placeholder {
          color: #555;
          font-style: italic;
        }

        .label-text-row {
          display: flex;
          align-items: center;
          gap: 4px;
        }

        .label-text-row .label-input {
          flex: 1;
          width: auto;
        }

        .label-override-toggle {
          accent-color: #60a0ff;
          cursor: pointer;
          margin: 0;
        }

        .label-input:disabled {
          cursor: default;
        }

        .node-select {
          background: #1a1a18;
          border: 1px solid #4a4a44;
          border-radius: 2px;
          color: #e0ddd0;
          font-family: 'Share Tech Mono', monospace;
          font-size: 0.6rem;
          padding: 2px 4px;
          outline: none;
          width: 100%;
        }

        .node-select:focus {
          border-color: #60a0ff;
        }

        .node-param-row {
          display: flex;
          align-items: center;
          gap: 4px;
          margin-top: 4px;
        }

        .node-param-label {
          font-size: 0.5rem;
          color: #8a8a7a;
          white-space: nowrap;
          min-width: 28px;
        }

        .label-resolved {
          font-size: 0.5rem;
          color: #60a0ff;
          margin-top: 2px;
          opacity: 0.7;
        }


        .context-menu {
          position: absolute;
          background: #2a2a28;
          border: 1px solid #5a5a54;
          border-radius: 4px;
          box-shadow: 0 4px 16px rgba(0,0,0,0.6);
          z-index: 20;
          font-size: 0.6rem;
          min-width: 140px;
          max-height: 300px;
          overflow-y: auto;
          display: none;
        }

        .context-menu.visible { display: block; }

        .context-menu-item {
          padding: 6px 12px;
          cursor: pointer;
          color: #ccc;
          border-bottom: 1px solid #3a3a36;
          letter-spacing: 0.05em;
        }

        .context-menu-item:last-child { border-bottom: none; }

        .context-menu-item:hover {
          background: rgba(255,170,32,0.15);
          color: #ffaa20;
        }

        .context-menu-header {
          padding: 4px 12px;
          font-size: 0.5rem;
          color: #666;
          text-transform: uppercase;
          letter-spacing: 0.1em;
          background: #222;
        }

        .context-menu-accordion {
          border-bottom: 1px solid #3a3a36;
        }

        .context-menu-accordion-trigger {
          padding: 6px 12px;
          cursor: pointer;
          color: #999;
          font-size: 0.55rem;
          text-transform: uppercase;
          letter-spacing: 0.1em;
          background: #252523;
          display: flex;
          justify-content: space-between;
          align-items: center;
          user-select: none;
        }

        .context-menu-accordion-trigger:hover {
          background: rgba(255,170,32,0.08);
          color: #ccc;
        }

        .context-menu-accordion-arrow {
          transition: transform 0.15s ease;
          font-size: 0.5rem;
        }

        .context-menu-accordion.open .context-menu-accordion-arrow {
          transform: rotate(90deg);
        }

        .context-menu-accordion-body {
          display: none;
          max-height: 180px;
          overflow-y: auto;
        }

        .context-menu-accordion.open .context-menu-accordion-body {
          display: block;
        }

        /* Camera/screen button styles */
        .camera-btn {
          background: #2a2a28;
          border: 1px solid #4a4a44;
          border-radius: 3px;
          color: #e0ddd0;
          font-family: 'Share Tech Mono', monospace;
          font-size: 0.55rem;
          padding: 3px 8px;
          cursor: pointer;
          width: 100%;
          text-align: center;
          letter-spacing: 0.05em;
        }

        .camera-btn:hover {
          border-color: #60a0ff;
          color: #60a0ff;
        }

        .camera-btn.active {
          border-color: #30ff60;
          color: #30ff60;
        }

      </style>

      <div class="canvas">
        <div class="canvas-inner">
          <svg class="connections"></svg>
        </div>
      </div>
      <div class="context-menu"></div>
      <div class="selection-rect"></div>
    `;

    this._canvas = this.shadowRoot.querySelector(".canvas");
    this._inner = this.shadowRoot.querySelector(".canvas-inner");
    this._svg = this.shadowRoot.querySelector("svg.connections");
    this._contextMenu = this.shadowRoot.querySelector(".context-menu");
    this._selectionRectEl = this.shadowRoot.querySelector(".selection-rect");
    this._zoom = 1;
    this._highlightColor = "#ffaa20";

    this._setupPanning();
    this._setupZoom();
    this._setupContextMenu();
  }

  connectedCallback() {
    this._updateTransform();
    this._renderConnections();
    this._paintLegend();
  }

  set highlightColor(color) {
    this._highlightColor = color || "#ffaa20";
    this._paintLegend();
  }

  // --- Public API ---

  loadData(data) {
    this._nodes = (data.nodes || []).map((n, i) => ({
      ...n,
      id: n.id || `node-${i}`,
      _el: null,
    }));
    this._edges = (data.edges || []).map(e => ({ ...e }));
    this._nextNodeId = this._nodes.length;
    this._selectedNodes.clear();

    // Clear existing nodes
    for (const el of this._inner.querySelectorAll(".node")) {
      el.remove();
    }

    // Render nodes (each _renderNode schedules its own deferred layout + connections)
    for (const node of this._nodes) {
      this._renderNode(node);
    }
  }

  getData() {
    return {
      nodes: this._nodes.map(n => ({
        id: n.id,
        type: n.type,
        x: n.x,
        y: n.y,
        config: n.config || {},
      })),
      edges: this._edges.map(e => ({
        from: e.from,
        fromPort: e.fromPort,
        to: e.to,
        toPort: e.toPort,
      })),
    };
  }

  setDevices(devices) {
    this._devices = devices || {};
  }

  // --- Panning ---

  _setupPanning() {
    this._canvas.addEventListener("mousedown", (e) => {
      if (e.target !== this._canvas && e.target !== this._inner) return;
      this._hideContextMenu();

      // Left or middle mouse button → pan
      if (e.button === 0 || e.button === 1) {
        e.preventDefault();
        this._panning = true;
        this._canvas.style.cursor = "grabbing";
        this._panStart = { x: e.clientX - this._pan.x, y: e.clientY - this._pan.y };
        return;
      }

      // Right mouse button → selection rectangle (or context menu if no drag)
      if (e.button === 2) {
        e.preventDefault();
        this._selectionRect = { startX: e.clientX, startY: e.clientY, _shift: e.shiftKey };
        this._selectionRectEl.style.left = e.clientX + "px";
        this._selectionRectEl.style.top = e.clientY + "px";
        this._selectionRectEl.style.width = "0";
        this._selectionRectEl.style.height = "0";
        this._selectionRectEl.style.display = "none";
        if (!e.shiftKey) {
          this._clearSelection();
        }
      }
    });

    this._canvas.addEventListener("mousemove", (e) => {
      if (this._panning) {
        this._pan.x = e.clientX - this._panStart.x;
        this._pan.y = e.clientY - this._panStart.y;
        this._updateTransform();
      }

      if (this._selectionRect) {
        const sx = Math.min(this._selectionRect.startX, e.clientX);
        const sy = Math.min(this._selectionRect.startY, e.clientY);
        const w = Math.abs(e.clientX - this._selectionRect.startX);
        const h = Math.abs(e.clientY - this._selectionRect.startY);
        this._selectionRectEl.style.left = sx + "px";
        this._selectionRectEl.style.top = sy + "px";
        this._selectionRectEl.style.width = w + "px";
        this._selectionRectEl.style.height = h + "px";
        if (w > 4 || h > 4) {
          this._selectionRectEl.style.display = "block";
          this._canvas.style.cursor = "crosshair";
          this._updateSelectionFromRect(sx, sy, w, h);
        }
      }

      if (this._connecting) {
        this._renderTempConnection(e);
      }
    });

    this._canvas.addEventListener("mouseup", (e) => {
      if (this._panning) {
        this._panning = false;
        this._canvas.style.cursor = "";
      }

      if (this._selectionRect) {
        const w = Math.abs(e.clientX - this._selectionRect.startX);
        const h = Math.abs(e.clientY - this._selectionRect.startY);
        // If it was just a click (no significant drag), show context menu
        if (w < 5 && h < 5) {
          if (!e.shiftKey) this._clearSelection();
          this._showContextMenu(e.clientX, e.clientY);
        }
        this._selectionRect = null;
        this._selectionRectEl.style.display = "none";
        this._canvas.style.cursor = "";
      }

      if (this._connecting) {
        this._cancelConnection();
      }
    });

    // Prevent middle-click default (auto-scroll)
    this._canvas.addEventListener("auxclick", (e) => {
      if (e.button === 1) e.preventDefault();
    });
  }

  _updateSelectionFromRect(rx, ry, rw, rh) {
    for (const node of this._nodes) {
      if (!node._el) continue;
      const rect = node._el.getBoundingClientRect();
      const overlaps =
        rect.left < rx + rw &&
        rect.right > rx &&
        rect.top < ry + rh &&
        rect.bottom > ry;

      if (overlaps) {
        this._selectedNodes.add(node.id);
        node._el.classList.add("selected");
      } else if (!this._selectionRect._shift) {
        this._selectedNodes.delete(node.id);
        node._el.classList.remove("selected");
      }
    }
  }

  _clearSelection() {
    for (const nodeId of this._selectedNodes) {
      const node = this._nodes.find(n => n.id === nodeId);
      if (node?._el) node._el.classList.remove("selected");
    }
    this._selectedNodes.clear();
  }

  _paintLegend() {
    const lines = [
      ["Drag", "Pan"],
      ["Right+Drag", "Select nodes"],
      ["Shift+Right+Drag", "Add to selection"],
      ["Shift+Click", "Toggle node"],
      ["Scroll", "Zoom"],
      ["Right-click", "Add node"],
    ];

    // Parse color and create a lighten helper (t: 0=original, 1=light, capped below white)
    let hex = (this._highlightColor || "#ffaa20").replace("#", "");
    if (hex.length === 3) hex = hex[0]+hex[0]+hex[1]+hex[1]+hex[2]+hex[2];
    const hr = parseInt(hex.substring(0, 2), 16);
    const hg = parseInt(hex.substring(2, 4), 16);
    const hb = parseInt(hex.substring(4, 6), 16);
    const lighten = (t) => {
      const r = Math.min(Math.round(hr + (200 - hr) * t), 200);
      const g = Math.min(Math.round(hg + (200 - hg) * t), 200);
      const b = Math.min(Math.round(hb + (200 - hb) * t), 200);
      return `#${((1<<24)|(r<<16)|(g<<8)|b).toString(16).slice(1)}`;
    };

    // Measure key widths using a temporary canvas context
    const measure = document.createElement("canvas").getContext("2d");
    measure.font = "10px monospace";
    const lineH = 18;
    const pad = 10;
    const keyH = 14;
    const keyPadX = 4;
    const keyGap = 3;
    const descGap = 6;

    // Pre-compute layout for each line
    const layout = lines.map(([keyStr, desc]) => {
      const keys = keyStr.split("+");
      const keyWidths = keys.map(k => measure.measureText(k).width + keyPadX * 2);
      const totalKeysW = keyWidths.reduce((a, b) => a + b, 0) + (keys.length - 1) * keyGap;
      return { keys, keyWidths, totalKeysW, desc };
    });

    const maxW = Math.max(...layout.map(l => l.totalKeysW + descGap + measure.measureText(" ··· " + l.desc).width)) + pad * 2;
    const w = Math.ceil(maxW);
    const h = lines.length * lineH + pad * 2;

    let rects = "";
    let texts = "";
    for (let i = 0; i < layout.length; i++) {
      const { keys, keyWidths, totalKeysW, desc } = layout[i];
      const baseY = pad + i * lineH;
      const textY = baseY + keyH - 3;
      let kx = pad;
      for (let j = 0; j < keys.length; j++) {
        rects += `<rect x="${kx}" y="${baseY}" width="${keyWidths[j]}" height="${keyH}" rx="2" ry="2" fill="transparent" stroke="${lighten(0.4)}" stroke-width="0.5"/>`;
        texts += `<text x="${kx + keyPadX}" y="${textY}" font-family="monospace" font-size="10" fill="${lighten(0.5)}">${keys[j]}</text>`;
        kx += keyWidths[j] + keyGap;
      }
      const afterKeys = pad + totalKeysW;
      texts += `<text x="${afterKeys}" y="${textY}" font-family="monospace" font-size="10"><tspan fill="${lighten(0.2)}"> ··· </tspan><tspan fill="${lighten(0.35)}">${desc}</tspan></text>`;
    }

    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">${rects}${texts}</svg>`;
    this._legendURI = `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
    this._legendW = w;
    this._updateTransform();
  }

  _updateTransform() {
    this._inner.style.transform = `translate(${this._pan.x}px, ${this._pan.y}px) scale(${this._zoom})`;
    const gridSize = `${20 * this._zoom}px ${20 * this._zoom}px`;
    if (this._legendURI) {
      this._canvas.style.backgroundImage = `radial-gradient(circle, rgba(255,255,255,0.03) 1px, transparent 1px), ${this._legendURI}`;
      this._canvas.style.backgroundPosition = `${this._pan.x}px ${this._pan.y}px, left 8px bottom 8px`;
      this._canvas.style.backgroundSize = `${gridSize}, ${this._legendW}px auto`;
      this._canvas.style.backgroundRepeat = "repeat, no-repeat";
    } else {
      this._canvas.style.backgroundPosition = `${this._pan.x}px ${this._pan.y}px`;
      this._canvas.style.backgroundSize = gridSize;
    }
  }

  _recenter() {
    if (this._nodes.length === 0) {
      this._pan = { x: this._canvas.clientWidth / 2, y: this._canvas.clientHeight / 2 };
    } else {
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      for (const n of this._nodes) {
        const w = n._el ? n._el.offsetWidth : 140;
        const h = n._el ? n._el.offsetHeight : 60;
        if (n.x < minX) minX = n.x;
        if (n.y < minY) minY = n.y;
        if (n.x + w > maxX) maxX = n.x + w;
        if (n.y + h > maxY) maxY = n.y + h;
      }
      const cx = (minX + maxX) / 2;
      const cy = (minY + maxY) / 2;
      this._pan = {
        x: this._canvas.clientWidth / 2 - cx,
        y: this._canvas.clientHeight / 2 - cy,
      };
    }

    this._inner.style.transition = "transform 0.3s ease";
    this._zoom = 1;
    this._updateTransform();
    setTimeout(() => { this._inner.style.transition = ""; }, 300);
  }

  // --- Zoom ---

  _setupZoom() {
    this._canvas.addEventListener("wheel", (e) => {
      e.preventDefault();
      const delta = e.deltaY > 0 ? -0.1 : 0.1;
      const newZoom = Math.min(3, Math.max(0.2, this._zoom + delta));

      // Zoom toward mouse position
      const rect = this._canvas.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;

      // Adjust pan so the point under the cursor stays fixed
      this._pan.x = mx - (mx - this._pan.x) * (newZoom / this._zoom);
      this._pan.y = my - (my - this._pan.y) * (newZoom / this._zoom);
      this._zoom = newZoom;

      this._updateTransform();
    }, { passive: false });
  }

  _setupContextMenu() {
    document.addEventListener("click", () => this._hideContextMenu());

    // Suppress native context menu on canvas – right-click is handled in mouseup
    this._canvas.addEventListener("contextmenu", (e) => {
      if (e.target !== this._canvas && e.target !== this._inner) return;
      e.preventDefault();
    });
  }

  _showContextMenu(x, y) {
    this._buildContextMenuItems();
    const hostRect = this.getBoundingClientRect();
    let left = x - hostRect.left;
    let top = y - hostRect.top;
    this._contextMenu.style.left = left + "px";
    this._contextMenu.style.top = top + "px";
    this._contextMenu.classList.add("visible");

    // Clamp within the circuitry box boundaries
    const menuRect = this._contextMenu.getBoundingClientRect();
    if (menuRect.right > hostRect.right) {
      left -= menuRect.right - hostRect.right;
    }
    if (menuRect.bottom > hostRect.bottom) {
      top -= menuRect.bottom - hostRect.bottom;
    }
    if (left < 0) left = 0;
    if (top < 0) top = 0;
    this._contextMenu.style.left = left + "px";
    this._contextMenu.style.top = top + "px";

    this._bindContextMenuClicks();
  }

  _buildContextMenuItems() {
    const pixelPattern = /^pixel:(?:([^:]*):)?(\d+)-(\d+)$/;
    const levers = [];
    const adapters = [];
    for (const [name, dev] of Object.entries(this._devices)) {
      if (name.startsWith("watch:")) continue;
      if (pixelPattern.test(name)) continue; // pixel levers handled by screen nodes
      if (dev.type === "lever") levers.push(name);
      else if (dev.type === "adapter") adapters.push(name);
    }
    levers.sort();
    adapters.sort();

    let html = "";

    if (levers.length) {
      let items = "";
      for (const name of levers) {
        items += `<div class="context-menu-item" data-type="lever" data-device="${name}">${name}</div>`;
      }
      html += `<div class="context-menu-accordion">
        <div class="context-menu-accordion-trigger">
          <span>Levers (${levers.length})</span>
          <span class="context-menu-accordion-arrow">&#9654;</span>
        </div>
        <div class="context-menu-accordion-body">${items}</div>
      </div>`;
    }

    if (adapters.length) {
      let items = "";
      for (const name of adapters) {
        items += `<div class="context-menu-item" data-type="adapter" data-device="${name}">${name}</div>`;
      }
      html += `<div class="context-menu-accordion">
        <div class="context-menu-accordion-trigger">
          <span>Adapters (${adapters.length})</span>
          <span class="context-menu-accordion-arrow">&#9654;</span>
        </div>
        <div class="context-menu-accordion-body">${items}</div>
      </div>`;
    }

    // Discover screens from pixel:* levers
    const screenIds = new Set();
    for (const name of Object.keys(this._devices)) {
      const m = pixelPattern.exec(name);
      if (m) screenIds.add(m[1] || "");
    }
    const screens = [...screenIds].sort();

    if (screens.length) {
      let items = "";
      for (const sid of screens) {
        const label = sid || "(default)";
        items += `<div class="context-menu-item" data-type="screen" data-device="${sid}">${label}</div>`;
      }
      html += `<div class="context-menu-accordion">
        <div class="context-menu-accordion-trigger">
          <span>Screens (${screens.length})</span>
          <span class="context-menu-accordion-arrow">&#9654;</span>
        </div>
        <div class="context-menu-accordion-body">${items}</div>
      </div>`;
    }

    if (!levers.length && !adapters.length && !screens.length) {
      html += `<div class="context-menu-header">No devices found</div>`;
    }

    // Separator + re-center
    html += `<div style="border-top:1px solid #3a3a34;margin:4px 0;"></div>`;
    html += `<div class="context-menu-item" data-action="recenter">Re-center</div>`;

    this._contextMenu.innerHTML = html;
  }

  _bindContextMenuClicks() {
    for (const trigger of this._contextMenu.querySelectorAll(".context-menu-accordion-trigger")) {
      trigger.addEventListener("click", (e) => {
        e.stopPropagation();
        trigger.parentElement.classList.toggle("open");
      });
    }

    for (const item of this._contextMenu.querySelectorAll(".context-menu-item")) {
      item.addEventListener("click", (e) => {
        e.stopPropagation();
        if (item.dataset.action === "recenter") {
          this._recenter();
        } else {
          const type = item.dataset.type;
          const device = item.dataset.device || null;
          this._addNode(type, device);
        }
        this._hideContextMenu();
      });
    }
  }

  _hideContextMenu() {
    this._contextMenu.classList.remove("visible");
  }

  _addNode(type, deviceName) {
    // Place near center of current view
    const cx = ((-this._pan.x + this._canvas.clientWidth / 2) / this._zoom) | 0;
    const cy = ((-this._pan.y + this._canvas.clientHeight / 2) / this._zoom) | 0;

    const id = `node-${this._nextNodeId++}`;
    const config = {};
    if (type === "screen" && deviceName != null) {
      config.screenId = deviceName || null;
    } else if (deviceName) {
      config.device = deviceName;
    }

    const node = {
      id,
      type,
      x: cx - 60,
      y: cy - 20,
      config,
    };

    this._nodes.push(node);
    this._renderNode(node);
  }

  // --- Node Rendering ---

  _renderNode(node) {
    const el = document.createElement("div");
    el.className = "node";
    el.style.left = node.x + "px";
    el.style.top = node.y + "px";
    el.dataset.nodeId = node.id;
    node._el = el;

    const headerClass = this._nodeHeaderClass(node.type);
    const displayName = this._nodeDisplayName(node.type);

    const ports = this._getNodePorts(node.type, node.config);
    const surfaceManaged = this._isSurfaceManaged(node);

    let portsHTML = "";
    ports.inputs.forEach((p, i) => {
      portsHTML += `<div class="port input-port" data-port-type="input" data-port-index="${i}"></div>`;
    });
    ports.outputs.forEach((p, i) => {
      portsHTML += `<div class="port output-port" data-port-type="output" data-port-index="${i}"></div>`;
    });

    const bodyContent = this._nodeBodyContent(node);
    const deleteBtn = surfaceManaged
      ? "" // Surface-managed nodes can't be deleted from circuitry view
      : `<span class="node-delete" title="Delete node">\u2715</span>`;

    el.innerHTML = `
      <div class="node-header ${headerClass}">
        <span>${displayName}</span>
        ${deleteBtn}
      </div>
      <div class="node-body">${bodyContent}</div>
      ${portsHTML}
    `;

    // Drag (single or multi-selected)
    el.addEventListener("mousedown", (e) => {
      if (e.button !== 0) return;
      if (e.target.classList.contains("port")) return;
      // Allow delete clicks only when not multi-selected
      if (e.target.classList.contains("node-delete") && this._selectedNodes.size <= 1) return;
      e.stopPropagation();

      const isSelected = this._selectedNodes.has(node.id);
      const multiSelected = this._selectedNodes.size > 1;

      if (e.shiftKey) {
        // Toggle selection
        if (isSelected) {
          this._selectedNodes.delete(node.id);
          el.classList.remove("selected");
        } else {
          this._selectedNodes.add(node.id);
          el.classList.add("selected");
        }
        return;
      }

      if (!isSelected) {
        // Clicking an unselected node clears selection and selects just this one
        this._clearSelection();
      }

      // Determine which nodes to drag
      const dragging = isSelected && multiSelected
        ? this._nodes.filter(n => this._selectedNodes.has(n.id))
        : [node];

      // Compute offset for each dragged node
      const offsets = new Map();
      for (const n of dragging) {
        offsets.set(n.id, {
          x: e.clientX - n.x * this._zoom - this._pan.x,
          y: e.clientY - n.y * this._zoom - this._pan.y,
        });
        if (n._el) n._el.style.zIndex = "5";
      }

      const onMove = (ev) => {
        for (const n of dragging) {
          const off = offsets.get(n.id);
          n.x = (ev.clientX - off.x - this._pan.x) / this._zoom;
          n.y = (ev.clientY - off.y - this._pan.y) / this._zoom;
          if (n._el) {
            n._el.style.left = n.x + "px";
            n._el.style.top = n.y + "px";
          }
        }
        this._renderConnections();
      };

      const onUp = () => {
        for (const n of dragging) {
          if (n._el) n._el.style.zIndex = "2";
        }
        document.removeEventListener("mousemove", onMove);
        document.removeEventListener("mouseup", onUp);
      };

      document.addEventListener("mousemove", onMove);
      document.addEventListener("mouseup", onUp);
    });

    // Delete (not available for surface-managed nodes)
    const deleteEl = el.querySelector(".node-delete");
    if (deleteEl) {
      deleteEl.addEventListener("click", (e) => {
        e.stopPropagation();
        this._deleteNode(node.id);
      });
    }

    // Label override toggle + text input
    const labelToggle = el.querySelector(".label-override-toggle");
    const labelInput = el.querySelector(".label-input");
    if (labelToggle) {
      labelToggle.addEventListener("mousedown", (e) => e.stopPropagation());
      labelToggle.addEventListener("change", () => {
        if (!node.config) node.config = {};
        node.config.overwriteText = labelToggle.checked;
        labelInput.disabled = !labelToggle.checked;
        labelInput.style.opacity = labelToggle.checked ? "" : "0.4";
        // Show/hide resolved device name
        const resolved = this._resolveConnectedDeviceName(node);
        const resolvedEl = el.querySelector(".label-resolved");
        if (!labelToggle.checked && resolved) {
          if (resolvedEl) {
            resolvedEl.textContent = resolved;
          } else {
            const div = document.createElement("div");
            div.className = "label-resolved";
            div.textContent = resolved;
            el.querySelector(".node-body").appendChild(div);
          }
        } else if (resolvedEl) {
          resolvedEl.remove();
        }
      });
    }
    if (labelInput) {
      labelInput.addEventListener("mousedown", (e) => e.stopPropagation());
      labelInput.addEventListener("input", () => {
        if (!node.config) node.config = {};
        node.config.text = labelInput.value;
      });
    }

    // Toggle parameter selects
    const toggleOrientation = el.querySelector(".toggle-orientation");
    if (toggleOrientation) {
      toggleOrientation.addEventListener("mousedown", (e) => e.stopPropagation());
      toggleOrientation.addEventListener("change", () => {
        if (!node.config) node.config = {};
        node.config.orientation = toggleOrientation.value;
        this._emitToggleConfigChange(node);
      });
    }
    const toggleStyle = el.querySelector(".toggle-style");
    if (toggleStyle) {
      toggleStyle.addEventListener("mousedown", (e) => e.stopPropagation());
      toggleStyle.addEventListener("change", () => {
        if (!node.config) node.config = {};
        node.config.style = toggleStyle.value;
        this._emitToggleConfigChange(node);
      });
    }
    const toggleSize = el.querySelector(".toggle-size");
    if (toggleSize) {
      toggleSize.addEventListener("mousedown", (e) => e.stopPropagation());
      toggleSize.addEventListener("change", () => {
        if (!node.config) node.config = {};
        node.config.size = toggleSize.value;
        this._emitToggleConfigChange(node);
      });
    }

    // Rainbow FPS input
    const rainbowFps = el.querySelector(".rainbow-fps");
    if (rainbowFps) {
      rainbowFps.addEventListener("mousedown", (e) => e.stopPropagation());
      rainbowFps.addEventListener("change", () => {
        if (!node.config) node.config = {};
        const val = parseFloat(rainbowFps.value);
        node.config.fps = val > 0 ? val : 2;
        this._emitToggleConfigChange(node);
      });
    }

    // Camera controls
    const cameraConnectBtn = el.querySelector(".camera-connect-btn");
    if (cameraConnectBtn) {
      cameraConnectBtn.addEventListener("mousedown", (e) => e.stopPropagation());
      cameraConnectBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        this._emitCameraConfigChange(node, "connect");
      });
    }
    const cameraFps = el.querySelector(".camera-fps");
    if (cameraFps) {
      cameraFps.addEventListener("mousedown", (e) => e.stopPropagation());
      cameraFps.addEventListener("change", () => {
        if (!node.config) node.config = {};
        const val = parseInt(cameraFps.value);
        node.config.fps = val > 0 ? val : DEFAULT_FPS;
        this._emitCameraConfigChange(node, "fps");
      });
    }
    const cameraThreshold = el.querySelector(".camera-threshold");
    if (cameraThreshold) {
      cameraThreshold.addEventListener("mousedown", (e) => e.stopPropagation());
      cameraThreshold.addEventListener("change", () => {
        if (!node.config) node.config = {};
        const val = parseInt(cameraThreshold.value);
        node.config.threshold = (val >= 0 && val <= 255) ? val : DEFAULT_THRESHOLD;
        this._emitCameraConfigChange(node, "threshold");
      });
    }

    // Screen node: screen ID input
    const screenIdInput = el.querySelector(".screen-id-input");
    if (screenIdInput) {
      screenIdInput.addEventListener("mousedown", (e) => e.stopPropagation());
      screenIdInput.addEventListener("change", () => {
        if (!node.config) node.config = {};
        const val = screenIdInput.value.trim();
        node.config.screenId = val || null;
        this._emitChange();
      });
    }

    // Port connections (disabled when multi-selected)
    for (const port of el.querySelectorAll(".port")) {
      this._attachPortHandlers(node, port);
    }

    this._inner.appendChild(el);

    // Queue deferred port layout — batches multiple _renderNode calls into one rAF
    this._pendingLayout = this._pendingLayout || [];
    this._pendingLayout.push(node);
    if (!this._layoutRafId) {
      this._layoutRafId = requestAnimationFrame(() => {
        for (const n of this._pendingLayout) this._layoutPorts(n);
        this._pendingLayout = null;
        this._layoutRafId = null;
        this._renderConnections();
      });
    }
  }

  /** Attach connection handlers to a single port element */
  _attachPortHandlers(node, port) {
    port.addEventListener("mousedown", (e) => {
      if (this._selectedNodes.size > 1) return;
      e.stopPropagation();
      const portType = port.dataset.portType;
      const portIndex = parseInt(port.dataset.portIndex);

      if (portType === "output") {
        const start = this._portCenter(node, "output", portIndex);
        this._connecting = {
          nodeId: node.id,
          portType: "output",
          portIndex,
          startX: start.x,
          startY: start.y,
        };
      }
    });

    port.addEventListener("mouseup", (e) => {
      if (this._selectedNodes.size > 1) return;
      e.stopPropagation();
      if (this._connecting && port.dataset.portType === "input") {
        const targetNodeId = node.id;
        if (this._connecting.nodeId !== targetNodeId) {
          this._edges.push({
            from: this._connecting.nodeId,
            fromPort: `out-${this._connecting.portIndex}`,
            to: targetNodeId,
            toPort: `in-${port.dataset.portIndex}`,
          });
          this._renderConnections();
        }
        this._connecting = null;
        this._removeTempConnection();
      }
    });

    port.addEventListener("contextmenu", (e) => {
      e.preventDefault();
      e.stopPropagation();
      const portType = port.dataset.portType;
      const portIndex = parseInt(port.dataset.portIndex);
      const portKey = portType === "output" ? `out-${portIndex}` : `in-${portIndex}`;

      const count = this._edges.filter(edge =>
        (portType === "output" && edge.from === node.id && edge.fromPort === portKey) ||
        (portType === "input" && edge.to === node.id && edge.toPort === portKey)
      ).length;

      if (count === 0) return;

      const menu = document.createElement("div");
      menu.className = "ctx-menu";
      menu.style.left = e.clientX + "px";
      menu.style.top = e.clientY + "px";

      const item = document.createElement("div");
      item.className = "ctx-menu-item ctx-menu-delete";
      item.innerHTML = `<span class="ctx-menu-delete-icon">&#x2716;</span> <span>Disconnect ${count > 1 ? `all ${count}` : ""}</span>`;
      item.addEventListener("click", () => {
        this._edges = this._edges.filter(edge =>
          !((portType === "output" && edge.from === node.id && edge.fromPort === portKey) ||
            (portType === "input" && edge.to === node.id && edge.toPort === portKey))
        );
        this._renderConnections();
        menu.remove();
      });
      menu.appendChild(item);
      document.body.appendChild(menu);

      const hostRect = this.getBoundingClientRect();
      const menuRect = menu.getBoundingClientRect();
      if (menuRect.right > hostRect.right) menu.style.left = (e.clientX - menuRect.width) + "px";
      if (menuRect.bottom > hostRect.bottom) menu.style.top = (e.clientY - menuRect.height) + "px";

      const dismiss = () => { menu.remove(); document.removeEventListener("click", dismiss); };
      document.addEventListener("click", dismiss);
    });
  }

  /** Position port dots vertically, centered in the node body */
  _layoutPorts(node) {
    const el = node._el;
    if (!el) return;

    const header = el.querySelector(".node-header");
    const body = el.querySelector(".node-body");
    const headerH = header ? header.offsetHeight : 22;
    const bodyH = body ? body.offsetHeight : 28;
    const ports = el.querySelectorAll(".port");
    if (!ports.length) return;

    const portSize = 14; // 10px + 2px border each side
    const portSpacing = 25;
    const totalPortsH = (ports.length - 1) * portSpacing + portSize;
    // Center the port block vertically within the body area
    const startY = headerH + Math.max(0, (bodyH - totalPortsH) / 2);

    for (const port of ports) {
      const idx = parseInt(port.dataset.portIndex) || 0;
      port.style.top = (startY + idx * portSpacing) + "px";
    }
  }

  /** Emit camera config change so parent component can update surface element */
  _emitCameraConfigChange(node, changeType) {
    this.dispatchEvent(new CustomEvent("camera-config-change", {
      bubbles: true,
      detail: { ...node.config, changeType },
    }));
    this._emitChange();
  }

  /** Generic change notification for config persistence */
  _emitChange() {
    this.dispatchEvent(new CustomEvent("circuitry-data-change", { bubbles: true }));
  }

  /** Get canvas-space center of a port element by reading its actual rendered position */
  _portCenter(node, portType, portIndex) {
    const sel = `.port.${portType}-port[data-port-index="${portIndex}"]`;
    const portEl = node._el?.querySelector(sel);
    if (!portEl) return { x: node.x, y: node.y + 30 };

    const portRect = portEl.getBoundingClientRect();
    const canvasRect = this._canvas.getBoundingClientRect();

    return {
      x: (portRect.left + portRect.width / 2 - canvasRect.left - this._pan.x) / this._zoom,
      y: (portRect.top + portRect.height / 2 - canvasRect.top - this._pan.y) / this._zoom,
    };
  }

  /** Public API: add a node from external data (e.g. surface registration) */
  addExternalNode(nodeData) {
    if (this._nodes.find(n => n.id === nodeData.id)) return;
    const node = { ...nodeData, _el: null };
    this._nodes.push(node);
    this._renderNode(node);
  }

  /** Emit toggle config change so the parent component can update constraints live */
  _emitToggleConfigChange(node) {
    this.dispatchEvent(new CustomEvent("toggle-config-change", {
      bubbles: true,
      detail: {
        surfaceId: node.config?.surfaceId,
        orientation: node.config?.orientation || "vertical",
        style: node.config?.style || "squared",
        size: node.config?.size || "medium",
      },
    }));
  }

  /** Public API: remove a node and its edges by ID */
  removeNode(nodeId) {
    this._deleteNode(nodeId);
  }

  _deleteNode(nodeId) {
    this._nodes = this._nodes.filter(n => {
      if (n.id === nodeId && n._el) {
        n._el.remove();
      }
      return n.id !== nodeId;
    });
    this._edges = this._edges.filter(e => e.from !== nodeId && e.to !== nodeId);
    this._renderConnections();
  }

  _nodeDisplayName(type) {
    const names = {
      lever: "Lever",
      adapter: "Adapter",
      screen: "Screen",
      "surface-led": "LED",
      "surface-toggle": "Toggle",
      "surface-dial": "Dial",
      "surface-label": "Label",
      "surface-alert": "Alert",
      "surface-rainbow": "Rainbow",
      "surface-camera": "Camera",
    };
    return names[type] || type;
  }

  _nodeHeaderClass(type) {
    if (type === "lever") return "output";    // amber — can read & write
    if (type === "adapter") return "input";   // green — read-only signal
    if (type === "screen") return "output";   // amber — receives pixel stream
    if (type.startsWith("surface-")) return "transform"; // blue — surface component
    return "input";
  }

  _getNodePorts(type, config) {
    // Surface-managed nodes carry their port definitions in config
    if (config?.ports) {
      return config.ports;
    }
    switch (type) {
      case "lever":
        return { inputs: ["set"], outputs: ["state"] };
      case "adapter":
        return { inputs: [], outputs: ["state"] };
      case "screen":
        return { inputs: ["stream"], outputs: [] };
      default:
        return { inputs: ["in"], outputs: ["out"] };
    }
  }

  _isSurfaceManaged(node) {
    return !!(node.config?.surfaceManaged);
  }

  _nodeBodyContent(node) {
    if (node.type === "surface-label") {
      const text = node.config?.text || "";
      const overwrite = !!node.config?.overwriteText;
      const resolved = this._resolveConnectedDeviceName(node);
      const resolvedHTML = resolved
        ? `<div class="label-resolved">${resolved}</div>`
        : "";
      return `
        <div class="label-text-row">
          <input class="label-input" type="text" value="${text.replace(/"/g, '&quot;')}" placeholder="${resolved || 'label text'}" ${overwrite ? "" : "disabled"} style="${overwrite ? "" : "opacity:0.4;"}" />
          <input type="checkbox" class="label-override-toggle" title="Override device name" ${overwrite ? "checked" : ""} />
        </div>
        ${overwrite ? "" : resolvedHTML}`;
    }
    if (node.type === "surface-toggle") {
      const label = node.config?.label || node.config?.surfaceId || "—";
      const orientation = node.config?.orientation || "vertical";
      const style = node.config?.style || "squared";
      const size = node.config?.size || "medium";
      return `
        <span style="color:#60a0ff;">${label}</span>
        <div class="node-param-row">
          <span class="node-param-label">dir</span>
          <select class="node-select toggle-orientation">
            <option value="vertical"${orientation === "vertical" ? " selected" : ""}>vertical</option>
            <option value="horizontal"${orientation === "horizontal" ? " selected" : ""}>horizontal</option>
          </select>
        </div>
        <div class="node-param-row">
          <span class="node-param-label">style</span>
          <select class="node-select toggle-style">
            <option value="squared"${style === "squared" ? " selected" : ""}>squared</option>
            <option value="rounded"${style === "rounded" ? " selected" : ""}>rounded</option>
          </select>
        </div>
        <div class="node-param-row">
          <span class="node-param-label">size</span>
          <select class="node-select toggle-size">
            <option value="small"${size === "small" ? " selected" : ""}>small</option>
            <option value="medium"${size === "medium" ? " selected" : ""}>medium</option>
            <option value="large"${size === "large" ? " selected" : ""}>large</option>
          </select>
        </div>`;
    }
    if (node.type === "surface-camera") {
      const label = node.config?.label || node.config?.surfaceId || "—";
      const fps = node.config?.fps || DEFAULT_FPS;
      const threshold = node.config?.threshold ?? DEFAULT_THRESHOLD;
      return `
        <span style="color:#60a0ff;">${label}</span>
        <div class="node-param-row">
          <button class="camera-btn camera-connect-btn">&#9654; Connect Camera</button>
        </div>
        <div class="node-param-row">
          <span class="node-param-label">fps</span>
          <input class="node-select camera-fps" type="number" min="1" max="30" step="1" value="${fps}" style="width:60px;" />
        </div>
        <div class="node-param-row">
          <span class="node-param-label">threshold</span>
          <input class="node-select camera-threshold" type="number" min="0" max="255" step="1" value="${threshold}" style="width:60px;" />
        </div>`;
    }
    if (node.type === "screen") {
      const screenId = node.config?.screenId || "";
      const w = node.config?._screenWidth || 0;
      const h = node.config?._screenHeight || 0;
      const count = node.config?._pixelCount || 0;
      const resText = w && h ? `${w}\u00d7${h}` : "no pixels";
      return `
        <div class="node-param-row">
          <span class="node-param-label">id</span>
          <input class="node-select screen-id-input" type="text" value="${screenId.replace(/"/g, '&quot;')}" placeholder="default" style="width:80px;" />
        </div>
        <div class="node-param-row" style="color:#555;font-size:0.5rem;">
          ${resText} (${count} px)
        </div>`;
    }
    if (node.type === "surface-rainbow") {
      const label = node.config?.label || node.config?.surfaceId || "—";
      const fps = node.config?.fps || 2;
      return `
        <span style="color:#60a0ff;">${label}</span>
        <div class="node-param-row">
          <span class="node-param-label">fps</span>
          <input class="node-select rainbow-fps" type="number" min="1" step="1" value="${fps}" style="width:60px;" />
        </div>`;
    }
    if (node.type.startsWith("surface-")) {
      const label = node.config?.label || node.config?.surfaceId || "—";
      return `<span style="color:#60a0ff;">${label}</span>`;
    }
    switch (node.type) {
      case "lever":
      case "adapter":
        return `<span style="color:#8a8a7a;">${node.config?.device || "—"}</span>`;
      default:
        return "";
    }
  }

  _resolveConnectedDeviceName(node) {
    // Find a device connected to this node's input port
    for (const edge of this._edges) {
      if (edge.to === node.id) {
        const sourceNode = this._nodes.find(n => n.id === edge.from);
        if (sourceNode?.config?.device) return sourceNode.config.device;
        if (sourceNode?.config?.label) return sourceNode.config.label;
        if (sourceNode?.config?.surfaceId) return sourceNode.config.surfaceId;
      }
    }
    return null;
  }

  _refreshLabelNodes() {
    for (const node of this._nodes) {
      if (node.type !== "surface-label" || !node._el) continue;
      const input = node._el.querySelector(".label-input");
      if (!input) continue;
      const text = node.config?.text || "";
      const resolved = this._resolveConnectedDeviceName(node);
      input.placeholder = resolved || "label text";
      const resolvedEl = node._el.querySelector(".label-resolved");
      if (!text && resolved) {
        if (resolvedEl) {
          resolvedEl.textContent = resolved;
        } else {
          const div = document.createElement("div");
          div.className = "label-resolved";
          div.textContent = resolved;
          node._el.querySelector(".node-body").appendChild(div);
        }
      } else if (resolvedEl) {
        resolvedEl.remove();
      }
    }
  }

  // --- Connections ---

  _renderConnections() {
    let pathsHTML = "";
    for (const edge of this._edges) {
      const fromNode = this._nodes.find(n => n.id === edge.from);
      const toNode = this._nodes.find(n => n.id === edge.to);
      if (!fromNode?._el || !toNode?._el) continue;

      const fromPortIndex = parseInt((edge.fromPort || "out-0").split("-")[1]) || 0;
      const toPortIndex = parseInt((edge.toPort || "in-0").split("-")[1]) || 0;

      const from = this._portCenter(fromNode, "output", fromPortIndex);
      const to = this._portCenter(toNode, "input", toPortIndex);
      const x1 = from.x, y1 = from.y, x2 = to.x, y2 = to.y;

      const dx = Math.abs(x2 - x1) * 0.5;
      const path = `M ${x1} ${y1} C ${x1 + dx} ${y1}, ${x2 - dx} ${y2}, ${x2} ${y2}`;
      pathsHTML += `<path d="${path}" />`;
    }

    this._svg.innerHTML = pathsHTML;
    this._refreshLabelNodes();
  }

  _renderTempConnection(e) {
    if (!this._connecting) return;

    const canvasRect = this._canvas.getBoundingClientRect();
    const x2 = (e.clientX - canvasRect.left - this._pan.x) / this._zoom;
    const y2 = (e.clientY - canvasRect.top - this._pan.y) / this._zoom;
    const x1 = this._connecting.startX;
    const y1 = this._connecting.startY;

    const dx = Math.abs(x2 - x1) * 0.5;
    const path = `M ${x1} ${y1} C ${x1 + dx} ${y1}, ${x2 - dx} ${y2}, ${x2} ${y2}`;

    // Remove old temp
    const old = this._svg.querySelector(".temp-connection");
    if (old) old.remove();

    const pathEl = document.createElementNS("http://www.w3.org/2000/svg", "path");
    pathEl.setAttribute("d", path);
    pathEl.classList.add("temp-connection");
    this._svg.appendChild(pathEl);
  }

  _cancelConnection() {
    this._connecting = null;
    this._removeTempConnection();
  }

  _removeTempConnection() {
    const old = this._svg.querySelector(".temp-connection");
    if (old) old.remove();
  }
}

customElements.define("tb-node-editor", TbNodeEditor);
